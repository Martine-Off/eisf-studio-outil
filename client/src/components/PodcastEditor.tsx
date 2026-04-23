import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Loader2, CheckCircle, ChevronLeft, ChevronRight, GripVertical, Pencil, X, FileDown, ChevronDown } from 'lucide-react';
import api from '../utils/api';
import { useKeyboardNav } from '../hooks/useKeyboardNav';
import AppLayout from '../components/AppLayout';
import { AIVerificationPanel } from './AIVerificationPanel';
import GenerateAudioModal from '../components/GenerateAudioModal';
import { motion, AnimatePresence } from 'framer-motion';

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

interface TextPart {
    type: 'text' | 'proposition';
    content: string;
    fullMatch: string;
}

interface PropositionRef {
    dialogueId: number;
    partIndex: number;
    fullMatch: string;
    content: string;
}

function parseTextParts(text: string): TextPart[] {
    const parts: TextPart[] = [];
    const regex = /\[PROPOSITION:\s*(.*?)\]/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ type: 'text', content: text.slice(lastIndex, match.index), fullMatch: '' });
        }
        parts.push({ type: 'proposition', content: match[1].trim(), fullMatch: match[0] });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
        parts.push({ type: 'text', content: text.slice(lastIndex), fullMatch: '' });
    }
    return parts;
}

