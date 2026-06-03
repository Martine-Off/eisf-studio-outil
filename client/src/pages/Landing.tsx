// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
import { Link } from 'react-router-dom';
import {
    ArrowRight, GraduationCap, Target, Users,
    Zap, Award, Shield, Twitter, Linkedin, Youtube, Facebook
} from 'lucide-react';
import { motion } from 'framer-motion';

const features = [
    {
        icon: GraduationCap,
        title: 'Cursus Professionnel',
        description: "Des modules spécialisés par secteur d'activité : business, luxe, gastronomie et diplomatie.",
    },
    {
        icon: Target,
        title: 'Objectifs Précis',
        description: 'Un système de suivi intelligent pour mesurer votre progression et accélérer vos paliers de compétence.',
    },
    {
        icon: Users,
        title: 'Communauté Active',
        description: "Échangez avec des experts et d'autres professionnels du monde entier via vos leçons dédiées.",
    },
    {
        icon: Zap,
        title: 'Micro-learning',
        description: 'Des sessions courtes de 10 minutes optimisées pour les agendas les plus chargés.',
    },
    {
        icon: Award,
        title: 'Certificats Reconnus',
        description: 'Validez vos compétences avec des certificats alignés sur le cadre européen (CECR).',
    },
    {
        icon: Shield,
        title: 'Sécurité Totale',
        description: 'Vos données et votre progression sont protégées par les plus hauts standards de sécurité.',
    },
];

