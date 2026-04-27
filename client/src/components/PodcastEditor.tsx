import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Loader2, CheckCircle, ChevronLeft, ChevronRight, GripVertical, Pencil,
    X, FileDown, Plus, ShieldCheck, AlertTriangle, RotateCcw, Clock, FileText, Users
} from 'lucide-react';
import api from '../utils/api';
import { useKeyboardNav } from '../hooks/useKeyboardNav';
import AppLayout from '../components/AppLayout';
import GenerateAudioModal, { type AudioSettings } from '../components/GenerateAudioModal';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface TextPart { type: 'text' | 'proposition'; content: string; fullMatch: string; }
interface PropositionRef { dialogueId: number; partIndex: number; fullMatch: string; content: string; }

interface VerificationState {
    status: 'idle' | 'running' | 'success' | 'insufficient';
    score: number | null;
    missingConcepts: string[];
    confusingElements: string[];
    passCount: number;
}

function parseTextParts(text: string): TextPart[] {
    const parts: TextPart[] = [];
    const regex = /\[PROPOSITION:\s*(.*?)\]/g;
    let lastIndex = 0, match;
    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) parts.push({ type: 'text', content: text.slice(lastIndex, match.index), fullMatch: '' });
        parts.push({ type: 'proposition', content: match[1].trim(), fullMatch: match[0] });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) parts.push({ type: 'text', content: text.slice(lastIndex), fullMatch: '' });
    return parts;
}

