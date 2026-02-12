const express = require('express');
const pool = require('../models/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Mettre à jour un dialogue
router.put('/:dialogueId', authMiddleware, async (req, res) => {
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

        res.json({ success: true });
    } catch (error) {
        console.error('Erreur mise à jour dialogue:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

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
