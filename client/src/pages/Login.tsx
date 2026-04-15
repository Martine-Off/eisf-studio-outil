import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Mic, ArrowRight, Eye, EyeOff } from 'lucide-react';
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
            login(res.data.token, res.data.user);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Erreur de connexion');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-background">
            {/* Branding Panel (Left) */}
            <div className="hidden lg:flex lg:w-1/2 eisf-gradient items-center justify-center p-12 relative overflow-hidden">
                <div className="absolute inset-0 bg-white/5 opacity-5 mix-blend-overlay"></div>
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6 }}
                    className="max-w-md text-center relative z-10"
                >
                    <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-foreground/10 backdrop-blur-sm shadow-xl border border-white/10">
                        <Mic className="h-10 w-10 text-primary-foreground" />
                    </div>
                    <h1 className="mb-4 font-display text-4xl font-bold text-primary-foreground tracking-tight">
                        Studio EISF
                    </h1>
                    <p className="text-lg text-primary-foreground/80 font-medium leading-relaxed">
                        Transformez vos cours en podcasts pédagogiques engageants avec Inès & Yannick.
                    </p>
                </motion.div>
            </div>

            {/* Form Panel (Right) */}
            <div className="flex flex-1 items-center justify-center p-8 bg-background">
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="w-full max-w-sm"
                >
                    {/* Mobile Logo */}
                    <div className="mb-8 lg:hidden flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg eisf-gradient shadow-sm">
                            <Mic className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <span className="font-display text-lg font-bold text-foreground tracking-tight">
                            Studio <span className="text-primary">EISF</span>
                        </span>
                    </div>

                    <h2 className="mb-2 font-display text-2xl font-bold text-foreground">Connexion</h2>
                    <p className="mb-8 text-muted-foreground">Accédez à votre espace de création</p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="formateur@eisf.fr"
                                className="w-full rounded-lg border border-input bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all hover:border-primary/50"
                                required
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-sm font-medium text-foreground">Mot de passe</label>
                                <a href="#" className="text-xs text-primary hover:underline font-medium">Oublié ?</a>
                            </div>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full rounded-lg border border-input bg-card pl-4 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all hover:border-primary/50"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground focus:outline-none"
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 text-eisf-red text-sm rounded-lg font-medium animate-fade-in border border-red-100">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="flex w-full items-center justify-center gap-2 rounded-lg eisf-gradient px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md active:scale-[0.99]"
                        >
                            {loading ? 'Connexion…' : 'Se connecter'}
                            {!loading && <ArrowRight className="h-4 w-4" />}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-muted-foreground">
                        Pas encore de compte ?{' '}
                        <Link to="/register" className="font-medium text-primary hover:underline transition-colors">
                            Créer un compte
                        </Link>
                    </p>
                </motion.div>
            </div>
        </div>
    );
}
