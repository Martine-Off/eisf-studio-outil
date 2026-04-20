const express = require('express');
const pool = require('../models/db');
const authMiddleware = require('../middleware/auth');
const mammoth = require('mammoth');
const callGPT = require('../utils/callGPT');

const INTRO_TEXT = "Bonjour et bienvenue dans ce podcast de formation EISF — votre capsule audio pour comprendre, apprendre et progresser à votre rythme. Cet épisode, généré par intelligence artificielle à partir de contenus rédigés et validés par nos formateurs, vous accompagne dans vos apprentissages théoriques.";
const OUTRO_TEXT = "Ce podcast est une création EISF. Il a été généré par intelligence artificielle à partir de contenus pédagogiques rédigés et validés par nos formateurs. Toute reproduction ou diffusion est interdite sans autorisation.";

const INTRO_READING = "Bonjour et bienvenue dans ce podcast de formation E.I.S.F. — votre capsule audio pour comprendre, apprendre et progresser à votre rythme. Cet épisode, généré par intelligence artificielle à partir de contenus rédigés et validés par nos formateurs, vous accompagne dans vos apprentissages théoriques.";
const OUTRO_READING = "Ce podcast est une création E.I.S.F.. Il a été généré par intelligence artificielle à partir de contenus pédagogiques rédigés et validés par nos formateurs. Toute reproduction ou diffusion est interdite sans autorisation.";

const router = express.Router();

// ─── Helper : parser JSON robuste ────────────────────────────────────────────
function parseJSON(text) {
    try {
        return JSON.parse(text);
    } catch {
        // Tentative de récupération si le JSON est tronqué
        const cleaned = text.replace(/,\s*$/, '').trim();
        try { return JSON.parse(cleaned + '"}]}'); } catch { /* ignore */ }
        throw new Error('Impossible de parser le JSON GPT : ' + text.substring(0, 200));
    }
}

