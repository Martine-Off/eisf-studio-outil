const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    try {
        console.log('[AUTH] Checking token...');
        const token = req.headers.authorization?.split(' ')[1]; // "Bearer TOKEN"

        if (!token) {
            console.log('[AUTH] No token found in headers');
            return res.status(401).json({ error: 'Token manquant' });
        }

        // Debug: Log first/last 10 chars of secret (safe)
        const secret = process.env.JWT_SECRET;
        if (!secret) console.error('[AUTH] CRITICAL: JWT_SECRET is missing in process.env');

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('[AUTH] Token verified for user:', decoded.userId);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        console.error('[AUTH] Token verification failed:', error.message);
        return res.status(401).json({ error: 'Token invalide', details: error.message });
    }
};

module.exports = authMiddleware;
