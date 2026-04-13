const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const apiRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging Middleware
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
});

// Servir les fichiers statiques du dossier uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
        database: dbStatus,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        service: 'Studio EISF API',
    });
});

// Gestion erreurs globale
app.use((err, req, res, next) => {
    console.error('Erreur non gérée:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
});

app.listen(PORT, () => {
    console.log(`🚀 Studio EISF API running on http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/health`);
});