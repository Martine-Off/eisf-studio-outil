// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GraduationCap, LayoutGrid, Plus, LogOut, Bell, Menu, X } from 'lucide-react';
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
        .map((s: string) => s.charAt(0).toUpperCase())
        .join('') || 'U';

    return (
        <div className="min-h-screen bg-[#E6E2E6] font-sans text-foreground">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white border-b border-[#E0DCE0] shadow-[0_1px_4px_0_rgb(0,0,0,0.06)]">
                <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center gap-4">
                    {/* Logo */}
                    <Link to="/dashboard" className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#D6475B]">
                            <GraduationCap className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-bold text-sm text-foreground tracking-tight">Studio EISF</span>
                    </Link>

                    {/* Nav */}
                    <nav className="hidden md:flex items-center gap-1 ml-2">
                        <Link
                            to="/dashboard"
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                location.pathname === '/dashboard'
                                    ? 'bg-[#E6E2E6] text-foreground'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-[#F0EEF0]'
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
                            className="flex items-center gap-1.5 bg-[#D6475B] text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-[#c03d50] transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                            Nouveau projet
                        </Link>
                        <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-[#F0EEF0] rounded-lg transition-colors">
                            <Bell className="h-4 w-4" />
                        </button>
                        <div className="relative group">
                            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E6E2E6] border-2 border-white text-xs font-bold text-foreground hover:border-[#D6475B] transition-colors overflow-hidden">
                                {initials}
                            </button>
                            {/* Dropdown */}
                            <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-[#E0DCE0] rounded-xl shadow-lg py-1 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all">
                                <button
                                    onClick={handleLogout}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-destructive hover:bg-[#FFF0F2] transition-colors"
                                >
                                    <LogOut className="h-3.5 w-3.5" />
                                    Déconnexion
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Mobile */}
                    <button
                        className="md:hidden p-2 text-foreground hover:bg-[#F0EEF0] rounded-lg"
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
                            className="absolute right-0 top-0 h-full w-72 bg-white border-l border-[#E0DCE0] p-6 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-8">
                                <span className="font-bold text-foreground">Menu</span>
                                <button onClick={() => setIsMobileMenuOpen(false)} className="p-1.5 rounded-lg hover:bg-[#F0EEF0]">
                                    <X size={18} />
                                </button>
                            </div>
                            <nav className="flex flex-col gap-2">
                                <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-[#F0EEF0]">
                                    <LayoutGrid size={16} />
                                    Tableau de bord
                                </Link>
                                <Link to="/new-project" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-[#F0EEF0]">
                                    <Plus size={16} />
                                    Nouveau projet
                                </Link>
                                <hr className="my-3 border-[#E0DCE0]" />
                                <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-red-50 w-full text-left">
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
        </div>
    );
}
