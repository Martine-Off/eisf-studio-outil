// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, Sparkles, Download, Pencil, Volume2, FileText, MessageSquare, Music } from 'lucide-react';
import { motion } from 'framer-motion';

const steps = [
    {
        number: '01', title: 'Import',
        color: 'text-[#3465AE]', bg: 'bg-[#3465AE]/10', icon: Download,
        description: 'Glissez votre export .docx Articulate Storyline.',
    },
    {
        number: '02', title: 'Génération IA',
        color: 'text-[#A973AF]', bg: 'bg-[#A973AF]/10', icon: Sparkles,
        description: "L'IA crée un dialogue naturel entre deux personnages — expert et apprenant.",
    },
    {
        number: '03', title: 'Édition & Vérification',
        color: 'text-[#6BB8CD]', bg: 'bg-[#6BB8CD]/10', icon: Pencil,
        description: 'Relisez, éditez, vérifiez la fidélité au contenu source.',
    },
    {
        number: '04', title: 'Export Audio',
        color: 'text-[#EF804E]', bg: 'bg-[#EF804E]/10', icon: Volume2,
        description: 'Générez le MP3 final et exportez pour vos apprenants.',
    },
];

const features = [
    {
        icon: FileText, color: 'bg-[#3465AE]/10', iconColor: 'text-[#3465AE]',
        title: 'Import Storyline',
        description: 'Glissez votre export .docx Articulate Storyline pour démarrer instantanément.',
    },
    {
        icon: MessageSquare, color: 'bg-[#A973AF]/10', iconColor: 'text-[#A973AF]',
        title: 'Dialogue IA',
        description: "L'IA génère un dialogue naturel entre deux personnages IA, fidèle à votre contenu source.",
    },
    {
        icon: Music, color: 'bg-[#BDD145]/20', iconColor: 'text-[#5A5963]',
        title: 'Audio & Export',
        description: 'Écoutez, éditez, vérifiez la fidélité et exportez le podcast final pour vos apprenants.',
    },
];

