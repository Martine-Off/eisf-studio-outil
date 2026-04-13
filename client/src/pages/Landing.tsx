import { Link } from 'react-router-dom';
import { Mic, ArrowRight, FileText, Sparkles, Headphones } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Landing() {
    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Hero Section */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 eisf-gradient opacity-[0.03]" />
                <div className="container relative py-20 lg:py-32 mx-auto px-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="mx-auto max-w-3xl text-center"
                    >
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl eisf-gradient shadow-lg">
                            <Mic className="h-8 w-8 text-primary-foreground" />
                        </div>

                        <h1 className="mb-4 font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                            Transformez vos cours en{' '}
                            <span className="text-primary">podcasts</span>
                        </h1>

                        <p className="mx-auto mb-8 max-w-xl text-lg text-muted-foreground">
                            Studio EISF — La Podcast Factory qui convertit vos contenus pédagogiques
                            en dialogues engageants entre Inès & Yannick.
                        </p>

                        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                            <Link
                                to="/login"
                                className="flex items-center gap-2 rounded-xl eisf-gradient px-6 py-3 font-semibold text-primary-foreground shadow-lg transition-all hover:opacity-90"
                            >
                                Commencer
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                            <Link
                                to="/register"
                                className="flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 font-semibold text-foreground shadow-sm transition-colors hover:bg-secondary"
                            >
                                Créer un compte
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Features Section */}
            <section className="container pb-20 mx-auto px-4">
                <div className="grid gap-6 sm:grid-cols-3">
                    <FeatureCard
                        icon={FileText}
                        title="Import Word"
                        description="Glissez-déposez vos cours au format Word ou PDF pour démarrer instantanément."
                        index={0}
                    />
                    <FeatureCard
                        icon={Sparkles}
                        title="Génération IA"
                        description="L'IA transforme votre contenu en un dialogue naturel et pédagogique."
                        index={1}
                    />
                    <FeatureCard
                        icon={Headphones}
                        title="Export Studio"
                        description="Écoutez, éditez et exportez le podcast final pour vos apprenants."
                        index={2}
                    />
                </div>
            </section>
        </div>
    );
}

function FeatureCard({ icon: Icon, title, description, index }: { icon: React.ElementType, title: string, description: string, index: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + index * 0.15 }}
            className="rounded-xl border border-border bg-card p-6 shadow-eisf"
        >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-secondary">
                <Icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mb-2 font-display font-bold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
        </motion.div>
    );
}