// ─── Helper : est-ce qu'on utilise le mock ? ─────────────────────────────────
function useMock() {
    return process.env.USE_MOCK_AI === 'true';
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
        // - Métadonnées Storyline / PowerPoint
        if (/^(zone de texte|état normal|état survol|id\s*:|slide\s*\d+|scène\s*\d+)/i.test(line)) return false;
        if (/^(nom de la (scène|diapositive|mise en page)|masques? de diapositives?|mises? en page)/i.test(line)) return false;
        if (/version de l.export/i.test(line)) return false;
        if (/^(v\d+\.\d+\.\d+|SingleTable|multi.?table)/i.test(line)) return false;
        if (/\bv\d+\.\d+\.\d+\.\d+-[A-Za-z]+\b/.test(line)) return false; // ex: v3.104.35448.0-SingleTable
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
                title: "Présentation du module",
                content: cleanedText.substring(0, 1000) || "Contenu fictif 1",
                wordCount: 800,
                thematic_note: "Premier module de découverte"
            },
            {
                title: "Concepts clés",
                content: cleanedText.substring(1000, 2000) || "Contenu fictif 2",
                wordCount: 950,
                thematic_note: "Notions fondamentales"
            },
            {
                title: "Mise en pratique",
                content: cleanedText.substring(2000, 3000) || "Contenu fictif 3",
                wordCount: 750,
                thematic_note: "Application pratique"
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

    const prompt = `Tu es un expert en pédagogie audio.

Voici le contenu brut d'un cours. Tu dois le découper en podcasts
de 5 à 8 minutes (750 à 1200 mots chacun).

RÈGLES ABSOLUES :
1. Chaque podcast = une unité mentale cohérente (un seul sujet compréhensible à l'oral)
2. Ne jamais mélanger deux sujets différents dans un même podcast
3. Tout le contenu source doit être conservé, aucune information ne doit être perdue
4. Si un sujet est trop court pour 750 mots seul → le fusionner avec le sujet le plus proche THÉMATIQUEMENT (pas forcément le suivant)
5. Si un sujet dépasse 1200 mots → le découper en deux parties logiques (pas à mi-chemin au hasard, mais à la rupture de sous-thème)
6. Chaque podcast doit pouvoir : introduire une idée, la relier à la précédente, donner un exemple concret, ancrer dans la pratique professionnelle
7. Les titres doivent être accrocheurs et parlants pour un apprenant : "Comprendre ce qu'est X" pas "Introduction"

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

    const aiResult = await callGPT("Tu es un expert en pédagogie audio.", prompt);
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
Tu es un générateur de podcasts pédagogiques EISF (École Internationale du Savoir-Faire Français).
CONTRAINTES STRICTES :
- Durée : ${targetDuration} minutes (${targetWords} mots)
- Personnages : Inès (70%) et Yannick (30%)
- Inès = experte, ton posé, professionnel. Explique les concepts clairement.
- Yannick = apprenant curieux, spontané. Pose des questions, reformule, fait des liens concrets.
- Structure : Intro (accroche sur le sujet, 30s) + Contenu avec quiz intégré (3-5min) + Conclusion (résumé sur le sujet, 30s)
- ATTENTION : L'introduction officielle et la conclusion légale seront ajoutées automatiquement. Commence directement le dialogue par l'accroche sur le cours.
- Quiz : Intégré naturellement dans le dialogue, pas de section séparée
- Ton conversationnel et naturel (pas "Chers auditeurs", pas "Bienvenue dans ce cours")
${NORMALIZATION_INSTRUCTIONS}
CONTENU SOURCE :
${content}
GÉNÈRE LE DIALOGUE AU FORMAT JSON UNIQUEMENT (pas de texte avant/après) :
{
  "title": "Titre accrocheur du podcast (max 50 caractères)",
  "dialogues": [
    {"character": "ines", "text_studio": "...", "text_reading": "...", "section": "intro"},
    {"character": "yannick", "text_studio": "...", "text_reading": "...", "section": "intro"}
  ]
}
VÉRIFIE AVANT D'ENVOYER :
✅ Pas de jingle artificiel à générer, l'introduction est ajoutée en dur.
✅ Ratio Inès/Yannick ≈ 70/30
✅ Durée totale = ${targetDuration} min (±30 secondes OK)
✅ Ton conversationnel, quiz intégré
✅ JSON valide avec text_studio ET text_reading`;

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
            console.log('🤖 [AI] Appel GPT...');
            generatedText = await callGPT(
                "Tu es un assistant pédagogique expert qui génère des dialogues JSON.",
                prompt
            );
            console.log('[AI] Réponse GPT reçue, longueur:', generatedText.length);
        }

        const dialogue = parseJSON(generatedText);

        const normalized = dialogue.dialogues.map(line => ({
            ...line,
            text_studio: normalizeText(line.text || line.text_studio || ''),
            text_reading: line.text || line.text_reading || '',
        }));

        // AJOUT EN DUR DES PHRASES OBLIGATOIRES
        normalized.unshift({
            character: 'ines',
            text_studio: INTRO_TEXT,
            text_reading: INTRO_READING,
            section: 'jingle'
        });
        normalized.push({
            character: 'ines',
            text_studio: OUTRO_TEXT,
            text_reading: OUTRO_READING,
            section: 'conclusion'
        });

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

            const prompt = `Tu es un scénariste de podcast pédagogique pour l'EISF (École Internationale du Savoir-Faire Français).
Génère un dialogue naturel entre Inès (experte, 70% du temps) et Yannick (apprenant, 30%).

RÈGLES DE TRANSFORMATION AUDIO (obligatoires) :
- Reformuler tout le jargon technique en langage parlé
  Exemple : "Le taux de cendres, c'est simplement un indicateur pour savoir si ta farine est plutôt blanche ou complète"
- Ajouter systématiquement : exemples concrets, analogies visuelles, liens avec une pâte ou une recette réelle
- Yannick pose les questions qu'un apprenti se pose vraiment (pas des questions génériques)
- Inès répond avec des exemples tirés du métier
- Prévoir des micro-reformulations ("donc si je résume...", "attends, tu veux dire que...")
  pour ancrer la mémorisation
- Structure obligatoire :
  1. Intro : relier ce podcast au précédent en 1 phrase (PAS DE JINGLE OFFICIEL, il est mis en dur)
  2. Contenu : tout le contenu source transformé (rien ne peut être omis)
  3. Conclusion : 1 phrase de résumé + 1 annonce du prochain podcast
${NORMALIZATION_INSTRUCTIONS}

TITRE DE L'ÉPISODE : ${segment.title}
CONTENU SOURCE À TRANSFORMER (tout garder, aucun concept ne doit être omis) :
${segment.content}

Durée cible : 5 à 8 minutes (750 à 1200 mots au total)

Réponds UNIQUEMENT en JSON valide :
{
  "title": "${segment.title}",
  "dialogues": [
    {"character": "ines", "text_studio": "...", "text_reading": "...", "section": "intro"},
    {"character": "yannick", "text_studio": "...", "text_reading": "...", "section": "intro"}
  ]
}`;

            const rawText = await callGPT("Tu es un assistant pédagogique expert.", prompt);
            console.log(`[GENERATE-PROJECT] GPT répondu pour segment ${idx + 1}`);

            const dialogue = parseJSON(rawText);
            const dialoguesNorm = (dialogue.dialogues || []).map(line => ({
                ...line,
                text_studio: normalizeText(line.text_studio || line.text || ''),
                text_reading: line.text_reading || line.text_studio || line.text || '',
            }));

            // AJOUT EN DUR DES PHRASES OBLIGATOIRES
            dialoguesNorm.unshift({ character: 'ines', text_studio: INTRO_TEXT, text_reading: INTRO_READING, section: 'jingle' });
            dialoguesNorm.push({ character: 'ines', text_studio: OUTRO_TEXT, text_reading: OUTRO_READING, section: 'conclusion' });

            const actualWordCount = dialoguesNorm.reduce((sum, d) => sum + (d.text_studio ? d.text_studio.split(/\s+/).length : 0), 0);
            const durationSecs = Math.round((actualWordCount / 130) * 60);

            const podcastResult = await pool.query(
                'INSERT INTO podcasts (project_id, title, order_index, word_count, duration_seconds) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [projectId, dialogue.title, idx, actualWordCount, durationSecs]
            );
            const podcastId = podcastResult.rows[0].id;
            allPodcasts.push({ podcastId, title: dialogue.title });

            for (let i = 0; i < dialoguesNorm.length; i++) {
                const d = dialoguesNorm[i];
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

        const prompt = `Tu es un scénariste de podcast pédagogique pour l'EISF (École Internationale du Savoir-Faire Français).
Génère un dialogue naturel entre Inès (experte, 70% du temps) et Yannick (apprenant, 30%).

RÈGLES DE TRANSFORMATION AUDIO (obligatoires) :
- Reformuler tout le jargon technique en langage parlé et accessible
- Ajouter systématiquement : exemples concrets, analogies, liens avec la pratique professionnelle
- Yannick pose les questions qu'un apprenant se pose vraiment (pas des questions génériques)
- Inès répond avec des exemples tirés du domaine enseigné
- Prévoir des micro-reformulations ("donc si je résume...", "attends, tu veux dire que...")
  pour ancrer la mémorisation
- Structure obligatoire :
  1. Intro : relier ce podcast au précédent en 1 phrase (PAS DE JINGLE OFFICIEL, il est mis en dur)
  2. Contenu : tout le contenu source transformé (rien ne peut être omis)
  3. Conclusion : 1 phrase de résumé + 1 annonce du prochain podcast
${NORMALIZATION_INSTRUCTIONS}

TITRE DE L'ÉPISODE : ${segment.title}
CONTENU SOURCE À TRANSFORMER (tout garder) :
${segment.content}

Durée cible : 5 à 8 minutes (750 à 1200 mots au total)

Réponds UNIQUEMENT en JSON valide :
{
  "title": "${segment.title}",
  "dialogues": [
    {"character": "ines", "text_studio": "...", "text_reading": "...", "section": "intro"},
    {"character": "yannick", "text_studio": "...", "text_reading": "...", "section": "intro"}
  ]
}`;

        console.log(`[GENERATE-SINGLE] Appel GPT pour ${segment.title}...`);
        const rawText = await callGPT("Tu es un scénariste de podcast pédagogique expert.", prompt);
        
        const dialogue = parseJSON(rawText);
        
        const dialoguesNormalized = (dialogue.dialogues || []).map(line => ({
            ...line,
            text_studio: normalizeText(line.text_studio || line.text || ''),
            text_reading: line.text_reading || line.text_studio || line.text || '',
        }));

        // AJOUT EN DUR DES PHRASES OBLIGATOIRES
        dialoguesNormalized.unshift({ character: 'ines', text_studio: INTRO_TEXT, text_reading: INTRO_READING, section: 'jingle' });
        dialoguesNormalized.push({ character: 'ines', text_studio: OUTRO_TEXT, text_reading: OUTRO_READING, section: 'conclusion' });

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
            'SELECT source_file_path, title, cleaned_text FROM projects WHERE id = $1 AND user_id = $2',
            [projectId, req.userId]
        );

        if (projectResult.rows.length === 0) {
            return res.status(404).json({ error: 'Projet non trouvé' });
        }

        const { source_file_path, title, cleaned_text: existingCleanedText } = projectResult.rows[0];

        // Récupérer le texte : depuis le fichier si disponible, sinon depuis cleaned_text en base
        let rawText = '';
        if (source_file_path) {
            const result = await mammoth.extractRawText({ path: source_file_path });
            rawText = result.value || '';
        } else if (existingCleanedText) {
            rawText = existingCleanedText;
        } else {
            return res.status(400).json({ error: 'Aucun fichier ni texte source trouvé pour ce projet.' });
        }

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

        const rawText = await callGPT("Tu es un expert pédagogique.", prompt);
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

        const systemPrompt = `Tu es un expert en vérification pédagogique. Ta mission est d'être EXHAUSTIF et CHIRURGICAL. Tu ne t'arrêtes jamais à 5 éléments. Tu parcours l'intégralité du texte source du début à la fin, concept par concept, chiffre par chiffre, terme technique par terme technique. Un oubli de ta part = une erreur pédagogique pour un étudiant.`;

        const prompt = `Tu dois comparer exhaustivement le cours source et le podcast généré.

MÉTHODE OBLIGATOIRE :
1. Lis le cours source et dresse mentalement la liste complète de TOUS les concepts, chiffres, termes techniques, définitions, et exemples.
2. Pour chaque élément de cette liste, vérifie s'il est présent dans le podcast.
3. Ne t'arrête pas avant d'avoir vérifié le dernier mot du cours source.

COURS SOURCE (texte de référence) :
${cleanedText}

PODCAST GÉNÉRÉ (à vérifier) :
${dialogueText}

Retourne UNIQUEMENT ce JSON valide, sans markdown, sans explication :
{
  "fidelityScore": <nombre entre 0 et 100>,
  "missingConcepts": [
    "concept manquant 1 (suffisamment précis pour retrouver dans le cours)",
    ...TOUS les concepts manquants, sans limite de nombre
  ],
  "addedConcepts": [
    "élément inventé ou absent du cours source",
    ...TOUS les ajouts, sans limite de nombre
  ],
  "incorrectFacts": [
    "fait déformé : podcast dit X, source dit Y",
    ...TOUS les faits incorrects
  ]
}

RÈGLE ABSOLUE : Les listes doivent être COMPLÈTES. S'il y a 20 concepts manquants, tu en listes 20. Ne jamais tronquer.`;

        const rawText = await callGPT(systemPrompt, prompt);
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

        const rawText = await callGPT(null, prompt);
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
// Verrou pour éviter les appels concurrents sur le même podcast
const verifyLocks = new Set();

