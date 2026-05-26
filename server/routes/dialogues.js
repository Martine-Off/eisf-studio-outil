// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
const express = require('express');
const pool = require('../models/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Réordonner les dialogues (globalement), déclaré AVANT /:dialogueId
router.patch('/reorder', authMiddleware, async (req, res) => {
    try {
        const { dialogues } = req.body; // [{ id, order_index }, ...]

        if (!Array.isArray(dialogues)) {
            return res.status(400).json({ error: 'Format invalide' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const d of dialogues) {
                await client.query(
                    'UPDATE dialogues SET order_index = $1 WHERE id = $2',
                    [d.order_index, d.id]
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
        console.error('Erreur réorganisation globale:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

const updateDialogueHandler = async (req, res) => {

    try {
        const { dialogueId } = req.params;
        const { text_studio, text_reading, character, section } = req.body;

        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (text_studio !== undefined) {
            updates.push(`text_studio = $${paramIndex++}`);
            values.push(text_studio);
        }
        if (text_reading !== undefined) {
            updates.push(`text_reading = $${paramIndex++}`);
            values.push(text_reading);
        }
        if (character !== undefined) {
            updates.push(`character = $${paramIndex++}`);
            values.push(character);
        }
        if (section !== undefined) {
            updates.push(`section = $${paramIndex++}`);
            values.push(section);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
        }

        values.push(dialogueId);
        await pool.query(
            `UPDATE dialogues SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
            values
        );

        // Bumper updated_at du podcast parent (le trigger podcasts ne se déclenche pas sur dialogues)
        await pool.query(
            'UPDATE podcasts SET updated_at = NOW() WHERE id = (SELECT podcast_id FROM dialogues WHERE id = $1)',
            [dialogueId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Erreur mise à jour dialogue:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Mettre à jour un dialogue
router.put('/:dialogueId', authMiddleware, updateDialogueHandler);
router.patch('/:dialogueId', authMiddleware, updateDialogueHandler);

// Supprimer un dialogue
router.delete('/:dialogueId', authMiddleware, async (req, res) => {
    try {
        const { dialogueId } = req.params;

        await pool.query('DELETE FROM dialogues WHERE id = $1', [dialogueId]);

        res.json({ success: true });
    } catch (error) {
        console.error('Erreur suppression dialogue:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Ajouter un dialogue
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { podcast_id, character, text_studio, text_reading, section, order_index } = req.body;

        const result = await pool.query(
            'INSERT INTO dialogues (podcast_id, order_index, character, text_studio, text_reading, section) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [podcast_id, order_index || 0, character, text_studio, text_reading || text_studio, section || '']
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erreur ajout dialogue:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
