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

const { generalLimiter, authLimiter, aiLimiter } = require('./middleware/rateLimiter');
const { queryFallback: authQueryMiddleware } = require('./middleware/auth');
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
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error(`CORS : origine non autorisée (${origin})`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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

// Rate limiting (avant les routes, /health exclu)
app.use('/api/auth', authLimiter);
app.use('/api/ai', aiLimiter);
app.use('/api', generalLimiter);

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

const server = app.listen(PORT, () => {
    console.log(`🚀 Studio EISF API running on http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/health`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} déjà utilisé. Arrêtez l'autre instance ou changez PORT dans .env`);
        process.exit(1);
    } else {
        throw err;
    }
});