/**
 * Studio EISF — Plateforme de génération de podcasts pédagogiques
 *
 * © 2026 EISF — École Internationale du Savoir-Faire Français
 * Tous droits réservés / All Rights Reserved.
 *
 * @author  Martine Desmaroux <contact@eisf.fr>
 * @license Propriétaire — EISF
 */
import axios from 'axios';

const api = axios.create({
    baseURL: '/api', // Proxy configuré dans vite.config.ts
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 300000,
    withCredentials: true, // envoie le cookie HttpOnly automatiquement
});

// Intercepteur pour envoyer le token CSRF sur les requêtes mutantes
api.interceptors.request.use((config) => {
    const method = (config.method || '').toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
        const match = document.cookie.split(';').find(c => c.trim().startsWith('csrf_token='));
        const csrfToken = match?.split('=')[1];
        if (csrfToken) config.headers['X-CSRF-Token'] = csrfToken;
    }
    return config;
});

// Intercepteur pour gérer les erreurs 401 (cookie expiré ou absent)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
