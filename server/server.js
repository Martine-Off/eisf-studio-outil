// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
process.env.TZ = 'Europe/Paris';

const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();

if (!process.env.NODE_ENV) {
    console.warn('[server] NODE_ENV non défini — comportement development appliqué par défaut');
}

const { generalLimiter, authLimiter, aiLimiter } = require('./middleware/rateLimiter');
const { queryFallback: authQueryMiddleware } = require('./middleware/auth');
const { csrfMiddleware } = require('./middleware/csrf');
const apiRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : ['http://localhost:3000', 'http://localhost:5173'];

app.use(cors({
    origin: (origin, callback) => {
        // Autoriser les requêtes sans origin (ex: Postman, server-to-server)
        // uniquement en développement
        if (!origin) {
            if (process.env.NODE_ENV === 'production') {
                return callback(new Error('Origin requis en production'));
            }
            return callback(null, true);
        }
        if (process.env.NODE_ENV !== 'production' && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
            return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error(`CORS : origine non autorisée (${origin})`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    exposedHeaders: ['Content-Type'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
});

// Activer trust proxy pour lire X-Forwarded-For derrière Nginx
app.set('trust proxy', 1);

// Redirection HTTP → HTTPS en production uniquement
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (!req.secure) return res.redirect(301, `https://${req.get('host')}${req.originalUrl}`);
        next();
    });
}

// Protection CSRF (actif en production uniquement — voir middleware/csrf.js)
app.use('/api', csrfMiddleware);

// Rate limiting (avant les routes, /health exclu)
app.use(generalLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/ai', aiLimiter);

// Logging Middleware
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
});

// Servir les fichiers statiques du dossier uploads (token requis)
app.use('/uploads', authQueryMiddleware, express.static(path.join(__dirname, 'uploads')));

// Servir les fichiers audio générés par Gemini TTS
app.use('/audio', express.static(path.join(__dirname, 'audio')));

// Routes
app.use('/api', apiRoutes);

// Health check
const pool = require('./models/db');
app.get('/health', async (req, res) => {
    let dbStatus = 'OK';
    try {
        await pool.query('SELECT 1');
    } catch (err) {
        dbStatus = 'Error: ' + (err.message || 'Unknown error');
        console.error('Database Health Check Failed:', err);
    }
    res.json({
        status: dbStatus === 'OK' ? 'OK' : 'DEGRADED',
        timestamp: new Date().toISOString(),
    });
});

// Gestion erreurs globale
app.use((err, req, res, next) => {
    console.error('Erreur non gérée:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
});

// Nettoyage des tokens révoqués expirés au démarrage
pool.query('DELETE FROM revoked_tokens WHERE expires_at < NOW()')
    .then(r => { if (r.rowCount > 0) console.log(`[AUTH] ${r.rowCount} token(s) révoqué(s) expirés supprimés`); })
    .catch(err => console.error('[AUTH] Nettoyage revoked_tokens:', err.message));

function startServer(attempt = 1) {
    const maxAttempts = 3;
    const srv = app.listen(PORT, () => {
        console.log(`🚀 Studio EISF API running on http://localhost:${PORT}`);
        console.log(`📋 Health check: http://localhost:${PORT}/health`);
    });
    srv.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            if (attempt < maxAttempts) {
                console.warn(`⚠️ Port ${PORT} occupé — nouvelle tentative ${attempt + 1}/${maxAttempts} dans 2s...`);
                setTimeout(() => startServer(attempt + 1), 2000);
            } else {
                console.error(`❌ Port ${PORT} toujours occupé après ${maxAttempts} tentatives. Arrêtez l'autre instance ou changez PORT dans .env`);
                process.exit(1);
            }
        } else {
            throw err;
        }
    });
}

startServer();