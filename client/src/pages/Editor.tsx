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
    FileDown, FileText, Clock, LayoutGrid, Loader2, CheckCircle, ArrowUp, ArrowDown, ChevronLeft, RefreshCw, ChevronRight, GripVertical
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

// Sortable Item Component with SaaS Design
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
            className={`group relative flex gap-4 p-6 rounded-2xl border-2 transition-all duration-200 outline-none
                ${isDragging ? 'shadow-xl scale-[1.01] border-primary' : ''}
                ${isInes
                    ? 'bg-card border-transparent hover:border-primary/30 shadow-sm'
                    : 'bg-accent/5 border-transparent hover:border-accent/30 shadow-sm'
                }
            `}
        >
            {/* Sidebar Internal (Avatar + Controls) */}
            <div className="w-20 flex flex-col items-center py-6 gap-3 flex-shrink-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm
                    ${isInes ? 'bg-secondary text-primary' : 'bg-card border border-accent/20 text-accent'}
                `}>
                    {isInes ? 'I' : 'Y'}
                </div>

                {/* Movement Controls (Visible on Hover) */}
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        className="p-1 text-muted-foreground hover:text-primary hover:bg-secondary rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
                        disabled={dialogue.order_index === 0}
                    >
                        <ArrowUp size={14} />
                    </button>
                    <button
                        className="p-1 text-muted-foreground hover:text-primary hover:bg-secondary rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
                        disabled={false}
                    >
                        <ArrowDown size={14} />
                    </button>
                </div>
            </div>
            
            <div className="w-8 flex flex-col items-center justify-center gap-2 cursor-grab text-muted-foreground hover:text-primary transition-colors" {...attributes} {...listeners}>
                <GripVertical size={20} />
            </div>
            
            <div className="flex-1">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex flex-col items-center justify-center font-bold text-sm shadow-inner
                            ${dialogue.character === 'ines' ? 'bg-[#f4ebe1] text-[#3465ae]' : 'bg-[#fcebdf] text-[#e63337]'}
                        `}>
                            {dialogue.character === 'ines' ? 'I' : 'Y'}
                        </div>
                        <span className={`font-black uppercase tracking-wide text-sm
                            ${dialogue.character === 'ines' ? 'text-[#3465ae]' : 'text-[#e63337]'}
                        `}>
                            {dialogue.character === 'ines' ? 'Inès' : 'Yannick'}
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className="relative group/regen">
                            <button 
                                className="text-[10px] flex items-center gap-1.5 px-2 py-1 bg-secondary border border-border rounded text-muted-foreground hover:text-foreground font-bold transition-colors uppercase tracking-wider"
                                disabled={isRegenerating}
                            >
                                {isRegenerating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                Régénérer
                            </button>
                            <div className="absolute right-0 top-full mt-1 w-32 bg-card border border-border shadow-eisf rounded-xl p-1 opacity-0 pointer-events-none group-hover/regen:opacity-100 group-hover/regen:pointer-events-auto transition-all z-10 flex flex-col scale-95 group-hover/regen:scale-100 origin-top-right">
                                <button onClick={() => onRegenerate(dialogue.id, dialogue.text_studio, 'simpler')} className="w-full text-left px-3 py-2 hover:bg-secondary rounded-lg text-xs font-medium text-foreground transition-colors">Plus simple</button>
                                <button onClick={() => onRegenerate(dialogue.id, dialogue.text_studio, 'detailed')} className="w-full text-left px-3 py-2 hover:bg-secondary rounded-lg text-xs font-medium text-foreground transition-colors">Plus détaillé</button>
                                <button onClick={() => onRegenerate(dialogue.id, dialogue.text_studio, 'rephrase')} className="w-full text-left px-3 py-2 hover:bg-secondary rounded-lg text-xs font-medium text-foreground transition-colors">Reformuler</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 mb-2 mt-1">
                    <button 
                         onClick={() => setEditingField('studio')}
                         className={`text-[10px] px-2 py-1 rounded uppercase tracking-wider font-bold transition-all ${editingField === 'studio' ? 'bg-primary text-white shadow-sm' : 'bg-secondary border border-border text-muted-foreground hover:bg-secondary/80'}`}
                    >
                        Texte Studio
                    </button>
                    <button 
                         onClick={() => setEditingField('reading')}
                         className={`text-[10px] px-2 py-1 rounded uppercase tracking-wider font-bold transition-all ${editingField === 'reading' ? 'bg-accent text-white shadow-sm' : 'bg-secondary border border-border text-muted-foreground hover:bg-secondary/80'}`}
                    >
                        Texte Export (Lecture)
                    </button>
                </div>
                <textarea
                    data-no-dnd="true"
                    onPointerDown={(e) => e.stopPropagation()}
                    className="w-full bg-transparent border-none p-0 text-[13px] font-normal text-foreground leading-relaxed resize-none focus:ring-0 outline-none font-sans"
                    value={editingField === 'studio' ? dialogue.text_studio : (dialogue.text_reading ?? dialogue.text_studio)}
                    onChange={(e) => onUpdate(dialogue.id, editingField, e.target.value)}
                    rows={Math.max(2, Math.ceil((editingField === 'studio' ? dialogue.text_studio : (dialogue.text_reading ?? dialogue.text_studio)).length / 80))}
                    spellCheck={false}
                    placeholder="Écrivez le dialogue ici..."
                />
            </div>
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
    const [exporting, setExporting] = useState(false);
    
    const [selectedPodcastId, setSelectedPodcastId] = useState<number | null>(null);
    const [availablePodcasts, setAvailablePodcasts] = useState<{id: number, title: string}[]>([]);
    const [generatingAudio, setGeneratingAudio] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [audioError, setAudioError] = useState<string | null>(null);
    
    // États pour le découpage manuel/unitaire
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

    // Synchroniser les chapitres éditables quand les données de preview arrivent
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

    // Quand ?chapter=N : dès que les chapitres sont chargés, passer à l'étape 'chapters'
    useEffect(() => {
        if (focusChapterIndex !== null && editableChapters.length > 0 && step === 'preview') {
            setStep('chapters');
        }
    }, [editableChapters.length]);

    // Scroll vers le chapitre ciblé une fois l'étape 'chapters' affichée
    useEffect(() => {
        if (step === 'chapters' && focusChapterIndex !== null && focusChapterRef.current) {
            setTimeout(() => focusChapterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
        }
    }, [step]);

    useKeyboardNav({
        onSave: () => handleSaveAction(dialogues),
    });

    const isGenerating = isGeneratingAll || generatingChapters.size > 0;

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

            // Reconstruire l'état des chapitres déjà générés depuis les podcasts existants
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
                
                // Try to extract filename from backend disposition
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
            // Boucle frontend pour éviter les timeouts serveur et montrer la progression
            for (let i = 0; i < editableChapters.length; i++) {
                // On saute ceux déjà générés manuellement
                if (generatedChapters.has(i)) continue;
                
                await handleGenerateSingle(i);
            }
            
            // Une fois fini, on va au dashboard du projet
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

            // Notification succès
            if (!isGeneratingAll) {
                setSaveStatus('saved');
                setShowToast(true);
                setTimeout(() => setShowToast(false), 3000);
            }
            
            return newPodcastId;
        } catch (error) {
            console.error('Erreur génération unitaire:', error);
            throw error; // Important pour arrêter la boucle globale en cas d'erreur
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

            // Recharger uniquement les dialogues du podcast corrigé
            // et les fusionner avec les dialogues des autres podcasts
            const dlgRes = await api.get(`/podcasts/${podcastId}/dialogues`);
            const correctedDialogues: Dialogue[] = dlgRes.data;
            setDialogues(prev => {
                const others = prev.filter(d => d.podcast_id !== podcastId);
                return [...others, ...correctedDialogues].sort((a, b) => {
                    if (a.podcast_id !== b.podcast_id) return (a.podcast_id ?? 0) - (b.podcast_id ?? 0);
                    return a.order_index - b.order_index;
                });
            });

            // Mettre à jour le rapport affiché
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
        <div className="h-screen flex items-center justify-center bg-background">
            <Loader2 className="animate-spin text-primary" size={40} />
        </div>
    );

    return (
        <AppLayout>
            <div className="max-w-5xl mx-auto pb-20">
                {/* Bandeau génération en cours */}
                {isGenerating && (
                    <div className="fixed top-0 inset-x-0 z-40 bg-[#E6A440] text-white text-sm font-semibold text-center py-2.5 px-4 flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                        ⏳ Génération en cours — ne fermez pas cette fenêtre et n'utilisez pas les boutons de navigation.
                    </div>
                )}

                {/* Stepper EISF */}
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
                                            ? 'bg-[#D6475B] text-white shadow-sm'
                                            : isDone
                                            ? 'bg-white text-foreground border border-[#E0DCE0] hover:border-[#D6475B] cursor-pointer'
                                            : 'bg-white text-muted-foreground border border-[#E0DCE0] opacity-50 cursor-not-allowed'
                                    }`}
                                >
                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                        isCurrent ? 'bg-white/25 text-white' : isDone ? 'bg-green-100 text-green-600' : 'bg-[#E6E2E6] text-muted-foreground'
                                    }`}>{isDone ? '✓' : i + 1}</span>
                                    {s.label}
                                </button>
                                {i < 2 && <div className={`w-8 h-px ${isDone ? 'bg-[#D6475B]/40' : 'bg-[#E0DCE0]'}`} />}
                            </div>
                        );
                    })}
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 mt-2">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/dashboard')}
                            disabled={isGenerating}
                            className="p-2 bg-card border border-border rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        {step === 'editor' && (
                            <button
                                onClick={() => navigate(`/project/${projectId}/podcasts`)}
                                disabled={isGenerating}
                                className="flex items-center gap-1.5 px-3 py-2 bg-card border border-border rounded-lg text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-[#E63337]/30 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Voir les podcasts →
                            </button>
                        )}
                        <div>
                            <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                                {isGenerating
                                    ? <span className="opacity-40 cursor-not-allowed">Projets</span>
                                    : <Link to="/dashboard" className="hover:text-foreground transition-colors">Projets</Link>
                                }
                                <span>/</span>
                                <span className="text-foreground font-medium">{project?.title || 'Éditeur'}</span>
                            </nav>
                            <h1 className="text-xl font-extrabold text-foreground tracking-tight font-display">
                                {project?.title || "Éditeur"}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {step === 'editor' && availablePodcasts.length > 1 && (
                            <select
                                value={selectedPodcastId || ''}
                                onChange={(e) => { setSelectedPodcastId(Number(e.target.value)); setAudioUrl(null); }}
                                className="bg-secondary text-foreground text-sm font-bold px-4 py-2 rounded-xl focus:ring-0 outline-none border border-border"
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
                                    displayScore >= 95 ? 'bg-[#BDD145]/20 text-[#5a6e00]' :
                                    displayScore >= 70 ? 'bg-[#E6A440]/20 text-[#b37a00]' :
                                    'bg-[#D6475B]/15 text-[#D6475B]'
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
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20"
                                >
                                    {verifying ? <Loader2 size={16} className="animate-spin" /> : '✨ Vérifier (IA)'}
                                </button>

                                <div className="relative group/export z-50">
                                    <button
                                        disabled={exporting}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all shadow-[0_2px_10px_-3px_rgba(52,101,174,0.3)] bg-primary border bg-card text-foreground border-border hover:bg-secondary"
                                    >
                                        {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                                        Exporter
                                    </button>
                                    <div className="absolute right-0 top-full mt-2 w-52 bg-card border border-border shadow-2xl rounded-xl p-2 opacity-0 pointer-events-none group-hover/export:opacity-100 group-hover/export:pointer-events-auto transition-all flex flex-col origin-top-right">
                                        <div className="text-[10px] font-bold text-muted-foreground px-2 py-1 uppercase tracking-wider">Word (.docx)</div>
                                        <button onClick={() => handleExport('word', 'studio')} className="text-left px-3 py-2 hover:bg-secondary rounded-lg text-sm transition-colors text-foreground font-medium">Version Studio</button>
                                        <button onClick={() => handleExport('word', 'lecture')} className="text-left px-3 py-2 hover:bg-secondary rounded-lg text-sm transition-colors text-foreground font-medium">Version Lecture</button>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleSave()}
                                    disabled={saveStatus === 'saving'}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm bg-card border border-border text-foreground hover:bg-secondary"
                                >
                                    {saveStatus === 'saving' && <Loader2 size={16} className="animate-spin" />}
                                    {saveStatus === 'saved' && <CheckCircle size={16} className="text-green-500" />}
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
                        <p className="text-sm text-muted-foreground -mt-2">
                            Vérifiez l'extraction des données avant de générer la structure pédagogique du podcast.
                        </p>

                        {previewing ? (
                            <div className="bg-white rounded-2xl border border-[#E0DCE0] p-20 text-center shadow-sm">
                                <Loader2 className="animate-spin text-[#D6475B] mx-auto mb-4" size={32} />
                                <p className="text-muted-foreground font-medium">Lecture du fichier Word en cours...</p>
                            </div>
                        ) : previewData ? (
                            <>
                                {/* 3 stat cards */}
                                <div className="grid grid-cols-3 gap-4">
                                    {([
                                        { value: previewData.wordCount.toLocaleString('fr-FR'), label: 'MOTS EXTRAITS' },
                                        { value: previewData.lineCount, label: 'BLOCS PÉDAGOGIQUES' },
                                        { value: previewData.chapters.length, label: 'CHAPITRES DÉTECTÉS' },
                                    ] as { value: string | number; label: string }[]).map(({ value, label }) => (
                                        <div key={label} className="bg-white rounded-2xl p-6 text-center shadow-sm">
                                            <p className="text-4xl font-extrabold" style={{ color: '#E63337' }}>{value}</p>
                                            <p className="text-xs font-semibold text-muted-foreground mt-2 tracking-wide">{label}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Card aperçu */}
                                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                    <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EEF0]">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                                                <FileText className="h-4 w-4 text-blue-500" />
                                            </div>
                                            <span className="font-semibold text-sm text-foreground">Aperçu du contenu extrait</span>
                                        </div>
                                        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-[#F4F6FA] border border-[#E0DCE0] px-3 py-1 rounded-full">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                                            Format Markdown détecté
                                        </span>
                                    </div>
                                    <div className="p-4">
                                        <div className="bg-[#F6F7F9] rounded-xl max-h-[400px] overflow-y-auto p-4">
                                            <pre className="font-mono text-xs text-foreground/75 whitespace-pre-wrap leading-relaxed">
                                                {previewData.cleanedText}
                                            </pre>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="bg-white rounded-2xl border border-dashed border-[#E0DCE0] p-20 text-center shadow-sm">
                                <p className="text-muted-foreground font-medium">Impossible de lire le fichier.</p>
                                <button onClick={handlePreview} className="mt-4 text-[#D6475B] underline text-sm">Réessayer</button>
                            </div>
                        )}

                        {/* Sticky bottom bar */}
                        {previewData && !previewing && (
                            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E0DCE0] z-30 flex items-center justify-between px-10 py-4 shadow-[0_-2px_12px_0_rgba(0,0,0,0.06)]">
                                <div className="flex items-center gap-2">
                                    {[1, 2, 3].map(n => (
                                        <span
                                            key={n}
                                            className="w-7 h-7 rounded-full bg-[#E6E2E6] text-foreground text-xs font-bold flex items-center justify-center"
                                        >
                                            {n}
                                        </span>
                                    ))}
                                    <span className="text-sm font-medium text-foreground ml-3">
                                        Prêt pour la découpe des chapitres
                                    </span>
                                </div>
                                <button
                                    onClick={() => { setIsNavigating(true); navigate(`/project/${projectId}/podcasts`); }}
                                    disabled={isNavigating}
                                    className="flex items-center gap-2 bg-[#D6475B] text-white hover:bg-[#c03d50] px-6 py-3 rounded-xl font-bold shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
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
                        <Loader2 className="animate-spin text-[#E63337]" size={28} />
                        <p className="text-sm text-muted-foreground">Chargement du découpage...</p>
                    </div>
                )}

                {step === 'chapters' && previewData && !previewing && (
                    <div className="grid lg:grid-cols-[35%_65%] gap-5 items-start">
                        {/* Left — chapter list */}
                        <div className="bg-white rounded-2xl border border-[#E0DCE0] shadow-sm overflow-hidden">
                            {/* Header */}
                            <div className="px-5 py-4 border-b border-[#E0DCE0] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                                    <h3 className="font-bold text-sm text-foreground">Structure du cours</h3>
                                </div>
                                <span className="text-[10px] font-bold tracking-widest uppercase bg-[#E6E2E6] text-muted-foreground px-2.5 py-1 rounded-full">
                                    ÉTAPE 2/3
                                </span>
                            </div>

                            {/* Chapter list */}
                            <div className="p-3 space-y-1 max-h-[520px] overflow-y-auto">
                                {editableChapters.map((chapter, i) => {
                                    const isGenerating = generatingChapters.has(i);
                                    const isGenerated = generatedChapters.has(i);
                                    const isSelected = selectedChapterIndex === i;
                                    return (
                                        <div
                                            key={i}
                                            ref={focusChapterIndex === i ? focusChapterRef : null}
                                            onClick={() => setSelectedChapterIndex(i)}
                                            style={isSelected ? { boxShadow: 'inset 4px 0 0 #E63337' } : undefined}
                                            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                                                isSelected
                                                    ? 'bg-[#FFF0F0]'
                                                    : isGenerated
                                                    ? 'bg-[#F5FBE8] hover:bg-[#EDF6D4]'
                                                    : 'bg-[#F8F7F8] hover:bg-[#F0EEF0]'
                                            }`}
                                        >
                                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold text-foreground truncate">{i + 1}. {chapter.title}</p>
                                                <div className="flex items-center gap-3 mt-0.5">
                                                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                        <FileText className="h-3 w-3" />{chapter.wordCount} mots
                                                    </span>
                                                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                        <Clock className="h-3 w-3" />
                                                        {chapterWordCounts[i]
                                                            ? `${Math.ceil(chapterWordCounts[i] / 140)} min`
                                                            : '–'}
                                                    </span>
                                                </div>
                                            </div>
                                            {isGenerating && <Loader2 className="h-3.5 w-3.5 text-[#E63337] animate-spin flex-shrink-0" />}
                                            {isGenerated && !isGenerating && <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Footer hint */}
                            <div className="px-4 py-3 border-t border-[#F0EEF0]">
                                <p className="text-[11px] italic text-muted-foreground text-center">
                                    Glissez-déposez pour réorganiser l'ordre des épisodes
                                </p>
                            </div>
                        </div>

                        {/* Right — selected chapter detail */}
                        {editableChapters[selectedChapterIndex] && (() => {
                            const ch = editableChapters[selectedChapterIndex];
                            const i = selectedChapterIndex;
                            const isGenerating = generatingChapters.has(i);
                            const isGenerated = generatedChapters.has(i);
                            return (
                                <div className="bg-white rounded-2xl border border-[#E0DCE0] shadow-sm overflow-hidden flex flex-col">
                                    {/* Header */}
                                    <div className="px-6 py-5 border-b border-[#E0DCE0]">
                                        <div className="flex items-start justify-between gap-4 mb-1">
                                            <input
                                                type="text"
                                                value={ch.title}
                                                onChange={(e) => updateChapterTitle(i, e.target.value)}
                                                className="flex-1 font-bold text-lg text-foreground bg-transparent border-none p-0 focus:ring-0 outline-none"
                                                placeholder="Titre du chapitre…"
                                            />
                                            {chapterWordCounts[i] ? (
                                                <span className="flex-shrink-0 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full">
                                                    ~{Math.ceil(chapterWordCounts[i] / 140)} min estimées
                                                </span>
                                            ) : (
                                                <span className="flex-shrink-0 text-xs font-semibold text-muted-foreground bg-[#F4F6FA] border border-[#E0DCE0] px-3 py-1 rounded-full">
                                                    durée : –
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {ch.wordCount} mots source
                                            {chapterWordCounts[i]
                                                ? ` · ${chapterWordCounts[i].toLocaleString('fr-FR')} mots générés`
                                                : ` · ~${ch.estimatedMinutes} min estimées`}
                                        </p>
                                    </div>

                                    {/* Source extract */}
                                    {(ch.lines?.length ?? 0) > 0 && (
                                        <div className="px-6 py-5 flex-1">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                                                Extrait du document source (.docx)
                                            </p>
                                            <div className="bg-[#F6F7F9] rounded-xl max-h-[350px] overflow-y-auto p-4">
                                                <pre className="font-mono text-xs text-foreground/75 whitespace-pre-wrap leading-relaxed">
                                                    {ch.lines!.join('\n')}
                                                </pre>
                                            </div>
                                        </div>
                                    )}

                                    {/* Bottom action bar */}
                                    <div className="px-6 pb-5 pt-3 border-t border-[#F0EEF0] flex items-center gap-4">
                                        <p className="text-xs italic text-muted-foreground flex-shrink-0">
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
                                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-[#E63337] text-white hover:bg-[#c92d31] disabled:opacity-60 transition-all"
                                        >
                                            {isGenerating && <Loader2 className="h-4 w-4 animate-spin" />}
                                            {isGenerating ? 'Génération en cours…' : isGenerated ? 'Ouvrir dans l\'éditeur →' : 'Générer ce chapitre →'}
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
                                className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                ← Retour aux chapitres
                            </button>
                            {dialogues.length > 0 && (
                                <button
                                    onClick={() => saveAndGoTo('audio')}
                                    className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-xl font-bold shadow-eisf hover:opacity-90 active:scale-95 transition-all"
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
                        <div className="bg-card border border-border rounded-3xl p-10 shadow-sm space-y-6">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">
                                    🎧
                                </div>
                                <h2 className="text-2xl font-bold text-foreground">Generation Audio</h2>
                                <p className="text-muted-foreground mt-2 text-sm max-w-md mx-auto">
                                    Deux voix IA distinctes : <strong>Ines</strong> (voix feminine) et <strong>Yannick</strong> (voix masculine).
                                    Le fichier MP3 est genere replique par replique puis assemble.
                                </p>
                            </div>

                            {/* Info voix */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-secondary rounded-xl p-4 text-center border border-border">
                                    <p className="font-bold text-foreground">Ines</p>
                                    <p className="text-xs text-muted-foreground mt-1">Voix Nova — experte</p>
                                    <div className="mt-2 h-1.5 rounded-full bg-primary/20">
                                        <div className="h-full w-[70%] rounded-full bg-primary"></div>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1">70% du dialogue</p>
                                </div>
                                <div className="bg-secondary rounded-xl p-4 text-center border border-border">
                                    <p className="font-bold text-foreground">Yannick</p>
                                    <p className="text-xs text-muted-foreground mt-1">Voix Echo — apprenant</p>
                                    <div className="mt-2 h-1.5 rounded-full bg-[#E63337]/20">
                                        <div className="h-full w-[30%] rounded-full bg-[#E63337]"></div>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1">30% du dialogue</p>
                                </div>
                            </div>

                            {/* Bouton generation */}
                            {!audioUrl && (
                                <div className="text-center">
                                    <button
                                        onClick={handleGenerateAudio}
                                        disabled={generatingAudio || displayedDialogues.length === 0}
                                        className="bg-[#D6475B] text-white hover:bg-[#c03d50] font-bold px-10 py-4 rounded-xl shadow-eisf hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-3 mx-auto"
                                    >
                                        {generatingAudio
                                            ? <><Loader2 size={20} className="animate-spin" /> Generation en cours ({displayedDialogues.length} repliques)...</>
                                            : <> Generer le podcast audio</>
                                        }
                                    </button>
                                    {generatingAudio && (
                                        <p className="text-xs text-muted-foreground mt-3">
                                            Environ {Math.ceil(dialogues.length * 0.3)} secondes — ne fermez pas la page.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Lecteur audio */}
                            {audioUrl && (
                                <div className="bg-secondary rounded-2xl p-6 border border-border space-y-4">
                                    <p className="font-bold text-foreground text-center">Podcast genere</p>
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
                                            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 transition-all"
                                        >
                                            <FileDown size={16} /> Telecharger MP3
                                        </a>
                                        <button
                                            onClick={handleGenerateAudio}
                                            disabled={generatingAudio}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-card border border-border text-foreground rounded-xl font-bold text-sm hover:bg-secondary transition-all disabled:opacity-50"
                                        >
                                            {generatingAudio ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                            Regenerer
                                        </button>
                                    </div>
                                </div>
                            )}

                            {audioError && (
                                <p className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-xl">{audioError}</p>
                            )}
                        </div>

                        <div className="pt-2">
                            <button
                                onClick={() => saveAndGoTo('editor')}
                                disabled={isGenerating}
                                className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                ← Retour a l'editeur
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Verification Panel Slider */}
            <AnimatePresence>
                {showVerificationPanel && (
                    <>
                        {/* Overlay */}
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }}
                            onClick={() => setShowVerificationPanel(false)}
                            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
                        />
                        {/* Panel */}
                        <motion.div
                            initial={{ x: '100%', opacity: 0.5 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0.5 }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 bottom-0 w-[400px] bg-card border-l border-border shadow-2xl z-50 flex flex-col"
                        >
                            <div className="p-6 border-b border-border flex items-center justify-between">
                                <div>
                                    <h2 className="font-bold text-lg">Vérification de l'IA</h2>
                                    <p className="text-sm text-muted-foreground mt-1">Analyse de fidélité au script d'origine</p>
                                    <p className="text-xs text-muted-foreground mt-1">⚠️ Ne fermez pas ce panneau pendant l'analyse ou la correction.</p>
                                </div>
                                <button onClick={() => setShowVerificationPanel(false)} className="p-2 hover:bg-secondary rounded-full">
                                    <ChevronRight size={20} className="text-muted-foreground" />
                                </button>
                            </div>

                            <div className="p-6 flex-1 overflow-y-auto">
                                {verifying ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center">
                                        <Loader2 className="animate-spin text-primary mb-4" size={40} />
                                        <p className="font-bold">Analyse en cours...</p>
                                        <p className="text-sm text-muted-foreground">L'IA croise le document et le script</p>
                                    </div>
                                ) : verificationReport ? (
                                    <div className="space-y-6">
                                        {/* Score */}
                                        <div className="bg-secondary rounded-2xl p-6 text-center border border-border">
                                            <p className="text-sm font-bold text-muted-foreground mb-2 uppercase tracking-wider">Score de Fidélité</p>
                                            <div className="flex items-baseline justify-center gap-1">
                                                <span className={`text-6xl font-extrabold tracking-tighter ${
                                                    verificationReport?.fidelityScore > 85 ? 'text-green-500' 
                                                    : verificationReport?.fidelityScore > 70 ? 'text-orange-500' 
                                                    : 'text-red-500'
                                                }`}>
                                                    {verificationReport?.fidelityScore}%
                                                </span>
                                            </div>
                                        </div>

                                        {/* Omissions */}
                                        <div>
                                            <h3 className="font-bold flex items-center gap-2 mb-3 text-sm text-muted-foreground uppercase tracking-wider">
                                                <span className="w-2 h-2 rounded-full bg-orange-500"></span> Concepts manquants ({verificationReport?.missingConcepts.length})
                                            </h3>
                                            {verificationReport?.missingConcepts.length > 0 ? (
                                                <ul className="space-y-2">
                                                    {verificationReport?.missingConcepts.map((c, i) => (
                                                        <li key={i} className="text-sm bg-accent/5 border border-accent/20 p-3 rounded-xl">{c}</li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-sm text-muted-foreground italic">Aucun concept oublié.</p>
                                            )}
                                        </div>

                                        {/* Additions */}
                                        <div>
                                            <h3 className="font-bold flex items-center gap-2 mb-3 text-sm text-muted-foreground uppercase tracking-wider">
                                                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Ajouts de l'IA ({verificationReport?.addedConcepts.length})
                                            </h3>
                                            {verificationReport?.addedConcepts.length > 0 ? (
                                                <ul className="space-y-2">
                                                    {verificationReport?.addedConcepts.map((c, i) => (
                                                        <li key={i} className="text-sm bg-blue-500/5 border border-blue-500/20 p-3 rounded-xl">{c}</li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-sm text-muted-foreground italic">Aucun ajout hors-script.</p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-20 text-muted-foreground">
                                        Impossible de charger le rapport.
                                    </div>
                                )}
                            </div>
                            {verificationReport && (
                                <div className="p-6 border-t border-border bg-secondary/50 flex flex-col gap-2">
                                    {autoFixing && (
                                        <div className="flex items-center gap-2 text-sm text-primary font-semibold mb-1">
                                            <Loader2 size={14} className="animate-spin" />
                                            {autoFixProgress || 'Correction automatique en cours...'}
                                        </div>
                                    )}
                                    {verificationReport?.missingConcepts.length > 0 && (
                                        <button
                                            onClick={handleAutoVerifyAndFix}
                                            disabled={autoFixing}
                                            className="w-full bg-[#E63337] hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {autoFixing ? <Loader2 size={16} className="animate-spin" /> : null}
                                            Corriger automatiquement jusqu'a 95%
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowVerificationPanel(false)}
                                        className="w-full bg-card hover:bg-secondary border border-border text-foreground font-bold py-3 rounded-xl transition-all"
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
                        className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#E63337] text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 z-[100] font-bold max-w-sm text-center text-sm"
                    >
                        <CheckCircle size={18} className="flex-shrink-0" />
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
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-foreground text-background px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 z-[100] font-bold border border-white/10"
                    >
                        <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
                            <CheckCircle size={14} className="text-white" />
                        </div>
                        Sauvegarde avec succes
                    </motion.div>
                )}
            </AnimatePresence>
        </AppLayout>
    );
}

