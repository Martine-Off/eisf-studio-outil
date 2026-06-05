// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    FileDown, FileText, Clock, LayoutGrid, Loader2, CheckCircle, ArrowUp, ArrowDown, ChevronLeft, RefreshCw, ChevronRight, GripVertical, AlertTriangle
} from 'lucide-react';
import api from '../utils/api';
import { useKeyboardNav } from '../hooks/useKeyboardNav';
import AppLayout from '../components/AppLayout';
import { motion, AnimatePresence } from 'framer-motion';

// Types
interface Dialogue {
    id: number;
    character: 'ines' | 'yannick';
    text_studio: string;
    text_reading?: string;
    section: string;
    duration_seconds: number;
    order_index: number;
    podcast_id?: number;
}

interface Chapter {
    title: string;
    lines: string[];
    wordCount: number;
    estimatedMinutes: number;
}

interface PreviewData {
    projectTitle: string;
    wordCount: number;
    lineCount: number;
    cleanedText: string;
    chapters: Chapter[];
    rawLinesPreview: string[];
}

type Step = 'preview' | 'chapters' | 'editor' | 'audio';

interface VerificationReport {
    fidelityScore: number;
    missingConcepts: string[];
    addedConcepts: string[];
    errors: string[];
}

interface Project {
    id: number;
    title: string;
    source_file_path: string;
    character_1_name?: string;
    character_2_name?: string;
}

// Sortable Item Component — style éditorial
function SortableDialogue({
    dialogue,
    onUpdate,
    onRegenerate,
    isRegenerating
}: {
    dialogue: Dialogue;
    onUpdate: (id: number, field: 'studio' | 'reading', text: string) => void;
    onRegenerate: (id: number, currentText: string, style: 'simpler' | 'detailed' | 'rephrase') => void;
    isRegenerating: boolean;
}) {
    const [editingField, setEditingField] = useState<'studio' | 'reading'>('studio');
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: dialogue.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.8 : 1,
    };

    const isInes = dialogue.character.toLowerCase() === 'ines';

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`group relative flex flex-col gap-2 p-4 rounded transition-all duration-200 outline-none bg-surface
                ${isDragging ? 'shadow-pop opacity-80' : 'shadow-card'}
                ${isInes
                    ? 'shadow-[inset_3px_0_0_var(--ines)]'
                    : 'ml-10 shadow-[inset_3px_0_0_var(--yannick)]'
                }
            `}
        >
            {/* Header row: nom locuteur + contrôles */}
            <div className="flex items-center justify-between mb-1">
                <span className={`font-heading text-[11px] tracking-[.18em] font-semibold ${isInes ? 'text-ines-ink' : 'text-yannick-ink'}`}>
                    {isInes ? 'INÈS' : 'YANNICK'}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        className="p-1 text-ink-faint hover:text-primary rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        disabled={dialogue.order_index === 0}
                    >
                        <ArrowUp size={12} />
                    </button>
                    <button
                        className="p-1 text-ink-faint hover:text-primary rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        disabled={false}
                    >
                        <ArrowDown size={12} />
                    </button>
                    <div className="cursor-grab text-ink-faint hover:text-primary px-1 transition-colors" {...attributes} {...listeners}>
                        <GripVertical size={16} />
                    </div>
                    <div className="relative group/regen">
                        <button
                            className="text-[10px] flex items-center gap-1 px-2 py-1 bg-surface border border-border rounded text-ink-soft hover:text-ink font-medium transition-colors"
                            disabled={isRegenerating}
                        >
                            {isRegenerating ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                            Régénérer
                        </button>
                        <div className="absolute right-0 top-full mt-1 w-32 bg-surface border border-border shadow-pop rounded-lg p-1 opacity-0 pointer-events-none group-hover/regen:opacity-100 group-hover/regen:pointer-events-auto transition-all z-10 flex flex-col">
                            <button onClick={() => onRegenerate(dialogue.id, dialogue.text_studio, 'simpler')} className="w-full text-left px-3 py-2 hover:bg-black/[.04] rounded text-xs font-medium text-ink transition-colors">Plus simple</button>
                            <button onClick={() => onRegenerate(dialogue.id, dialogue.text_studio, 'detailed')} className="w-full text-left px-3 py-2 hover:bg-black/[.04] rounded text-xs font-medium text-ink transition-colors">Plus détaillé</button>
                            <button onClick={() => onRegenerate(dialogue.id, dialogue.text_studio, 'rephrase')} className="w-full text-left px-3 py-2 hover:bg-black/[.04] rounded text-xs font-medium text-ink transition-colors">Reformuler</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Segmented control — Texte Studio / Texte Export */}
            <div className="flex items-center gap-1 mb-1">
                <button
                    onClick={() => setEditingField('studio')}
                    className={`text-[10px] px-2.5 py-1 rounded font-medium transition-all ${editingField === 'studio' ? 'bg-primary text-white' : 'bg-surface border border-border text-ink-soft'}`}
                >
                    Texte Studio
                </button>
                <button
                    onClick={() => setEditingField('reading')}
                    className={`text-[10px] px-2.5 py-1 rounded font-medium transition-all ${editingField === 'reading' ? 'bg-primary text-white' : 'bg-surface border border-border text-ink-soft'}`}
                >
                    Texte Export
                </button>
            </div>

            <textarea
                data-no-dnd="true"
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full bg-transparent border-none p-0 text-[14px] font-body font-normal text-ink leading-[1.72] resize-none focus:ring-0 outline-none"
                value={editingField === 'studio' ? dialogue.text_studio : (dialogue.text_reading ?? dialogue.text_studio)}
                onChange={(e) => onUpdate(dialogue.id, editingField, e.target.value)}
                rows={Math.max(2, Math.ceil((editingField === 'studio' ? dialogue.text_studio : (dialogue.text_reading ?? dialogue.text_studio)).length / 80))}
                spellCheck={false}
                placeholder="Écrivez le dialogue ici..."
            />
        </div>
    );
}

