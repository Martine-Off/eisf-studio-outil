// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../models/db');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');

const router = express.Router();

function validatePassword(password) {
    if (!password || password.length < 12) return 'Le mot de passe doit contenir au moins 12 caractères.';
    if (!/[A-Z]/.test(password)) return 'Le mot de passe doit contenir au moins une majuscule.';
    if (!/[a-z]/.test(password)) return 'Le mot de passe doit contenir au moins une minuscule.';
    if (!/[0-9]/.test(password)) return 'Le mot de passe doit contenir au moins un chiffre.';
    return null;
}

// Inscription
router.post('/register', validate([
    body('email').isEmail().withMessage('Email invalide').normalizeEmail(),
    body('first_name').optional().trim().isLength({ max: 100 }).withMessage('Prénom trop long (max 100 caractères)'),
    body('last_name').optional().trim().isLength({ max: 100 }).withMessage('Nom trop long (max 100 caractères)'),
]), async (req, res) => {
    try {
        const { email, password, first_name, last_name } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            return res.status(400).json({ error: passwordError });
        }

        // Vérifier si l'email existe déjà
        const userExists = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: 'Email déjà utilisé' });
        }

        // Hash du mot de passe
        const password_hash = await bcrypt.hash(password, 12);

        // Créer l'utilisateur
        const result = await pool.query(
            'INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name',
            [email, password_hash, first_name, last_name]
        );

        const user = result.rows[0];

        // Générer JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        res.status(201).json({ user });
    } catch (error) {
        console.error('Erreur inscription:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Connexion
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }

        // Récupérer l'utilisateur
        const result = await pool.query(
            'SELECT id, email, password_hash, first_name, last_name FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        const user = result.rows[0];

        // Vérifier mot de passe
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        // Mettre à jour last_login
        await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

        // Générer JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        res.json({
            user: {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
            },
        });
    } catch (error) {
        console.error('Erreur connexion:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Déconnexion — efface le cookie HttpOnly
router.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    });
    res.json({ success: true });
});

module.exports = router;
