const express = require('express');
const multer = require('multer');
const pool = require('../models/db');
const authMiddleware = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const { callWebhook } = require('../utils/callWebhook');
const { parseStorylineFile } = require('../utils/storylineParser');

const router = express.Router();

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
        // Sanitize : conserver seulement le basename, remplacer les caractères dangereux
        const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9.\-_\u00C0-\u017F]/g, '_');
        cb(null, Date.now() + '-' + safeName);
    },
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext !== '.docx' && ext !== '.doc') {
            return cb(new Error('Seuls les fichiers Word (.docx, .doc) sont acceptés'));
        }
        // Vérifier aussi le MIME type déclaré
        const allowedMimes = [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
            'application/octet-stream', // certains OS déclarent ainsi
        ];
        if (!allowedMimes.includes(file.mimetype)) {
            return cb(new Error('Type MIME invalide pour un fichier Word'));
        }
        cb(null, true);
    },
    limits: { fileSize: 25 * 1024 * 1024 } // 25 MB max
});

// Lister les projets de l'utilisateur
router.get('/', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT p.*,
                (SELECT COUNT(*) FROM podcasts WHERE project_id = p.id)::int AS podcast_count
             FROM projects p
             WHERE p.user_id = $1
             ORDER BY p.updated_at DESC`,
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

        if (!req.file && !content) {
            return res.status(400).json({ error: 'Fichier .docx ou texte requis' });
        }

        let cleanedText = '';
        let wordCount = 0;
        let filePath = null;
        let educationalContent = [];

        if (req.file) {
            filePath = req.file.path;
            const { chapters, markdown } = await parseStorylineFile(filePath);
            cleanedText = markdown;
            wordCount = cleanedText.split(/\s+/).filter(w => w).length;
            educationalContent = cleanedText.split('\n').filter(l => l.trim());
            console.log(`[IMPORT] ${chapters.length} chapitre(s) Storyline détecté(s), ${wordCount} mots.`);
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

        const headingsFound = (cleanedText.match(/^#{1,3} .+/gm) || []).length;
        res.json({
            project,
            wordCount,
            contentLines: educationalContent.length,
            headingsFound,
            needsAiSplitting: headingsFound < 2,
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

// PATCH /api/projects/:projectId/title
router.patch('/:projectId/title', authMiddleware, async (req, res) => {
    try {
        const { projectId } = req.params;
        const { title } = req.body;
        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Titre requis' });
        }
        const result = await pool.query(
            'UPDATE projects SET title = $1, updated_at = NOW() AT TIME ZONE \'UTC\' WHERE id = $2 AND user_id = $3 RETURNING id, title, updated_at',
            [title.trim(), projectId, req.userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Projet non trouvé' });
        }
        const row = result.rows[0];
        res.json({ success: true, title: row.title, updated_at: new Date(row.updated_at).toISOString() });
    } catch (error) {
        console.error('Erreur renommage projet:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/projects/:id/macro-verify
router.post('/:id/macro-verify', authMiddleware, async (req, res) => {
    try {
        const projectId = req.params.id;

        // Vérifier que le projet appartient à l'utilisateur
        const ownerCheck = await pool.query(
            'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
            [projectId, req.userId]
        );
        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Projet introuvable ou accès refusé' });
        }

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

        // Construire le contenu et le tronquer à 10 000 chars pour rester dans le contexte GPT
        const MAX_CONTENT = 10000;
        let fullContent = Array.from(podcastsMap.values())
            .map(dialogues => dialogues.join('\n'))
            .join('\n\n--- ÉPISODE SUIVANT ---\n\n');
        if (fullContent.length > MAX_CONTENT) {
            fullContent = fullContent.substring(0, MAX_CONTENT) + '\n[... contenu tronqué ...]';
        }

        // 3. Appel Make webhook — évaluation macro
        const rawText = await callWebhook({
            type: 'macro-evaluate',
            prompt: `Tu es un expert pédagogique et éditorial.\nÉvalue cet ensemble de scripts de podcasts concernant un cours.\nVérifie si le cours entier est bien couvert de façon cohérente, globale, et si rien d'important n'a été oublié.\n\nRenvoie UNIQUEMENT un objet JSON valide avec cette structure stricte, sans texte avant ni après :\n{\n  "score": <entier sur 100>,\n  "observations": [\n    "<observation 1>",\n    "<observation 2>"\n  ]\n}\n\nVoici les scripts concaténés :\n\n${fullContent}`
        });
        if (!rawText) throw new Error('Make n\'a pas répondu pour l\'évaluation macro');
        const cleaned = rawText.replace(/```json\n?|```/g, '').trim();
        const parsedResponse = JSON.parse(cleaned);
        const macroScore = parseInt(parsedResponse.score, 10) || 0;
        const macroFeedback = parsedResponse.observations || [];

        // 4. Update de la base de données
        await pool.query(
            'UPDATE projects SET macro_score = $1, macro_feedback = $2 WHERE id = $3',
            [macroScore, JSON.stringify(macroFeedback), projectId]
        );

        // 5. Réponse
        res.json({
            success: true,
            score: macroScore,
            observations: parsedResponse.observations
        });

    } catch (error) {
        console.error('Erreur lors du macro-verify:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la vérification globale.', details: error.message });
    }
});

module.exports = router;
