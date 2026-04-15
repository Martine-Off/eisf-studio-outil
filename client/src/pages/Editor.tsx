import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
    FileDown, Loader2, CheckCircle, ArrowUp, ArrowDown, ChevronLeft, RefreshCw, ChevronRight, GripVertical
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
                    className="w-full bg-transparent border-none p-0 text-lg text-foreground leading-relaxed resize-none focus:ring-0 outline-none font-sans"
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
    const [project, setProject] = useState<Project | null>(null);
    const [dialogues, setDialogues] = useState<Dialogue[]>([]);
    const [loading, setLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
    const [showToast, setShowToast] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [step, setStep] = useState<Step>('editor');
    const [previewData, setPreviewData] = useState<PreviewData | null>(null);
    const [previewing, setPreviewing] = useState(false);
    const [targetDuration, setTargetDuration] = useState(5);
    const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
    const [verifying, setVerifying] = useState(false);
    const [verificationReport, setVerificationReport] = useState<VerificationReport | null>(null);
    const [showVerificationPanel, setShowVerificationPanel] = useState(false);
    const [exporting, setExporting] = useState(false);
    
    const [selectedPodcastId, setSelectedPodcastId] = useState<number | null>(null);
    const [availablePodcasts, setAvailablePodcasts] = useState<{id: number, title: string}[]>([]);
    
    // États pour le découpage manuel/unitaire
    const [editableChapters, setEditableChapters] = useState<Chapter[]>([]);
    const [generatingChapters, setGeneratingChapters] = useState<Set<number>>(new Set());
    const [generatedChapters, setGeneratedChapters] = useState<Set<number>>(new Set());
    const [generatedIdMap, setGeneratedIdMap] = useState<Record<number, number>>({});
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);

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

    // Auto-lancer le preview quand on arrive sur l'étape 'preview' sans données
    useEffect(() => {
        if (step === 'preview' && !previewData && !previewing && projectId) {
            handlePreview();
        }
    }, [step]);

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

    useKeyboardNav({
        onSave: () => handleSaveAction(dialogues),
    });

    const handlePreview = async () => {
        setPreviewing(true);
        try {
            const res = await api.post('/ai/preview', { projectId: Number(projectId) });
            setPreviewData(res.data);
        } catch (error) {
            console.error('Erreur prévisualisation:', error);
        } finally {
            setPreviewing(false);
        }
    };

    const loadData = async () => {
        try {
            // Charger le projet d'abord
            const projRes = await api.get(`/projects/${projectId}`);
            setProject(projRes.data.project);

            // Charger les dialogues séparément (peut retourner [] si aucun podcast)
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
            setStep(allDialogues.length > 0 ? 'editor' : 'preview');
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

        setGeneratingChapters(prev => new Set(prev).add(index));
        try {
            const res = await api.post('/ai/generate-single-chapter', {
                projectId: Number(projectId),
                segment: chapter,
                orderIndex: index
            });
            
            const newPodcastId = res.data.podcastId;
            setGeneratedChapters(prev => new Set(prev).add(index));
            setGeneratedIdMap(prev => ({ ...prev, [index]: newPodcastId }));
            
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
        setVerifying(true);
        setShowVerificationPanel(true);
        try {
            const podcastId = selectedPodcastId || dialogues[0]?.podcast_id;
            const res = await api.post('/ai/verify', { podcastId });
            setVerificationReport(res.data);
        } catch (error) {
            console.error('Erreur vérification:', error);
        } finally {
            setVerifying(false);
        }
    };

    const handleFixMissing = async () => {
        if (!verificationReport) return;
        setVerifying(true);
        try {
            const podcastId = selectedPodcastId || dialogues[0]?.podcast_id;
            const res = await api.post('/ai/fix-missing-concepts', {
                podcastId,
                missingConcepts: verificationReport.missingConcepts
            });
            setDialogues(prev => [...prev, ...res.data.newDialogues]);
            setShowVerificationPanel(false);
            setSaveStatus('unsaved');
        } catch (error) {
            console.error('Erreur correction:', error);
        } finally {
            setVerifying(false);
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
                <div className="mb-8 mt-4 flex items-center justify-center gap-4">
                    {[
                        { id: 'preview', label: 'Aperçu' },
                        { id: 'chapters', label: 'Chapitres' },
                        { id: 'editor', label: 'Éditeur' },
                        { id: 'audio', label: 'Audio' }
                    ].map((s, i) => {
                        const stepOrder = ['preview', 'chapters', 'editor', 'audio'];
                        const idxS = stepOrder.indexOf(s.id);
                        const idxCurrent = stepOrder.indexOf(step);
                        const isDone = idxS < idxCurrent;
                        const isCurrent = idxS === idxCurrent;
                        
                        return (
                            <div key={s.id} className="flex items-center">
                                <button
                                    onClick={() => isDone ? saveAndGoTo(s.id as Step) : null}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-all ${
                                        isCurrent ? 'bg-primary text-primary-foreground shadow-sm' :
                                        isDone ? 'bg-secondary text-foreground hover:bg-secondary/80 cursor-pointer' :
                                        'bg-card text-muted-foreground opacity-50 cursor-not-allowed border border-border'
                                    }`}
                                >
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                                        isCurrent ? 'bg-background/20 text-primary-foreground' :
                                        isDone ? 'bg-background text-foreground' :
                                        'bg-secondary text-muted-foreground'
                                    }`}>
                                        {i + 1}
                                    </span>
                                    {s.label}
                                </button>
                                    {i < 3 && (
                                        <div className={`w-6 h-[2px] mx-2 ${isDone ? 'bg-secondary' : 'bg-border/50'}`}></div>
                                    )}
                            </div>
                        );
                    })}
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 mt-2">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="p-2.5 bg-card border border-border rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-all shadow-sm"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-3xl font-extrabold text-foreground tracking-tight font-display">
                                {project?.title || "Éditeur"}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {step === 'editor' && availablePodcasts.length > 1 && (
                            <select 
                                value={selectedPodcastId || ''} 
                                onChange={(e) => setSelectedPodcastId(Number(e.target.value))}
                                className="bg-secondary text-foreground text-sm font-bold px-4 py-2 rounded-xl focus:ring-0 outline-none border border-border"
                            >
                                {availablePodcasts.map(p => (
                                    <option key={p.id} value={p.id}>{p.title}</option>
                                ))}
                            </select>
                        )}
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
                                        <div className="h-[1px] bg-border my-1"></div>
                                        <div className="text-[10px] font-bold text-muted-foreground px-2 py-1 mt-1 uppercase tracking-wider">PDF</div>
                                        <button onClick={() => handleExport('pdf', 'studio')} className="text-left px-3 py-2 hover:bg-secondary rounded-lg text-sm transition-colors text-foreground font-medium">Version Studio</button>
                                        <button onClick={() => handleExport('pdf', 'lecture')} className="text-left px-3 py-2 hover:bg-secondary rounded-lg text-sm transition-colors text-foreground font-medium">Version Lecture</button>
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
                        {previewing ? (
                            <div className="bg-card border border-dashed border-border rounded-3xl p-20 text-center">
                                <Loader2 className="animate-spin text-primary mx-auto mb-4" size={32} />
                                <p className="text-muted-foreground font-medium">Lecture du fichier Word en cours...</p>
                            </div>
                        ) : previewData ? (
                            <>
                                {/* Stats du fichier */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-card border border-border rounded-2xl p-5 text-center">
                                        <p className="text-3xl font-extrabold text-primary">{previewData.wordCount.toLocaleString()}</p>
                                        <p className="text-sm text-muted-foreground mt-1">mots extraits</p>
                                    </div>
                                    <div className="bg-card border border-border rounded-2xl p-5 text-center">
                                        <p className="text-3xl font-extrabold text-primary">{previewData.lineCount}</p>
                                        <p className="text-sm text-muted-foreground mt-1">blocs pédagogiques</p>
                                    </div>
                                    <div className="bg-card border border-border rounded-2xl p-5 text-center">
                                        <p className="text-3xl font-extrabold text-primary">{previewData.chapters.length}</p>
                                        <p className="text-sm text-muted-foreground mt-1">chapitres détectés</p>
                                    </div>
                                </div>

                                {/* Aperçu du texte extrait */}
                                <div className="bg-card border border-border rounded-2xl p-6">
                                    <h3 className="font-bold text-foreground mb-3">📄 Aperçu du contenu extrait</h3>
                                    <div className="bg-secondary rounded-xl p-4 max-h-64 overflow-y-auto">
                                        {previewData.rawLinesPreview.map((line, i) => (
                                            <p key={i} className="text-sm text-foreground/80 mb-1 leading-relaxed">{line}</p>
                                        ))}
                                        {previewData.lineCount > 30 && (
                                            <p className="text-xs text-muted-foreground mt-2 italic">
                                                ... et {previewData.lineCount - 30} blocs supplémentaires
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Bouton continuer */}
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => saveAndGoTo('chapters')}
                                        className="flex items-center gap-2 eisf-gradient text-primary-foreground px-8 py-3 rounded-xl font-bold shadow-eisf hover:opacity-90 transition-all"
                                    >
                                        Voir le découpage des chapitres →
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="bg-card border border-dashed border-border rounded-3xl p-20 text-center">
                                <p className="text-muted-foreground font-medium">Impossible de lire le fichier.</p>
                                <button onClick={handlePreview} className="mt-4 text-primary underline text-sm">Réessayer</button>
                            </div>
                        )}
                    </div>
                )}

                {/* ============================================================ */}
                {/* ÉTAPE 2 — DÉCOUPAGE EN CHAPITRES                            */}
                {/* ============================================================ */}
                {step === 'chapters' && previewData && (
                    <div className="space-y-6">
                        <div className="bg-card border border-border rounded-2xl p-6">
                            <h3 className="font-bold text-foreground mb-1">🗂️ Découpage proposé</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                L'application a détecté {editableChapters.length} chapitre(s) dans votre cours.
                                Vous pouvez modifier les titres et générer chaque épisode un par un.
                            </p>

                            <div className="space-y-3">
                                {editableChapters.map((chapter, i) => {
                                    const isGenerating = generatingChapters.has(i);
                                    const isGenerated = generatedChapters.has(i);
                                    
                                    return (
                                        <div key={i} 
                                             onClick={() => {
                                                 if (isGenerated) {
                                                     const podcastId = generatedIdMap[i];
                                                     if (podcastId) {
                                                         navigate(`/project/${projectId}/podcast/${podcastId}/edit`);
                                                     } else {
                                                         navigate(`/project/${projectId}/podcasts`);
                                                     }
                                                 }
                                             }}
                                             className={`flex items-center gap-4 bg-secondary rounded-xl px-5 py-4 transition-all ${isGenerated ? 'opacity-90 border border-green-500/30 cursor-pointer hover:bg-green-50/50 hover:border-green-500/50 group' : ''}`}>
                                            <div className="flex-shrink-0 w-10 h-10 bg-background rounded-lg flex items-center justify-center text-xl shadow-sm">
                                                {isGenerated ? '✅' : '📻'}
                                            </div>
                                            
                                            <div className="flex-1">
                                                <input 
                                                    type="text"
                                                    value={chapter.title}
                                                    onChange={(e) => updateChapterTitle(i, e.target.value)}
                                                    className="w-full bg-transparent border-none p-0 font-bold text-foreground text-sm focus:ring-0 outline-none"
                                                    placeholder="Titre du podcast..."
                                                />
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-[10px] bg-background px-2 py-0.5 rounded text-muted-foreground font-bold uppercase tracking-wider">
                                                        {chapter.wordCount} mots
                                                    </span>
                                                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                                        ~{chapter.estimatedMinutes} min
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex-shrink-0">
                                                <button
                                                    onClick={() => handleGenerateSingle(i)}
                                                    disabled={isGenerating || isGenerated}
                                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all ${
                                                        isGenerated 
                                                            ? 'bg-green-500/10 text-green-600 border border-green-500/20' 
                                                            : 'bg-primary text-primary-foreground shadow-sm hover:opacity-90 active:scale-95 disabled:opacity-50'
                                                    }`}
                                                >
                                                    {isGenerating ? <Loader2 size={14} className="animate-spin" /> : isGenerated ? <CheckCircle size={14} /> : null}
                                                    {isGenerating ? 'En cours...' : isGenerated ? 'Généré' : 'Générer celui-ci'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Barre de progression pendant la génération globale */}
                        {isGeneratingAll && (
                            <div className="bg-card border border-primary/20 rounded-2xl p-6 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 mb-2">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-bold text-primary flex items-center gap-2">
                                        <Loader2 size={16} className="animate-spin" />
                                        Génération des chapitres en cours...
                                    </span>
                                    <span className="text-sm font-black text-primary">
                                        {generatedChapters.size} / {editableChapters.length}
                                    </span>
                                </div>
                                <div className="w-full h-3 bg-secondary rounded-full overflow-hidden border border-border">
                                    <div 
                                        className="h-full eisf-gradient transition-all duration-500 ease-out shadow-[0_0_10px_rgba(52,101,174,0.3)]"
                                        style={{ width: `${(generatedChapters.size / editableChapters.length) * 100}%` }}
                                    ></div>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-2 uppercase font-bold tracking-widest text-center">
                                    Estimation restante : {Math.ceil((editableChapters.length - generatedChapters.size) * 0.5)} minute(s)
                                </p>
                            </div>
                        )}

                        {/* Sélecteur durée + bouton générer */}
                        <div className="bg-card border border-border rounded-2xl p-6">
                            <h3 className="font-bold text-foreground mb-4">⚙️ Paramètres de génération</h3>
                            <div className="flex items-center gap-4">
                                <div>
                                    <label className="text-sm text-muted-foreground font-medium block mb-2">Durée cible du podcast</label>
                                    <select
                                        value={targetDuration}
                                        onChange={(e) => setTargetDuration(Number(e.target.value))}
                                        className="px-4 py-2.5 rounded-xl border border-border bg-secondary text-foreground font-medium"
                                    >
                                        <option value={4}>4 minutes</option>
                                        <option value={5}>5 minutes</option>
                                        <option value={6}>6 minutes</option>
                                        <option value={7}>7 minutes</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <button
                                onClick={() => saveAndGoTo('preview')}
                                className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
                            >
                                ← Retour à l'aperçu
                            </button>
                            <button
                                onClick={handleGenerate}
                                disabled={generating}
                                className="flex items-center gap-2 eisf-gradient text-primary-foreground px-8 py-3 rounded-xl font-bold shadow-eisf hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
                            >
                                {generating ? <Loader2 size={18} className="animate-spin" /> : '🎙️'}
                                {generating ? 'Génération IA en cours...' : 'Générer le podcast'}
                            </button>
                        </div>
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
                                className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
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
                        <div className="bg-card border border-border rounded-3xl p-12 text-center shadow-sm">
                            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                                🎧
                            </div>
                            <h2 className="text-2xl font-bold text-foreground mb-2">Génération Audio</h2>
                            <p className="text-muted-foreground max-w-lg mx-auto">
                                Cette section permettra d'exporter et de générer l'audio directement via nos voix d'IA pour Inès et Yannick.
                            </p>
                            <div className="mt-8">
                                <button className="bg-primary text-primary-foreground font-bold px-8 py-4 rounded-xl shadow-eisf opacity-50 cursor-not-allowed">
                                    Connexion aux voix en cours d'intégration...
                                </button>
                            </div>
                        </div>
                        <div className="pt-4">
                            <button
                                onClick={() => saveAndGoTo('editor')}
                                className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
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
                                <div className="p-6 border-t border-border bg-secondary/50">
                                    <button 
                                        onClick={() => setShowVerificationPanel(false)}
                                        className="w-full bg-card hover:bg-secondary border border-border text-foreground font-bold py-3 rounded-xl transition-all"
                                    >
                                        J'ai compris
                                    </button>
                                    {verificationReport?.missingConcepts.length > 0 && (
                                        <button 
                                            onClick={handleFixMissing}
                                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-xl transition-all"
                                        >
                                            Laisser l'IA corriger
                                        </button>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Toast Notifications */}
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
                        Sauvegardé avec succès
                    </motion.div>
                )}
            </AnimatePresence>
        </AppLayout>
    );
}

