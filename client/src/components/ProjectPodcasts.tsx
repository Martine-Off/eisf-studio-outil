// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, ChevronLeft, Mic, Plus, CheckCircle, AlertTriangle, LayoutList, Pencil } from 'lucide-react';
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
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleDraft, setTitleDraft] = useState('');
    const titleInputRef = useRef<HTMLInputElement>(null);

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

    const handleSaveTitle = async () => {
        setEditingTitle(false);
        const trimmed = titleDraft.trim();
        if (!trimmed || trimmed === projectData?.title) return;
        try {
            await api.patch(`/projects/${projectId}/title`, { title: trimmed });
            setProjectData(prev => prev ? { ...prev, title: trimmed } : prev);
        } catch {
            setTitleDraft(projectData?.title || '');
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
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        </AppLayout>
    );

    return (
        <AppLayout>
            <div className="max-w-5xl mx-auto pb-16 px-4 mt-6">

                {/* ── Header ── */}
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                        <nav className="flex items-center gap-1 text-xs text-ink-soft mb-2">
                            <Link to="/dashboard" className="hover:text-ink transition-colors">Projets</Link>
                            <span>/</span>
                            <span className="text-ink/70">{projectTitle}</span>
                            <span>/</span>
                            <span className="text-ink font-medium">Podcasts</span>
                        </nav>
                        {editingTitle ? (
                            <input
                                ref={titleInputRef}
                                autoFocus
                                value={titleDraft}
                                onChange={e => setTitleDraft(e.target.value)}
                                onBlur={handleSaveTitle}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleSaveTitle();
                                    if (e.key === 'Escape') setEditingTitle(false);
                                }}
                                className="text-2xl font-heading font-bold text-ink bg-transparent border-b-2 border-primary outline-none w-full"
                            />
                        ) : (
                            <h1
                                className="text-2xl font-heading font-bold text-ink cursor-pointer hover:text-primary transition-colors group flex items-center gap-2"
                                onClick={() => { setTitleDraft(projectData?.title || ''); setEditingTitle(true); }}
                            >
                                {projectTitle}
                                <Pencil className="h-4 w-4 opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0" />
                            </h1>
                        )}
                        <p className="text-sm text-ink-soft mt-1">
                            Récapitulatif des contenus audio générés pour ce projet
                        </p>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-shrink-0">
                        <button
                            onClick={() => navigate(`/editor/${projectId}`, { state: { step: 2 } })}
                            className="flex items-center gap-1.5 px-4 py-2 border border-border rounded text-sm font-medium text-ink-soft hover:text-ink hover:border-primary/30 bg-surface transition-colors"
                        >
                            <LayoutList className="h-4 w-4" />
                            Voir la structure
                        </button>
                        <button
                            onClick={() => navigate(`/editor/${projectId}`)}
                            className="flex items-center gap-1.5 px-4 py-2 border border-border rounded text-sm font-medium text-ink-soft hover:text-ink hover:border-primary/30 bg-surface transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Aperçu source
                        </button>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="flex items-center gap-1.5 px-4 py-2 border border-border rounded text-sm font-medium text-ink-soft hover:text-ink hover:border-primary/30 bg-surface transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Tableau de bord
                        </button>
                    </div>
                </div>

                {/* ── Analyse globale banner — masqué si pas encore d'analyse ── */}
                {(macroScore !== null || macroFeedback.length > 0) && (
                <div className="bg-surface rounded-lg border border-border shadow-card p-5 mb-6 flex gap-6 items-start">
                    {/* Left — score gauge */}
                    <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                        {macroScore === null ? (
                            <div className="w-[80px] h-[80px] flex items-center justify-center">
                                <span className="text-2xl font-heading text-ink-faint">—</span>
                            </div>
                        ) : (
                            <div className="relative w-[80px] h-[80px]">
                                <svg className="w-[80px] h-[80px] -rotate-90" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="35" fill="none" stroke="var(--border)" strokeWidth="10" />
                                    <circle cx="50" cy="50" r="35" fill="none"
                                        stroke={macroScore >= 90 ? 'var(--emerald)' : macroScore >= 70 ? 'var(--amber)' : 'var(--danger)'}
                                        strokeWidth="10" strokeLinecap="round"
                                        strokeDasharray={`${220 * macroScore / 100} 220`}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-lg font-heading font-bold text-ink leading-none">
                                        {macroScore}%
                                    </span>
                                </div>
                            </div>
                        )}
                        <p className="text-xs font-medium text-ink">Analyse globale</p>
                        <p className="text-[10px] text-ink-soft text-center leading-relaxed">
                            {podcasts.length} podcast{podcasts.length > 1 ? 's' : ''} généré{podcasts.length > 1 ? 's' : ''}
                            {meanScore !== null && (
                                <> · Score de fidélité moyen&nbsp;: {meanScore}%</>
                            )}
                        </p>
                    </div>

                    {/* Middle — key observations */}
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold text-ink-faint mb-2">
                            Observations clés
                        </p>
                        {macroFeedback.length > 0 ? (
                            <ul className="space-y-1.5">
                                {macroFeedback.map((item, i) => {
                                    const warn = isFeedbackWarning(item);
                                    return (
                                        <li key={i} className="flex items-start gap-2 text-[13px]">
                                            {warn
                                                ? <AlertTriangle className="h-3.5 w-3.5 text-amber flex-shrink-0 mt-0.5" />
                                                : <CheckCircle className="h-3.5 w-3.5 text-emerald flex-shrink-0 mt-0.5" />
                                            }
                                            <span className={warn ? 'text-amber-ink' : 'text-ink/80'}>{item}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="text-sm text-ink-soft italic">
                                Aucune analyse disponible pour ce projet.
                            </p>
                        )}
                    </div>

                    {/* Right — health badge */}
                    <div className="flex-shrink-0 self-center">
                        {(macroScore === null || macroScore >= 70) ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald/12 border border-emerald/30 rounded-full text-xs font-bold text-emerald-ink whitespace-nowrap">
                                <CheckCircle className="h-3.5 w-3.5" />
                                Projet en bonne santé
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber/12 border border-amber/30 rounded-full text-xs font-bold text-amber-ink whitespace-nowrap">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                À améliorer
                            </span>
                        )}
                    </div>
                </div>
                )}

                {/* ── Prénoms des personnages ── */}
                <div className={`bg-surface rounded-lg border border-border shadow-card p-5 mb-6 ${locked ? 'opacity-60' : ''}`}>
                    <p className="text-[10px] font-semibold text-ink-faint mb-3">
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
                            className="flex-1 text-sm font-semibold border border-border rounded px-3 py-2 bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed"
                        />
                        <input
                            type="text"
                            value={char2Name}
                            disabled={locked}
                            onChange={(e) => setChar2Name(e.target.value)}
                            onBlur={handleSaveCharacterNames}
                            placeholder="Yannick"
                            className="flex-1 text-sm font-semibold border border-border rounded px-3 py-2 bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed"
                        />
                    </div>
                    {locked
                        ? <p className="text-[11px] text-ink-soft italic mt-2">Non modifiable — des podcasts ont déjà été générés.</p>
                        : <p className="text-[11px] text-ink-soft mt-2">Ces prénoms seront utilisés dans tous les dialogues générés pour ce projet.</p>
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
                                className="bg-surface rounded-lg border border-border shadow-card p-4 flex flex-col hover:shadow-pop transition-shadow">
                                {/* Top row */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-border-soft">
                                        <Mic size={18} className="text-ink-soft" />
                                    </div>
                                    {score != null ? (
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                            score >= 90
                                                ? 'bg-emerald/12 text-emerald-ink border-emerald/30'
                                                : score >= 70
                                                ? 'bg-amber/12 text-amber-ink border-amber/30'
                                                : 'bg-danger/12 text-danger-ink border-danger/30'
                                        }`}>
                                            {Math.round(score)}%
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-border bg-surface text-ink-faint">
                                            —
                                        </span>
                                    )}
                                </div>

                                {/* Title */}
                                <h3 className="font-heading font-bold text-sm text-ink leading-snug mb-2">{displayTitle}</h3>

                                {/* Pills */}
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {(podcast.word_count ?? 0) > 0 && (
                                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-ines-soft text-ines-ink">
                                            {podcast.word_count!.toLocaleString('fr-FR')} mots
                                        </span>
                                    )}
                                    {mins > 0 && (
                                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-border-soft text-ink-soft">
                                            ~{mins} min
                                        </span>
                                    )}
                                    {podcast.audio_url && (
                                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald/12 text-emerald-ink">
                                            Audio ✓
                                        </span>
                                    )}
                                </div>

                                {/* Date */}
                                {podcast.updated_at && (
                                    <p className="text-[10px] text-ink-faint mb-3">
                                        {formatDateParis(podcast.updated_at)}
                                    </p>
                                )}

                                {/* CTA */}
                                <div className="mt-auto pt-3 border-t border-border-soft flex flex-col gap-2">
                                    <button
                                        onClick={() => navigate(`/project/${projectId}/podcast/${podcast.id}/edit`)}
                                        className="w-full py-2 rounded text-xs font-medium bg-primary text-white hover:opacity-90 transition-all"
                                    >
                                        Ouvrir l'éditeur
                                    </button>
                                    <button
                                        onClick={() => handleDelete(podcast.id)}
                                        className="w-full py-2 rounded text-xs font-medium text-ink-soft hover:bg-danger/10 hover:text-danger border border-border hover:border-danger/30 transition-colors"
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
                        className="bg-surface rounded-lg border-2 border-dashed border-border p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary hover:bg-black/[.03] transition-all min-h-[180px] group"
                    >
                        <div className="w-10 h-10 rounded-full bg-border-soft flex items-center justify-center">
                            <Plus className="h-5 w-5 text-ink-faint group-hover:text-primary transition-colors" />
                        </div>
                        <p className="text-sm font-heading font-bold text-ink text-center">Générer un nouveau chapitre</p>
                        <p className="text-[11px] text-ink-soft text-center">Ajoutez un segment audio à ce projet</p>
                    </div>
                </div>
            </div>
        </AppLayout>

    );
}
