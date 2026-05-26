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
        <div className="min-h-screen bg-white text-foreground flex flex-col">
            {/* Top accent bar */}
            <div className="h-1 w-full bg-[#D6475B]" />

            {/* Navbar */}
            <header className="sticky top-0 z-50 bg-white border-b border-[#E6E2E6]">
                <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#D6475B]">
                            <GraduationCap className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-bold text-base text-foreground tracking-tight">Studio EISF</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            to="/login"
                            className="text-sm font-medium text-foreground hover:text-[#D6475B] transition-colors px-3 py-1.5"
                        >
                            Se connecter
                        </Link>
                        <Link
                            to="/register"
                            className="text-sm font-semibold bg-[#D6475B] text-white px-4 py-1.5 rounded-lg hover:bg-[#c03d50] transition-colors"
                        >
                            S'inscrire
                        </Link>
                    </div>
                </div>
            </header>

            {/* Hero */}
            <section className="bg-[#E6E2E6] py-16 lg:py-24">
                <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
                    {/* Left */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <span className="inline-flex items-center gap-1.5 bg-[#6BB8CD]/15 text-[#3465AE] text-xs font-semibold px-3 py-1 rounded-full mb-5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#6BB8CD]" />
                            Assistant d'apprentissage
                        </span>

                        <h1 className="text-4xl lg:text-5xl font-extrabold text-foreground leading-tight mb-4">
                            Maîtrisez le Français avec{' '}
                            <span className="text-[#D6475B]">Studio EISF</span>
                        </h1>

                        <p className="text-base text-muted-foreground leading-relaxed mb-8 max-w-md">
                            Une plateforme d'apprentissage immersive conçue pour les professionnels aguerris.
                            Apprenez à votre rythme avec des outils modernes et un contenu pédagogique d'excellence.
                        </p>

                        <div className="flex flex-wrap gap-3 mb-6">
                            <Link
                                to="/register"
                                className="inline-flex items-center gap-2 bg-[#D6475B] text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-[#c03d50] transition-colors text-sm"
                            >
                                Commencer l'aventure
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-2 bg-white text-foreground font-semibold px-5 py-2.5 rounded-lg border border-[#D4D0D4] hover:border-[#D6475B] hover:text-[#D6475B] transition-colors text-sm"
                            >
                                Se connecter
                            </Link>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#BDD145]" />
                                Sans engagement
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#BDD145]" />
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
                        <div className="bg-white rounded-2xl shadow-[0_8px_40px_0_rgb(0,0,0,0.12)] overflow-hidden border border-white/80">
                            {/* Mock top bar */}
                            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E6E2E6] bg-white">
                                <div className="h-2.5 w-2.5 rounded-full bg-[#D6475B]/40" />
                                <div className="h-2.5 w-2.5 rounded-full bg-[#E6A440]/40" />
                                <div className="h-2.5 w-2.5 rounded-full bg-[#BDD145]/40" />
                            </div>
                            {/* Mock content */}
                            <div className="p-5 bg-[#F5F4F5] space-y-3">
                                <div className="bg-white rounded-xl p-4 shadow-sm space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="h-3 w-32 bg-[#E6E2E6] rounded-full" />
                                        <div className="h-5 w-14 bg-[#BDD145]/30 rounded-full" />
                                    </div>
                                    <div className="h-2 w-full bg-[#E6E2E6] rounded-full" />
                                    <div className="h-2 w-3/4 bg-[#E6E2E6] rounded-full" />
                                    <div className="flex gap-3 pt-1">
                                        <div className="h-2 w-16 bg-[#6BB8CD]/30 rounded-full" />
                                        <div className="h-2 w-12 bg-[#6BB8CD]/30 rounded-full" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    {[1,2,3].map(i => (
                                        <div key={i} className="bg-white rounded-xl p-3 shadow-sm space-y-2">
                                            <div className="h-8 w-8 rounded-lg bg-[#D6475B]/10" />
                                            <div className="h-2 w-full bg-[#E6E2E6] rounded-full" />
                                            <div className="h-2 w-2/3 bg-[#E6E2E6] rounded-full" />
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-white rounded-xl p-4 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-[#D6475B]/20 flex-shrink-0" />
                                        <div className="flex-1 space-y-1.5">
                                            <div className="h-2 w-3/4 bg-[#E6E2E6] rounded-full" />
                                            <div className="h-2 w-1/2 bg-[#E6E2E6] rounded-full" />
                                        </div>
                                        <div className="h-6 w-16 bg-[#BDD145]/30 rounded-full" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Features */}
            <section className="py-16 lg:py-20 bg-white">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-2xl lg:text-3xl font-extrabold text-foreground mb-3">
                            Pourquoi choisir Studio EISF ?
                        </h2>
                        <p className="text-muted-foreground max-w-xl mx-auto text-sm leading-relaxed">
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
                                className="bg-[#F8F7F8] rounded-xl p-5 border border-[#E6E2E6] hover:shadow-[0_2px_16px_0_rgb(0,0,0,0.07)] transition-shadow"
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#6BB8CD]/15 mb-4">
                                    <f.icon className="h-5 w-5 text-[#3465AE]" />
                                </div>
                                <h3 className="font-bold text-sm text-foreground mb-2">{f.title}</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">{f.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Banner */}
            <section className="bg-[#D6475B] py-14">
                <div className="max-w-6xl mx-auto px-6 flex flex-col lg:flex-row items-center justify-between gap-8">
                    <div className="text-white text-center lg:text-left">
                        <h2 className="text-2xl lg:text-3xl font-extrabold mb-2 leading-snug">
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
                            className="inline-flex items-center gap-2 bg-white text-[#D6475B] font-semibold px-6 py-2.5 rounded-lg hover:bg-white/90 transition-colors text-sm whitespace-nowrap"
                        >
                            Créer un compte gratuit
                        </Link>
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 border border-white/50 text-white font-semibold px-6 py-2.5 rounded-lg hover:border-white hover:bg-white/10 transition-colors text-sm whitespace-nowrap"
                        >
                            Se connecter
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-white border-t border-[#E6E2E6] py-10">
                <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 lg:grid-cols-4 gap-8">
                    {/* Brand */}
                    <div className="col-span-2 lg:col-span-1">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#D6475B]">
                                <GraduationCap className="h-4 w-4 text-white" />
                            </div>
                            <span className="font-bold text-sm text-foreground">Studio EISF</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed max-w-[200px]">
                            La plateforme d'excellence pour l'apprentissage du français professionnel.
                        </p>
                    </div>

                    {/* Produit */}
                    <div>
                        <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">Produit</p>
                        <ul className="space-y-2 text-xs text-muted-foreground">
                            <li><a href="#" className="hover:text-foreground transition-colors">Fonctionnalités</a></li>
                            <li><a href="#" className="hover:text-foreground transition-colors">Tarifs</a></li>
                            <li><a href="#" className="hover:text-foreground transition-colors">Témoignages</a></li>
                        </ul>
                    </div>

                    {/* Support */}
                    <div>
                        <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">Support</p>
                        <ul className="space-y-2 text-xs text-muted-foreground">
                            <li><a href="#" className="hover:text-foreground transition-colors">Aide</a></li>
                            <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
                            <li><a href="#" className="hover:text-foreground transition-colors">Confidentialité</a></li>
                        </ul>
                    </div>

                    {/* Social */}
                    <div>
                        <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">Suivez-nous</p>
                        <div className="flex gap-2">
                            {[Twitter, Linkedin, Youtube, Facebook].map((Icon, i) => (
                                <a
                                    key={i}
                                    href="#"
                                    className="flex h-7 w-7 items-center justify-center rounded bg-[#E6E2E6] hover:bg-[#D6475B] hover:text-white text-muted-foreground transition-colors"
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                </a>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="max-w-6xl mx-auto px-6 mt-8 pt-6 border-t border-[#E6E2E6]">
                    <p className="text-xs text-muted-foreground text-center">
                        © 2026 STUDIO EISF — TOUS DROITS RÉSERVÉS.
                    </p>
                </div>
            </footer>
        </div>
    );
}
