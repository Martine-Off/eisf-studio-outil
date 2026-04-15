const express = require('express');
const pool = require('../models/db');
const authMiddleware = require('../middleware/auth');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, WidthType } = require('docx');

const fetch = require('node-fetch');

async function callGemini(systemPrompt, userPrompt) {
    const prompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;
    const response = await fetch('http://localhost:5678/webhook/501bb061-982b-4b25-b782-d137b9ea8916', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
    });
    const data = await response.json();
    const text = data.output?.[0]?.content?.[0]?.text
        || data.message?.content
        || data.text
        || JSON.stringify(data);
    return text.replace(/```json\n?|```/g, '').trim();
}

const router = express.Router();


const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Récupérer tous les podcasts d'un projet
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) {
            return res.status(400).json({ error: 'projectId est requis' });
        }

        const result = await pool.query(
            'SELECT id, title, word_count, duration_seconds, created_at FROM podcasts WHERE project_id = $1 ORDER BY id ASC',
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

        const result = await pool.query(
            'SELECT * FROM dialogues WHERE podcast_id = $1 ORDER BY order_index ASC',
            [podcastId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Erreur récupération dialogues:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Réorganiser dialogues
router.put('/:podcastId/reorder', authMiddleware, async (req, res) => {
    try {
        const { podcastId } = req.params;
        const { dialogues } = req.body; // [{ id, order_index }, ...]

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
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Récupérer infos d'un podcast
router.get('/:podcastId', authMiddleware, async (req, res) => {
    try {
        const { podcastId } = req.params;

        const result = await pool.query(
            'SELECT * FROM podcasts WHERE id = $1',
            [podcastId]
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

        // Récupérer le projet lié au podcast pour avoir le texte source
        const podcastResult = await pool.query(
          'SELECT project_id FROM podcasts WHERE id = $1',
          [id]
        );
        if (podcastResult.rows.length === 0) {
          return res.status(404).json({ error: 'Podcast non trouvé' });
        }
        const projectId = podcastResult.rows[0].project_id;

        const projectResult = await pool.query(
          'SELECT cleaned_text FROM projects WHERE id = $1',
          [projectId]
        );
        const cleanedText = projectResult.rows[0]?.cleaned_text || '';

        // 1. Récupérer les dialogues
        const dialoguesResult = await pool.query(
            'SELECT character, text_studio FROM dialogues WHERE podcast_id = $1 ORDER BY order_index ASC',
            [id]
        );

        if (dialoguesResult.rows.length === 0) {
            return res.status(404).json({ error: 'Podcast ou dialogues non trouvés' });
        }

        const script = dialoguesResult.rows
            .map(item => `${item.character || 'Intervenant'}: ${item.text_studio || ''}`)
            .join('\n');

        // 2. Appel Gemini via n8n
        const geminiPrompt = `Tu dois comparer exhaustivement le cours source et le podcast généré.

MÉTHODE OBLIGATOIRE :
1. Lis le cours source et dresse la liste complète de TOUS les concepts, chiffres, termes techniques, définitions et exemples.
2. Pour chaque élément de cette liste, vérifie s'il est présent dans le podcast.
3. Ne t'arrête pas avant d'avoir vérifié le dernier mot du cours source.

COURS SOURCE (texte de référence) :
${cleanedText}

PODCAST GÉNÉRÉ (à vérifier) :
${script}

Retourne UNIQUEMENT ce JSON valide, sans markdown, sans explication :
{
  "concepts_manquants": ["concept manquant 1 (suffisamment précis pour retrouver dans le cours)", "...TOUS les concepts manquants, sans limite de nombre"],
  "informations_erronees": ["fait déformé : podcast dit X, source dit Y", "...TOUS les faits incorrects"],
  "suggestions": ["suggestion concrète 1", "..."]
}

RÈGLE ABSOLUE : Les listes doivent être COMPLÈTES. S'il y a 20 concepts manquants, tu en listes 20. Ne jamais tronquer.`;

        console.log('[VERIFY] Envoi à n8n...');
        const rawText = await callGemini(
            "Tu es un expert en vérification pédagogique. Ta mission est d'être EXHAUSTIF et CHIRURGICAL. Tu ne t'arrêtes jamais à 5 éléments. Tu parcours l'intégralité du texte source du début à la fin, concept par concept, chiffre par chiffre, terme technique par terme technique. Un oubli de ta part = une erreur pédagogique pour un étudiant.",
            geminiPrompt
        );
        console.log('[VERIFY] Réponse reçue:', rawText?.substring(0, 200));

        // 3. Parser la réponse
        let iaFeedback;
        try {
            iaFeedback = JSON.parse(rawText);
        } catch {
            iaFeedback = {
                concepts_manquants: [],
                informations_erronees: [],
                suggestions: [rawText]
            };
        }

        // 4. Sauvegarder en base
        await pool.query(
            'UPDATE podcasts SET ia_feedback = $1 WHERE id = $2',
            [JSON.stringify(iaFeedback), id]
        );

        res.json({ success: true, ia_feedback: iaFeedback });
    } catch (error) {
        console.error('Erreur vérification Gemini:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la vérification IA' });
    }
});

// Génération audio TTS — deux voix (Inès = nova, Yannick = echo)
// text_studio utilisé (avec phonétique) pour une meilleure prononciation TTS
router.post('/:id/generate-audio', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Récupérer tous les dialogues
        const dialoguesRes = await pool.query(
            'SELECT character, text_studio, text_reading FROM dialogues WHERE podcast_id = $1 ORDER BY order_index ASC',
            [id]
        );

        if (dialoguesRes.rows.length === 0) {
            return res.status(404).json({ error: 'Aucun dialogue trouvé pour ce podcast.' });
        }

        const dialogues = dialoguesRes.rows.filter(d => (d.text_studio || '').trim() !== '');
        if (dialogues.length === 0) {
            return res.status(400).json({ error: 'Le script est vide.' });
        }

        // 2. Voix par personnage
        // nova = voix féminine claire → Inès
        // echo = voix masculine posée → Yannick
        const VOICE_INES = 'nova';
        const VOICE_YANNICK = 'echo';

        console.log(`[TTS] Génération audio pour ${dialogues.length} répliques...`);

        // 3. Générer un buffer MP3 par réplique (en séquentiel pour respecter le rate limit)
        const audioBuffers = [];
        for (let i = 0; i < dialogues.length; i++) {
            const d = dialogues[i];
            const voice = d.character === 'yannick' ? VOICE_YANNICK : VOICE_INES;
            // text_studio contient les formes phonétiques — idéal pour le TTS
            const inputText = d.text_studio.trim();

            console.log(`[TTS] Réplique ${i + 1}/${dialogues.length} (${d.character}, ${voice})`);

            const mp3Response = await openai.audio.speech.create({
                model: 'tts-1',
                voice,
                input: inputText,
                response_format: 'mp3',
            });

            const buf = Buffer.from(await mp3Response.arrayBuffer());
            audioBuffers.push(buf);

            // Courte pause pour éviter le rate limit OpenAI
            if (i < dialogues.length - 1) {
                await new Promise(r => setTimeout(r, 200));
            }
        }

        // 4. Concaténer tous les buffers MP3
        // Note : la concaténation directe de fichiers MP3 CBR fonctionne pour la lecture
        const finalBuffer = Buffer.concat(audioBuffers);

        // 5. Supprimer l'ancien fichier audio s'il existe
        const uploadDir = path.join(__dirname, '../uploads/audio');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const existingRes = await pool.query('SELECT audio_url FROM podcasts WHERE id = $1', [id]);
        const oldUrl = existingRes.rows[0]?.audio_url;
        if (oldUrl) {
            const oldPath = path.join(__dirname, '..', oldUrl);
            fs.unlink(oldPath, () => {}); // Ignore l'erreur si le fichier n'existe plus
        }

        // 6. Sauvegarder le nouveau fichier
        const filename = `podcast_${id}_${Date.now()}.mp3`;
        const filepath = path.join(uploadDir, filename);
        await fs.promises.writeFile(filepath, finalBuffer);

        const audioUrl = `/uploads/audio/${filename}`;

        // 7. Mettre à jour la base de données
        await pool.query('UPDATE podcasts SET audio_url = $1 WHERE id = $2', [audioUrl, id]);

        console.log(`[TTS] Audio généré : ${filename} (${Math.round(finalBuffer.length / 1024)} Ko)`);

        res.json({ success: true, audio_url: audioUrl });

    } catch (error) {
        console.error('[TTS] Erreur génération audio:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la génération audio', details: error.message });
    }
});

// Auto-correction des dialogues
router.post('/:id/auto-correct', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Récupérer ia_feedback
        const podcastResult = await pool.query(
            'SELECT ia_feedback FROM podcasts WHERE id = $1',
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

Voici les dialogues actuels du podcast :
${JSON.stringify(dialogues)}

Voici les concepts manquants à intégrer TOUS et EXHAUSTIVEMENT :
${JSON.stringify(conceptsManquants)}

Voici les informations erronées à corriger TOUTES :
${JSON.stringify(iaFeedback.informations_erronees || [])}

Réécris CHAQUE dialogue en intégrant naturellement ces éléments. Conserve le style Inès/Yannick, le ratio 70/30, et la structure existante.

Réponds UNIQUEMENT avec ce JSON brut (aucun autre texte) :
{"dialogues":[{"id":1,"text_studio":"...","text_reading":"..."}]}`;

        // 3. Appel n8n
        console.log('[AUTO-CORRECT] Envoi à n8n, nb dialogues:', dialogues.length, '| nb concepts:', conceptsManquants.length);
        const rawResponse = await callGemini(prompt);
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
                await client.query(
                    'UPDATE dialogues SET text_studio = $1, text_reading = $2 WHERE id = $3 AND podcast_id = $4',
                    [d.text_studio || '', d.text_reading || '', d.id, id]
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

module.exports = router;