export default function Landing() {
    return (
        <div className="min-h-screen bg-white text-[#1C1B22] flex flex-col">
            {/* Liseré tricolore */}
            <div className="flex h-1 w-full">
                <div className="flex-1 bg-[#3465AE]" />
                <div className="flex-1 bg-white border-y border-[#E8E6EA]" />
                <div className="flex-1 bg-[#E63337]" />
            </div>

            {/* Navbar */}
            <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-[#E8E6EA]">
                <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <img src="/logo-eisf.png" className="h-9 w-auto" alt="EISF" />
                        <span className="font-heading font-bold text-base text-[#1C1B22] tracking-tight">
                            Studio <span className="text-[#3465AE]">EISF</span>
                        </span>
                    </div>
                    <Link
                        to="/login"
                        className="text-sm font-bold bg-[#3465AE] text-white px-5 py-2 rounded-lg hover:bg-[#007BC1] transition-colors"
                    >
                        Se connecter
                    </Link>
                </div>
            </header>

            {/* Hero */}
            <section className="relative overflow-hidden bg-white py-16 lg:py-24">
                <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-[#6BB8CD]/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-[#FECD32]/10 blur-3xl" />

                <div className="relative max-w-6xl mx-auto px-6 grid lg:grid-cols-[1.05fr_.95fr] gap-12 items-center">
                    {/* Left */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="flex flex-wrap gap-2 mb-6">
                            <span className="inline-flex items-center gap-1.5 bg-[#3465AE]/10 text-[#3465AE] border border-[#3465AE]/20 text-xs font-semibold px-3 py-1 rounded-full">
                                <CheckCircle className="h-3.5 w-3.5" />
                                Contenu certifié EISF
                            </span>
                            <span className="inline-flex items-center gap-1.5 bg-[#A973AF]/10 text-[#A973AF] border border-[#A973AF]/25 text-xs font-semibold px-3 py-1 rounded-full">
                                <Sparkles className="h-3.5 w-3.5" />
                                Généré par IA
                            </span>
                        </div>

                        <h1 className="text-4xl lg:text-5xl font-heading font-bold text-[#1C1B22] leading-tight mb-5">
                            Transformez vos cours en{' '}
                            <span className="text-[#3465AE]">podcasts pédagogiques</span>
                        </h1>

                        <p className="text-base text-[#5A5963] leading-relaxed mb-8 max-w-xl">
                            Studio EISF génère automatiquement des dialogues audio à partir de vos exports Storyline (.docx).
                            Fidélité au contenu source garantie, prêt à écouter en quelques clics.
                        </p>

                        <div className="flex flex-wrap items-center gap-4">
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-2 bg-[#3465AE] hover:bg-[#007BC1] text-white font-bold px-6 py-3.5 rounded-lg transition-colors text-sm"
                            >
                                Se connecter
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                            <a
                                href="/docs/GUIDE-UTILISATEUR.html"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mx-auto w-fit"
                            >
                                <FileText className="h-3.5 w-3.5" />
                                Guide utilisateur
                            </a>
                            <div className="flex items-center gap-4 text-xs text-[#5A5963]">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#BDD145]" />
                                    Sans installation
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#BDD145]" />
                                    Export .mp3
                                </span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Right — App mockup */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.15 }}
                        className="hidden lg:block"
                    >
                        <div className="relative rounded-2xl border border-[#E8E6EA] shadow-2xl bg-white overflow-hidden">
                            {/* Mac bar */}
                            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E8E6EA] bg-[#F5F4F7]">
                                <div className="h-3 w-3 rounded-full bg-[#E63337]/60" />
                                <div className="h-3 w-3 rounded-full bg-[#FECD32]/60" />
                                <div className="h-3 w-3 rounded-full bg-[#BDD145]/60" />
                                <span className="ml-3 text-xs font-medium text-[#5A5963]">Studio EISF · La crème pâtissière</span>
                            </div>

                            <div className="p-5 space-y-3">
                                {/* Réplique Inès */}
                                <div className="border-l-[3px] border-[#6BB8CD] pl-4 py-1">
                                    <p className="text-xs font-bold text-[#6BB8CD] mb-1.5">Inès</p>
                                    <div className="h-2 w-full bg-[#E8E6EA] rounded-full mb-1.5" />
                                    <div className="h-2 w-4/5 bg-[#E8E6EA] rounded-full" />
                                </div>
                                {/* Réplique Yannick */}
                                <div className="border-l-[3px] border-[#A973AF] pl-4 py-1 ml-6">
                                    <p className="text-xs font-bold text-[#A973AF] mb-1.5">Yannick</p>
                                    <div className="h-2 w-full bg-[#E8E6EA] rounded-full mb-1.5" />
                                    <div className="h-2 w-3/5 bg-[#E8E6EA] rounded-full" />
                                </div>
                                {/* Réplique Inès */}
                                <div className="border-l-[3px] border-[#6BB8CD] pl-4 py-1">
                                    <p className="text-xs font-bold text-[#6BB8CD] mb-1.5">Inès</p>
                                    <div className="h-2 w-full bg-[#E8E6EA] rounded-full mb-1.5" />
                                    <div className="h-2 w-2/3 bg-[#E8E6EA] rounded-full" />
                                </div>

                                {/* Mini-player */}
                                <div className="mt-2 flex items-center gap-3 bg-[#F5F4F7] rounded-xl px-4 py-3">
                                    <div className="h-8 w-8 rounded-full bg-[#3465AE] flex items-center justify-center flex-shrink-0">
                                        <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 space-y-1.5">
                                        <div className="h-1.5 w-full bg-[#E8E6EA] rounded-full overflow-hidden">
                                            <div className="h-full w-1/6 bg-[#3465AE] rounded-full" />
                                        </div>
                                        <p className="text-[10px] text-[#5A5963]">1:24 / 8:42</p>
                                    </div>
                                </div>
                            </div>

                            {/* Pastille fidélité */}
                            <div className="absolute top-14 right-4 bg-[#BDD145] text-[#1C1B22] text-[11px] font-bold px-2.5 py-1 rounded-full shadow">
                                Fidélité 97%
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Comment ça marche */}
            <section className="py-16 bg-[#F5F4F7] border-y border-[#E8E6EA]">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-10">
                        <p className="text-sm font-bold text-[#3465AE] uppercase tracking-widest mb-2">Le parcours</p>
                        <h2 className="text-2xl lg:text-3xl font-heading font-bold text-[#1C1B22]">
                            Comment ça marche
                        </h2>
                    </div>
                    <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-5">
                        {steps.map((step, i) => (
                            <motion.div
                                key={step.number}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 + i * 0.08 }}
                                className="relative bg-white rounded-xl border border-[#E8E6EA] p-6"
                            >
                                <span className="absolute top-4 right-5 text-3xl font-heading font-bold text-[#E8E6EA] leading-none select-none">
                                    {step.number}
                                </span>
                                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${step.bg} mb-4`}>
                                    <step.icon className={`h-4 w-4 ${step.color}`} />
                                </div>
                                <h3 className={`font-heading font-bold text-sm mb-2 ${step.color}`}>{step.title}</h3>
                                <p className="text-xs text-[#5A5963] leading-relaxed">{step.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Feature Cards */}
            <section className="py-16 lg:py-20 bg-white">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="grid md:grid-cols-3 gap-6">
                        {features.map((f, i) => (
                            <motion.div
                                key={f.title}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 + i * 0.07 }}
                                className="rounded-2xl border border-[#E8E6EA] p-7 hover:shadow-xl transition-shadow"
                            >
                                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${f.color} mb-5`}>
                                    <f.icon className={`h-5 w-5 ${f.iconColor}`} />
                                </div>
                                <h3 className="font-heading font-bold text-base text-[#1C1B22] mb-2">{f.title}</h3>
                                <p className="text-sm text-[#5A5963] leading-relaxed">{f.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-white border-t border-[#E8E6EA] py-6 mt-auto">
                <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <img src="/logo-eisf.png" className="h-5 w-auto" alt="EISF" />
                        <span className="font-heading font-bold text-xs text-[#1C1B22]">Studio EISF</span>
                    </div>
                    <p className="text-xs text-[#5A5963] text-center">
                        © 2026 EISF · Studio EISF par Martine Desmaroux.
                    </p>
                </div>
            </footer>
        </div>
    );
}