function fmtDuration(secs: number) {
    const m = Math.floor(secs / 60), s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Circular gauge ───────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number | null }) {
    const pct = score ?? 0;
    const color = pct >= 95 ? '#BDD145' : pct >= 70 ? '#E6A440' : '#D6475B';
    const dashArray = 220;
    const dashOffset = dashArray * (1 - pct / 100);
    return (
        <div className="flex flex-col items-center gap-1">
            <div className="relative w-28 h-28">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="35" fill="none" stroke="#E6E2E6" strokeWidth="8" />
                    <circle
                        cx="50" cy="50" r="35" fill="none"
                        stroke={color} strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${dashArray} 220`}
                        strokeDashoffset={dashOffset}
                        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {score === null ? (
                        <span className="text-sm text-muted-foreground font-medium">—</span>
                    ) : (
                        <>
                            <span className="text-2xl font-extrabold text-foreground leading-none">{score}%</span>
                            <span className="text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5">Fidélité</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Dialogue card ────────────────────────────────────────────────────────────

function SortableDialogue({
    dialogue, onUpdate, onAccept, onReject, activePropositionMatch, elementRef
}: {
    dialogue: Dialogue;
    onUpdate: (id: number, field: 'studio', text: string) => void;
    onAccept: (id: number, fullMatch: string) => void;
    onReject: (id: number, fullMatch: string) => void;
    activePropositionMatch: string | null;
    elementRef: (el: HTMLDivElement | null) => void;
}) {
    const [editing, setEditing] = useState(false);
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: dialogue.id });

    const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 'auto', opacity: isDragging ? 0.8 : 1 };
    const isInes = dialogue.character.toLowerCase() === 'ines';
    const textParts = parseTextParts(dialogue.text_studio);
    const hasProps = textParts.some(p => p.type === 'proposition');

    const mergedRef = useCallback((el: HTMLDivElement | null) => {
        setNodeRef(el);
        elementRef(el);
    }, [setNodeRef, elementRef]);

    return (
        <div
            ref={mergedRef}
            style={style}
            {...attributes}
            className={`group relative bg-white rounded-xl border transition-all duration-200 ${
                isDragging ? 'shadow-xl border-[#D6475B]/40 scale-[1.01]' :
                hasProps ? 'border-[#E6A440]/50 bg-[#FFF8EE]' :
                'border-[#E0DCE0] hover:border-[#D6475B]/20 hover:shadow-sm'
            }`}
        >
            <div className="flex items-start gap-3 px-3 py-3">
                {/* Drag handle */}
                <div
                    className="mt-1 cursor-grab text-muted-foreground/30 hover:text-muted-foreground transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                    {...listeners}
                >
                    <GripVertical className="h-4 w-4" />
                </div>

                {/* Avatar */}
                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    isInes ? 'bg-[#D6475B]/15 text-[#D6475B]' : 'bg-[#3465AE]/15 text-[#3465AE]'
                }`}>
                    {isInes ? 'I' : 'Y'}
                </div>

                <div className="flex-1 min-w-0">
                    {/* Character badge */}
                    <span className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1.5 ${
                        isInes ? 'bg-[#D6475B]/10 text-[#D6475B]' : 'bg-[#3465AE]/10 text-[#3465AE]'
                    }`}>
                        {isInes ? 'Inès' : 'Yannick'}
                    </span>

                    {/* Text — clic pour éditer */}
                    {editing ? (
                        <textarea
                            data-no-dnd="true"
                            onPointerDown={(e) => e.stopPropagation()}
                            className="w-full bg-[#F8F7F8] border border-[#E0DCE0] rounded-lg px-3 py-2 text-[13px] font-normal text-foreground leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[#D6475B]/30 focus:border-[#D6475B]"
                            value={dialogue.text_studio}
                            onChange={(e) => onUpdate(dialogue.id, 'studio', e.target.value)}
                            onBlur={() => setEditing(false)}
                            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setEditing(false); } }}
                            rows={Math.max(2, Math.ceil(dialogue.text_studio.length / 90))}
                            autoFocus
                        />
                    ) : (
                        <div
                            className="text-[13px] font-normal text-foreground/90 leading-relaxed whitespace-pre-wrap cursor-text"
                            onClick={() => setEditing(true)}
                            title="Cliquez pour éditer"
                        >
                            {textParts.map((part, i) =>
                                part.type === 'proposition' ? (
                                    <span key={i} className={`inline-flex items-baseline gap-1 rounded px-1.5 py-0.5 mx-0.5 text-[#7a5200] font-medium ${
                                        part.fullMatch === activePropositionMatch
                                            ? 'bg-[#E6A440]/40 ring-2 ring-[#E6A440]'
                                            : 'bg-[#E6A440]/20 border border-[#E6A440]/40'
                                    }`}>
                                        <span>{part.content}</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onAccept(dialogue.id, part.fullMatch); }}
                                            title="Garder"
                                            className="ml-1 text-[#BDD145] hover:text-green-700 font-bold text-sm"
                                        >✓</button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onReject(dialogue.id, part.fullMatch); }}
                                            title="Supprimer"
                                            className="text-[#D6475B] hover:text-red-700 font-bold text-sm"
                                        >✗</button>
                                    </span>
                                ) : <span key={i}>{part.content}</span>
                            )}
                            {!dialogue.text_studio && (
                                <span className="text-muted-foreground italic">Cliquez pour saisir une réplique…</span>
                            )}
                        </div>
                    )}

                    {/* Duration estimate */}
                    {dialogue.duration_seconds > 0 && (
                        <div className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>Durée estimée : {fmtDuration(dialogue.duration_seconds)}</span>
                        </div>
                    )}
                </div>

                {/* Edit toggle button */}
                <button
                    onClick={() => setEditing(v => !v)}
                    className="flex-shrink-0 p-1.5 text-muted-foreground hover:text-foreground hover:bg-[#F0EEF0] rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    title={editing ? 'Fermer' : 'Éditer'}
                >
                    {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                </button>
            </div>
        </div>
    );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function PodcastEditor() {
    const { projectId, podcastId } = useParams();
    const navigate = useNavigate();
    const [dialogues, setDialogues] = useState<Dialogue[]>([]);
    const [loading, setLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
    const [podcastInfo, setPodcastInfo] = useState<{ title: string; project_title?: string; word_count?: number }>({ title: 'Chargement...' });
    const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [isAddingDialogue, setIsAddingDialogue] = useState(false);
    const [newDialogueChar, setNewDialogueChar] = useState<'ines' | 'yannick'>('ines');
    const [newDialogueText, setNewDialogueText] = useState('');
    const [isSubmittingNew, setIsSubmittingNew] = useState(false);
    const [showSourceModal, setShowSourceModal] = useState(false);
    const [sourceText, setSourceText] = useState<string | null>(null);
    const [loadingSource, setLoadingSource] = useState(false);
    const [verification, setVerification] = useState<VerificationState>({
        status: 'idle', score: null, missingConcepts: [], confusingElements: [], passCount: 0
    });

    // Proposition navigation
    const [currentPropIdx, setCurrentPropIdx] = useState(0);
    const dialogueElRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );
    const saveStateRef = useRef({ status: saveStatus, dialogues });
    useEffect(() => { saveStateRef.current = { status: saveStatus, dialogues }; }, [saveStatus, dialogues]);
    useEffect(() => { if (podcastId) loadData(); }, [podcastId]);
    useEffect(() => {
        const t = setInterval(() => {
            if (saveStateRef.current.status === 'unsaved') handleSaveAction(saveStateRef.current.dialogues);
        }, 30000);
        return () => clearInterval(t);
    }, []);
    useKeyboardNav({ onSave: () => handleSaveAction(dialogues) });

    const loadData = async () => {
        try {
            const [infoRes, dlgsRes] = await Promise.all([
                api.get(`/podcasts/${podcastId}`),
                api.get(`/podcasts/${podcastId}/dialogues`),
            ]);
            setPodcastInfo(infoRes.data);
            if (infoRes.data.audio_url) {
                const base = import.meta.env.VITE_API_URL || 'http://localhost:3001';
                setAudioUrl(`${base}${infoRes.data.audio_url}`);
            }
            const dlgs: Dialogue[] = dlgsRes.data || [];
            setDialogues(dlgs.sort((a, b) => a.order_index - b.order_index));
        } catch (e) { console.error('Erreur chargement podcast:', e); }
        finally { setLoading(false); }
    };

    const allPropositions: PropositionRef[] = dialogues.flatMap(d =>
        parseTextParts(d.text_studio)
            .filter(p => p.type === 'proposition')
            .map((p, i) => ({ dialogueId: d.id, partIndex: i, fullMatch: p.fullMatch, content: p.content }))
    );
    const activeProp = allPropositions[currentPropIdx] ?? null;
    const hasPendingPropositions = allPropositions.length > 0;

    const scrollToProp = useCallback((idx: number) => {
        const prop = allPropositions[idx];
        if (!prop) return;
        dialogueElRefs.current.get(prop.dialogueId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [allPropositions]);

    const handleUpdate = (id: number, field: 'studio', text: string) => {
        setDialogues(items => items.map(item => item.id === id ? { ...item, text_studio: text } : item));
        setSaveStatus('unsaved');
    };

    const handleAccept = (dialogueId: number, fullMatch: string) => {
        const content = fullMatch.replace(/\[PROPOSITION:\s*(.*?)\]/, '$1').trim();
        setDialogues(items => items.map(item =>
            item.id === dialogueId ? { ...item, text_studio: item.text_studio.replace(fullMatch, content) } : item
        ));
        setSaveStatus('unsaved');
        setCurrentPropIdx(i => Math.max(0, Math.min(i, allPropositions.length - 2)));
    };

    const handleReject = (dialogueId: number, fullMatch: string) => {
        setDialogues(items => items.map(item =>
            item.id === dialogueId
                ? { ...item, text_studio: item.text_studio.replace(fullMatch, '').replace(/\s{2,}/g, ' ').trim() }
                : item
        ));
        setSaveStatus('unsaved');
        setCurrentPropIdx(i => Math.max(0, Math.min(i, allPropositions.length - 2)));
    };

    const handleSaveAction = async (current: Dialogue[]) => {
        if (saveStatus === 'saving') return;
        setSaveStatus('saving');
        try {
            await Promise.all(current.map(d =>
                api.patch(`/dialogues/${d.id}`, { text_studio: d.text_studio, text_reading: d.text_reading || d.text_studio })
            ));
            if (current.length > 0) {
                await api.patch('/dialogues/reorder', {
                    dialogues: current.map((d, i) => ({ id: d.id, order_index: i }))
                });
            }
            setSaveStatus('saved');
        } catch (e) { console.error('Erreur sauvegarde:', e); setSaveStatus('unsaved'); }
    };

    const handleAddDialogue = async (character: 'ines' | 'yannick', text: string) => {
        setIsSubmittingNew(true);
        const tempId = -(Date.now());
        const newDlg: Dialogue = {
            id: tempId, character, text_studio: text,
            section: '', duration_seconds: 0, order_index: dialogues.length, podcast_id: Number(podcastId)
        };
        setDialogues(prev => [...prev, newDlg]);
        setSaveStatus('unsaved');
        setIsAddingDialogue(false);
        setNewDialogueText('');
        setNewDialogueChar('ines');
        try {
            const res = await api.post(`/podcasts/${podcastId}/dialogues`, {
                character, text_studio: text, order_index: dialogues.length
            });
            if (res.data?.id) {
                setDialogues(prev => prev.map(d => d.id === tempId ? { ...d, id: res.data.id } : d));
            }
        } catch (e) {
            console.error('Erreur ajout réplique:', e);
        } finally {
            setIsSubmittingNew(false);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            setDialogues(items => {
                const oi = items.findIndex(i => i.id === active.id);
                const ni = items.findIndex(i => i.id === over?.id);
                return arrayMove(items, oi, ni);
            });
            setSaveStatus('unsaved');
        }
    };

    const handleVerify = async () => {
        setVerification(v => ({ ...v, status: 'running' }));
        try {
            const res = await api.post(`/podcasts/${podcastId}/verify`);
            const score: number = res.data.fidelity_score ?? 0;
            const missing: string[] = res.data.ia_feedback?.concepts_manquants ?? [];
            const confusing: string[] = res.data.ia_feedback?.informations_erronees ?? [];
            setVerification({
                status: score >= 95 ? 'success' : 'insufficient',
                score, missingConcepts: missing, confusingElements: confusing, passCount: 0
            });
        } catch (e) { console.error('Erreur vérification:', e); setVerification(v => ({ ...v, status: 'idle' })); }
    };

    const handleAutoFix = async () => {
        setVerification(v => ({ ...v, status: 'running' }));
        try {
            const res = await api.post('/ai/auto-verify-and-fix', { podcastId: Number(podcastId) }, { timeout: 300000 });
            const { finalScore, passCount } = res.data;
            setVerification({
                status: finalScore >= 95 ? 'success' : 'insufficient',
                score: finalScore, missingConcepts: [], confusingElements: [], passCount
            });
            await loadData();
        } catch (e) { console.error('Erreur correction:', e); setVerification(v => ({ ...v, status: 'idle' })); }
    };

    const handleGenerateAudio = async (settings: AudioSettings) => {
        setIsAudioModalOpen(false);
        setIsGeneratingAudio(true);
        try {
            const res = await api.post(`/podcasts/${podcastId}/generate-audio`, {
                voiceInes: settings.voiceInes,
                voiceYannick: settings.voiceYannick,
                speed: settings.speed,
            }, { timeout: 300000 });
            const base = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            setAudioUrl(`${base}${res.data.audio_url}`);
        } catch (e: any) {
            if (e?.response?.data?.error === 'tts_not_configured') {
                alert('La génération audio sera disponible prochainement.');
            } else { console.error('Erreur TTS:', e); alert('Erreur lors de la génération audio.'); }
        } finally { setIsGeneratingAudio(false); }
    };

    const handleShowSource = async () => {
        setShowSourceModal(true);
        if (sourceText !== null) return;
        setLoadingSource(true);
        try {
            const res = await api.get(`/podcasts/${podcastId}/source-section`);
            setSourceText(res.data.source_text || '');
        } catch { setSourceText('Impossible de charger le texte source.'); }
        finally { setLoadingSource(false); }
    };

    const totalWords = dialogues.reduce((sum, d) => sum + (d.text_studio?.split(/\s+/).length ?? 0), 0);
    const totalSecs = dialogues.reduce((sum, d) => sum + (d.duration_seconds ?? 0), 0);
    const totalMins = Math.floor(totalSecs / 60);
    const exportBlocked = (verification.score ?? 0) < 95 && verification.status !== 'idle';
    const canExport = !hasPendingPropositions && (verification.status === 'success' || verification.status === 'idle');

    if (loading) return (
        <div className="h-screen flex items-center justify-center bg-[#E6E2E6]">
            <Loader2 className="animate-spin text-[#D6475B]" size={32} />
        </div>
    );

    return (
        <AppLayout>
            {/* ── Bannière état vérification ── */}
            <AnimatePresence>
                {verification.status === 'running' && (
                    <motion.div
                        initial={{ y: -48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -48, opacity: 0 }}
                        className="fixed top-14 left-0 right-0 z-40 bg-[#6BB8CD] text-white px-6 py-2.5 flex items-center justify-between"
                    >
                        <span className="flex items-center gap-2 text-sm font-semibold">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Vérification en cours… analyse du chapitre
                        </span>
                        <span className="text-xs opacity-80">Traitement des concepts pédagogiques</span>
                    </motion.div>
                )}
                {verification.status === 'success' && (
                    <motion.div
                        initial={{ y: -48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -48, opacity: 0 }}
                        className="fixed top-14 left-0 right-0 z-40 bg-[#F0F7E0] border-b border-[#BDD145]/40 px-6 py-2 flex items-center justify-between"
                    >
                        <span className="flex items-center gap-2 text-sm font-semibold text-[#5a6e00]">
                            <CheckCircle className="h-4 w-4" />
                            VÉRIFICATION RÉUSSIE &nbsp;|&nbsp; Fidélité : {verification.score}% — Aucun concept manquant détecté dans ce chapitre.
                        </span>
                        <span className="text-xs font-semibold text-[#5a6e00]">Statut : Validé</span>
                    </motion.div>
                )}
                {verification.status === 'insufficient' && (
                    <motion.div
                        initial={{ y: -48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -48, opacity: 0 }}
                        className="fixed top-14 left-0 right-0 z-40 bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-between"
                    >
                        <span className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                            <AlertTriangle className="h-4 w-4" />
                            Fidélité : {verification.score}% — {verification.missingConcepts.length} concept{verification.missingConcepts.length > 1 ? 's' : ''} manquant{verification.missingConcepts.length > 1 ? 's' : ''} détecté{verification.missingConcepts.length > 1 ? 's' : ''} dans le chapitre actuel.
                        </span>
                        <button
                            onClick={handleAutoFix}
                            className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg px-3 py-1.5 transition-colors"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Corriger automatiquement
                        </button>
                    </motion.div>
                )}
                {hasPendingPropositions && (
                    <motion.div
                        initial={{ y: -48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -48, opacity: 0 }}
                        className="fixed top-14 left-0 right-0 z-50 bg-[#FFF3DB] border-b-2 border-[#E6A440]/50 px-6 py-2.5 flex items-center gap-4 flex-wrap"
                    >
                        <span className="text-[#7a5200] font-bold text-sm">
                            ⚠ {allPropositions.length} proposition{allPropositions.length > 1 ? 's' : ''} à valider
                        </span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => { const i = Math.max(0, currentPropIdx - 1); setCurrentPropIdx(i); scrollToProp(i); }} disabled={currentPropIdx === 0} className="p-1.5 rounded-lg border border-[#E6A440]/50 text-[#7a5200] hover:bg-[#E6A440]/10 disabled:opacity-30">
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <span className="text-sm font-bold text-[#7a5200] tabular-nums min-w-[52px] text-center">{currentPropIdx + 1} / {allPropositions.length}</span>
                            <button onClick={() => { const i = Math.min(allPropositions.length - 1, currentPropIdx + 1); setCurrentPropIdx(i); scrollToProp(i); }} disabled={currentPropIdx >= allPropositions.length - 1} className="p-1.5 rounded-lg border border-[#E6A440]/50 text-[#7a5200] hover:bg-[#E6A440]/10 disabled:opacity-30">
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                        {activeProp && (
                            <>
                                <button onClick={() => handleAccept(activeProp.dialogueId, activeProp.fullMatch)} className="px-3 py-1.5 rounded-lg bg-[#BDD145]/20 border border-[#BDD145]/40 text-[#5a6e00] font-bold text-sm hover:bg-[#BDD145]/30">✓ Garder</button>
                                <button onClick={() => handleReject(activeProp.dialogueId, activeProp.fullMatch)} className="px-3 py-1.5 rounded-lg bg-[#D6475B]/10 border border-[#D6475B]/20 text-[#D6475B] font-bold text-sm hover:bg-[#D6475B]/20">✗ Supprimer</button>
                                <span className="text-xs text-[#7a5200] italic truncate max-w-xs">«&nbsp;{activeProp.content.slice(0, 60)}{activeProp.content.length > 60 ? '…' : ''}&nbsp;»</span>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className={`max-w-[1300px] mx-auto ${(verification.status !== 'idle' || hasPendingPropositions) ? 'mt-12' : ''}`}>

                {/* ── Stepper ── */}
                <div className="flex items-center justify-center gap-2 mb-6 mt-1">
                    {[
                        { label: 'Aperçu source', href: `/editor/${projectId}` },
                        { label: 'Structure du cours', href: `/editor/${projectId}` },
                        { label: 'Éditeur', href: null },
                    ].map((s, i) => {
                        const isCurrent = i === 2;
                        const isDone = i < 2;
                        return (
                            <div key={i} className="flex items-center gap-2">
                                {isDone ? (
                                    <Link
                                        to={s.href!}
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
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => { handleSaveAction(dialogues); navigate(`/project/${projectId}/podcasts`); }}
                            className="p-2 bg-white border border-[#E0DCE0] rounded-lg text-muted-foreground hover:text-foreground hover:border-[#D6475B]/30 transition-all"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <div>
                            <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                                <Link to="/dashboard" className="hover:text-foreground">Projets</Link>
                                <span>/</span>
                                {podcastInfo.project_title && (
                                    <><Link to={`/project/${projectId}/podcasts`} className="hover:text-foreground">{podcastInfo.project_title}</Link><span>/</span></>
                                )}
                                <span className="text-foreground font-medium truncate max-w-[180px]">{podcastInfo.title}</span>
                            </nav>
                            <h1 className="text-lg font-bold text-foreground">Éditeur de Dialogue</h1>
                            <p className="text-xs text-muted-foreground">Révisez et ajustez les répliques générées par l'IA.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={handleShowSource}
                            className="flex items-center gap-1.5 bg-white border border-[#E0DCE0] rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <FileText className="h-3.5 w-3.5" />
                            Historique
                        </button>
                        <button
                            onClick={() => { setIsAddingDialogue(true); setNewDialogueChar(dialogues[dialogues.length - 1]?.character === 'ines' ? 'yannick' : 'ines'); }}
                            className="flex items-center gap-1.5 bg-white border border-[#E0DCE0] rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-[#D6475B] hover:border-[#D6475B]/30 transition-colors"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Ajouter une réplique
                        </button>
                        <button
                            onClick={() => handleSaveAction(dialogues)}
                            disabled={saveStatus === 'saving'}
                            className="flex items-center gap-1.5 bg-white border border-[#E0DCE0] rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
                        >
                            {saveStatus === 'saving' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saveStatus === 'saved' ? <CheckCircle className="h-3.5 w-3.5 text-[#BDD145]" /> : null}
                            Sauvegarder
                        </button>
                    </div>
                </div>

                {/* 2-col layout */}
                <div className="grid lg:grid-cols-[1fr_300px] gap-5">

                    {/* Left — dialogue list */}
                    <div className="space-y-3">
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
                                        elementRef={(el) => { if (el) dialogueElRefs.current.set(d.id, el); else dialogueElRefs.current.delete(d.id); }}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>

                        {/* Add dialogue — inline form */}
                        <AnimatePresence>
                            {isAddingDialogue ? (
                                <motion.div
                                    key="add-form"
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 8 }}
                                    className="bg-white border-2 border-[#D6475B]/30 rounded-xl p-4 space-y-3"
                                >
                                    {/* Character picker */}
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setNewDialogueChar('ines')}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold border transition-all ${
                                                newDialogueChar === 'ines'
                                                    ? 'bg-[#D6475B]/10 border-[#D6475B]/40 text-[#D6475B]'
                                                    : 'border-[#E0DCE0] text-muted-foreground hover:border-[#D6475B]/20'
                                            }`}
                                        >
                                            <span className="w-5 h-5 rounded-full bg-[#D6475B]/15 text-[#D6475B] flex items-center justify-center text-[10px] font-bold">I</span>
                                            Inès
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setNewDialogueChar('yannick')}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold border transition-all ${
                                                newDialogueChar === 'yannick'
                                                    ? 'bg-[#3465AE]/10 border-[#3465AE]/40 text-[#3465AE]'
                                                    : 'border-[#E0DCE0] text-muted-foreground hover:border-[#3465AE]/20'
                                            }`}
                                        >
                                            <span className="w-5 h-5 rounded-full bg-[#3465AE]/15 text-[#3465AE] flex items-center justify-center text-[10px] font-bold">Y</span>
                                            Yannick
                                        </button>
                                    </div>

                                    {/* Text input */}
                                    <textarea
                                        data-no-dnd="true"
                                        autoFocus
                                        value={newDialogueText}
                                        onChange={(e) => setNewDialogueText(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Escape') { setIsAddingDialogue(false); setNewDialogueText(''); }
                                        }}
                                        placeholder="Saisissez la réplique…"
                                        rows={3}
                                        className="w-full bg-[#F8F7F8] border border-[#E0DCE0] rounded-lg px-3 py-2 text-[13px] font-normal text-foreground leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[#D6475B]/30 focus:border-[#D6475B]"
                                    />

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setIsAddingDialogue(false); setNewDialogueText(''); }}
                                            className="flex-1 py-2 rounded-lg text-xs font-semibold border border-[#E0DCE0] text-muted-foreground hover:bg-[#F0EEF0] transition-colors"
                                        >
                                            Annuler
                                        </button>
                                        <button
                                            onClick={() => newDialogueText.trim() && handleAddDialogue(newDialogueChar, newDialogueText.trim())}
                                            disabled={!newDialogueText.trim() || isSubmittingNew}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-[#D6475B] text-white hover:bg-[#c03d50] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {isSubmittingNew ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                            Ajouter
                                        </button>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.button
                                    key="add-btn"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => { setIsAddingDialogue(true); setNewDialogueChar(dialogues[dialogues.length - 1]?.character === 'ines' ? 'yannick' : 'ines'); }}
                                    className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground border-2 border-dashed border-[#D4D0D4] rounded-xl py-3 hover:border-[#D6475B]/50 hover:text-[#D6475B] hover:bg-[#D6475B]/[0.02] transition-all"
                                >
                                    <Plus className="h-4 w-4" />
                                    Ajouter une réplique
                                </motion.button>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Right — fidelity panel */}
                    <div className="space-y-4">
                        {/* Score card */}
                        <div className="bg-white rounded-xl border border-[#E0DCE0] shadow-sm p-5">
                            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-1.5">
                                <ShieldCheck className="h-4 w-4 text-[#6BB8CD]" />
                                {verification.status === 'idle' ? 'Analyse de Fidélité' : 'Score de Fidélité'}
                            </h3>

                            <div className="flex justify-center mb-4">
                                <ScoreGauge score={verification.score} />
                            </div>

                            {verification.status === 'success' && (
                                <p className="text-xs text-center text-muted-foreground mb-3">
                                    Votre script couvre l'intégralité des concepts clés du document source.
                                </p>
                            )}

                            {/* Stats */}
                            {verification.status === 'success' && (
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    <div className="bg-[#F8F7F8] rounded-lg p-2.5 text-center">
                                        <p className="text-lg font-bold text-foreground">0</p>
                                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Omissions</p>
                                    </div>
                                    <div className="bg-[#BDD145]/10 rounded-lg p-2.5 text-center">
                                        <p className="text-sm font-bold text-[#5a6e00] flex items-center justify-center gap-1">
                                            <CheckCircle className="h-3.5 w-3.5" /> OK
                                        </p>
                                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cohérence</p>
                                    </div>
                                </div>
                            )}

                            {/* Missing concepts */}
                            {verification.status === 'insufficient' && verification.missingConcepts.length > 0 && (
                                <div className="mb-4 space-y-1.5">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                        Concepts manquants ({verification.missingConcepts.length})
                                    </p>
                                    {verification.missingConcepts.map((c, i) => (
                                        <div key={i} className="flex items-start gap-1.5 text-xs text-amber-800">
                                            <span className="mt-0.5 flex-shrink-0 h-1.5 w-1.5 rounded-full bg-[#E6A440] mt-1.5" />
                                            {c}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Verify / re-verify button */}
                            {verification.status === 'idle' && (
                                <button
                                    onClick={handleVerify}
                                    disabled={hasPendingPropositions}
                                    className="w-full flex items-center justify-center gap-1.5 bg-[#D6475B] text-white text-xs font-semibold py-2.5 rounded-lg hover:bg-[#c03d50] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ShieldCheck className="h-3.5 w-3.5" />Lancer la vérification
                                </button>
                            )}
                            {verification.status === 'insufficient' && verification.passCount < 2 && (
                                <button
                                    onClick={handleAutoFix}
                                    disabled={hasPendingPropositions}
                                    className="w-full flex items-center justify-center gap-1.5 bg-[#D6475B] text-white text-xs font-semibold py-2.5 rounded-lg hover:bg-[#c03d50] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" />Relancer la correction
                                </button>
                            )}
                            {verification.status === 'insufficient' && verification.passCount >= 2 && (
                                <div className="flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                                    <span>Les 2 passes de correction automatique ont été épuisées. Modifiez les répliques manuellement, puis relancez l'analyse.</span>
                                </div>
                            )}
                            {verification.status === 'insufficient' && verification.passCount >= 2 && (
                                <button
                                    onClick={handleVerify}
                                    className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg border border-[#E0DCE0] text-muted-foreground hover:text-foreground hover:border-[#D6475B]/30 transition-colors"
                                >
                                    <ShieldCheck className="h-3.5 w-3.5" />Relancer l'analyse
                                </button>
                            )}

                            {verification.status === 'running' && (
                                <div className="flex items-center justify-center gap-2 py-2 text-sm text-[#6BB8CD] font-medium">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Analyse en cours…
                                </div>
                            )}
                        </div>

                        {/* Project details */}
                        <div className="bg-white rounded-xl border border-[#E0DCE0] shadow-sm p-5 space-y-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Détails du projet</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Mots totaux :</span>
                                    <span className="font-semibold">{totalWords.toLocaleString('fr-FR')} mots</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Durée totale :</span>
                                    <span className="font-semibold">{totalMins > 0 ? `${totalMins}:${String(totalSecs % 60).padStart(2,'0')} min` : '—'}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground flex items-center gap-1"><Users className="h-3.5 w-3.5" />Intervenants :</span>
                                    <div className="flex -space-x-1.5">
                                        <div className="h-6 w-6 rounded-full bg-[#D6475B]/15 border-2 border-white flex items-center justify-center text-[9px] font-bold text-[#D6475B]">I</div>
                                        <div className="h-6 w-6 rounded-full bg-[#3465AE]/15 border-2 border-white flex items-center justify-center text-[9px] font-bold text-[#3465AE]">Y</div>
                                    </div>
                                </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground/60 italic">Ces statistiques incluent les pauses naturelles et l'intonation synthétisée.</p>
                        </div>

                        {/* Export / finaliser */}
                        <div className="bg-white rounded-xl border border-[#E0DCE0] shadow-sm p-5 space-y-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[#D6475B] mb-1">Finaliser le projet</h3>
                            <button
                                onClick={() => canExport && !isGeneratingAudio && setIsAudioModalOpen(true)}
                                disabled={!canExport || isGeneratingAudio || hasPendingPropositions}
                                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                                    audioUrl ? 'bg-[#BDD145]/15 text-[#5a6e00] border border-[#BDD145]/30' :
                                    !canExport ? 'bg-[#E6E2E6] text-muted-foreground cursor-not-allowed' :
                                    'bg-[#D6475B] text-white hover:bg-[#c03d50]'
                                }`}
                            >
                                {isGeneratingAudio ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                {audioUrl ? '✅ Audio prêt' : '🎙 Générer l\'audio (MP3)'}
                            </button>
                            <button
                                disabled={!canExport}
                                onClick={() => canExport && window.open(`/api/podcasts/${podcastId}/export-word/studio`)}
                                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                                    !canExport ? 'border-[#E0DCE0] text-muted-foreground cursor-not-allowed opacity-50' :
                                    'border-[#D6475B]/30 text-[#D6475B] hover:bg-[#D6475B]/5'
                                }`}
                            >
                                <FileDown className="h-4 w-4" />
                                Exporter le script (PDF)
                            </button>
                            {!canExport && (
                                <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-[#F8F7F8] rounded-lg p-2.5">
                                    <span className="flex-shrink-0 mt-0.5">ⓘ</span>
                                    <span>
                                        {hasPendingPropositions
                                            ? 'Validez toutes les propositions avant d\'exporter.'
                                            : `Export bloqué : La fidélité doit atteindre au moins 95% pour autoriser l'exportation. Veuillez corriger les concepts manquants.`}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Source doc info */}
                        <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Document source</div>
                        <button
                            onClick={handleShowSource}
                            className="flex items-center justify-between w-full bg-white border border-[#E0DCE0] rounded-lg px-3 py-2 text-xs text-muted-foreground hover:border-[#D6475B]/30 hover:text-foreground transition-all"
                        >
                            <div className="flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5 text-[#D6475B]" />
                                <span className="truncate max-w-[160px]">{podcastInfo.project_title || 'document_source.docx'}</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            {/* Audio player */}
            {audioUrl && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white border border-[#E0DCE0] shadow-xl rounded-full px-5 py-2 flex items-center gap-3">
                    <span className="text-xs font-semibold text-muted-foreground">Aperçu audio</span>
                    <audio src={audioUrl} controls className="h-8" />
                </div>
            )}

            {/* Modal audio */}
            <GenerateAudioModal
                isOpen={isAudioModalOpen}
                onCancel={() => setIsAudioModalOpen(false)}
                onConfirm={handleGenerateAudio}
                isGenerating={isGeneratingAudio}
                estimatedDurationMin={Math.round(totalWords / 150) || undefined}
            />

            {/* Source modal */}
            <AnimatePresence>
                {showSourceModal && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSourceModal(false)} className="fixed inset-0 bg-black/45 z-40" />
                        <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="fixed inset-x-4 top-[8%] bottom-[8%] max-w-3xl mx-auto bg-white border border-[#E0DCE0] shadow-2xl rounded-2xl z-50 flex flex-col">
                            <div className="p-5 border-b border-[#E0DCE0] flex items-center justify-between flex-shrink-0">
                                <div>
                                    <h2 className="font-bold text-base">Texte source — {podcastInfo.title}</h2>
                                    <p className="text-xs text-muted-foreground mt-0.5">Contenu du cours correspondant à ce chapitre</p>
                                </div>
                                <button onClick={() => setShowSourceModal(false)} className="p-2 hover:bg-[#F0EEF0] rounded-lg text-muted-foreground"><X className="h-4 w-4" /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-5">
                                {loadingSource ? (
                                    <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-[#D6475B]" size={28} /></div>
                                ) : (
                                    <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">{sourceText || 'Aucun texte source disponible.'}</pre>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </AppLayout>
    );
}
