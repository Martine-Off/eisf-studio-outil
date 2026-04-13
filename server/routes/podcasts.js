const express = require('express');
const pool = require('../models/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

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

module.exports = router;
