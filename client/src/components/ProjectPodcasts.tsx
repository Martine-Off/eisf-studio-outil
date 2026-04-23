import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ChevronLeft, Mic } from 'lucide-react';

function formatUpdatedAt(dateStr: string): string {
    const d = new Date(dateStr);
    const date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `Modifié le ${date} à ${h}h${m}`;
}
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
                <div className="flex items-center gap-4 mb-8 mt-4">
                    <button
                        onClick={() => navigate(`/editor/${projectId}`)}
                        className="p-2.5 bg-card border border-border rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-all shadow-sm"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <h1 className="text-3xl font-extrabold text-foreground tracking-tight font-display">
                        {projectData?.title || 'Liste des Podcasts'}
                    </h1>
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
                            Générer un podcast dans l'éditeur
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {podcasts.map((podcast) => (
                            <div key={podcast.id} className={`rounded-2xl p-6 shadow-sm transition-shadow flex flex-col items-start border ${
                                    (podcast.word_count ?? 0) > 0
                                        ? 'bg-card border-border hover:shadow-md'
                                        : 'bg-secondary/40 border-dashed border-border opacity-80'
                                }`}>
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                                    (podcast.word_count ?? 0) > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                                }`}>
                                    <Mic size={24} />
                                </div>
                                <div className="w-full flex items-start justify-between gap-2 mb-1">
                                    <h3 className={`font-bold text-lg line-clamp-2 ${(podcast.word_count ?? 0) > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                                        {podcast.title || `Podcast #${podcast.id}`}
                                    </h3>
                                    {(podcast.word_count ?? 0) === 0 ? (
                                        <span className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border bg-secondary text-muted-foreground border-border">
                                            À générer
                                        </span>
                                    ) : podcast.fidelity_score != null ? (
                                        <span className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border ${
                                            podcast.fidelity_score >= 95 ? 'bg-green-100 text-green-800 border-green-200' :
                                            podcast.fidelity_score >= 70 ? 'bg-orange-100 text-orange-800 border-orange-200' :
                                                                            'bg-red-100 text-red-800 border-red-200'
                                        }`}>
                                            {Math.round(podcast.fidelity_score)}%
                                        </span>
                                    ) : null}
                                </div>
                                {(podcast.word_count ?? 0) > 0 && (
                                    <div className="text-sm text-muted-foreground mb-2 flex gap-2 font-medium flex-wrap">
                                        <span className="bg-secondary px-2.5 py-1 rounded-md">{podcast.word_count!.toLocaleString()} mots</span>
                                        <span className="bg-secondary px-2.5 py-1 rounded-md">~{Math.ceil((podcast.duration_seconds || 0) / 60)} min</span>
                                        {podcast.audio_url && (
                                            <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-md text-xs font-bold">Audio ✓</span>
                                        )}
                                    </div>
                                )}
                                {podcast.updated_at && (podcast.word_count ?? 0) > 0 && (
                                    <p className="text-xs text-muted-foreground mb-4">{formatUpdatedAt(podcast.updated_at)}</p>
                                )}
                                <div className="mt-auto w-full pt-4 border-t border-border">
                                    {(podcast.word_count ?? 0) > 0 ? (
                                        <button
                                            onClick={() => navigate(`/project/${projectId}/podcast/${podcast.id}/edit`)}
                                            className="w-full text-center bg-accent/10 hover:bg-accent/20 text-accent font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                                        >
                                            Voir / Modifier le script
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => navigate(`/editor/${projectId}?chapter=${podcast.order_index ?? 0}`)}
                                            className="w-full text-center bg-primary/10 hover:bg-primary/20 text-primary font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                                        >
                                            🎙️ Générer ce podcast
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
