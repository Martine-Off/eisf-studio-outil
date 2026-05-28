// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('[AUTH] CRITIQUE : JWT_SECRET absent de process.env — le serveur ne peut pas valider les tokens');
    process.exit(1);
}

const authMiddleware = (req, res, next) => {
    try {
        // Cookie HttpOnly en priorité, fallback sur header Authorization (Postman / dev)
        const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Token manquant' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        console.error('[AUTH] Token verification failed:', error.message);
        return res.status(401).json({ error: 'Token invalide ou expiré' });
    }
};

// Variante acceptant le token en query param ?token= (pour window.open / nouveaux onglets)
const authQueryMiddleware = (req, res, next) => {
    try {
        const token = req.cookies?.token || req.headers.authorization?.split(' ')[1] || req.query.token;
        if (!token) return res.status(401).json({ error: 'Token manquant' });
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token invalide ou expiré' });
    }
};

module.exports = authMiddleware;
module.exports.queryFallback = authQueryMiddleware;
