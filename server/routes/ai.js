const express = require('express');
const pool = require('../models/db');
const authMiddleware = require('../middleware/auth');
const mammoth = require('mammoth');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fetch = require('node-fetch');


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
const router = express.Router();

// ─── Helper : appel via n8n → GPT ─────────────────────────────────────────
async function callGemini(systemPrompt, userPrompt) {
    const prompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;
    const response = await fetch('http://localhost:5678/webhook/501bb061-982b-4b25-b782-d137b9ea8916', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
    });
    const data = await response.json();
    const text = data.output?.[0]?.content?.[0]?.text || data.message?.content || data.text || JSON.stringify(data);
    return text.replace(/```json\n?|```/g, '').trim();
}

// ─── Helper : parser JSON robuste ────────────────────────────────────────────
function parseJSON(text) {
    try {
        return JSON.parse(text);
    } catch {
        // Tentative de récupération si le JSON est tronqué
        const cleaned = text.replace(/,\s*$/, '').trim();
        try { return JSON.parse(cleaned + '"}]}'); } catch { /* ignore */ }
        throw new Error('Impossible de parser le JSON Gemini : ' + text.substring(0, 200));
    }
}

// ─── Helper : est-ce qu'on utilise le mock ? ─────────────────────────────────
function useMock() {
    return !process.env.GEMINI_API_KEY || process.env.USE_MOCK_AI === 'true';
}

