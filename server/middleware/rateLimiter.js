const rateLimit = require('express-rate-limit');

const generalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_GENERAL_MAX) || 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        const minutes = Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 60000);
        res.status(429).json({ error: `Trop de requêtes, réessayez dans ${minutes} minutes.` });
    },
});

const authLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_AUTH_MAX) || 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        const minutes = Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 60000);
        res.status(429).json({ error: `Trop de requêtes, réessayez dans ${minutes} minutes.` });
    },
});

const aiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_AI_MAX) || 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        const minutes = Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 60000);
        res.status(429).json({ error: `Trop de requêtes, réessayez dans ${minutes} minutes.` });
    },
});

module.exports = { generalLimiter, authLimiter, aiLimiter };
