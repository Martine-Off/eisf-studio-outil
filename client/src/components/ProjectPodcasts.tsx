import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ChevronLeft, Mic } from 'lucide-react';
import api from '../utils/api';
import AppLayout from '../components/AppLayout';
import ProjectMacroAnalysis from '../components/ProjectMacroAnalysis';
import type { Project, Podcast } from '../types';

export default function ProjectPodcasts() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [podcasts, setPodcasts] = useState<Podcast[]>([]);
    const [projectData, setProjectData] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProjectAndPodcasts = async () => {
            try {
                // Modifié pour récupérer à la fois le projet et les podcasts associés
                const res = await api.get(`/projects/${projectId}`);
                setProjectData(res.data.project);
                setPodcasts(res.data.podcasts || []);
            } catch (error) {
                console.error('Erreur récupération projet et podcasts:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchProjectAndPodcasts();
    }, [projectId]);

    return (
        <AppLayout>
            <div className="max-w-5xl mx-auto pb-20 mt-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 mt-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(`/editor/${projectId}`)}
                            className="p-2.5 bg-card border border-border rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-all shadow-sm"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <h1 className="text-3xl font-extrabold text-foreground tracking-tight font-display">
                            Liste des Podcasts
                        </h1>
                    </div>
                    <button
                        onClick={() => navigate(`/editor/${projectId}`)}
                        className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-bold hover:opacity-90 transition-all font-sans"
                    >
                        Nouveau Podcast (Éditeur de projet)
                    </button>
                </div>

                {/* Encart de Synthèse Globale IA */}
                {!loading && projectData && (
                    <ProjectMacroAnalysis
                        projectId={projectId || ''}
                        initialScore={projectData.macro_score}
                        initialObservations={Array.isArray(projectData.macro_feedback) ? projectData.macro_feedback : []}
                    />
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="animate-spin text-primary" size={40} />
                    </div>
                ) : podcasts.length === 0 ? (
                    <div className="bg-card border border-dashed border-border rounded-2xl p-12 text-center">
                        <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Mic size={24} />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Aucun podcast</h2>
                        <p className="text-muted-foreground">Vous n'avez pas encore généré de podcast pour ce projet.</p>
                        <button
                            onClick={() => navigate(`/editor/${projectId}`)}
                            className="mt-6 text-primary font-bold underline cursor-pointer"
                        >
                            Aller à l'éditeur générer un podcast
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {podcasts.map((podcast) => (
                            <div key={podcast.id} className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col items-start">
                                <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-4">
                                    <Mic size={24} />
                                </div>
                                <div className="w-full flex items-start justify-between gap-2 mb-1">
                                    <h3 className="font-bold text-lg text-foreground line-clamp-2">{podcast.title || `Podcast #${podcast.id}`}</h3>
                                    {podcast.fidelity_score != null && (
                                        <span className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border ${
                                            podcast.fidelity_score >= 95 ? 'bg-green-100 text-green-800 border-green-200' :
                                            podcast.fidelity_score >= 70 ? 'bg-orange-100 text-orange-800 border-orange-200' :
                                                                            'bg-red-100 text-red-800 border-red-200'
                                        }`}>
                                            {Math.round(podcast.fidelity_score)}%
                                        </span>
                                    )}
                                </div>
                                <div className="text-sm text-muted-foreground mb-6 flex gap-2 font-medium flex-wrap">
                                    <span className="bg-secondary px-2.5 py-1 rounded-md">{podcast.word_count ? podcast.word_count.toLocaleString() : 0} mots</span>
                                    <span className="bg-secondary px-2.5 py-1 rounded-md">~{Math.ceil((podcast.duration_seconds || 0) / 60)} min</span>
                                    {podcast.audio_url && (
                                        <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-md text-xs font-bold">Audio ✓</span>
                                    )}
                                </div>
                                <div className="mt-auto w-full pt-4 border-t border-border">
                                    <button
                                        onClick={() => navigate(`/project/${projectId}/podcast/${podcast.id}/edit`)}
                                        className="w-full text-center bg-accent/10 hover:bg-accent/20 text-accent font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                                    >
                                        Voir / Modifier le script
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