export default function Landing() {
    return (
        <div className="min-h-screen bg-surface text-ink flex flex-col">
            {/* Top accent bar */}
            <div className="h-1 w-full bg-primary" />

            {/* Navbar */}
            <header className="sticky top-0 z-50 bg-surface border-b border-border">
                <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img src="/logo-eisf.png" className="h-7 w-auto" alt="EISF" />
                        <span className="font-heading font-bold text-base text-ink tracking-tight">Studio EISF</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            to="/login"
                            className="text-sm font-medium text-ink-soft hover:text-primary transition-colors px-3 py-1.5"
                        >
                            Se connecter
                        </Link>
                        <Link
                            to="/register"
                            className="text-sm font-medium bg-primary text-white px-4 py-1.5 rounded hover:opacity-90 transition-all"
                        >
                            S'inscrire
                        </Link>
                    </div>
                </div>
            </header>

            {/* Hero */}
            <section className="bg-canvas py-16 lg:py-24">
                <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
                    {/* Left */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <span className="inline-flex items-center gap-1.5 bg-ines-soft text-ines-ink text-xs font-semibold px-3 py-1 rounded-full mb-5">
                            <span className="w-1.5 h-1.5 rounded-full bg-ines" />
                            Assistant d'apprentissage
                        </span>

                        <h1 className="text-4xl lg:text-5xl font-heading font-bold text-ink leading-tight mb-4">
                            Maîtrisez le Français avec{' '}
                            <span className="text-ines-ink">Studio EISF</span>
                        </h1>

                        <p className="text-base text-ink-soft leading-relaxed mb-8 max-w-md">
                            Une plateforme d'apprentissage immersive conçue pour les professionnels aguerris.
                            Apprenez à votre rythme avec des outils modernes et un contenu pédagogique d'excellence.
                        </p>

                        <div className="flex flex-wrap gap-3 mb-6">
                            <Link
                                to="/register"
                                className="inline-flex items-center gap-2 bg-primary text-white font-medium px-5 py-2.5 rounded hover:opacity-90 transition-all text-sm"
                            >
                                Commencer l'aventure
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-2 bg-surface text-ink-soft font-medium px-5 py-2.5 rounded border border-border hover:border-primary hover:text-primary transition-colors text-sm"
                            >
                                Se connecter
                            </Link>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-ink-soft">
                            <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
                                Sans engagement
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
                                Contenus certifiés
                            </span>
                        </div>
                    </motion.div>

                    {/* Right — App mockup */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.15 }}
                        className="hidden lg:block"
                    >
                        <div className="bg-surface rounded-lg shadow-pop overflow-hidden border border-border">
                            {/* Mock top bar */}
                            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface">
                                <div className="h-2.5 w-2.5 rounded-full bg-danger/40" />
                                <div className="h-2.5 w-2.5 rounded-full bg-amber/40" />
                                <div className="h-2.5 w-2.5 rounded-full bg-emerald/40" />
                            </div>
                            {/* Mock content */}
                            <div className="p-5 bg-border-soft space-y-3">
                                <div className="bg-surface rounded-lg p-4 shadow-card space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="h-3 w-32 bg-border rounded-full" />
                                        <div className="h-5 w-14 bg-emerald/30 rounded-full" />
                                    </div>
                                    <div className="h-2 w-full bg-border rounded-full" />
                                    <div className="h-2 w-3/4 bg-border rounded-full" />
                                    <div className="flex gap-3 pt-1">
                                        <div className="h-2 w-16 bg-ines/30 rounded-full" />
                                        <div className="h-2 w-12 bg-ines/30 rounded-full" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    {[1,2,3].map(i => (
                                        <div key={i} className="bg-surface rounded-lg p-3 shadow-card space-y-2">
                                            <div className="h-8 w-8 rounded-lg bg-primary/10" />
                                            <div className="h-2 w-full bg-border rounded-full" />
                                            <div className="h-2 w-2/3 bg-border rounded-full" />
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-surface rounded-lg p-4 shadow-card">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-primary/15 flex-shrink-0" />
                                        <div className="flex-1 space-y-1.5">
                                            <div className="h-2 w-3/4 bg-border rounded-full" />
                                            <div className="h-2 w-1/2 bg-border rounded-full" />
                                        </div>
                                        <div className="h-6 w-16 bg-emerald/30 rounded-full" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Features */}
            <section className="py-16 lg:py-20 bg-surface">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-2xl lg:text-3xl font-heading font-bold text-ink mb-3">
                            Pourquoi choisir Studio EISF ?
                        </h2>
                        <p className="text-ink-soft max-w-xl mx-auto text-sm leading-relaxed">
                            Nous combinons l'excellence académique française avec la puissance technologique
                            pour une expérience d'apprentissage inégalée.
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {features.map((f, i) => (
                            <motion.div
                                key={f.title}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 + i * 0.07 }}
                                className="bg-surface rounded-lg p-5 border border-border hover:shadow-card transition-shadow"
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ines-soft mb-4">
                                    <f.icon className="h-5 w-5 text-ines-ink" />
                                </div>
                                <h3 className="font-heading font-bold text-sm text-ink mb-2">{f.title}</h3>
                                <p className="text-xs text-ink-soft leading-relaxed">{f.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Banner */}
            <section className="bg-primary py-14">
                <div className="max-w-6xl mx-auto px-6 flex flex-col lg:flex-row items-center justify-between gap-8">
                    <div className="text-white text-center lg:text-left">
                        <h2 className="text-2xl lg:text-3xl font-heading font-bold mb-2 leading-snug">
                            Prêt à transformer votre carrière<br className="hidden lg:block" /> avec le français ?
                        </h2>
                        <p className="text-white/80 text-sm">
                            Rejoignez les milliers de professionnels qui font confiance à<br className="hidden lg:block" />
                            Studio EISF pour leur développement linguistique.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                        <Link
                            to="/register"
                            className="inline-flex items-center gap-2 bg-surface text-primary font-medium px-6 py-2.5 rounded hover:opacity-95 transition-all text-sm whitespace-nowrap"
                        >
                            Créer un compte gratuit
                        </Link>
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 border border-white/50 text-white font-medium px-6 py-2.5 rounded hover:border-white hover:bg-white/10 transition-colors text-sm whitespace-nowrap"
                        >
                            Se connecter
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-surface border-t border-border py-10">
                <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 lg:grid-cols-4 gap-8">
                    {/* Brand */}
                    <div className="col-span-2 lg:col-span-1">
                        <div className="flex items-center gap-2 mb-3">
                            <img src="/logo-eisf.png" className="h-7 w-auto" alt="EISF" />
                            <span className="font-heading font-bold text-sm text-ink">Studio EISF</span>
                        </div>
                        <p className="text-xs text-ink-soft leading-relaxed max-w-[200px]">
                            La plateforme d'excellence pour l'apprentissage du français professionnel.
                        </p>
                    </div>

                    {/* Produit */}
                    <div>
                        <p className="text-xs font-semibold text-ink mb-3">Produit</p>
                        <ul className="space-y-2 text-xs text-ink-soft">
                            <li><a href="#" className="hover:text-ink transition-colors">Fonctionnalités</a></li>
                            <li><a href="#" className="hover:text-ink transition-colors">Tarifs</a></li>
                            <li><a href="#" className="hover:text-ink transition-colors">Témoignages</a></li>
                        </ul>
                    </div>

                    {/* Support */}
                    <div>
                        <p className="text-xs font-semibold text-ink mb-3">Support</p>
                        <ul className="space-y-2 text-xs text-ink-soft">
                            <li><a href="#" className="hover:text-ink transition-colors">Aide</a></li>
                            <li><a href="#" className="hover:text-ink transition-colors">Contact</a></li>
                            <li><a href="#" className="hover:text-ink transition-colors">Confidentialité</a></li>
                        </ul>
                    </div>

                    {/* Social */}
                    <div>
                        <p className="text-xs font-semibold text-ink mb-3">Suivez-nous</p>
                        <div className="flex gap-2">
                            {[Twitter, Linkedin, Youtube, Facebook].map((Icon, i) => (
                                <a
                                    key={i}
                                    href="#"
                                    className="flex h-7 w-7 items-center justify-center rounded bg-border-soft hover:bg-primary hover:text-white text-ink-soft transition-colors"
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                </a>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="max-w-6xl mx-auto px-6 mt-8 pt-6 border-t border-border">
                    <p className="text-xs text-ink-faint text-center">
                        © 2026 Studio EISF — Tous droits réservés.
                    </p>
                </div>
            </footer>
        </div>
    );
}
