const express = require('express');

const pool = require('../models/db');
const authMiddleware = require('../middleware/auth');
const mammoth = require('mammoth');

const router = express.Router();

// Générer dialogue Anabelle/Bryan
router.post('/generate', authMiddleware, async (req, res) => {
    try {
        const { projectId, content, targetDuration } = req.body;

        if (!content || !targetDuration) {
            return res.status(400).json({ error: 'Contenu et durée cible requis' });
        }

        // Calculer nombre de mots cible (150 mots/min)
        const targetWords = targetDuration * 150;

        const prompt = `
Tu es un générateur de podcasts pédagogiques EISF (École d'Ingénierie et de Sciences Fromagères).

CONTRAINTES STRICTES :
- Durée : ${targetDuration} minutes (${targetWords} mots)
- Personnages : Anabelle (70%) et Bryan (30%)
- Anabelle = experte, ton posé, professionnel. Explique les concepts clairement.
- Bryan = apprenant curieux, spontané. Pose des questions, reformule, fait des liens concrets.
- Jingle obligatoire (première réplique d'Anabelle) : "Ceci est un podcast produit à partir des cours originaux de l'EISF."
- Structure : Jingle (15s) + Intro (30s) + Contenu avec quiz intégré (3-5min) + Conclusion (30s)
- Quiz : Intégré naturellement dans le dialogue, pas de section séparée
- Ton conversationnel et naturel (pas "Chers auditeurs", pas "Bienvenue dans ce cours")

CONTENU SOURCE :
${content}

GÉNÈRE LE DIALOGUE AU FORMAT JSON UNIQUEMENT (pas de texte avant/après) :
{
  "title": "Titre accrocheur du podcast (max 50 caractères)",
  "dialogues": [
    {"character": "anabelle", "text": "...", "section": "jingle"},
    {"character": "bryan", "text": "...", "section": "jingle"},
    {"character": "anabelle", "text": "...", "section": "intro"},
    ...
  ]
}

VÉRIFIE AVANT D'ENVOYER :
✅ Jingle = texte EXACT fourni
✅ Ratio Anabelle/Bryan ≈ 70/30
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
                    { character: "anabelle", text: "Ceci est un podcast produit à partir des cours originaux de l'EISF.", section: "jingle" },
                    { character: "anabelle", text: "Bonjour à tous. Aujourd'hui, nous allons découvrir les secrets de la fabrication du fromage.", section: "intro" },
                    { character: "bryan", text: "Ça a l'air délicieux ! Par quoi on commence ?", section: "intro" },
                    { character: "anabelle", text: "Tout commence par le lait. Sa qualité est essentielle.", section: "content" },
                    { character: "bryan", text: "Et ensuite, c'est l'étape du caillage, c'est ça ?", section: "content" },
                    { character: "anabelle", text: "Exactement. C'est là que la magie opère.", section: "conclusion" }
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
            const completion = await openai.chat.completions.create({
                messages: [
                    { role: "system", content: "Tu es un assistant pédagogique expert qui génère des dialogues JSON." },
                    { role: "user", content: prompt }
                ],
                model: "gpt-4o-mini",
                response_format: { type: "json_object" },
            });

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
        const { projectId, targetDuration } = req.body;

        // Récupérer le chemin du fichier source
        const projectResult = await pool.query(
            'SELECT source_file_path FROM projects WHERE id = $1 AND user_id = $2',
            [projectId, req.userId]
        );

        if (projectResult.rows.length === 0) {
            return res.status(404).json({ error: 'Projet non trouvé' });
        }

        const filePath = projectResult.rows[0].source_file_path;

        // Lire le fichier Word
        const result = await mammoth.extractRawText({ path: filePath });
        const text = result.value;

        // Filtrer le contenu pédagogique
        const lines = text.split('\n').filter(line => line.trim());
        const educationalContent = lines.filter(line => {
            if (line.match(/^[a-zA-Z0-9+/\-]{15,}$/)) return false;
            if (line.includes('Zone de texte') || line.includes('État Normal')) return false;
            if (line.length < 20) return false;
            return true;
        });

        // Rediriger vers la route de génération
        req.body.content = educationalContent.join('\n');
        req.body.targetDuration = targetDuration || 5;

        // Appeler la logique de génération directement
        // (Réutiliser le handler /generate ci-dessus via un forwarding interne)
        const genHandler = router.stack.find(r => r.route?.path === '/generate');
        if (genHandler) {
            return genHandler.route.stack[0].handle(req, res);
        }

        res.status(500).json({ error: 'Route de génération non trouvée' });
    } catch (error) {
        console.error('Erreur génération depuis projet:', error);
        res.status(500).json({ error: 'Erreur serveur' });
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

module.exports = router;
