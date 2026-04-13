const express = require('express');

const pool = require('../models/db');
const authMiddleware = require('../middleware/auth');
const mammoth = require('mammoth');

const router = express.Router();

// Générer dialogue Inès/Yannick
router.post('/generate', authMiddleware, async (req, res) => {
    try {
        console.log('[GENERATE] Début de la route /generate');
        console.log('[GENERATE] req.body:', JSON.stringify(req.body).substring(0, 200));
        const { projectId, content, targetDuration } = req.body;
        console.log('[GENERATE] projectId:', projectId, 'targetDuration:', targetDuration, 'content length:', content?.length);

        if (!content || !targetDuration) {
            return res.status(400).json({ error: 'Contenu et durée cible requis' });
        }

        // Calculer nombre de mots cible (150 mots/min)
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
    {"character": "ines", "text": "...", "section": "intro"},
    ...
  ]
}

VÉRIFIE AVANT D'ENVOYER :
✅ Jingle = texte EXACT fourni
✅ Ratio Inès/Yannick ≈ 70/30
✅ Durée totale = ${targetDuration} min (±30 secondes OK)
✅ Ton conversationnel
✅ Quiz intégré dans dialogue
✅ JSON valide
`;

        let generatedText;

        // MOCK AI GENERATION
        if (process.env.USE_MOCK_DB === 'true' && !process.env.OPENAI_API_KEY) {
            const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
            await delay(2000); // Simuler un délai de génération

            const mockDialogue = {
                title: "Podcast Mock : La Fabrication du Fromage",
                dialogues: [
                    { character: "ines", text: "Ceci est un podcast produit à partir des cours originaux de l'EISF.", section: "jingle" },
                    { character: "ines", text: "Bonjour à tous. Aujourd'hui, nous allons découvrir les secrets de la fabrication du fromage.", section: "intro" },
                    { character: "yannick", text: "Ça a l'air délicieux ! Par quoi on commence ?", section: "intro" },
                    { character: "ines", text: "Tout commence par le lait. Sa qualité est essentielle.", section: "content" },
                    { character: "yannick", text: "Et ensuite, c'est l'étape du caillage, c'est ça ?", section: "content" },
                    { character: "ines", text: "Exactement. C'est là que la magie opère.", section: "conclusion" }
                ]
            };

            generatedText = JSON.stringify(mockDialogue);
            console.log('⚠️ [AI] Mock generation completed successfully');
        } else {
            // VRAIE GÉNÉRATION (OpenAI GPT)
            if (!process.env.OPENAI_API_KEY) {
                console.error("Clé API OpenAI manquante");
                return res.status(500).json({ error: 'Configuration serveur incomplète (Clé API manquante)' });
            }

            const OpenAI = require('openai');
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

            console.log('🤖 [AI] calling OpenAI...');
            console.log('[AI] Prompt length:', prompt.length);
            console.log('[AI] Target duration:', targetDuration, 'minutes');

            const completion = await openai.chat.completions.create({
                messages: [
                    { role: "system", content: "Tu es un assistant pédagogique expert qui génère des dialogues JSON." },
                    { role: "user", content: prompt }
                ],
                model: "gpt-4o-mini",
                response_format: { type: "json_object" },
            });

            console.log('[AI] OpenAI response received');
            console.log('[AI] Response length:', completion.choices[0].message.content.length);
            generatedText = completion.choices[0].message.content;
        }

        // Parser JSON (extraire de ```json ... ``` ou nettoyer)
        const jsonMatch = generatedText.match(/```json\n([\s\S]*?)\n```/);
        let dialogue;
        try {
            dialogue = JSON.parse(jsonMatch ? jsonMatch[1] : generatedText);
        } catch (parseErr) {
            // Tenter un nettoyage plus agressif
            const cleaned = generatedText.replace(/```json\n?|```/g, '').trim();
            dialogue = JSON.parse(cleaned);
        }

        // Normaliser (chiffres → lettres, acronymes → phonétique)
        const normalized = dialogue.dialogues.map(line => ({
            ...line,
            text_studio: normalizeText(line.text),
            text_reading: line.text,
        }));

        // Calculer le nombre de mots total
        const actualWordCount = normalized.reduce((sum, d) => sum + d.text_studio.split(/\s+/).length, 0);

        // Créer podcast dans BDD
        const podcastResult = await pool.query(
            'INSERT INTO podcasts (project_id, title, word_count, duration_seconds) VALUES ($1, $2, $3, $4) RETURNING id',
            [projectId, dialogue.title, actualWordCount, targetDuration * 60]
        );

        const podcastId = podcastResult.rows[0].id;

        // Insérer dialogues
        for (let i = 0; i < normalized.length; i++) {
            const d = normalized[i];
            const wordCount = d.text_studio.split(/\s+/).length;
            const estimatedDuration = Math.round((wordCount / 150) * 60); // secondes
            await pool.query(
                'INSERT INTO dialogues (podcast_id, order_index, character, text_studio, text_reading, duration_seconds, section) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [podcastId, i, d.character, d.text_studio, d.text_reading, estimatedDuration, d.section]
            );
        }

        res.json({
            podcastId,
            title: dialogue.title,
            wordCount: actualWordCount,
            dialogueCount: normalized.length,
        });
    } catch (error) {
        console.error('Erreur génération IA:', error);
        res.status(500).json({ error: 'Erreur lors de la génération' });
    }
});

// Régénérer à partir du fichier Word du projet
router.post('/generate-from-project', authMiddleware, async (req, res) => {
    try {
        console.log('[GENERATE-PROJECT] Début génération depuis projet');
        const { projectId, segments } = req.body;
        
        let segmentsToGenerate = segments;

        // Fallback si pas de segments
        if (!segmentsToGenerate || segmentsToGenerate.length === 0) {
            const projectResult = await pool.query('SELECT cleaned_text FROM projects WHERE id = $1', [projectId]);
            if (projectResult.rows.length === 0) return res.status(404).json({ error: 'Projet non trouvé' });
            segmentsToGenerate = [{ title: 'Podcast Pédagogique', content: projectResult.rows[0].cleaned_text }];
        }

        if (!process.env.OPENAI_API_KEY || process.env.USE_MOCK_AI === 'true') {
            console.log('[GENERATE-PROJECT] ⚠️ Utilisation du MOCK_AI (Pas de connexion OpenAI valide)');
            const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
            await delay(1500);

            let allPodcasts = [];
            for (let idx = 0; idx < segmentsToGenerate.length; idx++) {
                const segment = segmentsToGenerate[idx];
                const dialogue = {
                    title: segment.title,
                    dialogues: [
                        { character: "ines", text_studio: "Ceci est un podcast produit à partir des cours originaux de l'EISF.", text_reading: "Ceci est un podcast produit à partir des cours originaux de l'É I S F.", section: "jingle" },
                        { character: "ines", text_studio: "Bonjour, aujourd'hui nous découvrons : " + segment.title, text_reading: "Bonjour, aujourd'hui nous découvrons : " + segment.title, section: "intro" },
                        { character: "yannick", text_studio: "C'est super excitant ! Par quoi on commence ?", text_reading: "C'est super excitant ! Par quoi on commence ?", section: "content" },
                        { character: "ines", text_studio: "Voici les premiers principes à retenir.", text_reading: "Voici les premiers principes à retenir.", section: "content" },
                        { character: "yannick", text_studio: "Parfait, c'est très clair merci !", text_reading: "Parfait, c'est très clair merci !", section: "conclusion" }
                    ]
                };

                const podcastResult = await pool.query(
                    'INSERT INTO podcasts (project_id, title, order_index, word_count, duration_seconds) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                    [projectId, dialogue.title, idx, 60, 120]
                );

                const podcastId = podcastResult.rows[0].id;
                allPodcasts.push({ podcastId, title: dialogue.title });

                for (let i = 0; i < dialogue.dialogues.length; i++) {
                    const d = dialogue.dialogues[i];
                    await pool.query(
                        'INSERT INTO dialogues (podcast_id, order_index, character, text_studio, text_reading, duration_seconds, section) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                        [podcastId, i, d.character, d.text_studio, d.text_reading, 24, d.section]
                    );
                }
            }
            return res.json({ success: true, podcasts: allPodcasts });
        }

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: 'Clé API OpenAI manquante' });
        }
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        
        let allPodcasts = [];

        // Appels séquentiels importants pour rate limit
        for (let idx = 0; idx < segmentsToGenerate.length; idx++) {
            const segment = segmentsToGenerate[idx];
            console.log(`[GENERATE-PROJECT] Processing segment ${idx+1}/${segmentsToGenerate.length} : ${segment.title}`);
            const content = segment.content;
            if (!content || content.trim().length < 20) continue;

            const prompt = `Tu es un générateur de podcasts pédagogiques EISF (École d'Ingénierie et de Sciences Fromagères).
Génère le dialogue de l'épisode correspondant à la portion de cours suivante.
Titre de l'épisode: ${segment.title}

CONTRAINTES STRICTES :
- Personnages : Inès (70%) et Yannick (30%).
- Inès = experte, ton posé, professionnel. Explique les concepts clairement.
- Yannick = apprenant curieux, spontané. Pose des questions, reformule.
- Jingle obligatoire (première réplique d'Inès) : "Ceci est un podcast produit à partir des cours originaux de l'EISF."
- Format : JSON uniquement.

CONTENU SOURCE :
${content}

GÉNÈRE LE DIALOGUE AU FORMAT JSON UNIQUEMENT :
{
  "title": "${segment.title}",
  "dialogues": [
    {"character": "ines", "text_studio": "...", "text_reading": "...", "section": "jingle"},
    {"character": "yannick", "text_studio": "...", "text_reading": "...", "section": "intro"}
  ]
}`;

            const completion = await openai.chat.completions.create({
                messages: [
                    { role: "system", content: "Tu es un assistant pédagogique expert." },
                    { role: "user", content: prompt }
                ],
                model: "gpt-4o-mini",
                response_format: { type: "json_object" },
            });

            console.log('[GENERATE-PROJECT] Réponse OpenAI reçue pour le segment', idx + 1);
            let dialogue = JSON.parse(completion.choices[0].message.content);

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
        }

        console.log('[GENERATE-PROJECT] ✅ Génération complétée, podcasts créés:', allPodcasts.length);
        res.json({ success: true, podcasts: allPodcasts });

    } catch (error) {
        console.error('[GENERATE-PROJECT] ERREUR:', error);
        res.status(500).json({ error: 'Erreur génération IA', details: error.message });
    }
});

// Fonction normalisation
function normalizeText(text) {
    let normalized = text;

    // Chiffres courants → Lettres
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

    // Remplacer les nombres isolés par leur version en lettres
    for (const [num, word] of Object.entries(numberMap)) {
        const regex = new RegExp(`\\b${num}\\b`, 'g');
        normalized = normalized.replace(regex, word);
    }

    // Acronymes courants → Phonétique
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
        // Ne remplacer que si l'acronyme n'est pas déjà suivi de parenthèses
        const regex = new RegExp(`\\b${acronym}\\b(?!\\s*\\()`, 'g');
        normalized = normalized.replace(regex, phonetic);
    }

    return normalized;
}

// Prévisualisation : extraire et nettoyer le texte du .docx sans générer
router.post('/preview', authMiddleware, async (req, res) => {
    try {
        const { projectId } = req.body;

        const projectResult = await pool.query(
            'SELECT source_file_path, title, cleaned_text FROM projects WHERE id = $1 AND user_id = $2',
            [projectId, req.userId]
        );

        if (projectResult.rows.length === 0) {
            return res.status(404).json({ error: 'Projet non trouvé' });
        }

        const { source_file_path, title, cleaned_text } = projectResult.rows[0];

        // Convertir en HTML pour avoir les headings
        const resultHtml = await mammoth.convertToHtml({ path: source_file_path });
        const html = resultHtml.value;

        // Découper selon H1, H2, H3
        const parts = html.split(/(<h[1-3]>.*?<\/h[1-3]>)/ig);
        let currentSection = { title: 'Introduction', content: '' };
        let sections = [];
        
        parts.forEach(part => {
            const hMatch = part.match(/<h([1-3])>(.*?)<\/h\1>/i);
            if (hMatch) {
                if (currentSection.content.trim()) {
                    sections.push({...currentSection});
                }
                const level = parseInt(hMatch[1]);
                currentSection = { title: hMatch[2].replace(/<[^>]+>/g, '').trim() || 'Chapitre', content: '', level };
            } else {
                currentSection.content += part;
            }
        });
        if (currentSection.content.trim()) sections.push({...currentSection});

        let segments = [];
        let totalWordCount = 0;

        for (const s of sections) {
            // Nettoyer l'HTML pour le wordcount
            const textContent = s.content.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
            if (!textContent || textContent.length < 20) continue;

            const words = textContent.split(/\s+/).filter(w => w);
            const wordCount = words.length;
            totalWordCount += wordCount;
            // user format: (nombre de mots de la section / 130) * 60 secondes
            const estimatedDuration = Math.round((wordCount / 130) * 60);

            if (estimatedDuration > 420) { // > 7 minutes
                const chunkCount = Math.ceil(words.length / 900);
                for (let i = 0; i < chunkCount; i++) {
                    const chunkWords = words.slice(i * 900, (i + 1) * 900);
                    const chunkWordCount = chunkWords.length;
                    const chunkDuration = Math.round((chunkWordCount / 130) * 60);
                    segments.push({
                        title: `${s.title} (Partie ${i + 1})`,
                        wordCount: chunkWordCount,
                        estimatedMinutes: Math.round(chunkDuration / 60) || 1,
                        content: chunkWords.join(' ')
                    });
                }
            } else {
                segments.push({
                    title: s.title || 'Introduction',
                    wordCount: wordCount,
                    estimatedMinutes: Math.round(estimatedDuration / 60) || 1,
                    content: textContent
                });
            }
        }

        res.json({
            projectTitle: title,
            wordCount: totalWordCount,
            lineCount: segments.length,
            cleanedText: cleaned_text || '',
            chapters: segments,
            rawLinesPreview: (cleaned_text || '').substring(0, 300).split('\n'),
        });

    } catch (error) {
        console.error('[PREVIEW] Erreur:', error);
        res.status(500).json({ error: 'Erreur lors de la prévisualisation' });
    }
});

// Régénération unitaire d'une ligne
router.post('/regenerate-line', authMiddleware, async (req, res) => {
    try {
        const { dialogueId, currentText, style, contextBefore, contextAfter } = req.body;

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: 'Config OpenAI manquante' });
        }

        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const prompt = `Tu es un scénariste de podcast pédagogique. Ton but est de reformuler UNE réplique d'un personnage de manière naturelle sans casser la continuité du dialogue.

CONTEXTE AVANT:
${(contextBefore || []).join('\n')}

RÉPLIQUE ACTUELLE À REFORMULER:
${currentText}

CONTEXTE APRÈS:
${(contextAfter || []).join('\n')}

Contrainte: reformule en mode "${style}" (simplify: rends la phrase très facile à comprendre, detail: ajoute plus de valeur/détails pédagogiques, rephrase: change la tournure).
Génère UNIQUEMENT un JSON valide :
{
  "text_studio": "La nouvelle réplique générée",
  "text_reading": "La nouvelle réplique générée"
}
`;

        const completion = await openai.chat.completions.create({
            messages: [{ role: "system", content: "Tu es un expert pédagogique." }, { role: "user", content: prompt }],
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
        });

        const dialogue = JSON.parse(completion.choices[0].message.content);
        
        // Mettre à jour en BDD
        await pool.query('UPDATE dialogues SET text_studio = $1, text_reading = $2 WHERE id = $3', [dialogue.text_studio, dialogue.text_reading || dialogue.text_studio, dialogueId]);

        res.json({ text_studio: dialogue.text_studio, text_reading: dialogue.text_reading || dialogue.text_studio });
    } catch (error) {
        console.error('[REGENERATE] Erreur:', error);
        res.status(500).json({ error: 'Erreur lors de la régénération' });
    }
});

// Vérification IA (Fidélité au script source)
router.post('/verify', authMiddleware, async (req, res) => {
    try {
        const { podcastId } = req.body;

        const podcastRes = await pool.query('SELECT project_id FROM podcasts WHERE id = $1', [podcastId]);
        if (podcastRes.rows.length === 0) return res.status(404).json({ error: 'Podcast non trouvé' });
        
        const projectId = podcastRes.rows[0].project_id;
        const projectRes = await pool.query('SELECT cleaned_text FROM projects WHERE id = $1', [projectId]);
        const cleanedText = projectRes.rows[0]?.cleaned_text;

        const dialoguesRes = await pool.query('SELECT text_studio FROM dialogues WHERE podcast_id = $1 ORDER BY order_index ASC', [podcastId]);
        const dialogueText = dialoguesRes.rows.map(d => d.text_studio).join('\n');

        if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'Config OpenAI manquante' });

        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const prompt = `Analyse l'écart entre le cours brut (Source) et le podcast généré (Podcast).
Source:
${cleanedText}

Podcast généré:
${dialogueText}

Retourne UNIQUEMENT un JSON au format exact suivant:
{
  "fidelityScore": 87,
  "missingConcepts": ["concept pédagogique manquant 1", "concept manquant 2"],
  "addedConcepts": ["élément inventé 1"]
}`;

        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
        });

        const resultJson = JSON.parse(completion.choices[0].message.content);

        await pool.query('UPDATE podcasts SET fidelity_score = $1 WHERE id = $2', [resultJson.fidelityScore || null, podcastId]);

        res.json(resultJson);
    } catch (error) {
        console.error('[VERIFY] Erreur:', error);
        res.status(500).json({ error: 'Erreur lors de la vérification' });
    }
});

// Correction IA (Ajout des concepts manquants)
router.post('/fix-missing-concepts', authMiddleware, async (req, res) => {
    try {
        const { podcastId, missingConcepts } = req.body;

        const dialoguesRes = await pool.query('SELECT * FROM dialogues WHERE podcast_id = $1 ORDER BY order_index ASC', [podcastId]);
        const dialogues = dialoguesRes.rows;
        const dialogueText = dialogues.map((d, i) => `[ID:${i} - ${d.character}] ${d.text_studio}`).join('\n');

        if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'Config OpenAI manquante' });
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const prompt = `Voici un dialogue de podcast existant :
${dialogueText}

Concepts manquants à injecter :
- ${missingConcepts.join('\n- ')}

Génère une suite à insérer à la fin du dialogue (ou à un endroit pertinent) pour aborder de manière naturelle ces concepts manquants.
Utilise 'ines' pour l'expert et 'yannick' pour l'apprenant.
Renvoie UNIQUEMENT un JSON avec un tableau "newDialogues":
{
  "newDialogues": [
    {"character": "ines", "text_studio": "...", "text_reading": "...", "section": "content"},
    {"character": "yannick", "text_studio": "...", "text_reading": "...", "section": "content"}
  ]
}`;

        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
        });

        const resultJson = JSON.parse(completion.choices[0].message.content);
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
        res.status(500).json({ error: 'Erreur lors de la correction' });
    }
});

module.exports = router;
