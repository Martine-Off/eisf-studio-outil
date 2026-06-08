// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../models/db');

const router = express.Router();

// Connexion — single-auth via APP_LOGIN / APP_PASSWORD dans .env
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }

        const appLogin    = process.env.APP_LOGIN;
        const appPassword = process.env.APP_PASSWORD;

        if (!appLogin || !appPassword) {
            return res.status(503).json({ error: 'Authentification non configurée — APP_LOGIN et APP_PASSWORD requis dans .env' });
        }

        if (email !== appLogin || password !== appPassword) {
            return res.status(401).json({ error: 'Identifiants incorrects' });
        }

        // Récupérer l'utilisateur admin (premier de la table)
        const result = await pool.query(
            'SELECT id, email, first_name, last_name FROM users LIMIT 1'
        );
        const dbUser = result.rows[0];
        const user   = dbUser || { id: 1, email: appLogin, first_name: 'Admin', last_name: '' };

        if (dbUser) {
            await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [dbUser.id]);
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        const cookieOpts = {
            secure:   process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            maxAge:   7 * 24 * 60 * 60 * 1000,
        };
        res.cookie('token',      token,                                { ...cookieOpts, httpOnly: true  });
        res.cookie('csrf_token', crypto.randomBytes(32).toString('hex'), { ...cookieOpts, httpOnly: false });
        res.json({ user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name } });
    } catch (error) {
        console.error('Erreur connexion:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Déconnexion — inscrit le token en blacklist puis efface les cookies
router.post('/logout', async (req, res) => {
    try {
        const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
        if (token) {
            const decoded = jwt.decode(token);
            if (decoded?.exp) {
                const expiresAt = new Date(decoded.exp * 1000);
                await pool.query(
                    'INSERT INTO revoked_tokens (token, expires_at) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [token, expiresAt]
                );
            }
        }
    } catch (err) {
        console.error('[AUTH] Erreur blacklist logout:', err.message);
    }
    const clearOpts = {
        secure:   process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    };
    res.clearCookie('token',      { ...clearOpts, httpOnly: true  });
    res.clearCookie('csrf_token', { ...clearOpts, httpOnly: false });
    res.json({ success: true });
});

module.exports = router;
