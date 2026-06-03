// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../utils/api';

export default function Register() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('Les mots de passe ne correspondent pas.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            const response = await api.post('/auth/register', {
                email,
                password,
                first_name: '',
                last_name: '',
            });
            login(response.data.user);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.error || "Erreur lors de l'inscription.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-canvas flex flex-col items-center justify-between py-8 px-4">
            <div className="flex-1 flex items-center justify-center w-full">
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    className="w-full max-w-[380px]"
                >
                    {/* Card */}
                    <div className="bg-surface rounded-lg border border-border shadow-pop px-8 py-10">
                        {/* Logo */}
                        <div className="flex flex-col items-center mb-6">
                            <div className="flex items-center gap-2">
                                <img src="/logo-eisf.png" className="h-8 w-auto" alt="EISF" />
                                <span className="font-heading font-bold text-lg text-ink tracking-tight">Studio EISF</span>
                            </div>
                        </div>

                        <h1 className="text-2xl font-heading font-bold text-ink text-center mb-1">Créer votre compte</h1>
                        <p className="text-sm text-ink-soft text-center mb-7">
                            Rejoignez l'excellence de l'apprentissage du français.
                        </p>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-ink mb-1.5">
                                    Adresse e-mail
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="nom@exemple.com"
                                        className="w-full rounded border border-border bg-surface pl-10 pr-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-sm font-medium text-ink mb-1.5">Mot de passe</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full rounded border border-border bg-surface pl-10 pr-10 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-ink-soft hover:text-ink"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm Password */}
                            <div>
                                <label className="block text-sm font-medium text-ink mb-1.5">
                                    Confirmer le mot de passe
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" />
                                    <input
                                        type={showConfirm ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full rounded border border-border bg-surface pl-10 pr-10 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirm(!showConfirm)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-ink-soft hover:text-ink"
                                    >
                                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <p className="text-sm text-danger font-medium">{error}</p>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="flex w-full items-center justify-center gap-2 rounded bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
                            >
                                {loading ? 'Création…' : 'Créer mon compte'}
                                {!loading && <ArrowRight className="h-4 w-4" />}
                            </button>
                        </form>

                        <p className="mt-5 text-center text-sm text-ink-soft">
                            Déjà un compte ?{' '}
                            <Link to="/login" className="font-medium text-primary hover:underline">
                                Se connecter
                            </Link>
                        </p>
                    </div>
                </motion.div>
            </div>

            {/* Footer */}
            <footer className="flex items-center gap-4 text-xs text-ink-faint mt-6">
                <a href="#" className="hover:underline">Conditions</a>
                <span>—</span>
                <a href="#" className="hover:underline">Confidentialité</a>
                <span>—</span>
                <a href="#" className="hover:underline">Aide</a>
            </footer>
        </div>
    );
}
