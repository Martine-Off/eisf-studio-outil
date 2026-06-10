// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutGrid, Plus, LogOut, Bell, HelpCircle, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const initials = [user?.first_name, user?.last_name]
        .filter(Boolean)
        .map((s) => (s as string).charAt(0).toUpperCase())
        .join('') || 'U';

    return (
        <div className="min-h-screen bg-canvas font-body text-ink">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-surface border-b border-border shadow-card">
                <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center gap-4">
                    {/* Logo */}
                    <Link to="/dashboard" className="flex items-center gap-2.5 flex-shrink-0">
                        <img src="/logo-eisf.png" className="h-7 w-auto" alt="EISF" />
                        <span className="w-px h-4 bg-border shrink-0" aria-hidden="true" />
                        <span className="font-heading font-bold text-[13px] text-ink tracking-tight">EISF&nbsp;/&nbsp;Studio</span>
                    </Link>

                    {/* Nav */}
                    <nav className="hidden md:flex items-center gap-1 ml-2">
                        <Link
                            to="/dashboard"
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                                location.pathname === '/dashboard'
                                    ? 'bg-canvas text-ink'
                                    : 'text-ink-soft hover:text-ink hover:bg-canvas'
                            }`}
                        >
                            <LayoutGrid className="h-3.5 w-3.5" />
                            Tableau de bord
                        </Link>
                    </nav>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Actions */}
                    <div className="hidden md:flex items-center gap-2">
                        <Link
                            to="/new-project"
                            className="flex items-center gap-1.5 bg-primary text-white px-4 py-1.5 rounded text-sm font-medium hover:opacity-90 transition-all"
                        >
                            <Plus className="h-4 w-4" />
                            Nouveau projet
                        </Link>
                        <Link
                            to="/guide"
                            className="p-2 text-ink-soft hover:text-ink hover:bg-canvas rounded transition-colors"
                            title="Guide utilisateur"
                        >
                            <HelpCircle className="h-4 w-4" />
                        </Link>
                        <button className="p-2 text-ink-soft hover:text-ink hover:bg-canvas rounded transition-colors">
                            <Bell className="h-4 w-4" />
                        </button>
                        <div className="relative group">
                            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-primary border-2 border-surface text-xs font-bold text-white hover:opacity-90 transition-all overflow-hidden">
                                {initials}
                            </button>
                            {/* Dropdown */}
                            <div className="absolute right-0 top-full mt-1 w-40 bg-surface border border-border rounded-lg shadow-pop py-1 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all">
                                <button
                                    onClick={handleLogout}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink-soft hover:text-danger hover:bg-danger/8 transition-colors"
                                >
                                    <LogOut className="h-3.5 w-3.5" />
                                    Déconnexion
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Mobile */}
                    <button
                        className="md:hidden p-2 text-ink hover:bg-canvas rounded"
                        onClick={() => setIsMobileMenuOpen(true)}
                    >
                        <Menu size={20} />
                    </button>
                </div>
            </header>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/45 md:hidden"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="absolute right-0 top-0 h-full w-72 bg-surface border-l border-border p-6 shadow-pop"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-8">
                                <span className="font-heading font-bold text-ink">Menu</span>
                                <button onClick={() => setIsMobileMenuOpen(false)} className="p-1.5 rounded hover:bg-canvas">
                                    <X size={18} />
                                </button>
                            </div>
                            <nav className="flex flex-col gap-2">
                                <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded text-sm font-medium text-ink hover:bg-canvas">
                                    <LayoutGrid size={16} />
                                    Tableau de bord
                                </Link>
                                <Link to="/new-project" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded text-sm font-medium text-ink hover:bg-canvas">
                                    <Plus size={16} />
                                    Nouveau projet
                                </Link>
                                <hr className="my-3 border-border" />
                                <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2.5 rounded text-sm font-medium text-danger hover:bg-danger/8 w-full text-left">
                                    <LogOut size={16} />
                                    Déconnexion
                                </button>
                            </nav>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Content */}
            <main className="max-w-[1400px] mx-auto py-8 px-6">
                <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                >
                    {children}
                </motion.div>
            </main>

            {/* Footer */}
            <footer className="border-t border-border py-4 mt-auto">
                <div className="max-w-[1400px] mx-auto px-6">
                    <p className="text-xs text-[#5A5963] text-center">
                        © 2026 EISF · Studio EISF par Martine Desmaroux.
                    </p>
                </div>
            </footer>
        </div>
    );
}
