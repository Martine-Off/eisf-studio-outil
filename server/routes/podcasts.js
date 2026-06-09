// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
const express = require('express');
const pool = require('../models/db');
const authMiddleware = require('../middleware/auth');
const { queryFallback: authQueryMiddleware } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, WidthType } = require('docx');
const { callWebhook } = require('../utils/callWebhook');
const { generateDialogueMp3 } = require('../utils/callElevenLabs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegStatic);
const { normalizeText } = require('./ai');
const { verifyScriptAgainstSource } = require('../utils/verification');
const { assertPodcastOwner } = require('../utils/ownershipChecks');
const { extractSourceSection } = require('../utils/extractSourceSection');
const { groundingCheck } = require('../utils/groundingCheck');

const devMsg = (msg) => process.env.NODE_ENV !== 'production' ? msg : undefined;

function concatenateMp3s(inputPaths, outputPath) {
    const listPath = outputPath + '.txt';
    fs.writeFileSync(listPath, inputPaths.map(p => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(listPath)
            .inputOptions(['-f', 'concat', '-safe', '0'])
            .outputOptions(['-ar', '44100', '-ac', '1', '-b:a', '128k'])
            .output(outputPath)
            .on('error', (err) => { try { fs.unlinkSync(listPath); } catch {} reject(err); })
            .on('end',   ()    => { try { fs.unlinkSync(listPath); } catch {} resolve(); })
            .run();
    });
}

function trimMp3(inputPath, outputPath, durationSeconds) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .audioCodec('libmp3lame')
            .outputOptions([
                '-t', String(durationSeconds),
                '-ar', '44100',
                '-ac', '1',
                '-b:a', '128k',
            ])
            .output(outputPath)
            .on('error', reject)
            .on('end', resolve)
            .run();
    });
}

// ─── Break-time helpers ──────────────────────────────────────────────────────

const BREAK_DURATIONS = { xs: 0.15, s: 0.25, m: 0.5, l: 0.8, xl: 1.2 };

function parseBreakDuration(timeStr) {
    if (BREAK_DURATIONS[timeStr] !== undefined) return BREAK_DURATIONS[timeStr];
    const ms = timeStr.match(/^([\d.]+)ms$/);
    if (ms) return parseFloat(ms[1]) / 1000;
    const sec = timeStr.match(/^([\d.]+)s?$/);
    return sec ? parseFloat(sec[1]) : 0.5;
}

function splitOnBreaks(text) {
    const segments = [];
    const regex = /<break\s+time="([^"]+)"\s*\/>/g;
    let lastIndex = 0, match;
    while ((match = regex.exec(text)) !== null) {
        const chunk = text.slice(lastIndex, match.index).trim();
        if (chunk) segments.push({ type: 'text', content: chunk });
        segments.push({ type: 'break', duration: parseBreakDuration(match[1]) });
        lastIndex = match.index + match[0].length;
    }
    const tail = text.slice(lastIndex).trim();
    if (tail) segments.push({ type: 'text', content: tail });
    return segments;
}

function generateSilenceMp3(durationSec, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input('anullsrc=r=44100:cl=mono')
            .inputOptions(['-f', 'lavfi'])
            .audioCodec('libmp3lame')
            .outputOptions(['-t', String(durationSec), '-ar', '44100', '-ac', '1', '-b:a', '128k'])
            .output(outputPath)
            .on('error', reject)
            .on('end', resolve)
            .run();
    });
}

const router = express.Router();

