import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import AppLayout from '../components/AppLayout';
import {
    ChevronLeft,
    Wand2,
    Loader2,
    X
} from 'lucide-react';
import { motion } from 'framer-motion';
import WordImport from '../components/WordImport';

export default function Create() {
    const navigate = useNavigate();

    const [title, setTitle] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [content, setContent] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!file && !content) || !title) return;

        setIsUploading(true);
        setError('');

        const formData = new FormData();
        if (file) formData.append('file', file);
        if (content) formData.append('content', content);
        formData.append('title', title);

        try {
            const response = await api.post('/projects/create', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            // Redirect to Editor
            navigate(`/editor/${response.data.project.id}`);
        } catch (err: any) {
            console.error('Erreur création:', err);
            setError(err.response?.data?.error || "Erreur lors de la création du projet");
            setIsUploading(false);
        }
    };

    return (
        <AppLayout>
            <div className="max-w-3xl mx-auto pb-20">
                {/* Back Button */}
                <Link to="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8 font-semibold">
                    <ChevronLeft size={20} />
                    Retour au tableau de bord
                </Link>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-3xl shadow-xl overflow-hidden border border-border"
                >
                    {/* Header Banner */}
                    <div className="eisf-gradient p-10 text-primary-foreground relative overflow-hidden">
                        <div className="absolute inset-0 bg-white/5 opacity-10 mix-blend-overlay"></div>
                        <div className="relative z-10 flex items-center gap-6">
                            <div className="h-16 w-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/10">
                                <Wand2 size={32} />
                            </div>
                            <div>
                                <h1 className="text-3xl font-extrabold tracking-tight font-display">
                                    Nouveau Podcast
                                </h1>
                                <p className="opacity-90 mt-1 font-medium">
                                    L'IA transforme vos cours en dialogues captivants.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Form Body */}
                    <form onSubmit={handleSubmit} className="p-10 space-y-8">
                        {/* Project Title */}
                        <div>
                            <label className="text-sm font-bold text-foreground mb-2 block uppercase tracking-wider">
                                Titre du projet
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Ex: La Sécurité Incendie - Module 1"
                                className="w-full px-5 py-3.5 rounded-xl border border-input bg-background/50 focus:bg-background focus:ring-2 focus:ring-ring outline-none transition-all placeholder:text-muted-foreground font-medium"
                                required
                            />
                        </div>

                        {/* 2 Columns: Format & AI Engine */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <label className="text-sm font-bold text-primary mb-2 block uppercase tracking-wider">
                                    Gestion des durées
                                </label>
                                <div className="px-5 py-3.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm flex items-center gap-3">
                                    ✨ Découpage dynamique (Max 7 min / module) administré automatiquement par l'IA.
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-bold text-foreground mb-2 block uppercase tracking-wider">
                                    Profil & Casting
                                </label>
                                <div className="px-5 py-3.5 rounded-xl bg-secondary/50 border border-border text-foreground font-bold text-sm flex items-center gap-3">
                                    <div className="flex -space-x-2">
                                        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center border-2 border-background text-[10px]">A</div>
                                        <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center border-2 border-background text-[10px]">B</div>
                                    </div>
                                    Inès & Yannick (Classique)
                                </div>
                            </div>
                        </div>

                        {/* File Upload / Source */}
                        <div>
                            <label className="text-sm font-bold text-foreground mb-3 block uppercase tracking-wider">
                                Contenu source
                            </label>

                            <div className="space-y-4">
                                <WordImport 
                                    onImportComplete={(text) => {
                                        setContent(text);
                                        setFile(null); // We now have the text content
                                    }}
                                    onError={(msg) => setError(msg)}
                                />

                                <div className="relative">
                                    <div className="absolute inset-x-0 top-0 flex items-center" aria-hidden="true">
                                        <div className="w-full border-t border-border"></div>
                                    </div>
                                    <div className="relative flex justify-center text-sm">
                                        <span className="bg-card px-4 text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Ou collez le texte</span>
                                    </div>
                                </div>

                                <textarea
                                    value={content}
                                    onChange={(e) => { setContent(e.target.value); setFile(null); }}
                                    placeholder="Collez ici le contenu de votre cours si vous n'avez pas de fichier..."
                                    className="w-full h-48 px-5 py-4 rounded-2xl border border-input bg-background focus:ring-2 focus:ring-ring outline-none resize-none font-sans text-sm leading-relaxed placeholder:text-muted-foreground transition-all"
                                />
                            </div>
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="text-destructive bg-destructive/10 px-5 py-4 rounded-xl text-sm font-bold flex items-center gap-3 border border-destructive/20"
                            >
                                <X size={18} className="bg-destructive text-white rounded-full p-0.5" />
                                {error}
                            </motion.div>
                        )}

                        <button
                            type="submit"
                            disabled={(!file && !content) || !title || isUploading}
                            className={`w-full py-5 rounded-2xl text-lg font-extrabold shadow-eisf flex items-center justify-center gap-3 transition-all transform active:scale-[0.98]
                                ${(!file && !content) || !title || isUploading
                                    ? 'bg-secondary text-muted-foreground cursor-not-allowed shadow-none'
                                    : 'eisf-gradient text-primary-foreground hover:opacity-90 hover:shadow-xl'
                                }
                            `}
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="animate-spin" size={24} />
                                    <span>Création du projet en cours...</span>
                                </>
                            ) : (
                                <>
                                    <Wand2 size={24} />
                                    <span>Générer le Podcast</span>
                                </>
                            )}
                        </button>
                    </form>
                </motion.div>
            </div>
        </AppLayout >
    );
}

