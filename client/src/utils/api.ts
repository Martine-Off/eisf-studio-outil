import axios from 'axios';

const api = axios.create({
    baseURL: '/api', // Proxy configuré dans vite.config.ts
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 300000,
    withCredentials: true, // envoie le cookie HttpOnly automatiquement
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