// Récupérer tous les podcasts d'un projet
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) {
            return res.status(400).json({ error: 'projectId est requis' });
        }

        const result = await pool.query(
            'SELECT id, title, word_count, duration_seconds, fidelity_score, audio_url, created_at, updated_at FROM podcasts WHERE project_id = $1 ORDER BY order_index ASC NULLS LAST, id ASC',
            [projectId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Erreur récupération podcasts par projet:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Récupérer dialogues d'un podcast
router.get('/:podcastId/dialogues', authMiddleware, async (req, res) => {
    try {
        const { podcastId } = req.params;

        await assertPodcastOwner(podcastId, req.userId);

        const result = await pool.query(
            'SELECT * FROM dialogues WHERE podcast_id = $1 ORDER BY order_index ASC',
            [podcastId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Erreur récupération dialogues:', error);
        res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Erreur serveur' });
    }
});

// Réorganiser dialogues
router.put('/:podcastId/reorder', authMiddleware, async (req, res) => {
    try {
        const { podcastId } = req.params;
        const { dialogues } = req.body; // [{ id, order_index }, ...]

        await assertPodcastOwner(podcastId, req.userId);

        if (!Array.isArray(dialogues)) {
            return res.status(400).json({ error: 'Format invalide' });
        }

        // Mettre à jour en batch
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const d of dialogues) {
                await client.query(
                    'UPDATE dialogues SET order_index = $1 WHERE id = $2 AND podcast_id = $3',
                    [d.order_index, d.id, podcastId]
                );
            }
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Erreur réorganisation:', error);
        res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Erreur serveur' });
    }
});

// Texte source du chapitre correspondant au podcast
router.get('/:id/source-section', authMiddleware, async (req, res) => {
    try {
        const pod = await pool.query(
            `SELECT p.order_index, p.title, proj.cleaned_text
             FROM podcasts p
             JOIN projects proj ON p.project_id = proj.id
             WHERE p.id = $1 AND proj.user_id = $2`,
            [req.params.id, req.userId]
        );
        if (pod.rows.length === 0) {
            return res.status(404).json({ error: 'Podcast non trouvé' });
        }
        const { order_index, cleaned_text, title } = pod.rows[0];
        const section = extractSourceSection(cleaned_text, order_index ?? 0);
        res.json({ source_text: section, order_index: order_index ?? 0, podcast_title: title });
    } catch (error) {
        console.error('Erreur récupération texte source:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Page HTML du texte source d'un podcast (ouverte dans un nouvel onglet)
router.get('/:id/source', authQueryMiddleware, async (req, res) => {
    try {
        const pod = await pool.query(
            `SELECT p.title, p.segment_content, proj.cleaned_text, p.order_index
             FROM podcasts p
             JOIN projects proj ON p.project_id = proj.id
             WHERE p.id = $1 AND proj.user_id = $2`,
            [req.params.id, req.userId]
        );
        if (pod.rows.length === 0) return res.status(404).send('<p>Podcast non trouvé</p>');

        const { title, segment_content, cleaned_text, order_index } = pod.rows[0];
        const raw = segment_content || extractSourceSection(cleaned_text || '', order_index ?? 0) || '';

        const blocks = raw.split(/\n{2,}/);
        const bodyHtml = blocks.map(block => {
            const line = block.trim();
            if (!line) return '';
            const isHeading = line.length < 80 && !/[.!?]$/.test(line) && line.split('\n').length === 1;
            if (isHeading) return `<h2>${line.replace(/\n/g, '<br>')}</h2>`;
            return `<p>${line.replace(/\n/g, '<br>')}</p>`;
        }).join('\n');

        const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Source — ${title || 'Podcast'}</title>
<style>
  body { font-family: Georgia, serif; max-width: 740px; margin: 48px auto; padding: 0 24px 80px; color: #1a1a1a; line-height: 1.75; }
  h1 { font-size: 1.6rem; font-weight: 800; margin-bottom: 0.25em; color: #111; }
  .meta { font-size: 0.8rem; color: #888; margin-bottom: 2.5em; font-family: sans-serif; }
  h2 { font-size: 1.1rem; font-weight: 700; margin-top: 2em; margin-bottom: 0.4em; color: #222; font-family: sans-serif; }
  p { margin: 0 0 1em; font-size: 0.97rem; }
</style>
</head>
<body>
<h1>${title || 'Source du podcast'}</h1>
<p class="meta">Texte source utilisé pour la génération</p>
${bodyHtml}
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    } catch (error) {
        console.error('Erreur GET /source :', error);
        res.status(500).send('<p>Erreur serveur</p>');
    }
});

// Récupérer infos d'un podcast
router.get('/:podcastId', authMiddleware, async (req, res) => {
    try {
        const { podcastId } = req.params;

        // Ownership check : retourne directement les infos via la jointure
        const result = await pool.query(
            `SELECT podcasts.*, projects.title as project_title
             FROM podcasts
             JOIN projects ON podcasts.project_id = projects.id
             WHERE podcasts.id = $1 AND projects.user_id = $2`,
            [podcastId, req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Podcast non trouvé' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erreur récupération podcast:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Renommer un podcast
router.patch('/:podcastId/title', authMiddleware, async (req, res) => {
    try {
        const { podcastId } = req.params;
        const { title } = req.body;
        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Titre requis' });
        }
        await assertPodcastOwner(podcastId, req.userId);
        const result = await pool.query(
            'UPDATE podcasts SET title = $1 WHERE id = $2 RETURNING title, updated_at',
            [title.trim(), podcastId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Podcast non trouvé' });
        }
        const row = result.rows[0];
        res.json({ success: true, title: row.title, updated_at: new Date(row.updated_at).toISOString() });
    } catch (error) {
        console.error('Erreur renommage podcast:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Supprimer un podcast et ses dialogues
router.delete('/:podcastId', authMiddleware, async (req, res) => {
    try {
        const { podcastId } = req.params;
        await assertPodcastOwner(podcastId, req.userId);

        await pool.query('DELETE FROM dialogues WHERE podcast_id = $1', [podcastId]);
        const result = await pool.query('DELETE FROM podcasts WHERE id = $1 RETURNING id', [podcastId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Podcast non trouvé' });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Erreur suppression podcast:', error);
        res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Erreur serveur' });
    }
});

// Export PDF d'un podcast (Placeholder pour l'instant)
router.get('/:id/export/pdf', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        // La logique PDFKit sera ici. En attendant on redirige ou erreur 501.
        res.status(501).json({ error: 'Export PDF bientôt disponible' });
    } catch (error) {
        console.error('Erreur export PDF:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Vérification IA avec OpenAI
router.post('/:id/verify', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // Récupérer le projet lié au podcast + order_index pour extraire la bonne section
        const podcastResult = await pool.query(
          'SELECT project_id, order_index, segment_content FROM podcasts WHERE id = $1',
          [id]
        );
        if (podcastResult.rows.length === 0) {
          return res.status(404).json({ error: 'Podcast non trouvé' });
        }
        const projectId = podcastResult.rows[0].project_id;
        const orderIndex = podcastResult.rows[0].order_index ?? 0;

        let cleanedText = podcastResult.rows[0].segment_content || null;
        if (!cleanedText) {
          const projectResult = await pool.query(
            'SELECT cleaned_text FROM projects WHERE id = $1',
            [projectId]
          );
          cleanedText = extractSourceSection(projectResult.rows[0]?.cleaned_text || '', orderIndex);
        }

        // 1. Récupérer les dialogues
        const dialoguesResult = await pool.query(
            'SELECT character, text_studio FROM dialogues WHERE podcast_id = $1 ORDER BY order_index ASC',
            [id]
        );

        if (dialoguesResult.rows.length === 0) {
            return res.status(404).json({ error: 'Podcast ou dialogues non trouvés' });
        }

        const scriptText = dialoguesResult.rows
            .map(item => `${item.character || 'Intervenant'}: ${item.text_studio || ''}`)
            .join('\n');

        // 2. Vérification déterministe (extraction + vérification binaire)
        // Charger les concepts en cache pour reprendre après un dépassement de quota
        const feedbackRow = await pool.query('SELECT ia_feedback FROM podcasts WHERE id = $1', [id]);
        const cachedConcepts = feedbackRow.rows[0]?.ia_feedback?.cached_concepts || null;
        if (cachedConcepts) console.log(`[VERIFY] ${cachedConcepts.length} concepts en cache — appel 1 Make ignoré`);
        else console.log('[VERIFY] Lancement verifyScriptAgainstSource...');

        const result = await verifyScriptAgainstSource(cleanedText, scriptText, cachedConcepts, async (concepts) => {
            await pool.query(
                "UPDATE podcasts SET ia_feedback = COALESCE(ia_feedback, '{}'::jsonb) || $1::jsonb WHERE id = $2",
                [JSON.stringify({ cached_concepts: concepts }), id]
            );
            console.log(`[VERIFY] ${concepts.length} concepts sauvegardés en DB (protection quota)`);
        });

        // Grounding check AVANT le calcul du score pour que is_grounded = false soit inclus
        if (result.fidelityScore >= 95) {
            console.log('[VERIFY] Lancement grounding check...');
            try {
                await groundingCheck(id, cleanedText);
                console.log('[VERIFY] Grounding check terminé');
            } catch (gcErr) {
                console.error('[VERIFY] Grounding check échoué — pénalité sur données existantes:', gcErr.message);
            }
        }

        // Pénalité -5% par réplique is_grounded = false (grounding check ci-dessus)
        const ungroundedRes = await pool.query(
            'SELECT COUNT(*) FROM dialogues WHERE podcast_id = $1 AND is_grounded = false', [id]
        );
        const ungroundedCount = parseInt(ungroundedRes.rows[0].count) || 0;
        const penalty = ungroundedCount * 5;
        const hasMissing = result.missingConcepts.length > 0;
        const afterPenalty = result.fidelityScore - penalty;
        const capped = hasMissing ? Math.min(afterPenalty, 94) : afterPenalty;
        const finalScore = Math.min(99, Math.max(0, capped));
        console.log(`[VERIFY] Ratio brut : ${result.fidelityScore}% — pénalité : -${penalty}% (${ungroundedCount} non ancrées) — plafond : ${hasMissing ? 94 : 99}% → score final : ${finalScore}%`);

        const iaFeedback = {
            concepts_manquants: result.missingConcepts,
            concepts_incertains: result.uncertainConceptsList ?? [],
            cached_concepts: result.extractedConcepts,
            informations_erronees: [],
            suggestions: [`${result.validatedConcepts} / ${result.totalConcepts} concepts du cours sont présents dans le podcast.`]
        };

        await pool.query(
            'UPDATE podcasts SET ia_feedback = $1, fidelity_score = $2 WHERE id = $3',
            [JSON.stringify(iaFeedback), finalScore, id]
        );

        res.json({ success: true, ia_feedback: iaFeedback, fidelity_score: finalScore });
    } catch (error) {
        console.error('Erreur vérification GPT:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la vérification IA' });
    }
});

// Génération audio TTS via ElevenLabs
router.post('/:id/generate-audio', authMiddleware, async (req, res) => {
    try {
        const podcastId = req.params.id;
        await assertPodcastOwner(podcastId, req.userId);

        const podcastMeta = await pool.query('SELECT title FROM podcasts WHERE id = $1', [podcastId]);
        const titleSlug = (podcastMeta.rows[0]?.title || '')
            .toLowerCase()
            .normalize('NFD').replace(/\p{Diacritic}/gu, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .substring(0, 60);
        const fileName = `podcast_${podcastId}_${titleSlug}.mp3`;

        const dialoguesRes = await pool.query(
            'SELECT * FROM dialogues WHERE podcast_id = $1 ORDER BY order_index ASC',
            [podcastId]
        );

        const hasUnresolved = dialoguesRes.rows.some(d =>
            d.text_studio && d.text_studio.includes('[PROPOSITION:')
        );
        if (hasUnresolved) return res.status(400).json({ error: 'propositions_unresolved' });

        const transitionSrc = process.env.TRANSITION_SOUND_PATH
            || path.join(__dirname, '../audio/assets/transition.mp3');
        const trimPaths = [];

        const mp3Paths = [];
        for (const d of dialoguesRes.rows) {
            const rawText = (d.text_studio || '').replace(/\[PROPOSITION:[^\]]*\]/g, '').trim();
            if (!rawText) continue;

            if (d.sound_before && fs.existsSync(transitionSrc)) {
                const trimPath = path.join(__dirname, '../audio', `transition_${podcastId}_${d.id}.mp3`);
                await trimMp3(transitionSrc, trimPath, 3);
                mp3Paths.push(trimPath);
                trimPaths.push(trimPath);
            }

            const processedText = rawText.replace(/<break\s+time="([^"]+)"\s*\/?>/gi, (match, time) => {
                const sec = parseBreakDuration(time);
                return sec < 1.2 ? '...' : match;
            });
            const segments = splitOnBreaks(processedText);
            let partIdx = 0;
            for (const seg of segments) {
                if (seg.type === 'text') {
                    const segId = segments.length === 1 ? d.id : `${d.id}_p${partIdx}`;
                    const prevSeg = segments.slice(0, partIdx).filter(s => s.type === 'text').pop();
                    const nextSeg = segments.slice(partIdx + 1).find(s => s.type === 'text');
                    const filePath = await generateDialogueMp3(seg.content, d.character, podcastId, segId, prevSeg?.content ?? null, nextSeg?.content ?? null);
                    mp3Paths.push(filePath);
                    if (partIdx + 1 < segments.length) await new Promise(r => setTimeout(r, 300));
                } else {
                    const silPath = path.join(__dirname, '../audio', `sil_${podcastId}_${d.id}_${partIdx}.mp3`);
                    await generateSilenceMp3(seg.duration, silPath);
                    mp3Paths.push(silPath);
                    trimPaths.push(silPath);
                }
                partIdx++;
            }
            await new Promise(r => setTimeout(r, 500));
        }

        if (mp3Paths.length === 0)
            return res.status(400).json({ error: 'Aucun dialogue avec text_studio trouvé' });

        const outputPath = path.join(__dirname, '../audio', fileName);
        await concatenateMp3s(mp3Paths, outputPath);
        for (const p of trimPaths) { try { fs.unlinkSync(p); } catch {} }

        const totalWords = dialoguesRes.rows.reduce((sum, d) =>
            sum + (d.text_studio || '').split(/\s+/).length, 0);
        const durationSeconds = Math.round((totalWords / 150) * 60);

        await pool.query(
            'UPDATE podcasts SET duration_seconds = $1, audio_url = $2 WHERE id = $3',
            [durationSeconds, `/audio/${fileName}`, podcastId]
        );

        res.json({ success: true, audioPath: `/audio/${fileName}`, durationSeconds });
    } catch (error) {
        if (error.code === 'ELEVENLABS_QUOTA_EXCEEDED')
            return res.status(429).json({ error: 'quota_elevenlabs_exceeded' });
        console.error('[GENERATE-AUDIO] Erreur:', error);
        res.status(500).json({ error: 'Erreur génération audio', details: devMsg(error.message) });
    }
});

// Auto-correction des dialogues
router.post('/:id/auto-correct', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Récupérer ia_feedback + order_index + project_id
        const podcastResult = await pool.query(
            'SELECT ia_feedback, order_index, project_id FROM podcasts WHERE id = $1',
            [id]
        );

        if (podcastResult.rows.length === 0) {
            return res.status(404).json({ error: 'Podcast non trouvé' });
        }

        const iaFeedback = podcastResult.rows[0].ia_feedback;
        if (!iaFeedback || !iaFeedback.concepts_manquants) {
            return res.status(400).json({ error: 'Aucun concept manquant identifié ou feedback introuvable' });
        }

        const conceptsManquants = iaFeedback.concepts_manquants;

        // Récupérer la section source pour contexte
        const orderIndex = podcastResult.rows[0].order_index ?? 0;
        const projRes = await pool.query('SELECT cleaned_text FROM projects WHERE id = $1', [podcastResult.rows[0].project_id]);
        const sourceSection = extractSourceSection(projRes.rows[0]?.cleaned_text || '', orderIndex);

        // 2. Récupérer tous les dialogues du podcast
        const dialoguesResult = await pool.query(
            'SELECT * FROM dialogues WHERE podcast_id = $1 ORDER BY order_index ASC',
            [id]
        );

        if (dialoguesResult.rows.length === 0) {
            return res.status(404).json({ error: 'Aucun dialogue trouvé' });
        }

        const dialogues = dialoguesResult.rows;

        const prompt = `Tu es un expert pédagogique. CONSIGNE STRICTE : réponds UNIQUEMENT avec le JSON brut, sans texte avant, sans texte après, sans balises markdown, sans explication.

TEXTE SOURCE DU CHAPITRE (référence pédagogique — utilise-le pour vérifier et enrichir) :
${sourceSection}

Voici les dialogues actuels du podcast :
${JSON.stringify(dialogues)}

Voici les concepts manquants à intégrer TOUS et EXHAUSTIVEMENT :
${JSON.stringify(conceptsManquants)}

Voici les informations erronées à corriger TOUTES :
${JSON.stringify(iaFeedback.informations_erronees || [])}

Réécris CHAQUE dialogue en intégrant naturellement ces éléments. Conserve le style Inès/Yannick, le ratio 70/30, et la structure existante.
ATTENTION : Ne modifie JAMAIS le premier et le dernier dialogue s'il s'agit des phrases d'introduction ou de conclusion officielles.

Réponds UNIQUEMENT avec ce JSON brut (aucun autre texte) :
{"dialogues":[{"id":1,"text_studio":"...","text_reading":"..."}]}`;

        // 3. Appel Make webhook
        console.log('[AUTO-CORRECT] Envoi à Make, nb dialogues:', dialogues.length, '| nb concepts:', conceptsManquants.length);
        const rawResponse = await callWebhook({ type: 'auto-correct', prompt });
        if (!rawResponse) throw new Error('MAKE_WEBHOOK_URL non configurée — correction impossible');
        console.log('[AUTO-CORRECT] Réponse Make reçue:', rawResponse?.substring(0, 300));
        const cleaned = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonStart = cleaned.indexOf('{');
        const jsonEnd = cleaned.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1) {
            throw new Error('Réponse IA invalide : JSON introuvable');
        }
        const parsedData = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
        const updatedDialogues = parsedData.dialogues;

        // 5. UPDATE en base de données
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const d of updatedDialogues) {
                const original = dialogues.find(od => od.id === d.id);
                // Ne jamais modifier l'intro et la conclu obligatoires
                if (original && (original.section === 'jingle' || original.section === 'conclusion' || original.text_studio.includes('généré par intelligence artificielle'))) {
                    continue;
                }

                const studioNorm = normalizeText(d.text_studio || '');
                await client.query(
                    'UPDATE dialogues SET text_studio = $1, text_reading = $2 WHERE id = $3 AND podcast_id = $4',
                    [studioNorm, d.text_reading || studioNorm, d.id, id]
                );
            }
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        res.json({ success: true, updated_count: updatedDialogues.length });
    } catch (error) {
        console.error('Erreur auto-correction OpenAI:', error);
        res.status(500).json({ error: "Erreur serveur lors de l'auto-correction" });
    }
});

// Export Word - Studio / Lecture
router.get('/:id/export-word/:mode', authMiddleware, async (req, res) => {
    try {
        const { id, mode } = req.params;
        if (mode !== 'studio' && mode !== 'lecture') {
            return res.status(400).json({ error: 'Mode invalide' });
        }

        await assertPodcastOwner(id, req.userId);

        // 1. Fetch dialogues and podcast info
        const podcastRes = await pool.query('SELECT title FROM podcasts WHERE id = $1', [id]);
        if (podcastRes.rows.length === 0) {
            return res.status(404).json({ error: 'Podcast non trouvé' });
        }
        const podcastTitle = podcastRes.rows[0].title;

        const dialoguesRes = await pool.query(
            'SELECT character, text_studio, text_reading FROM dialogues WHERE podcast_id = $1 ORDER BY order_index ASC',
            [id]
        );
        const dialogues = dialoguesRes.rows;

        // 2. Build Docx based on mode
        let docTitle = podcastTitle + (mode === 'studio' ? ' - Script Studio' : ' - Script Lecture');
        let tableRows = [];

        // Header Row
        if (mode === 'studio') {
            tableRows.push(
                new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Personnage", bold: true })] })] }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Texte Studio", bold: true })] })] }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Durée", bold: true })] })] }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Notes", bold: true })] })] })
                    ]
                })
            );
        } else {
            tableRows.push(
                new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Personnage", bold: true })] })] }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Texte Lecture", bold: true })] })] })
                    ]
                })
            );
        }

        // Content Rows
        dialogues.forEach(d => {
            let cells = [];
            let text = mode === 'studio' ? (d.text_studio || '') : (d.text_reading || d.text_studio || '');

            cells.push(new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: d.character || 'Intervenant', bold: true })] })] }));
            cells.push(new TableCell({ children: [new Paragraph({ text: text })] }));

            if (mode === 'studio') {
                const words = text.trim() ? text.split(/\s+/).length : 0;
                const durationSec = Math.round((words / 150) * 60);
                const formatTime = Math.floor(durationSec / 60) + ':' + (durationSec % 60).toString().padStart(2, '0');
                
                cells.push(new TableCell({ children: [new Paragraph({ text: formatTime })] }));
                cells.push(new TableCell({ children: [new Paragraph({ text: "" })] })); // Notes vide
            }

            tableRows.push(new TableRow({ children: cells }));
        });

        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    new Paragraph({ text: docTitle, heading: HeadingLevel.HEADING_1 }),
                    new Paragraph({ text: " " }), // spacer
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: tableRows
                    })
                ]
            }]
        });

        const buffer = await Packer.toBuffer(doc);
        
        // 3. Send Buffer
        res.setHeader('Content-Disposition', `attachment; filename="${docTitle.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9_\-]/g, '_')}.docx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.send(buffer);
        
    } catch (error) {
        console.error('Erreur lors de la génération Word:', error);
        res.status(500).json({ error: 'Erreur lors de la génération du document Word' });
    }
});

// Export TXT - format Speaker 1/2 pour API Google AI Studio
router.get('/:id/export-txt', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        await assertPodcastOwner(id, req.userId);

        const podcastRes = await pool.query('SELECT title FROM podcasts WHERE id = $1', [id]);
        if (podcastRes.rows.length === 0) return res.status(404).json({ error: 'Podcast non trouvé' });
        const podcastTitle = podcastRes.rows[0].title;

        const dialoguesRes = await pool.query(
            'SELECT character, text_studio FROM dialogues WHERE podcast_id = $1 ORDER BY order_index ASC',
            [id]
        );

        const lines = dialoguesRes.rows.map(d => {
            const speaker = d.character === 'ines' ? 'Speaker 1' : 'Speaker 2';
            // Retirer les guillemets droits et typographiques
            const text = (d.text_studio || '').replace(/[""“”"]/g, '');
            return `${speaker}: ${text}`;
        });

        const content = lines.join('\n\n');
        const filename = `${podcastTitle.replace(/[^a-z0-9_]/gi, '_')}_speaker.txt`;

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send(content);

    } catch (error) {
        console.error('Erreur export TXT:', error);
        res.status(500).json({ error: 'Erreur lors de la génération du TXT' });
    }
});

module.exports = router;
