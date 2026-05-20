import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, ChevronLeft, Mic, Plus, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '../utils/api';
import AppLayout from '../components/AppLayout';
import { formatDateParis } from '../lib/utils';
import type { Project, Podcast } from '../types';

function cleanTitle(podcast: Podcast, idx: number): string {
    const t = podcast.title;
    if (!t) return `Podcast ${(podcast.order_index ?? idx) + 1}`;
    if (/_/.test(t) || /^\d/.test(t)) return `Podcast ${(podcast.order_index ?? idx) + 1}`;
    return t;
}


function estimateMinutes(durationSeconds: number | null | undefined, wordCount: number | null | undefined): number {
    if (durationSeconds && durationSeconds > 60) return Math.ceil(durationSeconds / 60);
    if (wordCount && wordCount > 0) return Math.ceil(wordCount / 140);
    return 0;
}

function isFeedbackWarning(item: string): boolean {
    return /manqu|absent|insuffis|faib|oubli|incorrect|erron|probl/i.test(item);
}

export default function ProjectPodcasts() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [podcasts, setPodcasts] = useState<Podcast[]>([]);
    const [projectData, setProjectData] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [char1Name, setChar1Name] = useState('Inès');
    const [char2Name, setChar2Name] = useState('Yannick');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await api.get(`/projects/${projectId}`);
                setProjectData(res.data.project);
                setPodcasts(res.data.podcasts || []);
                setChar1Name(res.data.project.character_1_name || 'Inès');
                setChar2Name(res.data.project.character_2_name || 'Yannick');
            } catch (e) {
                console.error('Erreur récupération projet:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [projectId]);

    const locked = podcasts.some(p => (p.word_count ?? 0) > 0);

    const handleSaveCharacterNames = async () => {
        try {
            await api.patch(`/projects/${projectId}/character-names`, {
                character_1_name: char1Name.trim() || 'Inès',
                character_2_name: char2Name.trim() || 'Yannick',
            });
        } catch (e: any) {
            if (e?.response?.status === 409) {
                setChar1Name(projectData?.character_1_name || 'Inès');
                setChar2Name(projectData?.character_2_name || 'Yannick');
            }
        }
    };

    const handleDelete = async (podcastId: number) => {
        if (!window.confirm('Êtes-vous sûr ? Cette action supprimera le podcast et tous ses dialogues.')) return;
        try {
            await api.delete(`/podcasts/${podcastId}`);
            setPodcasts(prev => prev.filter(p => p.id !== podcastId));
        } catch (e) {
            console.error('Erreur suppression podcast:', e);
            alert('Erreur lors de la suppression.');
        }
    };

    const scoredPodcasts = podcasts.filter(p => p.fidelity_score != null);
    const meanScore = scoredPodcasts.length > 0
        ? Math.round(scoredPodcasts.reduce((s, p) => s + (p.fidelity_score ?? 0), 0) / scoredPodcasts.length)
        : null;
    const macroScore = projectData?.macro_score ?? null;
    const macroFeedback = projectData?.macro_feedback ?? [];
    const projectTitle = projectData?.title || 'Projet';

    if (loading) return (
        <AppLayout>
            <div className="h-[60vh] flex items-center justify-center">
                <Loader2 className="animate-spin text-[#E63337]" size={32} />
            </div>
        </AppLayout>
    );

    return (
        <AppLayout>
            <div className="max-w-5xl mx-auto pb-16 px-4 mt-6">

                {/* ── Header ── */}
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                        <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                            <Link to="/dashboard" className="hover:text-foreground transition-colors">Projets</Link>
                            <span>/</span>
                            <span className="text-foreground/70">{projectTitle}</span>
                            <span>/</span>
                            <span className="text-foreground font-medium">Podcasts</span>
                        </nav>
                        <h1 className="text-2xl font-bold text-foreground">{projectTitle}</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Récapitulatif des contenus audio générés pour ce projet
                        </p>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-shrink-0">
                        <button
                            onClick={() => navigate(`/editor/${projectId}`)}
                            className="flex items-center gap-1.5 px-4 py-2 border border-[#E0DCE0] rounded-lg text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-[#E63337]/30 bg-white transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Aperçu source
                        </button>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="flex items-center gap-1.5 px-4 py-2 border border-[#E0DCE0] rounded-lg text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-[#3465AE]/30 bg-white transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Tableau de bord
                        </button>
                    </div>
                </div>

                {/* ── Analyse globale banner ── */}
                <div className="bg-white rounded-xl border border-[#E0DCE0] shadow-sm p-5 mb-6 flex gap-6 items-start">
                    {/* Left — score gauge */}
                    <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                        <div className="relative w-[80px] h-[80px]">
                            <svg className="w-[80px] h-[80px] -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="35" fill="none" stroke="#E6E2E6" strokeWidth="10" />
                                {macroScore !== null && (
                                    <circle cx="50" cy="50" r="35" fill="none"
                                        stroke={macroScore >= 90 ? '#22c55e' : macroScore >= 70 ? '#E6A440' : '#E63337'}
                                        strokeWidth="10" strokeLinecap="round"
                                        strokeDasharray={`${220 * macroScore / 100} 220`}
                                    />
                                )}
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-lg font-extrabold text-foreground leading-none">
                                    {macroScore !== null ? `${macroScore}%` : '—'}
                                </span>
                            </div>
                        </div>
                        <p className="text-xs font-bold text-foreground">Analyse globale</p>
                        <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                            {podcasts.length} podcast{podcasts.length > 1 ? 's' : ''} généré{podcasts.length > 1 ? 's' : ''}
                            {meanScore !== null && (
                                <> · Score de fidélité moyen&nbsp;: {meanScore}%</>
                            )}
                        </p>
                    </div>

                    {/* Middle — key observations */}
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                            Observations clés
                        </p>
                        {macroFeedback.length > 0 ? (
                            <ul className="space-y-1.5">
                                {macroFeedback.map((item, i) => {
                                    const warn = isFeedbackWarning(item);
                                    return (
                                        <li key={i} className="flex items-start gap-2 text-[13px]">
                                            {warn
                                                ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                                                : <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                                            }
                                            <span className={warn ? 'text-amber-800' : 'text-foreground/80'}>{item}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">
                                Aucune analyse disponible pour ce projet.
                            </p>
                        )}
                    </div>

                    {/* Right — health badge */}
                    <div className="flex-shrink-0 self-center">
                        {(macroScore === null || macroScore >= 70) ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full text-xs font-bold text-green-700 whitespace-nowrap">
                                <CheckCircle className="h-3.5 w-3.5" />
                                Projet en bonne santé
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-xs font-bold text-amber-700 whitespace-nowrap">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                À améliorer
                            </span>
                        )}
                    </div>
                </div>

                {/* ── Prénoms des personnages ── */}
                <div className={`bg-white rounded-xl border border-[#E0DCE0] shadow-sm p-5 mb-6 ${locked ? 'opacity-60' : ''}`}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                        Prénoms des personnages
                    </p>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={char1Name}
                            disabled={locked}
                            onChange={(e) => setChar1Name(e.target.value)}
                            onBlur={handleSaveCharacterNames}
                            placeholder="Inès"
                            className="flex-1 text-sm font-semibold border border-[#E0DCE0] rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-[#E63337] disabled:cursor-not-allowed"
                        />
                        <input
                            type="text"
                            value={char2Name}
                            disabled={locked}
                            onChange={(e) => setChar2Name(e.target.value)}
                            onBlur={handleSaveCharacterNames}
                            placeholder="Yannick"
                            className="flex-1 text-sm font-semibold border border-[#E0DCE0] rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-[#E63337] disabled:cursor-not-allowed"
                        />
                    </div>
                    {locked
                        ? <p className="text-[11px] text-muted-foreground italic mt-2">Non modifiable — des podcasts ont déjà été générés.</p>
                        : <p className="text-[11px] text-muted-foreground mt-2">Ces prénoms seront utilisés dans tous les dialogues générés pour ce projet.</p>
                    }
                </div>

                {/* ── Podcasts grid ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {podcasts.map((podcast, idx) => {
                        const mins = estimateMinutes(podcast.duration_seconds, podcast.word_count);
                        const displayTitle = cleanTitle(podcast, idx);
                        const score = podcast.fidelity_score;
                        return (
                            <div key={podcast.id}
                                className="bg-white rounded-xl border border-[#E0DCE0] shadow-sm p-4 flex flex-col hover:shadow-md transition-shadow">
                                {/* Top row */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#FDDEDE]">
                                        <Mic size={18} className="text-[#E63337]" />
                                    </div>
                                    {score != null ? (
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                            score >= 90
                                                ? 'bg-green-50 text-green-700 border-green-200'
                                                : score >= 70
                                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                : 'bg-red-50 text-[#E63337] border-red-200'
                                        }`}>
                                            {Math.round(score)}%
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#E0DCE0] bg-white text-muted-foreground">
                                            —
                                        </span>
                                    )}
                                </div>

                                {/* Title */}
                                <h3 className="font-bold text-sm text-foreground leading-snug mb-2">{displayTitle}</h3>

                                {/* Pills */}
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {(podcast.word_count ?? 0) > 0 && (
                                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#DEE9FD] text-[#3465AE]">
                                            {podcast.word_count!.toLocaleString('fr-FR')} mots
                                        </span>
                                    )}
                                    {mins > 0 && (
                                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#FDDEDE] text-[#E63337]">
                                            ~{mins} min
                                        </span>
                                    )}
                                    {podcast.audio_url && (
                                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                            Audio ✓
                                        </span>
                                    )}
                                </div>

                                {/* Date */}
                                {podcast.updated_at && (
                                    <p className="text-[10px] text-muted-foreground mb-3">
                                        {formatDateParis(podcast.updated_at)}
                                    </p>
                                )}

                                {/* CTA */}
                                <div className="mt-auto pt-3 border-t border-[#F0EEF0] flex flex-col gap-2">
                                    <button
                                        onClick={() => navigate(`/project/${projectId}/podcast/${podcast.id}/edit`)}
                                        className="w-full py-2 rounded-lg text-xs font-semibold bg-[#FDDEDE] text-[#E63337] hover:bg-[#FECECE] transition-colors"
                                    >
                                        Ouvrir l'éditeur
                                    </button>
                                    <button
                                        onClick={() => handleDelete(podcast.id)}
                                        className="w-full py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-red-50 hover:text-[#E63337] border border-[#E0DCE0] hover:border-[#E63337]/30 transition-colors"
                                    >
                                        Supprimer
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {/* + card — generate new chapter */}
                    <div
                        onClick={() => navigate(`/editor/${projectId}`, { state: { step: 2 } })}
                        className="bg-white rounded-xl border-2 border-dashed border-[#D4D0D4] p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#E63337]/50 hover:bg-[#FFF8F8] transition-all min-h-[180px]"
                    >
                        <div className="w-10 h-10 rounded-full bg-[#F0EEF0] flex items-center justify-center">
                            <Plus className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-bold text-foreground text-center">Générer un nouveau chapitre</p>
                        <p className="text-[11px] text-muted-foreground text-center">Ajoutez un segment audio à ce projet</p>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