function hasPropositions(text: string): boolean {
    return /\[PROPOSITION:/i.test(text);
}

// ─── Composant réplique ───────────────────────────────────────────────────────
function SortableDialogue({
    dialogue, onUpdate, onAccept, onReject, activePropositionMatch, elementRef
}: {
    dialogue: Dialogue;
    onUpdate: (id: number, field: 'studio' | 'reading', text: string) => void;
    onAccept: (id: number, fullMatch: string) => void;
    onReject: (id: number, fullMatch: string) => void;
    activePropositionMatch: string | null;
    elementRef: (el: HTMLDivElement | null) => void;
}) {
    const [editingField, setEditingField] = useState<'studio' | 'reading' | null>(null);
    const [showReading, setShowReading] = useState(false);
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: dialogue.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.8 : 1
    };
    const isInes = dialogue.character.toLowerCase() === 'ines';
    const textStudioParts = parseTextParts(dialogue.text_studio);
    const studioHasProps = textStudioParts.some(p => p.type === 'proposition');

    const mergedRef = useCallback((el: HTMLDivElement | null) => {
        setNodeRef(el);
        elementRef(el);
    }, [setNodeRef, elementRef]);

    return (
        <div
            ref={mergedRef}
            style={style}
            {...attributes}
            className={`group relative flex gap-4 p-6 rounded-2xl border-2 transition-all duration-200 outline-none
                ${isDragging ? 'shadow-xl scale-[1.01] border-primary' : ''}
                ${studioHasProps ? 'border-amber-300 bg-amber-50/40' : isInes
                    ? 'bg-card border-transparent hover:border-primary/30 shadow-sm'
                    : 'bg-accent/5 border-transparent hover:border-accent/30 shadow-sm'
                }`}
        >
            {/* Drag handle */}
            <div className="w-8 flex flex-col items-center justify-center gap-2 cursor-grab text-muted-foreground hover:text-primary transition-colors flex-shrink-0" {...listeners}>
                <GripVertical size={20} />
            </div>

            {/* Avatar */}
            <div className="w-10 flex-shrink-0 flex flex-col items-center pt-1">
                <div className={`w-10 h-10 rounded-full flex flex-col items-center justify-center font-bold text-sm shadow-inner
                    ${isInes ? 'bg-[#f4ebe1] text-[#3465ae]' : 'bg-[#fcebdf] text-[#e63337]'}`}>
                    {isInes ? 'I' : 'Y'}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-3">
                    <span className={`font-black uppercase tracking-wide text-sm ${isInes ? 'text-[#3465ae]' : 'text-[#e63337]'}`}>
                        {isInes ? 'Inès' : 'Yannick'}
                    </span>
                    {studioHasProps && editingField === null && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                            ⚠ propositions en attente
                        </span>
                    )}
                </div>

                {/* Texte Studio */}
                <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60">Texte Studio</span>
                        <button
                            onClick={() => setEditingField(editingField === 'studio' ? null : 'studio')}
                            className="text-[10px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground transition-all flex items-center gap-1"
                        >
                            {editingField === 'studio' ? <><X size={10} /> Fermer</> : <><Pencil size={10} /> Éditer</>}
                        </button>
                    </div>

                    {editingField === 'studio' ? (
                        <textarea
                            data-no-dnd="true"
                            onPointerDown={(e) => e.stopPropagation()}
                            className="w-full bg-transparent border border-border rounded-lg p-2 text-base text-foreground leading-relaxed resize-none focus:ring-1 focus:ring-primary outline-none font-sans"
                            value={dialogue.text_studio}
                            onChange={(e) => onUpdate(dialogue.id, 'studio', e.target.value)}
                            rows={Math.max(3, Math.ceil(dialogue.text_studio.length / 90))}
                            spellCheck={false}
                        />
                    ) : (
                        <div className="text-base text-foreground leading-relaxed font-sans whitespace-pre-wrap">
                            {textStudioParts.map((part, i) =>
                                part.type === 'proposition' ? (
                                    <span
                                        key={i}
                                        className={`inline-flex items-baseline gap-1 rounded px-1.5 py-0.5 mx-0.5 text-amber-900 font-medium
                                            ${part.fullMatch === activePropositionMatch
                                                ? 'bg-amber-300 ring-2 ring-amber-500'
                                                : 'bg-amber-100 border border-amber-300'
                                            }`}
                                    >
                                        <span>{part.content}</span>
                                        <button
                                            onClick={() => onAccept(dialogue.id, part.fullMatch)}
                                            title="Garder cette proposition"
                                            className="ml-1 text-green-700 hover:text-green-900 font-bold text-sm leading-none"
                                        >✓</button>
                                        <button
                                            onClick={() => onReject(dialogue.id, part.fullMatch)}
                                            title="Supprimer cette proposition"
                                            className="text-red-500 hover:text-red-700 font-bold text-sm leading-none"
                                        >✗</button>
                                    </span>
                                ) : (
                                    <span key={i}>{part.content}</span>
                                )
                            )}
                        </div>
                    )}
                </div>

                {/* Texte Lecture — collapsé par défaut */}
                <div className="mt-2">
                    <button
                        onClick={() => { setShowReading(v => !v); if (editingField === 'reading') setEditingField(null); }}
                        className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                    >
                        <ChevronRight size={10} className={`transition-transform ${showReading ? 'rotate-90' : ''}`} />
                        Version lecture (export)
                    </button>
                    {showReading && (
                        <div className="mt-1.5">
                            <div className="flex items-center gap-2 mb-1">
                                <button
                                    onClick={() => setEditingField(editingField === 'reading' ? null : 'reading')}
                                    className="text-[10px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground transition-all flex items-center gap-1"
                                >
                                    {editingField === 'reading' ? <><X size={10} /> Fermer</> : <><Pencil size={10} /> Éditer</>}
                                </button>
                            </div>
                            {editingField === 'reading' ? (
                                <textarea
                                    data-no-dnd="true"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    className="w-full bg-transparent border border-border rounded-lg p-2 text-sm text-muted-foreground leading-relaxed resize-none focus:ring-1 focus:ring-primary outline-none font-sans"
                                    value={dialogue.text_reading ?? dialogue.text_studio}
                                    onChange={(e) => onUpdate(dialogue.id, 'reading', e.target.value)}
                                    rows={Math.max(2, Math.ceil((dialogue.text_reading ?? dialogue.text_studio).length / 90))}
                                    spellCheck={false}
                                />
                            ) : (
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {dialogue.text_reading ?? dialogue.text_studio}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function PodcastEditor() {
    const { projectId, podcastId } = useParams();
    const navigate = useNavigate();
    const [dialogues, setDialogues] = useState<Dialogue[]>([]);
    const [loading, setLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
    const [podcastInfo, setPodcastInfo] = useState<{ title: string; project_title?: string }>({ title: 'Chargement...' });
    const [showVerificationPanel, setShowVerificationPanel] = useState(false);
    const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
    const [showSourceModal, setShowSourceModal] = useState(false);
    const [sourceText, setSourceText] = useState<string | null>(null);
    const [loadingSource, setLoadingSource] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

    // Proposition navigation
    const [currentPropGlobalIdx, setCurrentPropGlobalIdx] = useState(0);
    const dialogueElRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );
    const saveStateRef = useRef({ status: saveStatus, dialogues });
    useEffect(() => { saveStateRef.current = { status: saveStatus, dialogues }; }, [saveStatus, dialogues]);

    useEffect(() => { if (podcastId) loadData(); }, [podcastId]);
    useEffect(() => {
        const timer = setInterval(() => {
            if (saveStateRef.current.status === 'unsaved') handleSaveAction(saveStateRef.current.dialogues);
        }, 30000);
        return () => clearInterval(timer);
    }, []);

    useKeyboardNav({ onSave: () => handleSaveAction(dialogues) });

    const handleShowSource = async () => {
        setShowSourceModal(true);
        if (sourceText !== null) return;
        setLoadingSource(true);
        try {
            const res = await api.get(`/podcasts/${podcastId}/source-section`);
            setSourceText(res.data.source_text || '');
        } catch (err) {
            setSourceText('Impossible de charger le texte source.');
            console.error(err);
        } finally {
            setLoadingSource(false);
        }
    };

    const loadData = async () => {
        try {
            const [infoRes, dlgsRes] = await Promise.all([
                api.get(`/podcasts/${podcastId}`),
                api.get(`/podcasts/${podcastId}/dialogues`),
            ]);
            setPodcastInfo(infoRes.data);
            if (infoRes.data.audio_url) {
                const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
                setAudioUrl(`${baseUrl}${infoRes.data.audio_url}`);
            }
            setDialogues(dlgsRes.data || []);
        } catch (error) {
            console.error('Erreur chargement podcast:', error);
        } finally {
            setLoading(false);
        }
    };

    // Toutes les propositions à traiter (liste plate)
    const allPropositions: PropositionRef[] = dialogues.flatMap(d => {
        const parts = parseTextParts(d.text_studio);
        return parts
            .filter(p => p.type === 'proposition')
            .map((p, partIndex) => ({
                dialogueId: d.id,
                partIndex,
                fullMatch: p.fullMatch,
                content: p.content,
            }));
    });

    const activeProp = allPropositions[currentPropGlobalIdx] ?? null;

    const scrollToProposition = useCallback((idx: number) => {
        const prop = allPropositions[idx];
        if (!prop) return;
        const el = dialogueElRefs.current.get(prop.dialogueId);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [allPropositions]);

    const goPrev = () => {
        const idx = Math.max(0, currentPropGlobalIdx - 1);
        setCurrentPropGlobalIdx(idx);
        scrollToProposition(idx);
    };
    const goNext = () => {
        const idx = Math.min(allPropositions.length - 1, currentPropGlobalIdx + 1);
        setCurrentPropGlobalIdx(idx);
        scrollToProposition(idx);
    };

    const handleUpdate = (id: number, field: 'studio' | 'reading', text: string) => {
        setDialogues(items => items.map(item =>
            item.id === id ? { ...item, [field === 'studio' ? 'text_studio' : 'text_reading']: text } : item
        ));
        setSaveStatus('unsaved');
    };

    const handleAccept = (dialogueId: number, fullMatch: string) => {
        // Extraire le texte de la proposition et le garder sans les crochets
        const content = fullMatch.replace(/\[PROPOSITION:\s*(.*?)\]/, '$1').trim();
        setDialogues(items => items.map(item =>
            item.id === dialogueId
                ? { ...item, text_studio: item.text_studio.replace(fullMatch, content) }
                : item
        ));
        setSaveStatus('unsaved');
        // Recentrer sur la proposition suivante si elle existe
        setCurrentPropGlobalIdx(idx => Math.max(0, Math.min(idx, allPropositions.length - 2)));
    };

    const handleReject = (dialogueId: number, fullMatch: string) => {
        setDialogues(items => items.map(item =>
            item.id === dialogueId
                ? { ...item, text_studio: item.text_studio.replace(fullMatch, '').replace(/\s{2,}/g, ' ').trim() }
                : item
        ));
        setSaveStatus('unsaved');
        setCurrentPropGlobalIdx(idx => Math.max(0, Math.min(idx, allPropositions.length - 2)));
    };

    const handleSaveAction = async (currentDialogues: Dialogue[]) => {
        if (saveStatus === 'saving') return;
        setSaveStatus('saving');
        try {
            await Promise.all(currentDialogues.map(d =>
                api.patch(`/dialogues/${d.id}`, {
                    text_studio: d.text_studio,
                    text_reading: d.text_reading || d.text_studio
                })
            ));
            if (currentDialogues.length > 0) {
                await api.patch(`/dialogues/reorder`, {
                    dialogues: currentDialogues.map((d, index) => ({ id: d.id, order_index: index }))
                });
            }
            setSaveStatus('saved');
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
            setSaveStatus('unsaved');
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

    const handleGenerateAudio = async () => {
        setIsAudioModalOpen(false);
        setIsGeneratingAudio(true);
        try {
            const response = await api.post(`/podcasts/${podcastId}/generate-audio`, {}, { timeout: 300000 });
            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            setAudioUrl(`${baseUrl}${response.data.audio_url}`);
        } catch (error: any) {
            const msg = error?.response?.data?.error;
            if (msg === 'tts_not_configured') {
                alert("La génération audio sera disponible prochainement (configuration n8n en cours).");
            } else {
                console.error("Erreur TTS:", error);
                alert("Erreur lors de la génération audio.");
            }
        } finally {
            setIsGeneratingAudio(false);
        }
    };

    if (loading) return (
        <div className="h-screen flex items-center justify-center bg-background">
            <Loader2 className="animate-spin text-primary" size={40} />
        </div>
    );

    const hasPendingPropositions = allPropositions.length > 0;

    return (
        <AppLayout>
            {/* Barre de navigation des propositions */}
            <AnimatePresence>
                {hasPendingPropositions && (
                    <motion.div
                        initial={{ y: -60, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -60, opacity: 0 }}
                        className="fixed top-0 left-0 right-0 z-50 bg-amber-50 border-b-2 border-amber-300 shadow-md px-6 py-3 flex items-center gap-4 flex-wrap"
                    >
                        <span className="text-amber-800 font-bold text-sm">
                            ⚠ {allPropositions.length} proposition{allPropositions.length > 1 ? 's' : ''} à valider
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={goPrev}
                                disabled={currentPropGlobalIdx === 0}
                                className="p-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-100 disabled:opacity-30 transition-all"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="text-sm font-bold text-amber-800 tabular-nums min-w-[60px] text-center">
                                {currentPropGlobalIdx + 1} / {allPropositions.length}
                            </span>
                            <button
                                onClick={goNext}
                                disabled={currentPropGlobalIdx >= allPropositions.length - 1}
                                className="p-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-100 disabled:opacity-30 transition-all"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                        {activeProp && (
                            <>
                                <button
                                    onClick={() => handleAccept(activeProp.dialogueId, activeProp.fullMatch)}
                                    className="px-3 py-1.5 rounded-lg bg-green-100 border border-green-300 text-green-800 font-bold text-sm hover:bg-green-200 transition-all flex items-center gap-1"
                                >
                                    ✓ Garder
                                </button>
                                <button
                                    onClick={() => handleReject(activeProp.dialogueId, activeProp.fullMatch)}
                                    className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 font-bold text-sm hover:bg-red-100 transition-all flex items-center gap-1"
                                >
                                    ✗ Supprimer
                                </button>
                                <span className="text-xs text-amber-700 italic truncate max-w-xs">
                                    « {activeProp.content.slice(0, 60)}{activeProp.content.length > 60 ? '…' : ''} »
                                </span>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className={`max-w-5xl mx-auto pb-20 ${hasPendingPropositions ? 'mt-20' : 'mt-6'}`}>
                <div className="flex flex-col md:flex-row justify-between gap-4 mb-6 mt-2">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => { handleSaveAction(dialogues); navigate(`/project/${projectId}/podcasts`); }}
                            className="p-2 bg-card border border-border rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-all shadow-sm"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <div>
                            <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                                <Link to="/dashboard" className="hover:text-foreground transition-colors">Projets</Link>
                                <span>/</span>
                                {podcastInfo.project_title && (
                                    <>
                                        <Link to={`/project/${projectId}/podcasts`} className="hover:text-foreground transition-colors">
                                            {podcastInfo.project_title}
                                        </Link>
                                        <span>/</span>
                                    </>
                                )}
                                <span className="text-foreground font-medium truncate max-w-[180px]">{podcastInfo.title || 'Podcast'}</span>
                            </nav>
                            <h1 className="text-lg font-extrabold text-foreground tracking-tight font-display leading-tight">
                                {podcastInfo.title || 'Éditeur de podcast'}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Dropdown Exporter */}
                        <div className="relative group/export z-50">
                            <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm bg-card border border-border text-foreground hover:bg-secondary">
                                <FileDown size={14} />
                                Exporter
                                <ChevronDown size={12} />
                            </button>
                            <div className="absolute right-0 top-full mt-2 w-52 bg-card border border-border shadow-2xl rounded-xl p-2 opacity-0 pointer-events-none group-hover/export:opacity-100 group-hover/export:pointer-events-auto transition-all flex flex-col origin-top-right">
                                <div className="text-[10px] font-bold text-muted-foreground px-2 py-1 uppercase tracking-wider">Texte (.txt)</div>
                                <button onClick={() => window.open(`/api/podcasts/${podcastId}/export-txt`)} className="text-left px-3 py-2 hover:bg-secondary rounded-lg text-sm transition-colors text-foreground font-medium">Script API (Speaker 1/2)</button>
                                <div className="h-[1px] bg-border my-1" />
                                <div className="text-[10px] font-bold text-muted-foreground px-2 py-1 uppercase tracking-wider">Word (.docx)</div>
                                <button onClick={() => window.open(`/api/podcasts/${podcastId}/export-word/studio`)} className="text-left px-3 py-2 hover:bg-secondary rounded-lg text-sm transition-colors text-foreground font-medium">Version Studio</button>
                                <button onClick={() => window.open(`/api/podcasts/${podcastId}/export-word/lecture`)} className="text-left px-3 py-2 hover:bg-secondary rounded-lg text-sm transition-colors text-foreground font-medium">Version Lecture</button>
                                <div className="h-[1px] bg-border my-1" />
                                <div className="text-[10px] font-bold text-muted-foreground px-2 py-1 uppercase tracking-wider">Référence</div>
                                <button onClick={handleShowSource} className="text-left px-3 py-2 hover:bg-secondary rounded-lg text-sm transition-colors text-foreground font-medium">Texte source</button>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowVerificationPanel(true)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20"
                        >
                            ✨ Vérifier (IA)
                        </button>
                        <button
                            onClick={() => handleSaveAction(dialogues)}
                            disabled={saveStatus === 'saving'}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm bg-card border border-border text-foreground hover:bg-secondary"
                        >
                            {saveStatus === 'saving' && <Loader2 size={14} className="animate-spin" />}
                            {saveStatus === 'saved' && <CheckCircle size={14} className="text-green-500" />}
                            Sauvegarder
                        </button>
                        <button
                            onClick={() => !audioUrl && !isGeneratingAudio && !hasPendingPropositions && setIsAudioModalOpen(true)}
                            disabled={isGeneratingAudio || hasPendingPropositions}
                            title={hasPendingPropositions ? 'Validez toutes les propositions avant de générer l\'audio' : ''}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm ${
                                audioUrl
                                    ? 'bg-green-100 text-green-700 cursor-default'
                                    : hasPendingPropositions
                                    ? 'bg-amber-100 text-amber-600 cursor-not-allowed border border-amber-200'
                                    : isGeneratingAudio
                                    ? 'bg-indigo-200 text-indigo-500 cursor-wait'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`}
                        >
                            {audioUrl
                                ? '✅ Audio prêt'
                                : hasPendingPropositions
                                ? `⚠ ${allPropositions.length} proposition${allPropositions.length > 1 ? 's' : ''}`
                                : isGeneratingAudio
                                ? <><Loader2 size={14} className="animate-spin" /> En cours...</>
                                : '🎙️ Générer le podcast'
                            }
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={dialogues.map(d => d.id)} strategy={verticalListSortingStrategy}>
                            {dialogues.map(d => (
                                <SortableDialogue
                                    key={d.id}
                                    dialogue={d}
                                    onUpdate={handleUpdate}
                                    onAccept={handleAccept}
                                    onReject={handleReject}
                                    activePropositionMatch={activeProp?.dialogueId === d.id ? activeProp.fullMatch : null}
                                    elementRef={(el) => {
                                        if (el) dialogueElRefs.current.set(d.id, el);
                                        else dialogueElRefs.current.delete(d.id);
                                    }}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                </div>
            </div>

            <AnimatePresence>
                {showVerificationPanel && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowVerificationPanel(false)}
                            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
                        />
                        <motion.div
                            initial={{ x: '100%', opacity: 0.5 }} animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0.5 }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 bottom-0 w-[400px] bg-card border-l border-border shadow-2xl z-50 flex flex-col"
                        >
                            <div className="p-6 border-b border-border flex items-center justify-between">
                                <div>
                                    <h2 className="font-bold text-lg">Vérification de l'IA</h2>
                                    <p className="text-sm text-muted-foreground mt-1">Analyse de fidélité au script d'origine</p>
                                </div>
                                <button onClick={() => setShowVerificationPanel(false)} className="p-2 hover:bg-secondary rounded-full">
                                    <ChevronRight size={20} className="text-muted-foreground" />
                                </button>
                            </div>
                            <div className="p-6 flex-1 overflow-y-auto">
                                <AIVerificationPanel podcastId={podcastId!} onCorrectionDone={loadData} />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <GenerateAudioModal
                isOpen={isAudioModalOpen}
                onCancel={() => setIsAudioModalOpen(false)}
                onConfirm={handleGenerateAudio}
            />

            {/* Modale texte source */}
            {showSourceModal && (
                <>
                    <div
                        onClick={() => setShowSourceModal(false)}
                        className="fixed inset-0 bg-black/50 z-40"
                    />
                    <div className="fixed inset-x-4 top-[10%] bottom-[10%] max-w-3xl mx-auto bg-card border border-border shadow-2xl rounded-2xl z-50 flex flex-col">
                        <div className="p-6 border-b border-border flex items-center justify-between flex-shrink-0">
                            <div>
                                <h2 className="font-bold text-lg">Texte source — {podcastInfo.title}</h2>
                                <p className="text-sm text-muted-foreground mt-0.5">Contenu du cours correspondant à ce chapitre</p>
                            </div>
                            <button
                                onClick={() => setShowSourceModal(false)}
                                className="p-2 hover:bg-secondary rounded-full text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            {loadingSource ? (
                                <div className="flex items-center justify-center py-16">
                                    <Loader2 className="animate-spin text-primary" size={32} />
                                </div>
                            ) : (
                                <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">
                                    {sourceText || 'Aucun texte source disponible.'}
                                </pre>
                            )}
                        </div>
                    </div>
                </>
            )}

            {audioUrl && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white p-2 rounded-full shadow-2xl border flex items-center gap-4 px-6">
                    <span className="text-sm font-bold text-gray-500">Aperçu Audio :</span>
                    <audio src={audioUrl} controls className="h-8" />
                </div>
            )}
        </AppLayout>
    );
}