// ROUTE : /auto-verify-and-fix  — boucle jusqu'à 95% de fidélité (max 4 passes)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/auto-verify-and-fix', authMiddleware, async (req, res) => {
    const { podcastId } = req.body;
    if (!podcastId) return res.status(400).json({ error: 'podcastId requis' });

    // Bloquer si une correction est déjà en cours sur ce podcast
    if (verifyLocks.has(podcastId)) {
        return res.status(409).json({ error: 'Une correction est déjà en cours pour ce podcast. Patientez.' });
    }
    verifyLocks.add(podcastId);

    const MAX_ITERATIONS = 4;
    const TARGET_SCORE = 95;
    const history = [];

    try {
        // Récupérer le texte source
        const podcastRes = await pool.query('SELECT project_id FROM podcasts WHERE id = $1', [podcastId]);
        if (podcastRes.rows.length === 0) return res.status(404).json({ error: 'Podcast non trouvé' });
        const projectRes = await pool.query('SELECT cleaned_text FROM projects WHERE id = $1', [podcastRes.rows[0].project_id]);
        const cleanedText = projectRes.rows[0]?.cleaned_text || '';

        if (!cleanedText) {
            return res.status(400).json({ error: 'Texte source introuvable pour ce projet' });
        }

        let currentScore = 0;
        let bestScore = 0;
        let iteration = 0;
        let lastVerifyResult = null; // Garde le résultat de la dernière vérification
        // Limite de concepts par passe pour éviter les prompts trop longs (→ refus GPT)
        const MAX_CONCEPTS_PER_PASS = 8;

        while (iteration < MAX_ITERATIONS && currentScore < TARGET_SCORE) {
            iteration++;
            console.log(`[AUTO-VERIFY] Itération ${iteration}/${MAX_ITERATIONS}...`);

            try {
                // ── Étape 1 : Vérification ────────────────────────────────────
                const dialoguesRes = await pool.query(
                    'SELECT text_studio FROM dialogues WHERE podcast_id = $1 ORDER BY order_index ASC',
                    [podcastId]
                );
                const dialogueText = dialoguesRes.rows.map(d => d.text_studio).join('\n');

                // Tronquer le texte source si trop long (évite dépassement de contexte)
                const sourceExcerpt = cleanedText.length > 6000
                    ? cleanedText.substring(0, 6000) + '\n[... texte tronqué pour la vérification ...]'
                    : cleanedText;

                const verifyPrompt = `Tu dois comparer le cours source et le podcast généré.

COURS SOURCE :
${sourceExcerpt}

PODCAST GÉNÉRÉ :
${dialogueText}

Retourne UNIQUEMENT ce JSON valide :
{
  "fidelityScore": <0 à 100>,
  "missingConcepts": ["concept pédagogique manquant 1", "concept 2", ...],
  "incorrectFacts": ["podcast dit X, source dit Y", ...]
}
Note : ne liste que les vrais concepts pédagogiques — ignore les métadonnées techniques (noms de fichiers, versions logicielles, noms de diapositives).`;

                const verifyRaw = await callGPT(
                    "Tu es un expert en vérification pédagogique. Évalue la fidélité du podcast au cours source.",
                    verifyPrompt
                );
                const verifyResult = parseJSON(verifyRaw);
                lastVerifyResult = verifyResult;
                currentScore = verifyResult.fidelityScore || 0;

                await pool.query('UPDATE podcasts SET fidelity_score = $1 WHERE id = $2', [currentScore, podcastId]);

                history.push({
                    iteration,
                    score: currentScore,
                    missingCount: verifyResult.missingConcepts?.length || 0,
                });

                console.log(`[AUTO-VERIFY] Score itération ${iteration} : ${currentScore}%`);

                // Arrêt si objectif atteint
                if (currentScore >= TARGET_SCORE) {
                    console.log(`[AUTO-VERIFY] Objectif atteint : ${currentScore}%`);
                    bestScore = currentScore;
                    break;
                }

                // Arrêt si le score régresse (correction contre-productive)
                if (iteration > 1 && currentScore < bestScore - 5) {
                    console.log(`[AUTO-VERIFY] Score en régression (${currentScore}% < ${bestScore}%), arrêt.`);
                    // Restaurer le meilleur score en base
                    await pool.query('UPDATE podcasts SET fidelity_score = $1 WHERE id = $2', [bestScore, podcastId]);
                    currentScore = bestScore;
                    break;
                }

                bestScore = Math.max(bestScore, currentScore);

                if (verifyResult.missingConcepts?.length === 0 && verifyResult.incorrectFacts?.length === 0) {
                    console.log(`[AUTO-VERIFY] Aucun concept manquant, arrêt.`);
                    break;
                }

                // ── Étape 2 : Correction (max MAX_CONCEPTS_PER_PASS concepts) ─
                const allDialoguesRes = await pool.query(
                    'SELECT * FROM dialogues WHERE podcast_id = $1 ORDER BY order_index ASC',
                    [podcastId]
                );
                const allDialogues = allDialoguesRes.rows;
                const dialogueContext = allDialogues.map((d, i) => `[${i}|${d.character}] ${d.text_studio}`).join('\n');

                // Limiter les concepts pour garder le prompt sous contrôle
                const conceptsToFix = (verifyResult.missingConcepts || []).slice(0, MAX_CONCEPTS_PER_PASS);
                const factsToFix = (verifyResult.incorrectFacts || []).slice(0, 3);

                const fixPrompt = `Tu es un expert pédagogique. Enrichis le podcast en intégrant les concepts manquants.
${NORMALIZATION_INSTRUCTIONS}

DIALOGUE ACTUEL :
${dialogueContext}

CONCEPTS À INTÉGRER (prioritaires) :
${conceptsToFix.map(c => '- ' + c).join('\n')}
${factsToFix.length > 0 ? '\nFAITS À CORRIGER :\n' + factsToFix.map(f => '- ' + f).join('\n') : ''}

Conserve le style Inès/Yannick, le ratio 70/30, la structure existante.
Réponds UNIQUEMENT avec ce JSON :
{"dialogues":[{"id":<index_original>,"text_studio":"...","text_reading":"..."},...]}`;

                const fixRaw = await callGPT("Tu es un expert pédagogique.", fixPrompt);
                const fixResult = parseJSON(fixRaw);

                // Mettre à jour chaque réplique en base
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');
                    for (const d of (fixResult.dialogues || [])) {
                        const original = allDialogues[d.id];
                        if (!original) continue;

                        // Ne jamais modifier l'intro et la conclu obligatoires
                        if (original.section === 'jingle' || original.section === 'conclusion' || original.text_studio.includes('généré par intelligence artificielle')) {
                            continue;
                        }

                        const studioNorm = normalizeText(d.text_studio || '');
                        await client.query(
                            'UPDATE dialogues SET text_studio = $1, text_reading = $2 WHERE id = $3',
                            [studioNorm, d.text_reading || studioNorm, original.id]
                        );
                    }
                    await client.query('COMMIT');
                } catch (err) {
                    await client.query('ROLLBACK');
                    throw err;
                } finally {
                    client.release();
                }

                // Pause pour éviter le rate limit n8n/ChatGPT
                if (iteration < MAX_ITERATIONS && currentScore < TARGET_SCORE) {
                    await new Promise(r => setTimeout(r, 2000));
                }

            } catch (iterErr) {
                // Une itération échoue → on log et on s'arrête proprement
                console.error(`[AUTO-VERIFY] Erreur itération ${iteration}:`, iterErr.message);
                history.push({ iteration, score: currentScore, missingCount: -1, error: iterErr.message });
                break;
            }
        }

        // Retourner le meilleur score atteint + concepts encore manquants pour correction manuelle
        const finalScore = Math.max(currentScore, bestScore);
        await pool.query('UPDATE podcasts SET fidelity_score = $1 WHERE id = $2', [finalScore, podcastId]);

        const remainingConcepts = lastVerifyResult?.missingConcepts || [];
        const remainingFacts = lastVerifyResult?.incorrectFacts || [];

        verifyLocks.delete(podcastId);
        res.json({
            finalScore,
            targetReached: finalScore >= TARGET_SCORE,
            iterations: iteration,
            history,
            remainingConcepts,
            remainingFacts,
        });

    } catch (error) {
        verifyLocks.delete(podcastId);
        console.error('[AUTO-VERIFY] Erreur:', error);
        res.status(500).json({ error: 'Erreur vérification automatique', details: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Normalisation texte (chiffres → lettres, acronymes → phonétique)
// ─────────────────────────────────────────────────────────────────────────────

function unitsToFr(n) {
    const u = ['zéro','un','deux','trois','quatre','cinq','six','sept','huit','neuf',
                'dix','onze','douze','treize','quatorze','quinze','seize','dix-sept',
                'dix-huit','dix-neuf'];
    return u[n];
}

function tensToFr(n) {
    if (n < 20) return unitsToFr(n);
    const tens = ['','','vingt','trente','quarante','cinquante','soixante','soixante','quatre-vingt','quatre-vingt'];
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (t === 7 || t === 9) {
        const base = t === 7 ? 60 : 80;
        const sub = n - base;
        const subStr = sub === 1 && t === 7 ? 'et onze' : (sub < 20 ? unitsToFr(sub) : tensToFr(sub));
        return (t === 9 ? 'quatre-vingt-' : 'soixante-') + subStr;
    }
    if (u === 0) return tens[t] + (t === 8 ? 's' : '');
    if (u === 1 && t !== 8) return tens[t] + '-et-un';
    return tens[t] + '-' + unitsToFr(u);
}

function intToFr(n) {
    if (n < 0) return 'moins ' + intToFr(-n);
    if (n < 100) return tensToFr(n);
    if (n < 1000) {
        const c = Math.floor(n / 100);
        const r = n % 100;
        const centStr = c === 1 ? 'cent' : (unitsToFr(c) + ' cent' + (r === 0 && c > 1 ? 's' : ''));
        return r === 0 ? centStr : centStr + ' ' + tensToFr(r);
    }
    if (n < 1000000) {
        const m = Math.floor(n / 1000);
        const r = n % 1000;
        const milleStr = m === 1 ? 'mille' : intToFr(m) + ' mille';
        return r === 0 ? milleStr : milleStr + ' ' + intToFr(r);
    }
    const m = Math.floor(n / 1000000);
    const r = n % 1000000;
    const millionStr = intToFr(m) + ' million' + (m > 1 ? 's' : '');
    return r === 0 ? millionStr : millionStr + ' ' + intToFr(r);
}

function numberToFr(str) {
    // Gère décimales : "3,5" ou "3.5"
    if (/^\d+[,\.]\d+$/.test(str)) {
        const parts = str.replace(',', '.').split('.');
        return intToFr(parseInt(parts[0])) + ' virgule ' + parts[1].split('').map(d => unitsToFr(parseInt(d))).join(' ');
    }
    return intToFr(parseInt(str));
}

function normalizeText(text) {
    let normalized = text;

    // Chiffres isolés → lettres (pas ceux déjà dans une parenthèse phonétique)
    normalized = normalized.replace(/(?<!\()\b(\d{1,7}(?:[,\.]\d+)?)\b(?!\s*\))/g, (match) => {
        try { return numberToFr(match); } catch { return match; }
    });

    // Unités courantes après conversion
    normalized = normalized.replace(/(\w+)\s*%/g, '$1 pourcent');
    normalized = normalized.replace(/(\w+)\s*€/g, '$1 euros');
    normalized = normalized.replace(/(\w+)\s*°C/g, '$1 degrés Celsius');
    normalized = normalized.replace(/(\w+)\s*°/g, '$1 degrés');
    normalized = normalized.replace(/\s*&\s*/g, ' et ');

    // Acronymes → phonétique (uniquement si pas déjà suivi d'une parenthèse)
    const acronymMap = {
        'EISF':  'EISF (E.I.S.F.)',
        'DLC':   'DLC (Dé-El-Cé)',
        'HACCP': 'HACCP (Ha-A-Cé-Cé-Pé)',
        'DLUO':  'DLUO (Dé-El-U-O)',
        'IGP':   'IGP (I-Gé-Pé)',
        'AOP':   'AOP (A-O-Pé)',
        'AOC':   'AOC (A-O-Cé)',
        'CAP':   'CAP (Cé-A-Pé)',
        'BEP':   'BEP (Bé-E-Pé)',
        'BTS':   'BTS (Bé-Té-S)',
        'pH':    'pH (pé-ache)',
        'TVA':   'TVA (Té-Vé-A)',
        'TTC':   'TTC (Té-Té-Cé)',
        'HT':    'HT (Ache-Té)',
    };
    for (const [acronym, phonetic] of Object.entries(acronymMap)) {
        normalized = normalized.replace(new RegExp(`\\b${acronym}\\b(?!\\s*\\()`, 'g'), phonetic);
    }

    return normalized;
}

// Instructions de normalisation à injecter dans chaque prompt IA
const NORMALIZATION_INSTRUCTIONS = `
NORMALISATION OBLIGATOIRE DU TEXTE (applique à chaque réplique) :
- Tous les chiffres en toutes lettres : "150" → "cent cinquante", "3,5" → "trois virgule cinq"
- Tous les acronymes avec phonétique entre parenthèses : "EISF" → "EISF (E.I.S.F.)", "HACCP" → "HACCP (Ha-A-Cé-Cé-Pé)"
- "%" → "pourcent", "€" → "euros", "°C" → "degrés Celsius", "&" → "et"
- text_studio = version avec phonétique pour la voix TTS (ex: "l'EISF (E.I.S.F.) forme cent cinquante apprentis")
- text_reading = version lisible sans parenthèses (ex: "l'EISF forme 150 apprentis")`;

module.exports = { router, normalizeText, NORMALIZATION_INSTRUCTIONS };