// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
// Double Submit Cookie pattern — actif uniquement en production.
// Le cookie csrf_token (non-HttpOnly) est défini au login/register.
// Chaque requête mutante doit inclure X-CSRF-Token avec la même valeur.

const EXEMPT_PATHS = ['/api/auth/login', '/api/auth/register'];
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

function csrfMiddleware(req, res, next) {
    if (process.env.NODE_ENV !== 'production') return next();
    if (SAFE_METHODS.includes(req.method)) return next();
    if (EXEMPT_PATHS.includes(req.path)) return next();

    const cookieToken = req.cookies['csrf_token'];
    const headerToken = req.headers['x-csrf-token'];

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        return res.status(403).json({ error: 'CSRF token invalide' });
    }
    next();
}

module.exports = { csrfMiddleware };
