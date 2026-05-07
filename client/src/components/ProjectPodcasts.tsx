import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, ChevronLeft, Mic } from 'lucide-react';
import api from '../utils/api';
import AppLayout from '../components/AppLayout';
import type { Project, Podcast } from '../types';

/** Détecte les slugs techniques (underscores + chiffres) et retourne un titre propre. */
function cleanTitle(podcast: Podcast, idx: number): string {
    const t = podcast.title;
    if (!t) return `Podcast ${(podcast.order_index ?? idx) + 1}`;
    // Slug pattern : contient des underscores ou commence par des chiffres
    if (/_/.test(t) || /^\d/.test(t)) {
        return `Podcast ${(podcast.order_index ?? idx) + 1}`;
    }
    return t;
}

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
    const [editingPodcastId, setEditingPodcastId] = useState<number | null>(null);
    const [editPodcastTitle, setEditPodcastTitle] = useState('');

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

    const handleRenamePodcast = async (id: number, newTitle: string) => {
        const trimmed = newTitle.trim();
        setEditingPodcastId(null);
        if (!trimmed) return;
        try {
            await api.patch(`/podcasts/${id}/title`, { title: trimmed });
            setPodcasts(prev => prev.map(p => p.id === id ? { ...p, title: trimmed } : p));
        } catch (error) {
            console.error('Erreur renommage podcast:', error);
        }
    };

    return (
        <AppLayout>
            <div className="max-w-5xl mx-auto pb-20 mt-6">

                {/* ── Retour chapitres ── */}
                <button
                    onClick={() => navigate(`/editor/${projectId}`, { state: { step: 2 } })}
                    className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-[#D6475B] transition-colors mb-3 group"
                >
                    <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                    Chapitres
                </button>

                {/* ── Stepper ── */}
                <div className="flex items-center justify-center gap-2 mb-6 mt-1">
                    {[
                        { label: 'Aperçu source', href: `/editor/${projectId}`, navState: undefined },
                        { label: 'Structure du cours', href: `/editor/${projectId}`, navState: { step: 2 } },
                        { label: 'Éditeur', href: null, navState: undefined },
                    ].map((s, i) => {
                        const isCurrent = i === 2;
                        const isDone = i < 2;
                        return (
                            <div key={i} className="flex items-center gap-2">
                                {isDone ? (
                                    <Link
                                        to={s.href!}
                                        state={s.navState}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white text-foreground border border-[#E0DCE0] hover:border-[#D6475B] transition-colors"
                                    >
                                        <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold bg-[#BDD145]/20 text-[#5a6e00]">{i + 1}</span>
                                        {s.label}
                                    </Link>
                                ) : (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#D6475B] text-white shadow-sm">
                                        <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold bg-white/25 text-white">{i + 1}</span>
                                        {s.label}
                                    </div>
                                )}
                                {i < 2 && <div className={`w-8 h-px ${isDone ? 'bg-[#D6475B]/40' : 'bg-[#E0DCE0]'}`} />}
                            </div>
                        );
                    })}
                </div>

                {/* Header */}
                <div className="flex items-center gap-3 mb-6 mt-2">
                    <button
                        onClick={() => navigate(`/editor/${projectId}`, { state: { step: 2 } })}
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
                        {podcasts.map((podcast, idx) => {
                            const isGenerated = (podcast.word_count ?? 0) > 0;
                            const mins = estimateMinutes(podcast.duration_seconds, podcast.word_count);
                            const displayTitle = cleanTitle(podcast, idx);
                            return (
                                <div key={podcast.id} className={`rounded-xl p-4 transition-shadow flex flex-col items-start border ${
                                    isGenerated
                                        ? 'bg-white border-[#E0DCE0] hover:shadow-md shadow-sm hover:border-[#D6475B]/20'
                                        : 'bg-[#F8F7F8] border-dashed border-[#D4D0D4] opacity-75'
                                }`}>
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${
                                        isGenerated ? 'bg-[#D6475B]/10 text-[#D6475B]' : 'bg-[#E6E2E6] text-muted-foreground'
                                    }`}>
                                        <Mic size={18} />
                                    </div>

                                    <div className="w-full flex items-start justify-between gap-2 mb-1">
                                        {editingPodcastId === podcast.id ? (
                                            <input
                                                autoFocus
                                                value={editPodcastTitle}
                                                onChange={e => setEditPodcastTitle(e.target.value)}
                                                onBlur={() => handleRenamePodcast(podcast.id, editPodcastTitle)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') handleRenamePodcast(podcast.id, editPodcastTitle);
                                                    if (e.key === 'Escape') setEditingPodcastId(null);
                                                }}
                                                className="flex-1 text-sm font-semibold border border-[#D6475B]/40 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-[#D6475B]/30 bg-white text-foreground"
                                            />
                                        ) : (
                                            <h3
                                                className={`font-semibold text-sm leading-snug cursor-text ${isGenerated ? 'text-foreground' : 'text-muted-foreground'}`}
                                                onClick={() => {
                                                    if (!isGenerated) return;
                                                    setEditingPodcastId(podcast.id);
                                                    setEditPodcastTitle(displayTitle);
                                                }}
                                            >
                                                {displayTitle}
                                            </h3>
                                        )}
                                        {!isGenerated ? (
                                            <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-white text-muted-foreground border-[#D4D0D4] whitespace-nowrap">
                                                À générer
                                            </span>
                                        ) : podcast.fidelity_score != null ? (
                                            <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                                                podcast.fidelity_score >= 95
                                                    ? 'bg-[#BDD145]/20 text-[#5a6e00] border-[#BDD145]/40'
                                                    : podcast.fidelity_score >= 70
                                                    ? 'bg-[#E6A440]/20 text-[#7a5200] border-[#E6A440]/40'
                                                    : 'bg-[#D6475B]/10 text-[#D6475B] border-[#D6475B]/20'
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

                                    <div className="mt-auto w-full pt-3 border-t border-[#F0EEF0]">
                                        {isGenerated ? (
                                            <button
                                                onClick={() => navigate(`/project/${projectId}/podcast/${podcast.id}/edit`)}
                                                className="w-full text-center bg-[#D6475B]/10 hover:bg-[#D6475B]/20 text-[#D6475B] text-xs font-semibold py-2 rounded-lg transition-colors"
                                            >
                                                Ouvrir l'éditeur
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => navigate(`/editor/${projectId}?chapter=${podcast.order_index ?? 0}`)}
                                                className="w-full text-center bg-[#6BB8CD]/10 hover:bg-[#6BB8CD]/20 text-[#1a6a80] text-xs font-semibold py-2 rounded-lg transition-colors"
                                            >
                                                Générer ce chapitre
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
