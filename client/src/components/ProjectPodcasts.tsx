import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, ChevronLeft, Mic } from 'lucide-react';
import api from '../utils/api';
import AppLayout from '../components/AppLayout';
import type { Project, Podcast } from '../types';

function formatUpdatedAt(dateStr: string): string {
    const d = new Date(dateStr);
    const date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `Modifié le ${date} à ${h}h${m}`;
}

function estimateMinutes(durationSeconds: number | null | undefined, wordCount: number | null | undefined): number {
    if (durationSeconds && durationSeconds > 60) return Math.ceil(durationSeconds / 60);
    if (wordCount && wordCount > 0) return Math.ceil(wordCount / 140);
    return 0;
}

export default function ProjectPodcasts() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [podcasts, setPodcasts] = useState<Podcast[]>([]);
    const [projectData, setProjectData] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProjectAndPodcasts = async () => {
            try {
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
            <div className="max-w-5xl mx-auto pb-20 mt-6">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6 mt-2">
                    <button
                        onClick={() => navigate(`/editor/${projectId}`)}
                        className="p-2 bg-card border border-border rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-all shadow-sm"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <div>
                        <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                            <Link to="/dashboard" className="hover:text-foreground transition-colors">Projets</Link>
                            <span>/</span>
                            <Link to={`/editor/${projectId}`} className="hover:text-foreground transition-colors">
                                {projectData?.title || '…'}
                            </Link>
                            <span>/</span>
                            <span className="text-foreground font-medium">Podcasts</span>
                        </nav>
                        <h1 className="text-xl font-extrabold text-foreground tracking-tight font-display">
                            {projectData?.title || 'Liste des Podcasts'}
                        </h1>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="animate-spin text-primary" size={32} />
                    </div>
                ) : podcasts.length === 0 ? (
                    <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center">
                        <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <Mic size={20} />
                        </div>
                        <h2 className="text-base font-bold mb-1">Aucun podcast</h2>
                        <p className="text-sm text-muted-foreground">Vous n'avez pas encore généré de podcast pour ce projet.</p>
                        <button
                            onClick={() => navigate(`/editor/${projectId}`)}
                            className="mt-4 text-sm text-primary font-bold underline cursor-pointer"
                        >
                            Générer un podcast dans l'éditeur
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {podcasts.map((podcast) => {
                            const isGenerated = (podcast.word_count ?? 0) > 0;
                            const mins = estimateMinutes(podcast.duration_seconds, podcast.word_count);
                            return (
                                <div key={podcast.id} className={`rounded-xl p-4 transition-shadow flex flex-col items-start border ${
                                    isGenerated
                                        ? 'bg-card border-border hover:shadow-md shadow-sm'
                                        : 'bg-secondary/40 border-dashed border-border opacity-75'
                                }`}>
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${
                                        isGenerated ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                                    }`}>
                                        <Mic size={18} />
                                    </div>

                                    <div className="w-full flex items-start justify-between gap-2 mb-1">
                                        <h3 className={`font-semibold text-sm leading-snug ${isGenerated ? 'text-foreground' : 'text-muted-foreground'}`}>
                                            {podcast.title || `Podcast #${podcast.id}`}
                                        </h3>
                                        {!isGenerated ? (
                                            <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-secondary text-muted-foreground border-border whitespace-nowrap">
                                                À générer
                                            </span>
                                        ) : podcast.fidelity_score != null ? (
                                            <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                                                podcast.fidelity_score >= 95 ? 'bg-green-100 text-green-800 border-green-200' :
                                                podcast.fidelity_score >= 70 ? 'bg-orange-100 text-orange-800 border-orange-200' :
                                                                                'bg-red-100 text-red-800 border-red-200'
                                            }`}>
                                                {Math.round(podcast.fidelity_score)}%
                                            </span>
                                        ) : null}
                                    </div>

                                    {isGenerated && (
                                        <div className="text-xs text-muted-foreground mb-1.5 flex gap-1.5 font-medium flex-wrap">
                                            <span className="bg-secondary px-2 py-0.5 rounded">{podcast.word_count!.toLocaleString()} mots</span>
                                            {mins > 0 && <span className="bg-secondary px-2 py-0.5 rounded">~{mins} min</span>}
                                            {podcast.audio_url && (
                                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold">Audio ✓</span>
                                            )}
                                        </div>
                                    )}
                                    {podcast.updated_at && isGenerated && (
                                        <p className="text-[10px] text-muted-foreground mb-3">{formatUpdatedAt(podcast.updated_at)}</p>
                                    )}

                                    <div className="mt-auto w-full pt-3 border-t border-border">
                                        {isGenerated ? (
                                            <button
                                                onClick={() => navigate(`/project/${projectId}/podcast/${podcast.id}/edit`)}
                                                className="w-full text-center bg-accent/10 hover:bg-accent/20 text-accent text-sm font-bold py-2 rounded-lg transition-colors"
                                            >
                                                Voir / Modifier le script
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => navigate(`/editor/${projectId}?chapter=${podcast.order_index ?? 0}`)}
                                                className="w-full text-center bg-primary/10 hover:bg-primary/20 text-primary text-sm font-bold py-2 rounded-lg transition-colors"
                                            >
                                                🎙️ Générer ce podcast
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
