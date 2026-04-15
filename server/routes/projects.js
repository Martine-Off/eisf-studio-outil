const express = require('express');
const multer = require('multer');
const mammoth = require('mammoth');
const pool = require('../models/db');
const authMiddleware = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const { OpenAI } = require('openai');

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Assurer que le dossier uploads/ existe
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuration upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    },
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext !== '.docx' && ext !== '.doc') {
            return cb(new Error('Seuls les fichiers Word (.docx, .doc) sont acceptés'));
        }
        cb(null, true);
    },
    limits: { fileSize: 500 * 1024 * 1024 } // 500 MB max
});

// Lister les projets de l'utilisateur
router.get('/', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM projects WHERE user_id = $1 ORDER BY updated_at DESC',
            [req.userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Erreur liste projets:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Créer projet + upload fichier
router.post('/create', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        const { title, content } = req.body;
        const userId = req.userId;

        // Auto-create user if missing (helpful for mock DB transition)
        const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
        if (userCheck.rows.length === 0) {
            const bcrypt = require('bcrypt');
            const hash = await bcrypt.hash('admin', 12);
            await pool.query('INSERT INTO users (id, email, password_hash, first_name) VALUES ($1, $2, $3, $4)', [userId, `auto_${userId}@eisf.fr`, hash, 'AutoUser']);
        }

        if (!req.file && !content) {
            return res.status(400).json({ error: 'Fichier .docx ou texte requis' });
        }

        let cleanedText = '';
        let wordCount = 0;
        let filePath = null;
        let educationalContent = [];

        if (req.file) {
            filePath = req.file.path;
            // Lire le fichier Word
            const result = await mammoth.extractRawText({ path: filePath });
            const text = result.value;

            // Parser le contenu
            const lines = text.split('\n').filter(line => line.trim());

            // Filtrer les lignes pédagogiques
            educationalContent = lines.filter(line => {
                // Ignorer métadonnées Storyline
                if (line.match(/^[a-zA-Z0-9+/\-]{15,}$/)) return false;
                if (line.includes('Zone de texte') || line.includes('État Normal')) return false;
                if (line.length < 20) return false;
                return true;
            });
            cleanedText = educationalContent.join('\n');
            wordCount = educationalContent.join(' ').split(/\s+/).length;
        } else if (content) {
            cleanedText = content;
            educationalContent = content.split('\n').filter(line => line.trim().length > 0);
            wordCount = content.split(/\s+/).length;
        }

        // Créer le projet dans la BDD
        const projectResult = await pool.query(
            'INSERT INTO projects (user_id, title, source_file_path, cleaned_text) VALUES ($1, $2, $3, $4) RETURNING id, title, status, created_at',
            [userId, title || (req.file ? req.file.originalname : 'Nouveau Projet'), filePath, cleanedText]
        );

        const project = projectResult.rows[0];

        res.json({
            project,
            wordCount,
            contentLines: educationalContent.length,
            needsSplitting: wordCount > 1500, // >10 min
            contentPreview: educationalContent.slice(0, 5).join('\n'),
        });
    } catch (error) {
        console.error('Erreur upload:', error);
        res.status(500).json({ error: "Erreur lors de l'import: " + error.message });
    }
});

// Récupérer un projet spécifique
router.get('/:projectId', authMiddleware, async (req, res) => {
    try {
        const { projectId } = req.params;

        const result = await pool.query(
            'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
            [projectId, req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Projet non trouvé' });
        }

        // Mettre à jour last_opened_at
        await pool.query(
            'UPDATE projects SET last_opened_at = NOW() WHERE id = $1',
            [projectId]
        );

        // Récupérer les podcasts du projet
        const podcasts = await pool.query(
            'SELECT * FROM podcasts WHERE project_id = $1 ORDER BY order_index ASC',
            [projectId]
        );

        res.json({
            project: result.rows[0],
            podcasts: podcasts.rows,
        });
    } catch (error) {
        console.error('Erreur récupération projet:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Récupérer tous les dialogues d'un projet (via ses podcasts)
router.get('/:projectId/dialogues', authMiddleware, async (req, res) => {
    try {
        const { projectId } = req.params;

        // Vérifier que le projet appartient à l'utilisateur
        const projCheck = await pool.query(
            'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
            [projectId, req.userId]
        );
        if (projCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Projet non trouvé' });
        }

        // Récupérer tous les dialogues via les podcasts du projet
        const result = await pool.query(
            `SELECT d.*, p.title as podcast_title
             FROM dialogues d
             JOIN podcasts p ON d.podcast_id = p.id
             WHERE p.project_id = $1
             ORDER BY p.order_index ASC, d.order_index ASC`,
            [projectId]
        );

        res.json(result.rows); // Retourne [] si aucun dialogue
    } catch (error) {
        console.error('Erreur récupération dialogues projet:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Supprimer un projet
router.delete('/:projectId', authMiddleware, async (req, res) => {
    try {
        const { projectId } = req.params;

        const result = await pool.query(
            'DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id',
            [projectId, req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Projet non trouvé' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Erreur suppression projet:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/projects/:id/macro-verify
router.post('/:id/macro-verify', async (req, res) => {
    try {
        const projectId = req.params.id;

        // 1. Récupération des scripts via la table dialogues
        const dialoguesRes = await pool.query(
            `SELECT p.id as podcast_id, d.character, d.text_studio 
             FROM podcasts p 
             JOIN dialogues d ON p.id = d.podcast_id 
             WHERE p.project_id = $1 
             ORDER BY p.order_index ASC, d.order_index ASC`,
            [projectId]
        );

        if (dialoguesRes.rows.length === 0) {
            return res.status(404).json({ error: 'Aucun dialogue trouvé pour ce projet.' });
        }

        // 2. Concaténation robuste
        const podcastsMap = new Map();
        dialoguesRes.rows.forEach(d => {
            if (!podcastsMap.has(d.podcast_id)) {
                podcastsMap.set(d.podcast_id, []);
            }
            podcastsMap.get(d.podcast_id).push(`${d.character || 'Intervenant'}: ${d.text_studio || ''}`);
        });

        const fullContent = Array.from(podcastsMap.values())
            .map(dialogues => dialogues.join('\n'))
            .join('\n\n--- ÉPISODE SUIVANT ---\n\n');

        // 3. Appel OpenAI (gpt-4o-mini avec JSON object forcé)
        const systemPrompt = `Tu es un expert pédagogique et éditorial.
Évalue cet ensemble de scripts de podcasts concernant un cours.
Vérifie si le cours entier est bien couvert de façon cohérente, globale, et si rien d'important n'a été oublié.

Renvoie UNIQUEMENT un objet JSON valide avec cette structure stricte :
{
  "score": <entier sur 100>,
  "observations": [
    "<observation 1>",
    "<observation 2>"
  ]
}`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Voici les scripts concaténés :\n\n${fullContent}` }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3
        });

        const parsedResponse = JSON.parse(completion.choices[0].message.content);
        const macroScore = parseInt(parsedResponse.score, 10) || 0;
        const macroFeedback = JSON.stringify(parsedResponse.observations || []); 

        // 4. Update de la base de données
        await pool.query(
            'UPDATE projects SET macro_score = $1, macro_feedback = $2 WHERE id = $3',
            [macroScore, macroFeedback, projectId]
        );

        // 5. Réponse
        res.json({
            success: true,
            score: macroScore,
            observations: parsedResponse.observations
        });

    } catch (error) {
        console.error('Erreur lors du macro-verify:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la vérification globale.' });
    }
});

module.exports = router;