export default function Editor() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const focusChapterIndex = searchParams.get('chapter') !== null ? Number(searchParams.get('chapter')) : null;
    const focusChapterRef = useRef<HTMLDivElement | null>(null);
    const [project, setProject] = useState<Project | null>(null);
    const [dialogues, setDialogues] = useState<Dialogue[]>([]);
    const [loading, setLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
    const [showToast, setShowToast] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [step, setStep] = useState<Step>('editor');
    const [previewData, setPreviewData] = useState<PreviewData | null>(null);
    const [previewing, setPreviewing] = useState(false);
    const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
    const [verifying, setVerifying] = useState(false);
    const [verificationReport, setVerificationReport] = useState<VerificationReport | null>(null);
    const [showVerificationPanel, setShowVerificationPanel] = useState(false);
    const [autoFixing, setAutoFixing] = useState(false);
    const [autoFixProgress, setAutoFixProgress] = useState('');
    const [autoFixToastMsg, setAutoFixToastMsg] = useState('');
    const [errorToastMsg, setErrorToastMsg] = useState('');
    const [exporting, setExporting] = useState(false);

    const [selectedPodcastId, setSelectedPodcastId] = useState<number | null>(null);
    const [availablePodcasts, setAvailablePodcasts] = useState<{id: number, title: string}[]>([]);
    const [generatingAudio, setGeneratingAudio] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [audioError, setAudioError] = useState<string | null>(null);

    const [editableChapters, setEditableChapters] = useState<Chapter[]>([]);
    const [generatingChapters, setGeneratingChapters] = useState<Set<number>>(new Set());
    const [generatedChapters, setGeneratedChapters] = useState<Set<number>>(new Set());
    const [generatedIdMap, setGeneratedIdMap] = useState<Record<number, number>>({});
    const [chapterScores, setChapterScores] = useState<Record<number, number>>({});
    const [chapterWordCounts, setChapterWordCounts] = useState<Record<number, number>>({});
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);
    const [selectedChapterIndex, setSelectedChapterIndex] = useState<number>(0);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const saveStateRef = useRef({ status: saveStatus, dialogues });
    useEffect(() => { saveStateRef.current = { status: saveStatus, dialogues }; }, [saveStatus, dialogues]);

    useEffect(() => {
        if (projectId) loadData();
    }, [projectId]);

    useEffect(() => {
        if (previewData?.chapters) {
            setEditableChapters(previewData.chapters);
        }
    }, [previewData]);

    useEffect(() => {
        const timer = setInterval(() => {
            if (saveStateRef.current.status === 'unsaved') {
                handleSaveAction(saveStateRef.current.dialogues);
            }
        }, 30000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (focusChapterIndex !== null && editableChapters.length > 0 && step === 'preview') {
            setStep('chapters');
        }
    }, [editableChapters.length]);

    useEffect(() => {
        if (step === 'chapters' && focusChapterIndex !== null && focusChapterRef.current) {
            setTimeout(() => focusChapterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
        }
    }, [step]);

    useKeyboardNav({
        onSave: () => handleSaveAction(dialogues),
    });

    const isGenerating = isGeneratingAll || generatingChapters.size > 0 || regeneratingId !== null;

    useEffect(() => {
        if (!isGenerating) return;
        const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isGenerating]);

    const previewInFlightRef = useRef(false);
    const inFlightChapters = useRef<Set<number>>(new Set());

    const handlePreview = useCallback(async () => {
        if (previewInFlightRef.current) return;
        previewInFlightRef.current = true;
        setPreviewing(true);
        try {
            const res = await api.post('/ai/preview', { projectId: Number(projectId) });
            setPreviewData(res.data);
        } catch (error) {
            console.error('Erreur prévisualisation:', error);
        } finally {
            setPreviewing(false);
            previewInFlightRef.current = false;
        }
    }, [projectId]);

    const loadData = async () => {
        try {
            const projRes = await api.get(`/projects/${projectId}`);
            setProject(projRes.data.project);

            const existingPodcasts: any[] = projRes.data.podcasts || [];
            if (existingPodcasts.length > 0) {
                const genChapters = new Set<number>();
                const genIdMap: Record<number, number> = {};
                const genWc: Record<number, number> = {};
                existingPodcasts.forEach((p: any) => {
                    if (p.order_index != null) {
                        genChapters.add(p.order_index);
                        genIdMap[p.order_index] = p.id;
                        if ((p.word_count ?? 0) > 0) genWc[p.order_index] = p.word_count;
                    }
                });
                setGeneratedChapters(genChapters);
                setGeneratedIdMap(genIdMap);
                setChapterWordCounts(genWc);
            }

            let allDialogues: Dialogue[] = [];
            try {
                const dlgsRes = await api.get(`/projects/${projectId}/dialogues`);
                allDialogues = dlgsRes.data || [];
            } catch (dlgError) {
                console.warn('Aucun dialogue trouvé, démarrage au preview:', dlgError);
                allDialogues = [];
            }

            if (allDialogues.length > 0) {
                const uniqueIds = Array.from(new Set(allDialogues.map((d: any) => d.podcast_id)));
                const deducedPodcasts = uniqueIds.map(pid => {
                    const firstMatch: any = allDialogues.find((d: any) => d.podcast_id === pid);
                    return { id: pid as number, title: firstMatch?.podcast_title || `Chapitre ${firstMatch?.section || pid}` };
                });
                setAvailablePodcasts(deducedPodcasts);
                if (!selectedPodcastId && deducedPodcasts.length > 0) {
                    setSelectedPodcastId(deducedPodcasts[0].id);
                }
            }

            setDialogues(allDialogues);
            const initialStep: Step = location.state?.step === 2
                ? 'chapters'
                : focusChapterIndex !== null ? 'preview'
                : allDialogues.length > 0 ? 'editor'
                : 'preview';
            setStep(initialStep);
            if (initialStep === 'preview' || initialStep === 'chapters') {
                handlePreview();
            }
        } catch (error) {
            console.error('Erreur chargement projet:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = (id: number, field: 'studio' | 'reading', text: string) => {
        setDialogues(items =>
            items.map(item => item.id === id ? { ...item, [field === 'studio' ? 'text_studio' : 'text_reading']: text } : item)
        );
        setSaveStatus('unsaved');
    };

    const handleSaveAction = async (currentDialogues: Dialogue[]) => {
        if (saveStatus === 'saving') return;
        setSaveStatus('saving');

        try {
            await Promise.all(currentDialogues.map(d =>
                api.put(`/dialogues/${d.id}`, {
                    text_studio: d.text_studio,
                    text_reading: d.text_reading || d.text_studio
                })
            ));

            if (currentDialogues.length > 0) {
                const podcastId = currentDialogues[0].podcast_id;
                if (podcastId) {
                    await api.put(`/podcasts/${podcastId}/reorder`, {
                        dialogues: currentDialogues.map((d, index) => ({ id: d.id, order_index: index }))
                    });
                }
            }

            setSaveStatus('saved');
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
        } catch (error: any) {
            console.error('Erreur sauvegarde:', error);
            setSaveStatus('unsaved');
        }
    };

    const handleSave = () => handleSaveAction(dialogues);

    const saveAndGoTo = async (newStep: Step) => {
        if (step === 'editor' && saveStatus === 'unsaved') {
            await handleSaveAction(dialogues);
        }
        setStep(newStep);
        if ((newStep === 'preview' || newStep === 'chapters') && !previewData) {
            handlePreview();
        }
    };

    const displayedDialogues = useMemo(() => {
        if (!selectedPodcastId) return dialogues;
        return dialogues.filter(d => d.podcast_id === selectedPodcastId).sort((a, b) => a.order_index - b.order_index);
    }, [dialogues, selectedPodcastId]);

    const handleExport = async (format: 'pdf' | 'word' | 'json', mode: 'studio' | 'lecture' | '') => {
        if (displayedDialogues.length > 0) {
            setExporting(true);
            try {
                const podcastId = selectedPodcastId || displayedDialogues[0].podcast_id;
                let endpoint = '';
                if (format === 'json') {
                    endpoint = `/export/json/${podcastId}`;
                } else {
                    endpoint = `/export/${format}-${mode}/${podcastId}`;
                }
                const res = await api.get(endpoint, { responseType: 'blob' });

                const url = window.URL.createObjectURL(new Blob([res.data]));
                const link = document.createElement('a');
                link.href = url;

                const disposition = res.headers['content-disposition'];
                let filename = `export.${format === 'word' ? 'docx' : format}`;
                if (disposition && disposition.indexOf('filename=') !== -1) {
                    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                    const matches = filenameRegex.exec(disposition);
                    if (matches != null && matches[1]) {
                        filename = matches[1].replace(/['"]/g, '');
                    }
                }

                link.download = filename;
                document.body.appendChild(link);
                link.click();
                link.remove();
            } catch (err: unknown) {
                console.error('Erreur export:', err);
                const msg = err instanceof Error ? err.message : 'Erreur inconnue';
                alert(`Echec de l'export : ${msg}. Verifiez que le serveur est demarré.`);
            } finally {
                setExporting(false);
            }
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            setDialogues((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over?.id);
                return arrayMove(items, oldIndex, newIndex);
            });
            setSaveStatus('unsaved');
        }
    };

    const handleGenerate = async () => {
        if (isGeneratingAll) return;
        setIsGeneratingAll(true);
        setGenerating(true);

        try {
            for (let i = 0; i < editableChapters.length; i++) {
                if (generatedChapters.has(i)) continue;
                await handleGenerateSingle(i);
            }
            navigate(`/project/${projectId}/podcasts`);
        } catch (error) {
            console.error('Erreur génération globale:', error);
        } finally {
            setGenerating(false);
            setIsGeneratingAll(false);
        }
    };

    const updateChapterTitle = (index: number, newTitle: string) => {
        setEditableChapters(prev => prev.map((ch, i) => i === index ? { ...ch, title: newTitle } : ch));
    };

    const handleGenerateSingle = async (index: number) => {
        const chapter = editableChapters[index];
        if (!chapter) return;
        if (generatingChapters.has(index)) return;
        if (inFlightChapters.current.has(index)) return;
        inFlightChapters.current.add(index);

        setGeneratingChapters(prev => new Set(prev).add(index));
        try {
            const res = await api.post('/ai/generate-single-chapter', {
                projectId: Number(projectId),
                segment: chapter,
                orderIndex: index,
                totalChapters: editableChapters.length,
                previousChapter: editableChapters[index - 1] || null,
                nextChapter: editableChapters[index + 1] || null,
            });

            const newPodcastId = res.data.podcastId;
            setGeneratedChapters(prev => new Set(prev).add(index));
            setGeneratedIdMap(prev => ({ ...prev, [index]: newPodcastId }));

            try {
                const podcastRes = await api.get(`/podcasts/${newPodcastId}`);
                const score: number | undefined = podcastRes.data.fidelity_score;
                if (score != null && score > 0) {
                    setChapterScores(prev => ({ ...prev, [index]: score }));
                }
                if (podcastRes.data.word_count) {
                    setChapterWordCounts(prev => ({ ...prev, [index]: podcastRes.data.word_count }));
                }
            } catch {}

            if (!isGeneratingAll) {
                setSaveStatus('saved');
                setShowToast(true);
                setTimeout(() => setShowToast(false), 3000);
            }

            return newPodcastId;
        } catch (error) {
            console.error('Erreur génération unitaire:', error);
            setErrorToastMsg('La génération a rencontré un problème temporaire. Réessayez dans quelques secondes.');
            throw new Error('La génération a rencontré un problème temporaire. Réessayez dans quelques secondes.');
        } finally {
            inFlightChapters.current.delete(index);
            setGeneratingChapters(prev => {
                const next = new Set(prev);
                next.delete(index);
                return next;
            });
        }
    };

    const handleRegenerate = async (id: number, currentText: string, style: 'simpler' | 'detailed' | 'rephrase') => {
        setRegeneratingId(id);
        try {
            const res = await api.post('/ai/regenerate-line', {
                projectId: Number(projectId),
                dialogueId: id,
                currentText,
                style
            });
            handleUpdate(id, 'studio', res.data.text_studio);
        } catch (error) {
            console.error('Erreur de régénération:', error);
        } finally {
            setRegeneratingId(null);
        }
    };

    const handleVerify = async () => {
        const podcastId = selectedPodcastId || dialogues[0]?.podcast_id;
        if (!podcastId) {
            alert('Generez d\'abord un podcast avant de lancer la verification.');
            return;
        }
        setVerifying(true);
        setShowVerificationPanel(true);
        try {
            const res = await api.post('/ai/verify', { podcastId });
            setVerificationReport(res.data);
        } catch (error) {
            console.error('Erreur vérification:', error);
        } finally {
            setVerifying(false);
        }
    };

    const handleAutoVerifyAndFix = async () => {
        const podcastId = selectedPodcastId || dialogues[0]?.podcast_id;
        if (!podcastId) {
            alert('Selectionnez un podcast avant de lancer la correction.');
            return;
        }
        setAutoFixing(true);
        setAutoFixProgress('Analyse en cours...');
        try {
            const res = await api.post('/ai/auto-verify-and-fix', { podcastId }, { timeout: 300000 });
            const { finalScore, iterations, targetReached } = res.data;
            setAutoFixProgress('Rechargement des dialogues...');

            const dlgRes = await api.get(`/podcasts/${podcastId}/dialogues`);
            const correctedDialogues: Dialogue[] = dlgRes.data;
            setDialogues(prev => {
                const others = prev.filter(d => d.podcast_id !== podcastId);
                return [...others, ...correctedDialogues].sort((a, b) => {
                    if (a.podcast_id !== b.podcast_id) return (a.podcast_id ?? 0) - (b.podcast_id ?? 0);
                    return a.order_index - b.order_index;
                });
            });

            setVerificationReport({
                fidelityScore: finalScore,
                missingConcepts: [],
                addedConcepts: [],
                errors: []
            });

            setAutoFixToastMsg(`Script corrige — ${finalScore}% de fidelite${targetReached ? '' : ' (correction partielle)'} en ${iterations} passe(s)`);
            setTimeout(() => setAutoFixToastMsg(''), 5000);
        } catch (error) {
            console.error('Erreur auto-correction:', error);
            alert('Erreur lors de la correction automatique. Verifiez que le serveur est demarre.');
        } finally {
            setAutoFixing(false);
            setAutoFixProgress('');
        }
    };

    const handleGenerateAudio = async () => {
        const podcastId = selectedPodcastId || dialogues[0]?.podcast_id;
        if (!podcastId) return;
        setGeneratingAudio(true);
        setAudioError(null);
        try {
            const res = await api.post(`/podcasts/${podcastId}/generate-audio`, {}, { timeout: 300000 });
            const url = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}${res.data.audio_url}`;
            setAudioUrl(url);
        } catch (err: any) {
            if (err?.response?.data?.error === 'tts_not_configured') {
                setAudioError('La génération audio sera disponible prochainement (configuration n8n en cours).');
            } else {
                const msg = err instanceof Error ? err.message : 'Erreur inconnue';
                setAudioError(`Echec de la generation audio : ${msg}`);
            }
        } finally {
            setGeneratingAudio(false);
        }
    };

    if (loading) return (
        <div className="h-screen flex items-center justify-center bg-canvas">
            <Loader2 className="animate-spin text-primary" size={40} />
        </div>
    );

    return (
        <AppLayout>
            <div className="max-w-5xl mx-auto pb-20">
                {/* Bandeau génération en cours */}
                {isGenerating && (
                    <div className="fixed top-14 inset-x-0 z-[60] bg-surface border-b-2 border-amber text-amber-ink text-sm font-medium text-center py-2.5 px-4 flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                        Génération en cours — ne fermez pas cette fenêtre et n'utilisez pas les boutons de navigation.
                    </div>
                )}

                {/* Stepper */}
                <div className="flex items-center justify-center gap-2 mb-8 mt-2">
                    {[
                        { id: 'preview', label: 'Aperçu source' },
                        { id: 'chapters', label: 'Structure du cours' },
                        { id: 'editor', label: 'Éditeur' },
                    ].map((s, i) => {
                        const stepOrder = ['preview', 'chapters', 'editor', 'audio'];
                        const idxS = stepOrder.indexOf(s.id);
                        const idxCurrent = stepOrder.indexOf(step);
                        const isDone = idxS < idxCurrent;
                        const isCurrent = idxS === idxCurrent;
                        return (
                            <div key={s.id} className="flex items-center gap-2">
                                <button
                                    onClick={() => isDone ? saveAndGoTo(s.id as Step) : undefined}
                                    disabled={!isDone && !isCurrent}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                        isCurrent
                                            ? 'bg-primary text-white shadow-sm'
                                            : isDone
                                            ? 'bg-surface text-ink border border-border hover:border-primary cursor-pointer'
                                            : 'bg-surface text-ink-soft border border-border opacity-50 cursor-not-allowed'
                                    }`}
                                >
                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                        isCurrent ? 'bg-white/25 text-white' : isDone ? 'bg-emerald/15 text-emerald-ink' : 'bg-border-soft text-ink-faint'
                                    }`}>{isDone ? '✓' : i + 1}</span>
                                    {s.label}
                                </button>
                                {i < 2 && <div className={`w-8 h-px ${isDone ? 'bg-primary/40' : 'bg-border'}`} />}
                            </div>
                        );
                    })}
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 mt-2">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/dashboard')}
                            disabled={isGenerating}
                            className="p-2 bg-surface border border-border rounded hover:bg-canvas text-ink-soft hover:text-ink transition-all shadow-card disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        {step === 'editor' && (
                            <button
                                onClick={() => navigate(`/project/${projectId}/podcasts`)}
                                disabled={isGenerating}
                                className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-border rounded text-sm font-medium text-ink-soft hover:text-ink hover:border-primary/30 transition-all shadow-card disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Voir les podcasts →
                            </button>
                        )}
                        <div>
                            <nav className="flex items-center gap-1 text-xs text-ink-soft mb-0.5">
                                {isGenerating
                                    ? <span className="opacity-40 cursor-not-allowed">Projets</span>
                                    : <Link to="/dashboard" className="hover:text-ink transition-colors">Projets</Link>
                                }
                                <span>/</span>
                                <span className="text-ink font-medium">{project?.title || 'Éditeur'}</span>
                            </nav>
                            <h1 className="text-xl font-heading font-bold text-ink tracking-tight">
                                {project?.title || "Éditeur"}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {step === 'editor' && availablePodcasts.length > 1 && (
                            <select
                                value={selectedPodcastId || ''}
                                onChange={(e) => { setSelectedPodcastId(Number(e.target.value)); setAudioUrl(null); }}
                                className="bg-surface text-ink text-sm font-medium px-4 py-2 rounded focus:ring-0 outline-none border border-border"
                            >
                                {availablePodcasts.map(p => (
                                    <option key={p.id} value={p.id}>{p.title}</option>
                                ))}
                            </select>
                        )}
                        {step === 'editor' && (() => {
                            const scoreFromReport = verificationReport?.fidelityScore;
                            const scoreFromChapters = scoreFromReport == null
                                ? (() => {
                                    const entry = Object.entries(generatedIdMap).find(([, pid]) => pid === selectedPodcastId);
                                    return entry != null ? chapterScores[Number(entry[0])] : undefined;
                                })()
                                : undefined;
                            const displayScore = scoreFromReport ?? scoreFromChapters;
                            if (displayScore == null || displayScore === 0) return null;
                            return (
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                    displayScore >= 95 ? 'bg-emerald/15 text-emerald-ink' :
                                    displayScore >= 70 ? 'bg-amber/15 text-amber-ink' :
                                    'bg-danger/15 text-danger-ink'
                                }`}>
                                    Fidélité : {displayScore}%
                                </span>
                            );
                        })()}
                        {step === 'editor' && (
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleVerify}
                                    disabled={verifying}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded font-medium transition-all shadow-card bg-surface border border-border text-ink-soft hover:bg-canvas hover:text-ink"
                                >
                                    {verifying ? <Loader2 size={16} className="animate-spin" /> : '✨ Vérifier (IA)'}
                                </button>

                                <div className="relative group/export z-50">
                                    <button
                                        disabled={exporting}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded font-medium transition-all shadow-card bg-surface border border-border text-ink-soft hover:bg-canvas hover:text-ink"
                                    >
                                        {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                                        Exporter
                                    </button>
                                    <div className="absolute right-0 top-full mt-2 w-52 bg-surface border border-border shadow-pop rounded-lg p-2 opacity-0 pointer-events-none group-hover/export:opacity-100 group-hover/export:pointer-events-auto transition-all flex flex-col origin-top-right">
                                        <div className="text-[10px] font-medium text-ink-faint px-2 py-1">Word (.docx)</div>
                                        <button onClick={() => handleExport('word', 'studio')} className="text-left px-3 py-2 hover:bg-black/[.04] rounded text-sm transition-colors text-ink font-medium">Version Studio</button>
                                        <button onClick={() => handleExport('word', 'lecture')} className="text-left px-3 py-2 hover:bg-black/[.04] rounded text-sm transition-colors text-ink font-medium">Version Lecture</button>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleSave()}
                                    disabled={saveStatus === 'saving'}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded font-medium transition-all shadow-card bg-surface border border-border text-ink-soft hover:bg-canvas hover:text-ink"
                                >
                                    {saveStatus === 'saving' && <Loader2 size={16} className="animate-spin" />}
                                    {saveStatus === 'saved' && <CheckCircle size={16} className="text-emerald" />}
                                    Sauvegarder
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ============================================================ */}
                {/* ÉTAPE 1 — PRÉVISUALISATION DU CONTENU EXTRAIT               */}
                {/* ============================================================ */}
                {step === 'preview' && (
                    <div className="space-y-6">
                        <p className="text-sm text-ink-soft -mt-2">
                            Vérifiez l'extraction des données avant de générer la structure pédagogique du podcast.
                        </p>

                        {previewing ? (
                            <div className="bg-surface rounded-lg border border-border p-20 text-center shadow-card">
                                <Loader2 className="animate-spin text-primary mx-auto mb-4" size={32} />
                                <p className="text-ink-soft font-medium">Lecture du fichier Word en cours...</p>
                            </div>
                        ) : previewData ? (
                            <>
                                {/* 3 stat cards */}
                                <div className="grid grid-cols-3 gap-4">
                                    {([
                                        { value: previewData.wordCount.toLocaleString('fr-FR'), label: 'Mots extraits' },
                                        { value: previewData.lineCount, label: 'Blocs pédagogiques' },
                                        { value: previewData.chapters.length, label: 'Chapitres détectés' },
                                    ] as { value: string | number; label: string }[]).map(({ value, label }) => (
                                        <div key={label} className="bg-surface rounded-lg border border-border p-6 text-center shadow-card">
                                            <p className="text-4xl font-heading font-bold text-ink">{value}</p>
                                            <p className="text-xs font-medium text-ink-faint mt-2">{label}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Card aperçu */}
                                <div className="bg-surface rounded-lg shadow-card overflow-hidden border border-border">
                                    <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 bg-ines-soft rounded-lg flex items-center justify-center">
                                                <FileText className="h-4 w-4 text-ines-ink" />
                                            </div>
                                            <span className="font-semibold text-sm text-ink">Aperçu du contenu extrait</span>
                                        </div>
                                        <span className="flex items-center gap-1.5 text-xs font-medium text-ink-soft bg-canvas border border-border px-3 py-1 rounded-full">
                                            <span className="w-1.5 h-1.5 rounded-full bg-ines flex-shrink-0" />
                                            Format Markdown détecté
                                        </span>
                                    </div>
                                    <div className="p-4">
                                        <div className="bg-black/[.03] rounded-lg max-h-[400px] overflow-y-auto p-4">
                                            <pre className="font-mono text-xs text-ink/75 whitespace-pre-wrap leading-relaxed">
                                                {previewData.cleanedText}
                                            </pre>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="bg-surface rounded-lg border border-dashed border-border p-20 text-center shadow-card">
                                <p className="text-ink-soft font-medium">Impossible de lire le fichier.</p>
                                <button onClick={handlePreview} className="mt-4 text-primary underline text-sm">Réessayer</button>
                            </div>
                        )}

                        {/* Sticky bottom bar */}
                        {previewData && !previewing && (
                            <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-30 flex items-center justify-between px-10 py-4 shadow-[0_-4px_12px_0_rgba(0,0,0,0.04)]">
                                <div className="flex items-center gap-2">
                                    {[1, 2, 3].map(n => (
                                        <span
                                            key={n}
                                            className="w-7 h-7 rounded-full bg-border-soft text-ink-soft text-xs font-medium flex items-center justify-center"
                                        >
                                            {n}
                                        </span>
                                    ))}
                                    <span className="text-sm font-medium text-ink ml-3">
                                        Prêt pour la découpe des chapitres
                                    </span>
                                </div>
                                <button
                                    onClick={() => { setIsNavigating(true); navigate(`/project/${projectId}/podcasts`); }}
                                    disabled={isNavigating}
                                    className="flex items-center gap-2 bg-primary text-white hover:opacity-90 px-6 py-3 rounded font-medium shadow-card transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isNavigating ? 'Chargement…' : 'Configurer et générer les podcasts →'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ============================================================ */}
                {/* ÉTAPE 2 — DÉCOUPAGE EN CHAPITRES                            */}
                {/* ============================================================ */}
                {step === 'chapters' && (!previewData || previewing) && (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="animate-spin text-primary" size={28} />
                        <p className="text-sm text-ink-soft">Chargement du découpage...</p>
                    </div>
                )}

                {step === 'chapters' && previewData && !previewing && (
                    <div className="grid lg:grid-cols-[35%_65%] gap-5 items-start">
                        {/* Left — chapter list */}
                        <div className="bg-surface rounded-lg border border-border shadow-card overflow-hidden">
                            {/* Header */}
                            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <LayoutGrid className="h-4 w-4 text-ink-soft" />
                                    <h3 className="font-heading font-bold text-sm text-ink">Structure du cours</h3>
                                </div>
                                <span className="text-[10px] font-medium bg-border-soft text-ink-soft px-2.5 py-1 rounded-pill">
                                    Étape 2/3
                                </span>
                            </div>

                            {/* Chapter list */}
                            <div className="p-3 space-y-1 max-h-[520px] overflow-y-auto">
                                {editableChapters.map((chapter, i) => {
                                    const isThisChapterGenerating = generatingChapters.has(i);
                                    const isGenerated = generatedChapters.has(i);
                                    const isSelected = selectedChapterIndex === i;
                                    return (
                                        <div
                                            key={i}
                                            ref={focusChapterIndex === i ? focusChapterRef : null}
                                            onClick={() => setSelectedChapterIndex(i)}
                                            style={isSelected ? { boxShadow: 'inset 3px 0 0 var(--primary)' } : undefined}
                                            className={`flex items-center gap-2.5 px-3 py-2.5 rounded cursor-pointer transition-all ${
                                                isSelected
                                                    ? 'bg-canvas'
                                                    : isGenerated
                                                    ? 'bg-emerald/5 hover:bg-emerald/8'
                                                    : 'bg-canvas hover:bg-black/[.03]'
                                            }`}
                                        >
                                            <GripVertical className="h-3.5 w-3.5 text-ink-faint/40 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold text-ink truncate">{i + 1}. {chapter.title}</p>
                                                <div className="flex items-center gap-3 mt-0.5">
                                                    <span className="flex items-center gap-1 text-[10px] text-ink-faint">
                                                        <FileText className="h-3 w-3" />{chapter.wordCount} mots
                                                    </span>
                                                    <span className="flex items-center gap-1 text-[10px] text-ink-faint">
                                                        <Clock className="h-3 w-3" />
                                                        {chapterWordCounts[i]
                                                            ? `${Math.ceil(chapterWordCounts[i] / 140)} min`
                                                            : '–'}
                                                    </span>
                                                </div>
                                            </div>
                                            {isThisChapterGenerating && <Loader2 className="h-3.5 w-3.5 text-primary animate-spin flex-shrink-0" />}
                                            {isGenerated && !isThisChapterGenerating && <CheckCircle className="h-3.5 w-3.5 text-emerald flex-shrink-0" />}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Footer hint */}
                            <div className="px-4 py-3 border-t border-border-soft">
                                <p className="text-[11px] italic text-ink-faint text-center">
                                    Glissez-déposez pour réorganiser l'ordre des épisodes
                                </p>
                            </div>
                        </div>

                        {/* Right — selected chapter detail */}
                        {editableChapters[selectedChapterIndex] && (() => {
                            const ch = editableChapters[selectedChapterIndex];
                            const i = selectedChapterIndex;
                            const isThisChapterGenerating = generatingChapters.has(i);
                            const isGenerated = generatedChapters.has(i);
                            return (
                                <div className="bg-surface rounded-lg border border-border shadow-card overflow-hidden flex flex-col">
                                    {/* Header */}
                                    <div className="px-6 py-5 border-b border-border">
                                        <div className="flex items-start justify-between gap-4 mb-1">
                                            <input
                                                type="text"
                                                value={ch.title}
                                                onChange={(e) => updateChapterTitle(i, e.target.value)}
                                                className="flex-1 font-heading font-bold text-lg text-ink bg-transparent border-none p-0 focus:ring-0 outline-none"
                                                placeholder="Titre du chapitre…"
                                            />
                                            {chapterWordCounts[i] ? (
                                                <span className="flex-shrink-0 text-xs font-semibold text-emerald-ink bg-emerald/10 border border-emerald/25 px-3 py-1 rounded-full">
                                                    ~{Math.ceil(chapterWordCounts[i] / 140)} min estimées
                                                </span>
                                            ) : (
                                                <span className="flex-shrink-0 text-xs font-semibold text-ink-soft bg-canvas border border-border px-3 py-1 rounded-full">
                                                    durée : –
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-ink-soft">
                                            {ch.wordCount} mots source
                                            {chapterWordCounts[i]
                                                ? ` · ${chapterWordCounts[i].toLocaleString('fr-FR')} mots générés`
                                                : ` · ~${ch.estimatedMinutes} min estimées`}
                                        </p>
                                    </div>

                                    {/* Source extract */}
                                    {(ch.lines?.length ?? 0) > 0 && (
                                        <div className="px-6 py-5 flex-1">
                                            <p className="text-[10px] font-medium text-ink-faint mb-3">
                                                Extrait du document source (.docx)
                                            </p>
                                            <div className="bg-black/[.03] rounded-lg max-h-[350px] overflow-y-auto p-4">
                                                <pre className="font-mono text-xs text-ink/75 whitespace-pre-wrap leading-relaxed">
                                                    {ch.lines!.join('\n')}
                                                </pre>
                                            </div>
                                        </div>
                                    )}

                                    {/* Bottom action bar */}
                                    <div className="px-6 pb-5 pt-3 border-t border-border-soft flex items-center gap-4">
                                        <p className="text-xs italic text-ink-faint flex-shrink-0">
                                            Extraction validée par l'IA
                                        </p>
                                        <button
                                            onClick={() => {
                                                if (isGenerated) {
                                                    const podcastId = generatedIdMap[i];
                                                    if (podcastId) navigate(`/project/${projectId}/podcast/${podcastId}/edit`);
                                                    else navigate(`/project/${projectId}/podcasts`);
                                                } else {
                                                    handleGenerateSingle(i);
                                                }
                                            }}
                                            disabled={isGenerating}
                                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded text-sm font-medium bg-primary text-white hover:opacity-90 disabled:opacity-60 transition-all"
                                        >
                                            {isThisChapterGenerating && <Loader2 className="h-4 w-4 animate-spin" />}
                                            {isThisChapterGenerating ? 'Génération en cours…' : isGenerated ? 'Ouvrir dans l\'éditeur →' : 'Générer ce chapitre →'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}

                {step === 'editor' && (
                    <div className="space-y-4">
                        {displayedDialogues.length > 0 ? (
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                <SortableContext items={displayedDialogues.map(d => d.id)} strategy={verticalListSortingStrategy}>
                                    {displayedDialogues.map(d => (
                                        <SortableDialogue
                                            key={d.id}
                                            dialogue={d}
                                            onUpdate={handleUpdate}
                                            onRegenerate={handleRegenerate}
                                            isRegenerating={regeneratingId === d.id}
                                        />
                                    ))}
                                </SortableContext>
                            </DndContext>
                        ) : (
                                <button
                                    onClick={() => saveAndGoTo('chapters')}
                                    className="mt-4 text-primary underline text-sm font-medium"
                                >
                                    Aller au découpage
                                </button>
                        )}
                        <div className="pt-8 flex justify-between">
                            <button
                                onClick={() => saveAndGoTo('chapters')}
                                disabled={isGenerating}
                                className="text-ink-soft hover:text-ink text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                ← Retour aux chapitres
                            </button>
                            {dialogues.length > 0 && (
                                <button
                                    onClick={() => saveAndGoTo('audio')}
                                    className="flex items-center gap-2 bg-primary text-white px-8 py-3 rounded font-medium hover:opacity-90 active:scale-95 transition-all"
                                >
                                    Passer à la génération audio →
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* ============================================================ */}
                {/* ÉTAPE 4 — GÉNÉRATION AUDIO                                  */}
                {/* ============================================================ */}
                {step === 'audio' && (
                    <div className="space-y-6">
                        <div className="bg-surface border border-border rounded-lg p-10 shadow-card space-y-6">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4 text-3xl">
                                    🎧
                                </div>
                                <h2 className="text-2xl font-heading font-bold text-ink">Génération Audio</h2>
                                <p className="text-ink-soft mt-2 text-sm max-w-md mx-auto">
                                    Deux voix IA distinctes : <strong>Inès</strong> (voix féminine) et <strong>Yannick</strong> (voix masculine).
                                    Le fichier MP3 est généré réplique par réplique puis assemblé.
                                </p>
                            </div>

                            {/* Info voix */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-canvas rounded-lg p-4 text-center border border-border">
                                    <p className="font-heading font-bold text-ink">Inès</p>
                                    <p className="text-xs text-ink-soft mt-1">Voix Nova — experte</p>
                                    <div className="mt-2 h-1.5 rounded-full bg-primary/20">
                                        <div className="h-full w-[70%] rounded-full bg-primary"></div>
                                    </div>
                                    <p className="text-[10px] text-ink-faint mt-1">70% du dialogue</p>
                                </div>
                                <div className="bg-canvas rounded-lg p-4 text-center border border-border">
                                    <p className="font-heading font-bold text-ink">Yannick</p>
                                    <p className="text-xs text-ink-soft mt-1">Voix Echo — apprenant</p>
                                    <div className="mt-2 h-1.5 rounded-full bg-yannick/20">
                                        <div className="h-full w-[30%] rounded-full bg-yannick"></div>
                                    </div>
                                    <p className="text-[10px] text-ink-faint mt-1">30% du dialogue</p>
                                </div>
                            </div>

                            {/* Bouton generation */}
                            {!audioUrl && (
                                <div className="text-center">
                                    <button
                                        onClick={handleGenerateAudio}
                                        disabled={generatingAudio || displayedDialogues.length === 0}
                                        className="bg-primary text-white hover:opacity-90 font-medium px-10 py-4 rounded shadow-card active:scale-95 transition-all disabled:opacity-50 flex items-center gap-3 mx-auto"
                                    >
                                        {generatingAudio
                                            ? <><Loader2 size={20} className="animate-spin" /> Génération en cours ({displayedDialogues.length} répliques)...</>
                                            : <> Générer le podcast audio</>
                                        }
                                    </button>
                                    {generatingAudio && (
                                        <p className="text-xs text-ink-faint mt-3">
                                            Environ {Math.ceil(dialogues.length * 0.3)} secondes — ne fermez pas la page.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Lecteur audio */}
                            {audioUrl && (
                                <div className="bg-canvas rounded-lg p-6 border border-border space-y-4">
                                    <p className="font-heading font-bold text-ink text-center">Podcast généré</p>
                                    <audio
                                        controls
                                        src={audioUrl}
                                        className="w-full rounded-lg"
                                        style={{ colorScheme: 'light' }}
                                    />
                                    <div className="flex gap-3 justify-center flex-wrap">
                                        <a
                                            href={audioUrl}
                                            download
                                            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded font-medium text-sm hover:opacity-90 transition-all"
                                        >
                                            <FileDown size={16} /> Télécharger MP3
                                        </a>
                                        <button
                                            onClick={handleGenerateAudio}
                                            disabled={generatingAudio}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-surface border border-border text-ink-soft rounded font-medium text-sm hover:bg-canvas transition-all disabled:opacity-50"
                                        >
                                            {generatingAudio ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                            Régénérer
                                        </button>
                                    </div>
                                </div>
                            )}

                            {audioError && (
                                <p className="text-danger text-sm text-center bg-danger/8 p-3 rounded-lg">{audioError}</p>
                            )}
                        </div>

                        <div className="pt-2">
                            <button
                                onClick={() => saveAndGoTo('editor')}
                                disabled={isGenerating}
                                className="text-ink-soft hover:text-ink text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                ← Retour à l'éditeur
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Verification Panel Slider */}
            <AnimatePresence>
                {showVerificationPanel && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowVerificationPanel(false)}
                            className="fixed inset-0 bg-black/45 z-40"
                        />
                        <motion.div
                            initial={{ x: '100%', opacity: 0.5 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0.5 }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 bottom-0 w-[400px] bg-surface border-l border-border shadow-pop z-50 flex flex-col"
                        >
                            <div className="p-6 border-b border-border flex items-center justify-between">
                                <div>
                                    <h2 className="font-heading font-bold text-lg text-ink">Vérification de l'IA</h2>
                                    <p className="text-sm text-ink-soft mt-1">Analyse de fidélité au script d'origine</p>
                                    <p className="text-xs text-ink-faint mt-1">Ne fermez pas ce panneau pendant l'analyse ou la correction.</p>
                                </div>
                                <button onClick={() => setShowVerificationPanel(false)} className="p-2 hover:bg-canvas rounded-full">
                                    <ChevronRight size={20} className="text-ink-soft" />
                                </button>
                            </div>

                            <div className="p-6 flex-1 overflow-y-auto">
                                {verifying ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center">
                                        <Loader2 className="animate-spin text-primary mb-4" size={40} />
                                        <p className="font-bold text-ink">Analyse en cours...</p>
                                        <p className="text-sm text-ink-soft">L'IA croise le document et le script</p>
                                    </div>
                                ) : verificationReport ? (
                                    <div className="space-y-6">
                                        {/* Score */}
                                        <div className="bg-canvas rounded-lg p-6 text-center border border-border">
                                            <p className="text-sm font-semibold text-ink-faint mb-2">Score de fidélité</p>
                                            <div className="flex items-baseline justify-center gap-1">
                                                <span className={`text-6xl font-heading font-bold tracking-tighter ${
                                                    verificationReport?.fidelityScore > 85 ? 'text-emerald-ink'
                                                    : verificationReport?.fidelityScore > 70 ? 'text-amber-ink'
                                                    : 'text-danger-ink'
                                                }`}>
                                                    {verificationReport?.fidelityScore}%
                                                </span>
                                            </div>
                                        </div>

                                        {/* Omissions */}
                                        <div>
                                            <h3 className="font-medium flex items-center gap-2 mb-3 text-sm text-ink-faint">
                                                <span className="w-2 h-2 rounded-full bg-amber"></span> Concepts manquants ({verificationReport?.missingConcepts.length})
                                            </h3>
                                            {verificationReport?.missingConcepts.length > 0 ? (
                                                <ul className="space-y-2">
                                                    {verificationReport?.missingConcepts.map((c, i) => (
                                                        <li key={i} className="text-sm bg-amber/8 border border-amber/20 p-3 rounded-lg text-ink">{c}</li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-sm text-ink-soft italic">Aucun concept oublié.</p>
                                            )}
                                        </div>

                                        {/* Additions */}
                                        <div>
                                            <h3 className="font-medium flex items-center gap-2 mb-3 text-sm text-ink-faint">
                                                <span className="w-2 h-2 rounded-full bg-ines"></span> Ajouts de l'IA ({verificationReport?.addedConcepts.length})
                                            </h3>
                                            {verificationReport?.addedConcepts.length > 0 ? (
                                                <ul className="space-y-2">
                                                    {verificationReport?.addedConcepts.map((c, i) => (
                                                        <li key={i} className="text-sm bg-ines/8 border border-ines/20 p-3 rounded-lg text-ink">{c}</li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-sm text-ink-soft italic">Aucun ajout hors-script.</p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-20 text-ink-soft">
                                        Impossible de charger le rapport.
                                    </div>
                                )}
                            </div>
                            {verificationReport && (
                                <div className="p-6 border-t border-border bg-canvas flex flex-col gap-2">
                                    {autoFixing && (
                                        <div className="flex items-center gap-2 text-sm text-ink font-medium mb-1">
                                            <Loader2 size={14} className="animate-spin" />
                                            {autoFixProgress || 'Correction automatique en cours...'}
                                        </div>
                                    )}
                                    {verificationReport?.missingConcepts.length > 0 && (
                                        <button
                                            onClick={handleAutoVerifyAndFix}
                                            disabled={autoFixing}
                                            className="w-full bg-primary hover:opacity-90 text-white font-medium py-3 rounded transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {autoFixing ? <Loader2 size={16} className="animate-spin" /> : null}
                                            Corriger automatiquement jusqu'à 95%
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowVerificationPanel(false)}
                                        className="w-full bg-surface hover:bg-canvas border border-border text-ink-soft font-medium py-3 rounded transition-all"
                                    >
                                        Fermer
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Toast auto-fix */}
            <AnimatePresence>
                {autoFixToastMsg && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-surface border border-border text-ink px-6 py-3.5 rounded-lg shadow-pop flex items-center gap-3 z-[100] font-medium max-w-sm text-center text-sm"
                    >
                        <CheckCircle size={18} className="flex-shrink-0 text-emerald" />
                        {autoFixToastMsg}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toast sauvegarde */}
            <AnimatePresence>
                {showToast && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-surface border border-border text-ink px-6 py-3.5 rounded-lg shadow-pop flex items-center gap-3 z-[100] font-medium"
                    >
                        <div className="h-6 w-6 rounded-full bg-emerald flex items-center justify-center">
                            <CheckCircle size={14} className="text-white" />
                        </div>
                        Sauvegarde avec succès
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toast erreur génération */}
            <AnimatePresence>
                {errorToastMsg && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-danger/10 border border-danger/30 text-danger-ink px-6 py-3.5 rounded-lg shadow-pop flex items-center gap-3 z-[100] font-medium max-w-sm text-center text-sm"
                    >
                        <AlertTriangle size={16} className="flex-shrink-0 text-danger" />
                        {errorToastMsg}
                        <button onClick={() => setErrorToastMsg('')} className="ml-2 text-danger hover:opacity-70">✕</button>
                    </motion.div>
                )}
            </AnimatePresence>
        </AppLayout>
    );
}
