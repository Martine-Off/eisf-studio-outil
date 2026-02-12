import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';


export default function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            const endpoint = isLogin ? '/auth/login' : '/auth/register';
            const payload = isLogin
                ? { email, password }
                : { email, password, first_name: firstName, last_name: lastName };

            const response = await api.post(endpoint, payload);
            const { token, user } = response.data;

            login(token, user);
        } catch (err: any) {
            console.error('Auth error:', err);
            setError(err.response?.data?.error || 'Une erreur est survenue');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-eisf-bg p-4 relative overflow-hidden">
            {/* Background decorations */}
            <div className="absolute top-[-10%] right-[-5%] w-64 h-64 rounded-full bg-eisf-blue/10 blur-3xl animate-pulse-glow" />
            <div className="absolute bottom-[-10%] left-[-5%] w-80 h-80 rounded-full bg-eisf-red/5 blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />

            <div className="card w-full max-w-md p-8 relative z-10 animate-fade-in shadow-xl border-white/50 backdrop-blur-sm">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-eisf-blue to-eisf-blue-light rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-4 transform rotate-3">
                        <span className="text-3xl">🎙️</span>
                    </div>
                    <h1 className="text-2xl font-bold text-eisf-blue-dark">Studio EISF</h1>
                    <p className="text-gray-500 mt-2 text-sm">Podcast Factory Pédagogique</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-eisf-red text-sm p-3 rounded-xl mb-6 border border-red-100 flex items-center gap-2 animate-slide-in-left">
                        <span>⚠️</span>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Prénom</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Nom</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            className="input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Mot de passe</label>
                        <input
                            type="password"
                            className="input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full btn-primary justify-center py-3 text-base shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                    >
                        {isLogin ? 'Se connecter' : "S'inscrire"}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => { setIsLogin(!isLogin); setError(''); }}
                        className="text-sm text-eisf-blue hover:text-eisf-blue-dark font-medium hover:underline transition-all"
                    >
                        {isLogin ? "Pas encore de compte ? Créer un compte" : "Déjà un compte ? Se connecter"}
                    </button>
                </div>
            </div>
        </div>
    );
}
