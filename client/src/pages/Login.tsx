// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, GraduationCap } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../utils/api';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await api.post('/auth/login', { email, password });
            login(res.data.user);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Identifiants incorrects.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#E6E2E6] flex flex-col items-center justify-between py-8 px-4">
            <div className="flex-1 flex items-center justify-center w-full">
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    className="w-full max-w-[380px]"
                >
                    {/* Card */}
                    <div className="bg-white rounded-2xl shadow-[0_2px_24px_0_rgb(0,0,0,0.10)] px-8 py-10">
                        {/* Logo */}
                        <div className="flex flex-col items-center mb-6">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D6475B]">
                                    <GraduationCap className="h-5 w-5 text-white" />
                                </div>
                                <span className="font-bold text-lg text-foreground tracking-tight">Studio EISF</span>
                            </div>
                            <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                                Plateforme e-learning professionnelle
                            </p>
                        </div>

                        <h1 className="text-2xl font-bold text-foreground text-center mb-1">Connexion</h1>
                        <p className="text-sm text-muted-foreground text-center mb-7">
                            Accédez à votre espace de formation
                        </p>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">
                                    Adresse e-mail
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="nom@exemple.com"
                                        className="w-full rounded-lg border border-input bg-white pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#D6475B]/40 focus:border-[#D6475B] transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-sm font-medium text-foreground">Mot de passe</label>
                                    <a href="#" className="text-xs text-[#D6475B] hover:underline font-medium">
                                        Mot de passe oublié ?
                                    </a>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full rounded-lg border border-input bg-white pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#D6475B]/40 focus:border-[#D6475B] transition-all"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <p className="text-sm text-[#D6475B] font-medium">{error}</p>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#D6475B] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#c03d50] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
                            >
                                {loading ? 'Connexion…' : 'Se connecter'}
                                {!loading && <ArrowRight className="h-4 w-4" />}
                            </button>
                        </form>

                        {/* Divider */}
                        <div className="flex items-center gap-3 my-5">
                            <hr className="flex-1 border-border" />
                            <span className="text-xs text-muted-foreground">ou</span>
                            <hr className="flex-1 border-border" />
                        </div>

                        <p className="text-sm text-muted-foreground text-center mb-3">
                            Pas encore de compte sur Studio EISF ?
                        </p>
                        <Link
                            to="/register"
                            className="flex w-full items-center justify-center rounded-lg border border-[#D6475B] px-4 py-2.5 text-sm font-semibold text-[#D6475B] transition-all hover:bg-[#D6475B]/5 active:scale-[0.99]"
                        >
                            Créer un compte gratuitement
                        </Link>
                    </div>
                </motion.div>
            </div>

            {/* Footer */}
            <footer className="flex items-center gap-4 text-xs text-muted-foreground mt-6">
                <a href="#" className="hover:underline">Aide &amp; Support</a>
                <span>—</span>
                <a href="#" className="hover:underline">Confidentialité</a>
                <span>—</span>
                <a href="#" className="hover:underline">Conditions d'utilisation</a>
            </footer>
        </div>
    );
}