// ─────────────────────────────────────────────────────────────────────────────
// NETTOYAGE AUTOMATIQUE DU .DOCX AVANT DÉCOUPAGE
// ─────────────────────────────────────────────────────────────────────────────
async function cleanStorylineText(rawText) {
    let lines = rawText.split('\n').map(l => l.trim());
    
    // - Artefacts numériques collés : ligne.replace(/^\d+([A-ZÀ-Üa-zà-ü])/, '$1')
    lines = lines.map(line => line.replace(/^\d+([A-ZÀ-Üa-zà-ü])/g, '$1'));

    lines = lines.filter(line => {
        // - Lignes < 15 caractères
        if (line.length < 15) return false;
        // - Lignes de navigation
        if (/^(commencer|suivant|précédent|retour|continuer|fermer|replay)/i.test(line)) return false;
        // - Métadonnées Storyline
        if (/^(zone de texte|état normal|état survol|id\s*:|slide\s*\d+|scène\s*\d+)/i.test(line)) return false;
        // - IDs alphanumériques purs
        if (/^[a-zA-Z0-9_\-]{8,40}$/.test(line)) return false;
        // - Lignes contenant uniquement chiffres ou ponctuation
        if (/^[\d\W]+$/.test(line)) return false;
        return true;
    });

    // - Lignes répétées (dédoublonnage après toLowerCase().trim())
    const uniqueLines = [];
    const seen = new Set();
    for (const line of lines) {
        const lower = line.toLowerCase();
        if (!seen.has(lower)) {
            seen.add(lower);
            uniqueLines.push(line);
        }
    }
    
    return uniqueLines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// DÉCOUPAGE STORYLINE : extrait les vrais chapitres d'un .docx (texte nettoyé)
// ─────────────────────────────────────────────────────────────────────────────
async function extractStorylineChapters(rawText, projectId = null) {
    const cleanedText = await cleanStorylineText(rawText);
    
    if (projectId) {
        await pool.query('UPDATE projects SET cleaned_text = $1 WHERE id = $2', [cleanedText, projectId]);
    }

    if (useMock()) {
        console.log('🤖 [AI] Découpage (Mock)...');
        const mockSegments = [
            {
                title: "Découverte des céréales",
                content: cleanedText.substring(0, 1000) || "Contenu fictif 1",
                wordCount: 800,
                thematic_note: "Introduction au blé"
            },
            {
                title: "Le processus de mouture",
                content: cleanedText.substring(1000, 2000) || "Contenu fictif 2",
                wordCount: 950,
                thematic_note: "Transformation en farine"
            },
            {
                title: "Types et catégories de farines",
                content: cleanedText.substring(2000, 3000) || "Contenu fictif 3",
                wordCount: 750,
                thematic_note: "Différences T45, T55, etc."
            }
        ];
        return { 
            cleanedText, 
            segments: mockSegments.map(seg => ({
                ...seg,
                estimatedMinutes: Math.round(seg.wordCount / 150)
            })) 
        };
    }

    const prompt = `Tu es un expert en pédagogie audio pour apprentis boulangers/pâtissiers.

Voici le contenu brut d'un cours sur les farines. Tu dois le découper en podcasts 
de 5 à 8 minutes (750 à 1200 mots chacun).

RÈGLES ABSOLUES :
1. Chaque podcast = une unité mentale cohérente (un seul sujet compréhensible à l'oral)
2. Ne jamais mélanger deux sujets différents dans un même podcast
3. Tout le contenu source doit être conservé, aucune information ne doit être perdue
4. Si un sujet est trop court pour 750 mots seul → le fusionner avec le sujet le plus proche THÉMATIQUEMENT (pas forcément le suivant)
5. Si un sujet dépasse 1200 mots → le découper en deux parties logiques (pas à mi-chemin au hasard, mais à la rupture de sous-thème)
6. Chaque podcast doit pouvoir : introduire une idée, la relier à la précédente, donner un exemple concret, revenir au métier
7. Les titres doivent être accrocheurs et parlants pour un apprenti : "Comprendre ce qu'est la farine" pas "Introduction"

CONTENU SOURCE :
${cleanedText}

Réponds UNIQUEMENT en JSON valide, sans texte avant ni après :
{
  "segments": [
    {
      "title": "Titre accrocheur du podcast",
      "content": "Tout le contenu source correspondant, mot pour mot, sans résumer",
      "wordCount": 850,
      "thematic_note": "En une phrase : quel est le fil conducteur de ce podcast ?"
    }
  ]
}`;

    const aiResult = await callGemini("Tu es un expert en pédagogie audio.", prompt);
    const parsed = parseJSON(aiResult);
    
    let segments = parsed.segments || [];
    segments = segments.map(seg => {
        const actualWordCount = seg.content.split(/\s+/).length;
        if (actualWordCount < 500 || actualWordCount > 1400) {
            console.warn(`[WARNING] Segment "${seg.title}" a un wordCount hors tolérances : ${actualWordCount}`);
        }
        return {
            ...seg,
            wordCount: actualWordCount,
            estimatedMinutes: Math.round(actualWordCount / 150)
        };
    });

    return { cleanedText, segments };
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE : /generate  (génération depuis contenu brut)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/generate', authMiddleware, async (req, res) => {
    try {
        console.log('[GENERATE] Début');
        const { projectId, content, targetDuration } = req.body;

        if (!content || !targetDuration) {
            return res.status(400).json({ error: 'Contenu et durée cible requis' });
        }

        const targetWords = targetDuration * 150;
        const prompt = `
Tu es un générateur de podcasts pédagogiques EISF (École d'Ingénierie et de Sciences Fromagères).
CONTRAINTES STRICTES :
- Durée : ${targetDuration} minutes (${targetWords} mots)
- Personnages : Inès (70%) et Yannick (30%)
- Inès = experte, ton posé, professionnel. Explique les concepts clairement.
- Yannick = apprenant curieux, spontané. Pose des questions, reformule, fait des liens concrets.
- Jingle obligatoire (première réplique d'Inès) : "Ceci est un podcast produit à partir des cours originaux de l'EISF."
- Structure : Jingle (15s) + Intro (30s) + Contenu avec quiz intégré (3-5min) + Conclusion (30s)
- Quiz : Intégré naturellement dans le dialogue, pas de section séparée
- Ton conversationnel et naturel (pas "Chers auditeurs", pas "Bienvenue dans ce cours")
CONTENU SOURCE :
${content}
GÉNÈRE LE DIALOGUE AU FORMAT JSON UNIQUEMENT (pas de texte avant/après) :
{
  "title": "Titre accrocheur du podcast (max 50 caractères)",
  "dialogues": [
    {"character": "ines", "text": "...", "section": "jingle"},
    {"character": "yannick", "text": "...", "section": "jingle"},
    {"character": "ines", "text": "...", "section": "intro"}
  ]
}
VÉRIFIE AVANT D'ENVOYER :
✅ Jingle = première réplique d'Inès avec texte exact du jingle
✅ Ratio Inès/Yannick ≈ 70/30
✅ Durée totale = ${targetDuration} min (±30 secondes OK)
✅ Ton conversationnel
✅ Quiz intégré dans dialogue
✅ JSON valide`;

        let generatedText;

        if (useMock()) {
            console.log('⚠️ [AI] Mock generation');
            await new Promise(r => setTimeout(r, 1500));
            generatedText = JSON.stringify({
                title: "Podcast Mock : La Fabrication du Fromage",
                dialogues: [
                    { character: "ines", text: "Ceci est un podcast produit à partir des cours originaux de l'EISF.", section: "jingle" },
                    { character: "ines", text: "Bonjour à tous. Aujourd'hui, nous allons découvrir les secrets de la fabrication du fromage.", section: "intro" },
                    { character: "yannick", text: "Ça a l'air délicieux ! Par quoi on commence ?", section: "intro" },
                    { character: "ines", text: "Tout commence par le lait. Sa qualité est essentielle.", section: "content" },
                    { character: "yannick", text: "Et ensuite, c'est l'étape du caillage, c'est ça ?", section: "content" },
                    { character: "ines", text: "Exactement. C'est là que la magie opère.", section: "conclusion" }
                ]
            });
        } else {
            console.log('🤖 [AI] Appel Gemini...');
            generatedText = await callGemini(
                "Tu es un assistant pédagogique expert qui génère des dialogues JSON.",
                prompt
            );
            console.log('[AI] Réponse Gemini reçue, longueur:', generatedText.length);
        }

        const dialogue = parseJSON(generatedText);

        const normalized = dialogue.dialogues.map(line => ({
            ...line,
            text_studio: normalizeText(line.text || line.text_studio || ''),
            text_reading: line.text || line.text_reading || '',
        }));

        const actualWordCount = normalized.reduce((sum, d) => sum + d.text_studio.split(/\s+/).length, 0);

        const podcastResult = await pool.query(
            'INSERT INTO podcasts (project_id, title, word_count, duration_seconds) VALUES ($1, $2, $3, $4) RETURNING id',
            [projectId, dialogue.title, actualWordCount, targetDuration * 60]
        );
        const podcastId = podcastResult.rows[0].id;

        for (let i = 0; i < normalized.length; i++) {
            const d = normalized[i];
            const wordCount = d.text_studio.split(/\s+/).length;
            const estimatedDuration = Math.round((wordCount / 150) * 60);
            await pool.query(
                'INSERT INTO dialogues (podcast_id, order_index, character, text_studio, text_reading, duration_seconds, section) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [podcastId, i, d.character, d.text_studio, d.text_reading, estimatedDuration, d.section]
            );
        }

        res.json({ podcastId, title: dialogue.title, wordCount: actualWordCount, dialogueCount: normalized.length });

    } catch (error) {
        console.error('[GENERATE] Erreur:', error);
        res.status(500).json({ error: 'Erreur lors de la génération', details: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE : /generate-single-chapter
// ─────────────────────────────────────────────────────────────────────────────
router.post('/generate-single-chapter', authMiddleware, async (req, res) => {
    try {
        const { projectId, segment, orderIndex } = req.body;

        const projectRes = await pool.query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [projectId, req.userId]);
        if (projectRes.rows.length === 0) {
            return res.status(404).json({ error: 'Projet non trouvé ou non autorisé' });
        }

        if (useMock()) {
            console.log('[GENERATE-SINGLE] ⚠️ Mock AI');
            await new Promise(r => setTimeout(r, 1000));
            
            const podcastResult = await pool.query(
                'INSERT INTO podcasts (project_id, title, order_index, word_count, duration_seconds) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [projectId, segment.title, orderIndex, 60, 120]
            );
            const podcastId = podcastResult.rows[0].id;
            
            const mockDialogues = [
                { character: "ines", text_studio: "Ceci est un podcast produit à partir des cours originaux de l'EISF.", text_reading: "Ceci est un podcast produit à partir des cours originaux de l'É I S F.", section: "jingle" },
                { character: "ines", text_studio: "Bonjour, aujourd'hui nous découvrons : " + segment.title, text_reading: "Bonjour, aujourd'hui nous découvrons : " + segment.title, section: "intro" },
                { character: "yannick", text_studio: "Par quoi on commence ?", text_reading: "Par quoi on commence ?", section: "content" },
            ];
            
            for (let i = 0; i < mockDialogues.length; i++) {
                const d = mockDialogues[i];
                await pool.query(
                    'INSERT INTO dialogues (podcast_id, order_index, character, text_studio, text_reading, duration_seconds, section) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [podcastId, i, d.character, d.text_studio, d.text_reading, 24, d.section]
                );
            }
            return res.json({ podcastId, title: segment.title, wordCount: 60, durationSeconds: 120 });
        }

        const prompt = `Tu es un générateur de podcasts pédagogiques EISF.
Génère le dialogue de l'épisode correspondant à la portion de cours suivante.
Titre de l'épisode: ${segment.title}
CONTRAINTES STRICTES :
- Personnages : Inès (70%) et Yannick (30%).
- Inès = experte, ton posé, professionnel.
- Yannick = apprenant curieux, spontané.
- Jingle obligatoire (première réplique d'Inès) : "Ceci est un podcast produit à partir des cours originaux de l'EISF."
- Format : JSON uniquement, pas de texte avant/après.
CONTENU SOURCE :
${segment.content || (segment.lines ? segment.lines.join('\n') : '')}
FORMAT DE RÉPONSE :
{
  "title": "${segment.title}",
  "dialogues": [
    {"character": "ines", "text_studio": "...", "text_reading": "...", "section": "jingle"},
    {"character": "yannick", "text_studio": "...", "text_reading": "...", "section": "intro"}
  ]
}`;

        const rawText = await callGemini("Tu es un assistant pédagogique expert.", prompt);
        const dialogue = parseJSON(rawText);

        const actualWordCount = dialogue.dialogues.reduce((sum, d) => sum + (d.text_studio ? d.text_studio.split(/\s+/).length : 0), 0);
        const durationSecs = Math.round((actualWordCount / 130) * 60);

        const podcastResult = await pool.query(
            'INSERT INTO podcasts (project_id, title, order_index, word_count, duration_seconds) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [projectId, dialogue.title, orderIndex, actualWordCount, durationSecs]
        );
        const podcastId = podcastResult.rows[0].id;

        for (let i = 0; i < dialogue.dialogues.length; i++) {
            const d = dialogue.dialogues[i];
            const wCount = d.text_studio ? d.text_studio.split(/\s+/).length : 0;
            const eDuration = Math.round((wCount / 130) * 60);
            await pool.query(
                'INSERT INTO dialogues (podcast_id, order_index, character, text_studio, text_reading, duration_seconds, section) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [podcastId, i, d.character || 'ines', d.text_studio, d.text_reading || d.text_studio, eDuration, d.section || 'content']
            );
        }

        res.json({ podcastId, title: dialogue.title, wordCount: actualWordCount, durationSeconds: durationSecs });

    } catch (error) {
        console.error('[GENERATE-SINGLE] Erreur:', error);
        res.status(500).json({ error: 'Erreur génération IA unitaire', details: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE : /generate-from-project
// ─────────────────────────────────────────────────────────────────────────────
router.post('/generate-from-project', authMiddleware, async (req, res) => {
    try {
        console.log('[GENERATE-PROJECT] Début');
        const { projectId, segments } = req.body;

        let segmentsToGenerate = segments;
        if (!segmentsToGenerate || segmentsToGenerate.length === 0) {
            const projectResult = await pool.query('SELECT cleaned_text FROM projects WHERE id = $1', [projectId]);
            if (projectResult.rows.length === 0) return res.status(404).json({ error: 'Projet non trouvé' });
            segmentsToGenerate = [{ title: 'Podcast Pédagogique', content: projectResult.rows[0].cleaned_text }];
        }

        if (useMock()) {
            console.log('[GENERATE-PROJECT] ⚠️ Mock AI');
            await new Promise(r => setTimeout(r, 1000));
            let allPodcasts = [];
            for (let idx = 0; idx < segmentsToGenerate.length; idx++) {
                const segment = segmentsToGenerate[idx];
                const mockDialogues = [
                    { character: "ines", text_studio: "Ceci est un podcast produit à partir des cours originaux de l'EISF.", text_reading: "Ceci est un podcast produit à partir des cours originaux de l'É I S F.", section: "jingle" },
                    { character: "ines", text_studio: "Bonjour, aujourd'hui nous découvrons : " + segment.title, text_reading: "Bonjour, aujourd'hui nous découvrons : " + segment.title, section: "intro" },
                    { character: "yannick", text_studio: "C'est super excitant ! Par quoi on commence ?", text_reading: "C'est super excitant ! Par quoi on commence ?", section: "content" },
                    { character: "ines", text_studio: "Voici les premiers principes à retenir.", text_reading: "Voici les premiers principes à retenir.", section: "content" },
                    { character: "yannick", text_studio: "Parfait, c'est très clair merci !", text_reading: "Parfait, c'est très clair merci !", section: "conclusion" }
                ];
                const podcastResult = await pool.query(
                    'INSERT INTO podcasts (project_id, title, order_index, word_count, duration_seconds) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                    [projectId, segment.title, idx, 60, 120]
                );
                const podcastId = podcastResult.rows[0].id;
                allPodcasts.push({ podcastId, title: segment.title });
                for (let i = 0; i < mockDialogues.length; i++) {
                    const d = mockDialogues[i];
                    await pool.query(
                        'INSERT INTO dialogues (podcast_id, order_index, character, text_studio, text_reading, duration_seconds, section) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                        [podcastId, i, d.character, d.text_studio, d.text_reading, 24, d.section]
                    );
                }
            }
            return res.json({ success: true, podcasts: allPodcasts });
        }

        let allPodcasts = [];

        for (let idx = 0; idx < segmentsToGenerate.length; idx++) {
            const segment = segmentsToGenerate[idx];
            console.log(`[GENERATE-PROJECT] Segment ${idx + 1}/${segmentsToGenerate.length} : ${segment.title}`);

            if (!segment.content || segment.content.trim().length < 20) continue;

            const prompt = `Tu es un scénariste de podcast pédagogique pour l'EISF (École d'Ingénierie et de Sciences Fromagères).
Génère un dialogue naturel entre Inès (experte, 70% du temps) et Yannick (apprenant, 30%).

RÈGLES DE TRANSFORMATION AUDIO (obligatoires) :
- Reformuler tout le jargon technique en langage parlé
  Exemple : ❌ "Le taux de cendres correspond au poids de cendres obtenu après calcination"
            ✅ "Le taux de cendres, c'est simplement un indicateur pour savoir si ta farine est plutôt blanche ou complète"
- Ajouter systématiquement : exemples concrets, analogies visuelles, liens avec une pâte ou une recette réelle
- Yannick pose les questions qu'un apprenti se pose vraiment (pas des questions génériques)
- Inès répond avec des exemples tirés du métier
- Prévoir des micro-reformulations ("donc si je résume...", "attends, tu veux dire que...") 
  pour ancrer la mémorisation
- Structure obligatoire :
  1. Jingle (Inès : "Ceci est un podcast produit à partir des cours originaux de l'EISF.")
  2. Intro : relier ce podcast au précédent en 1 phrase
  3. Contenu : tout le contenu source transformé (rien ne peut être omis)
  4. Conclusion : 1 phrase de résumé + 1 annonce du prochain podcast

TITRE DE L'ÉPISODE : ${segment.title}
CONTENU SOURCE À TRANSFORMER (tout garder) :
${segment.content}

Durée cible : 5 à 8 minutes (750 à 1200 mots au total)

Réponds UNIQUEMENT en JSON valide :
{
  "title": "${segment.title}",
  "dialogues": [
    {"character": "ines", "text_studio": "...", "text_reading": "...", "section": "jingle"},
    {"character": "yannick", "text_studio": "...", "text_reading": "...", "section": "intro"}
  ]
}`;

            const rawText = await callGemini("Tu es un assistant pédagogique expert.", prompt);
            console.log(`[GENERATE-PROJECT] Gemini répondu pour segment ${idx + 1}`);

            const dialogue = parseJSON(rawText);
            const actualWordCount = dialogue.dialogues.reduce((sum, d) => sum + (d.text_studio ? d.text_studio.split(/\s+/).length : 0), 0);
            const durationSecs = Math.round((actualWordCount / 130) * 60);

            const podcastResult = await pool.query(
                'INSERT INTO podcasts (project_id, title, order_index, word_count, duration_seconds) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [projectId, dialogue.title, idx, actualWordCount, durationSecs]
            );
            const podcastId = podcastResult.rows[0].id;
            allPodcasts.push({ podcastId, title: dialogue.title });

            for (let i = 0; i < dialogue.dialogues.length; i++) {
                const d = dialogue.dialogues[i];
                const wCount = d.text_studio ? d.text_studio.split(/\s+/).length : 0;
                const eDuration = Math.round((wCount / 130) * 60);
                await pool.query(
                    'INSERT INTO dialogues (podcast_id, order_index, character, text_studio, text_reading, duration_seconds, section) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [podcastId, i, d.character || 'ines', d.text_studio, d.text_reading || d.text_studio, eDuration, d.section || 'content']
                );
            }

            // Pause entre segments pour éviter le rate limit
            if (idx < segmentsToGenerate.length - 1) {
                await new Promise(r => setTimeout(r, 4000));
            }

        }
        console.log('[GENERATE-PROJECT] ✅ Terminé, podcasts créés:', allPodcasts.length);
        res.json({ success: true, podcasts: allPodcasts });
    } catch (error) {
        console.error('[GENERATE-PROJECT] Erreur:', error);
        res.status(500).json({ error: 'Erreur génération IA', details: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE : /generate-single-chapter
// ─────────────────────────────────────────────────────────────────────────────
router.post('/generate-single-chapter', authMiddleware, async (req, res) => {
    try {
        console.log('[GENERATE-SINGLE] Début');
        const { projectId, segment, orderIndex } = req.body;

        if (!segment || !segment.content) {
            return res.status(400).json({ error: 'Segment content is required' });
        }

        if (useMock()) {
            console.log('[GENERATE-SINGLE] ⚠️ Mock AI');
            await new Promise(r => setTimeout(r, 1000));
            const mockDialogues = [
                { character: "ines", text_studio: "Ceci est un podcast produit à partir des cours originaux de l'EISF.", text_reading: "Ceci est un podcast produit à partir des cours originaux de l'É I S F.", section: "jingle" },
                { character: "ines", text_studio: "Aujourd'hui sur ce segment : " + segment.title, text_reading: "Aujourd'hui sur ce segment : " + segment.title, section: "intro" },
                { character: "yannick", text_studio: "Allons-y !", text_reading: "Allons-y !", section: "content" },
                { character: "ines", text_studio: "Voilà l'essentiel.", text_reading: "Voilà l'essentiel.", section: "conclusion" }
            ];
            
            const actualWordCount = 60;
            const durationSecs = 120;
            const podcastResult = await pool.query(
                'INSERT INTO podcasts (project_id, title, order_index, word_count, duration_seconds) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [projectId, segment.title, orderIndex || 0, actualWordCount, durationSecs]
            );
            const podcastId = podcastResult.rows[0].id;
            
            for (let i = 0; i < mockDialogues.length; i++) {
                const d = mockDialogues[i];
                await pool.query(
                    'INSERT INTO dialogues (podcast_id, order_index, character, text_studio, text_reading, duration_seconds, section) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [podcastId, i, d.character, d.text_studio, d.text_reading, 24, d.section]
                );
            }

            return res.json({
                podcastId,
                title: segment.title,
                wordCount: actualWordCount,
                durationSeconds: durationSecs,
                dialogueCount: mockDialogues.length
            });
        }

        const prompt = `Tu es un scénariste de podcast pédagogique pour l'EISF (École d'Ingénierie et de Sciences Fromagères).
Génère un dialogue naturel entre Inès (experte, 70% du temps) et Yannick (apprenant, 30%).

RÈGLES DE TRANSFORMATION AUDIO (obligatoires) :
- Reformuler tout le jargon technique en langage parlé
  Exemple : ❌ "Le taux de cendres correspond au poids de cendres obtenu après calcination"
            ✅ "Le taux de cendres, c'est simplement un indicateur pour savoir si ta farine est plutôt blanche ou complète"
- Ajouter systématiquement : exemples concrets, analogies visuelles, liens avec une pâte ou une recette réelle
- Yannick pose les questions qu'un apprenti se pose vraiment (pas des questions génériques)
- Inès répond avec des exemples tirés du métier
- Prévoir des micro-reformulations ("donc si je résume...", "attends, tu veux dire que...") 
  pour ancrer la mémorisation
- Structure obligatoire :
  1. Jingle (Inès : "Ceci est un podcast produit à partir des cours originaux de l'EISF.")
  2. Intro : relier ce podcast au précédent en 1 phrase
  3. Contenu : tout le contenu source transformé (rien ne peut être omis)
  4. Conclusion : 1 phrase de résumé + 1 annonce du prochain podcast

TITRE DE L'ÉPISODE : ${segment.title}
CONTENU SOURCE À TRANSFORMER (tout garder) :
${segment.content}

Durée cible : 5 à 8 minutes (750 à 1200 mots au total)

Réponds UNIQUEMENT en JSON valide :
{
  "title": "${segment.title}",
  "dialogues": [
    {"character": "ines", "text_studio": "...", "text_reading": "...", "section": "jingle"},
    {"character": "yannick", "text_studio": "...", "text_reading": "...", "section": "intro"}
  ]
}`;

        console.log(`[GENERATE-SINGLE] Appel Gemini pour ${segment.title}...`);
        const rawText = await callGemini("Tu es un scénariste de podcast pédagogique expert.", prompt);
        
        const dialogue = parseJSON(rawText);
        
        const dialoguesNormalized = (dialogue.dialogues || []).map(line => ({
            ...line,
            text_studio: normalizeText(line.text_studio || line.text || ''),
            text_reading: line.text_reading || line.text_studio || line.text || '',
        }));

        const actualWordCount = dialoguesNormalized.reduce((sum, d) => sum + (d.text_studio ? d.text_studio.split(/\s+/).length : 0), 0);
        const durationSecs = Math.round((actualWordCount / 130) * 60); // Roughly 130 words per min

        const podcastResult = await pool.query(
            'INSERT INTO podcasts (project_id, title, order_index, word_count, duration_seconds) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [projectId, dialogue.title || segment.title, orderIndex || 0, actualWordCount, durationSecs]
        );
        const podcastId = podcastResult.rows[0].id;

        for (let i = 0; i < dialoguesNormalized.length; i++) {
            const d = dialoguesNormalized[i];
            const wCount = d.text_studio ? d.text_studio.split(/\s+/).length : 0;
            const eDuration = Math.round((wCount / 130) * 60);
            await pool.query(
                'INSERT INTO dialogues (podcast_id, order_index, character, text_studio, text_reading, duration_seconds, section) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [podcastId, i, d.character || 'ines', d.text_studio, d.text_reading, eDuration, d.section || 'content']
            );
        }

        console.log('[GENERATE-SINGLE] ✅ Podcast créé:', podcastId);
        res.json({
            podcastId,
            title: dialogue.title || segment.title,
            wordCount: actualWordCount,
            durationSeconds: durationSecs,
            dialogueCount: dialoguesNormalized.length
        });

    } catch (error) {
        console.error('[GENERATE-SINGLE] Erreur:', error);
        res.status(500).json({ error: 'Erreur génération podcast', details: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE : /preview  — extrait les chapitres du .docx et procède au nettoyage + découpe
// ─────────────────────────────────────────────────────────────────────────────
router.post('/preview', authMiddleware, async (req, res) => {
    try {
        const { projectId } = req.body;

        // Récupérer le chemin du fichier
        const projectResult = await pool.query(
            'SELECT source_file_path, title FROM projects WHERE id = $1 AND user_id = $2',
            [projectId, req.userId]
        );

        if (projectResult.rows.length === 0) {
            return res.status(404).json({ error: 'Projet non trouvé' });
        }

        const { source_file_path, title } = projectResult.rows[0];

        // Extraire le texte brut du fichier Word/Storyline
        const result = await mammoth.extractRawText({ path: source_file_path });
        const rawText = result.value || '';

        // Appel à la nouvelle logique de nettoyage et de découpage IA
        console.log(`[PREVIEW] Découpage IA de "${title}" (Projet #${projectId})...`);
        const { cleanedText, segments } = await extractStorylineChapters(rawText, projectId);
        
        const lines = cleanedText.split('\n');
        const wordCount = cleanedText.split(/\s+/).length;

        console.log(`[PREVIEW] Succès. ${segments.length} segments extraits.`);

        res.json({
            projectTitle: title,
            wordCount,
            lineCount: lines.length,
            cleanedText,                  // Le texte complet nettoyé
            chapters: segments,           // Les segments détectés par l'IA (+ mock fallback)
            rawLinesPreview: lines.slice(0, 30), // Aperçu des premières lignes
        });

    } catch (error) {
        console.error('[PREVIEW] Erreur:', error);
        res.status(500).json({ error: 'Erreur lors de la prévisualisation' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE : /regenerate-line
// ─────────────────────────────────────────────────────────────────────────────
router.post('/regenerate-line', authMiddleware, async (req, res) => {
    try {
        const { dialogueId, currentText, style, contextBefore, contextAfter } = req.body;

        if (useMock()) {
            return res.json({ text_studio: currentText + ' [reformulé]', text_reading: currentText + ' [reformulé]' });
        }

        const prompt = `Tu es un scénariste de podcast pédagogique. Reformule UNE réplique de manière naturelle sans casser la continuité.
CONTEXTE AVANT:
${(contextBefore || []).join('\n')}
RÉPLIQUE À REFORMULER:
${currentText}
CONTEXTE APRÈS:
${(contextAfter || []).join('\n')}
Mode: "${style}" (simplify: rends très simple, detail: ajoute des détails pédagogiques, rephrase: change la tournure).
Génère UNIQUEMENT ce JSON :
{
  "text_studio": "La nouvelle réplique",
  "text_reading": "La nouvelle réplique"
}`;

        const rawText = await callGemini("Tu es un expert pédagogique.", prompt);
        const dialogue = parseJSON(rawText);

        await pool.query(
            'UPDATE dialogues SET text_studio = $1, text_reading = $2 WHERE id = $3',
            [dialogue.text_studio, dialogue.text_reading || dialogue.text_studio, dialogueId]
        );

        res.json({ text_studio: dialogue.text_studio, text_reading: dialogue.text_reading || dialogue.text_studio });

    } catch (error) {
        console.error('[REGENERATE] Erreur:', error);
        res.status(500).json({ error: 'Erreur lors de la régénération', details: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE : /verify
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify', authMiddleware, async (req, res) => {
    try {
        const { podcastId } = req.body;

        const podcastRes = await pool.query('SELECT project_id FROM podcasts WHERE id = $1', [podcastId]);
        if (podcastRes.rows.length === 0) return res.status(404).json({ error: 'Podcast non trouvé' });

        const projectId = podcastRes.rows[0].project_id;
        const projectRes = await pool.query('SELECT cleaned_text FROM projects WHERE id = $1', [projectId]);
        const cleanedText = projectRes.rows[0]?.cleaned_text;

        const dialoguesRes = await pool.query(
            'SELECT text_studio FROM dialogues WHERE podcast_id = $1 ORDER BY order_index ASC',
            [podcastId]
        );
        const dialogueText = dialoguesRes.rows.map(d => d.text_studio).join('\n');

        if (useMock()) {
            return res.json({ fidelityScore: 85, missingConcepts: [], addedConcepts: [] });
        }

        const prompt = `Analyse l'écart entre le cours brut (Source) et le podcast généré.
Source:
${cleanedText}
Podcast généré:
${dialogueText}
Retourne UNIQUEMENT ce JSON :
{
  "fidelityScore": 87,
  "missingConcepts": ["concept manquant 1"],
  "addedConcepts": ["élément inventé 1"]
}`;

        const rawText = await callGemini(null, prompt);
        const resultJson = parseJSON(rawText);

        await pool.query('UPDATE podcasts SET fidelity_score = $1 WHERE id = $2', [resultJson.fidelityScore || null, podcastId]);
        res.json(resultJson);

    } catch (error) {
        console.error('[VERIFY] Erreur:', error);
        res.status(500).json({ error: 'Erreur lors de la vérification', details: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE : /fix-missing-concepts
// ─────────────────────────────────────────────────────────────────────────────
router.post('/fix-missing-concepts', authMiddleware, async (req, res) => {
    try {
        const { podcastId, missingConcepts } = req.body;

        const dialoguesRes = await pool.query(
            'SELECT * FROM dialogues WHERE podcast_id = $1 ORDER BY order_index ASC',
            [podcastId]
        );
        const dialogues = dialoguesRes.rows;
        const dialogueText = dialogues.map((d, i) => `[ID:${i} - ${d.character}] ${d.text_studio}`).join('\n');

        if (useMock()) {
            return res.json({ newDialogues: [] });
        }

        const prompt = `Voici un dialogue de podcast existant :
${dialogueText}
Concepts manquants à injecter :
- ${missingConcepts.join('\n- ')}
Génère une suite naturelle pour aborder ces concepts. Utilise 'ines' pour l'experte et 'yannick' pour l'apprenant.
Renvoie UNIQUEMENT ce JSON :
{
  "newDialogues": [
    {"character": "ines", "text_studio": "...", "text_reading": "...", "section": "content"},
    {"character": "yannick", "text_studio": "...", "text_reading": "...", "section": "content"}
  ]
}`;

        const rawText = await callGemini(null, prompt);
        const resultJson = parseJSON(rawText);

        const addedDialogues = [];
        let lastIndex = dialogues.length > 0 ? Math.max(...dialogues.map(d => d.order_index)) : 0;

        for (const line of resultJson.newDialogues) {
            lastIndex++;
            const wordCount = line.text_studio.split(/\s+/).length;
            const duration = Math.round((wordCount / 150) * 60);
            const inserted = await pool.query(
                'INSERT INTO dialogues (podcast_id, order_index, character, text_studio, text_reading, duration_seconds, section) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
                [podcastId, lastIndex, line.character || 'ines', line.text_studio, line.text_reading || line.text_studio, duration, line.section || 'content']
            );
            addedDialogues.push(inserted.rows[0]);
        }

        res.json({ newDialogues: addedDialogues });

    } catch (error) {
        console.error('[FIX] Erreur:', error);
        res.status(500).json({ error: 'Erreur lors de la correction', details: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Normalisation texte (chiffres → lettres, acronymes → phonétique)
// ─────────────────────────────────────────────────────────────────────────────
function normalizeText(text) {
    let normalized = text;

    const numberMap = {
        '0': 'zéro', '1': 'un', '2': 'deux', '3': 'trois', '4': 'quatre',
        '5': 'cinq', '6': 'six', '7': 'sept', '8': 'huit', '9': 'neuf',
        '10': 'dix', '11': 'onze', '12': 'douze', '13': 'treize', '14': 'quatorze',
        '15': 'quinze', '16': 'seize', '20': 'vingt', '30': 'trente',
        '40': 'quarante', '50': 'cinquante', '60': 'soixante', '100': 'cent',
        '150': 'cent cinquante', '200': 'deux cents', '500': 'cinq cents',
        '1000': 'mille', '2024': 'deux mille vingt-quatre', '2025': 'deux mille vingt-cinq',
        '2026': 'deux mille vingt-six',
    };
    for (const [num, word] of Object.entries(numberMap)) {
        normalized = normalized.replace(new RegExp(`\\b${num}\\b`, 'g'), word);
    }

    const acronymMap = {
        'EISF': 'EISF (É-I-S-F)',
        'DLC': 'DLC (Dé-El-Cé)',
        'HACCP': 'HACCP (H-A-C-C-P)',
        'DLUO': 'DLUO (Dé-El-U-O)',
        'IGP': 'IGP (I-Gé-Pé)',
        'AOP': 'AOP (A-O-Pé)',
        'AOC': 'AOC (A-O-Cé)',
        'CAP': 'CAP (Cé-A-Pé)',
        'BEP': 'BEP (Bé-E-Pé)',
        'pH': 'pH (pé-ache)',
    };
    for (const [acronym, phonetic] of Object.entries(acronymMap)) {
        normalized = normalized.replace(new RegExp(`\\b${acronym}\\b(?!\\s*\\()`, 'g'), phonetic);
    }

    return normalized;
}

module.exports = router;