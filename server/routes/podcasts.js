const express = require('express');
const pool = require('../models/db');
const authMiddleware = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, WidthType } = require('docx');
const callGPT = require('../utils/callGPT');
const { normalizeText, verifyScriptAgainstSource } = require('./ai');
const { assertPodcastOwner } = require('../utils/ownershipChecks');

const router = express.Router();

// ─── Helper : extrait une section du cleaned_text par index de chapitre ───────
function extractSourceSection(cleanedText, orderIndex) {
    if (!cleanedText) return '';
    // Priorité : découpage par titres markdown ## / # / ###
    const sections = [];
    let current = null;
    for (const line of cleanedText.split('\n')) {
        if (/^#{1,3}\s+/.test(line)) {
            if (current !== null) sections.push(current.join('\n'));
            current = [line];
        } else if (current !== null) {
            current.push(line);
        }
    }
    if (current !== null) sections.push(current.join('\n'));
    if (sections.length > 0) {
        const idx = Math.max(0, Math.min(orderIndex, sections.length - 1));
        return sections[idx].trim();
    }
    // Fallback : découpage par séparateur ---
    const parts = cleanedText.split(/\n\n---\n\n|\n---\n/).map(s => s.trim());
    if (parts.length > 1) {
        const idx = Math.max(0, Math.min(orderIndex, parts.length - 1));
        return parts[idx];
    }
    return cleanedText;
}

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
          'SELECT project_id, order_index FROM podcasts WHERE id = $1',
          [id]
        );
        if (podcastResult.rows.length === 0) {
          return res.status(404).json({ error: 'Podcast non trouvé' });
        }
        const projectId = podcastResult.rows[0].project_id;
        const orderIndex = podcastResult.rows[0].order_index ?? 0;

        const projectResult = await pool.query(
          'SELECT cleaned_text FROM projects WHERE id = $1',
          [projectId]
        );
        const fullText = projectResult.rows[0]?.cleaned_text || '';
        const cleanedText = extractSourceSection(fullText, orderIndex);

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

        // 2. Vérification déterministe via Anthropic (extraction + vérification binaire)
        console.log('[VERIFY] Lancement verifyScriptAgainstSource...');
        const result = await verifyScriptAgainstSource(cleanedText, scriptText);
        console.log(`[VERIFY] Score : ${result.fidelityScore}% (${result.validatedConcepts}/${result.totalConcepts})`);

        const iaFeedback = {
            concepts_manquants: result.missingConcepts,
            informations_erronees: [],
            suggestions: [`${result.validatedConcepts} / ${result.totalConcepts} concepts du cours sont présents dans le podcast.`]
        };

        await pool.query(
            'UPDATE podcasts SET ia_feedback = $1, fidelity_score = $2 WHERE id = $3',
            [JSON.stringify(iaFeedback), result.fidelityScore, id]
        );

        res.json({ success: true, ia_feedback: iaFeedback, fidelity_score: result.fidelityScore });
    } catch (error) {
        console.error('Erreur vérification GPT:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la vérification IA' });
    }
});

// Génération audio TTS — en attente de configuration n8n
router.post('/:id/generate-audio', authMiddleware, async (req, res) => {
    return res.status(503).json({
        error: 'tts_not_configured',
        message: 'La génération audio est en cours de configuration. Elle sera disponible prochainement.'
    });
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

        // 3. Appel n8n
        console.log('[AUTO-CORRECT] Envoi à n8n, nb dialogues:', dialogues.length, '| nb concepts:', conceptsManquants.length);
        const rawResponse = await callGPT(null, prompt);
        console.log('[AUTO-CORRECT] Réponse n8n reçue:', rawResponse?.substring(0, 300));
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
router.get('/:id/export-word/:mode', async (req, res) => {
    try {
        const { id, mode } = req.params;
        if (mode !== 'studio' && mode !== 'lecture') {
            return res.status(400).json({ error: 'Mode invalide' });
        }

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
        res.setHeader('Content-Disposition', `attachment; filename="${docTitle.replace(/[^a-z0-9_]/gi, '_')}.docx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.send(buffer);
        
    } catch (error) {
        console.error('Erreur lors de la génération Word:', error);
        res.status(500).json({ error: 'Erreur lors de la génération du document Word' });
    }
});

// Export TXT - format Speaker 1/2 pour API Google AI Studio
router.get('/:id/export-txt', async (req, res) => {
    try {
        const { id } = req.params;

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
