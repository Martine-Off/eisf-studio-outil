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
    X, FileDown, Plus, AlertTriangle, RotateCcw, Clock, FileText, Trash2
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

// ─── Score gauge ──────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number | null }) {
    const pct = score ?? 0;
    const color = pct >= 95 ? '#BDD145' : pct >= 70 ? '#E6A440' : '#E63337';
    const dashArray = 220;
    const dashOffset = dashArray * (1 - pct / 100);
    return (
        <div className="flex flex-col items-center gap-1">
            <div className="relative w-24 h-24">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="35" fill="none" stroke="#E6E2E6" strokeWidth="8" />
                    <circle cx="50" cy="50" r="35" fill="none" stroke={color} strokeWidth="8"
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
                            <span className="text-xl font-extrabold text-foreground leading-none">{score}%</span>
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
    dialogue, onUpdate, onAccept, onReject, onDelete, onAddAfter, activePropositionMatch, elementRef
}: {
    dialogue: Dialogue;
    onUpdate: (id: number, field: 'studio', text: string) => void;
    onAccept: (id: number, fullMatch: string) => void;
    onReject: (id: number, fullMatch: string) => void;
    onDelete: (id: number) => void;
    onAddAfter: (afterId: number) => void;
    activePropositionMatch: string | null;
    elementRef: (el: HTMLDivElement | null) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    useEffect(() => {
        if (!confirmDelete) return;
        const t = setTimeout(() => setConfirmDelete(false), 3000);
        return () => clearTimeout(t);
    }, [confirmDelete]);

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: dialogue.id });
    const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 'auto', opacity: isDragging ? 0.8 : 1 };
    const isInes = dialogue.character.toLowerCase() === 'ines';
    const textParts = parseTextParts(dialogue.text_studio);
    const hasProps = textParts.some(p => p.type === 'proposition');

    const mergedRef = useCallback((el: HTMLDivElement | null) => {
        setNodeRef(el);
        elementRef(el);
    }, [setNodeRef, elementRef]);

    const borderColor = isInes ? '#E63337' : '#3465AE';

    return (
        <div
            ref={mergedRef}
            style={style}
            {...attributes}
            className={`group relative bg-white rounded-xl border transition-all duration-150 ${
                isDragging ? 'shadow-xl scale-[1.01]' :
                hasProps ? 'border-[#E6A440]/50 bg-[#FFF8EE]' :
                'border-[#E0DCE0]'
            }`}
            onMouseEnter={e => { if (!isDragging && !hasProps) e.currentTarget.style.boxShadow = `inset 3px 0 0 ${borderColor}`; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; }}
        >
            <div className="flex items-start gap-3 px-3 py-3">
                {/* Drag handle */}
                <div
                    className="mt-2 cursor-grab text-muted-foreground/30 hover:text-muted-foreground transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                    {...listeners}
                >
                    <GripVertical className="h-4 w-4" />
                </div>

                {/* Avatar */}
                <div
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold mt-0.5"
                    style={isInes ? { backgroundColor: '#FDDEDE', color: '#E63337' } : { backgroundColor: '#DEE9FD', color: '#3465AE' }}
                >
                    {isInes ? 'I' : 'Y'}
                </div>

                <div className="flex-1 min-w-0">
                    {/* Character name — small caps */}
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
                        style={{ color: isInes ? '#E63337' : '#3465AE' }}>
                        {isInes ? 'Inès' : 'Yannick'}
                    </p>

                    {/* Text */}
                    {editing ? (
                        <textarea
                            data-no-dnd="true"
                            onPointerDown={e => e.stopPropagation()}
                            className="w-full bg-[#F8F7F8] border border-[#E0DCE0] rounded-lg px-3 py-2 text-[13px] leading-relaxed resize-none focus:outline-none focus:ring-2 focus:border-transparent"
                            style={{ '--tw-ring-color': borderColor } as React.CSSProperties}
                            value={dialogue.text_studio}
                            onChange={e => onUpdate(dialogue.id, 'studio', e.target.value)}
                            onBlur={() => setEditing(false)}
                            onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setEditing(false); } }}
                            rows={Math.max(2, Math.ceil(dialogue.text_studio.length / 90))}
                            autoFocus
                        />
                    ) : (
                        <div
                            className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-wrap cursor-text"
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
                                        <button onClick={e => { e.stopPropagation(); onAccept(dialogue.id, part.fullMatch); }} className="ml-1 text-[#BDD145] hover:text-green-700 font-bold text-sm">✓</button>
                                        <button onClick={e => { e.stopPropagation(); onReject(dialogue.id, part.fullMatch); }} className="text-[#D6475B] hover:text-red-700 font-bold text-sm">✗</button>
                                    </span>
                                ) : <span key={i}>{part.content}</span>
                            )}
                            {!dialogue.text_studio && (
                                <span className="text-muted-foreground italic">Cliquez pour saisir une réplique…</span>
                            )}
                        </div>
                    )}

                    {/* Duration */}
                    <div className="flex items-center gap-1 mt-2 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Durée estimée : {dialogue.duration_seconds > 0 ? fmtDuration(dialogue.duration_seconds) : '—'}</span>
                    </div>
                </div>

                {/* Top-right actions — + always visible, rest on hover */}
                <div className="flex-shrink-0 flex flex-col gap-1">
                    <button
                        onClick={e => { e.stopPropagation(); onAddAfter(dialogue.id); }}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-[#F0EEF0] rounded-lg transition-all"
                        title="Ajouter une réplique après"
                    >
                        <Plus className="h-3.5 w-3.5" />
                    </button>
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                            onClick={() => setEditing(v => !v)}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-[#F0EEF0] rounded-lg transition-all"
                            title={editing ? 'Fermer' : 'Éditer'}
                        >
                            {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                        </button>
                        {confirmDelete ? (
                            <button
                                onClick={() => onDelete(dialogue.id)}
                                className="p-1.5 bg-[#E63337] text-white rounded-lg text-[9px] font-bold px-1.5 py-1 whitespace-nowrap"
                            >Suppr.</button>
                        ) : (
                            <button
                                onClick={() => setConfirmDelete(true)}
                                className="p-1.5 text-muted-foreground hover:text-[#E63337] hover:bg-[#E63337]/10 rounded-lg transition-all"
                                title="Supprimer"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>
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
    const [insertAfterId, setInsertAfterId] = useState<number | null>(null);
    const [newDialogueChar, setNewDialogueChar] = useState<'ines' | 'yannick'>('ines');
    const [newDialogueText, setNewDialogueText] = useState('');
    const [isSubmittingNew, setIsSubmittingNew] = useState(false);
    const [showSourceModal, setShowSourceModal] = useState(false);
    const [sourceText, setSourceText] = useState<string | null>(null);
    const [loadingSource, setLoadingSource] = useState(false);
    const [verification, setVerification] = useState<VerificationState>({
        status: 'idle', score: null, missingConcepts: [], confusingElements: [], passCount: 0
    });
    const [fidelityScore, setFidelityScore] = useState<number | null>(null);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [titleDraft, setTitleDraft] = useState('');

    const [currentPropIdx, setCurrentPropIdx] = useState(0);
    const [verifyError, setVerifyError] = useState<string | null>(null);
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
            setFidelityScore(infoRes.data.fidelity_score ?? null);
            const feedback = infoRes.data.ia_feedback;
            if (feedback && infoRes.data.fidelity_score != null) {
              setVerification({
                status: infoRes.data.fidelity_score >= 95 ? 'success' : 'insufficient',
                score: infoRes.data.fidelity_score,
                missingConcepts: feedback.concepts_manquants ?? [],
                confusingElements: feedback.informations_erronees ?? [],
              });
            }
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
        const el = dialogueElRefs.current.get(prop.dialogueId);
        if (!el) return;
        // Décalage pour les bandeaux fixes (AppLayout nav ~56px + bandeau PROPOSITION ~48px + marge)
        const FIXED_OFFSET = 120;
        const rect = el.getBoundingClientRect();
        const targetTop = rect.top + window.scrollY - FIXED_OFFSET;
        window.scrollTo({ top: targetTop, behavior: 'smooth' });
    }, [allPropositions]);

    const handleUpdate = (id: number, _field: 'studio', text: string) => {
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

    const handleDeleteDialogue = async (id: number) => {
        setDialogues(prev => prev.filter(d => d.id !== id));
        setSaveStatus('unsaved');
        try { await api.delete(`/dialogues/${id}`); } catch (e) { console.error('Erreur suppression:', e); }
    };

    const handleAddAfter = (afterId: number) => {
        const d = dialogues.find(d => d.id === afterId);
        setInsertAfterId(afterId);
        setIsAddingDialogue(true);
        setNewDialogueChar(d?.character === 'ines' ? 'yannick' : 'ines');
    };

    const handleAddDialogue = async (character: 'ines' | 'yannick', text: string) => {
        setIsSubmittingNew(true);
        const insertIdx = insertAfterId !== null
            ? dialogues.findIndex(d => d.id === insertAfterId) + 1
            : dialogues.length;
        const tempId = -(Date.now());
        const newDlg: Dialogue = {
            id: tempId, character, text_studio: text,
            section: '', duration_seconds: 0, order_index: insertIdx, podcast_id: Number(podcastId)
        };
        setDialogues(prev => {
            const next = [...prev];
            next.splice(insertIdx, 0, newDlg);
            return next.map((d, i) => ({ ...d, order_index: i }));
        });
        setSaveStatus('unsaved');
        setIsAddingDialogue(false);
        setNewDialogueText('');
        setNewDialogueChar('ines');
        setInsertAfterId(null);
        try {
            const res = await api.post(`/podcasts/${podcastId}/dialogues`, {
                character, text_studio: text, order_index: insertIdx
            });
            if (res.data?.id) {
                setDialogues(prev => prev.map(d => d.id === tempId ? { ...d, id: res.data.id } : d));
            }
        } catch (e) {
            console.error('Erreur ajout réplique:', e);
            setDialogues(prev => prev.filter(d => d.id !== tempId));
        } finally { setIsSubmittingNew(false); }
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
        if (verification.status === 'running') return;
        setVerifyError(null);
        setVerification(v => ({ ...v, status: 'running' }));
        try {
            const res = await api.post(`/podcasts/${podcastId}/verify`);
            const score: number = res.data.fidelity_score ?? 0;
            const missing: string[] = res.data.ia_feedback?.concepts_manquants ?? [];
            const confusing: string[] = res.data.ia_feedback?.informations_erronees ?? [];
            setVerification({ status: score >= 95 ? 'success' : 'insufficient', score, missingConcepts: missing, confusingElements: confusing, passCount: 0 });
            setFidelityScore(score);
        } catch (e: any) {
            console.error('Erreur vérification:', e);
            const msg = e?.response?.status === 429
                ? 'Quota Make dépassé — réessayez dans quelques minutes.'
                : e?.response?.status === 504 || e?.code === 'MAKE_TIMEOUT'
                ? 'Make n\'a pas répondu (délai 60s dépassé). Réessayez.'
                : 'Impossible de joindre le serveur de vérification.';
            setVerifyError(msg);
            setVerification(v => ({ ...v, status: 'idle' }));
        }
    };

    const handleAutoFix = async () => {
        if (verification.status === 'running') return;
        setVerifyError(null);
        setVerification(v => ({ ...v, status: 'running' }));
        try {
            const res = await api.post('/ai/auto-verify-and-fix', { podcastId: Number(podcastId) }, { timeout: 300000 });
            const { finalScore, passCount, passHistory } = res.data;
            const lastPass = passHistory?.[passHistory.length - 1];
            const finalMissing: string[] = lastPass?.missing ?? [];
            setVerification({ status: finalScore >= 95 ? 'success' : 'insufficient', score: finalScore, missingConcepts: finalMissing, confusingElements: [], passCount });
            setFidelityScore(finalScore);
            await loadData();
        } catch (e: any) {
            console.error('Erreur correction:', e);
            const msg = e?.response?.status === 429
                ? 'Quota Make dépassé — réessayez dans quelques minutes.'
                : e?.response?.status === 504 || e?.code === 'MAKE_TIMEOUT'
                ? 'Make n\'a pas répondu (délai 60s dépassé). Réessayez.'
                : e?.response?.data?.message
                ? e.response.data.message
                : 'Impossible de joindre le serveur de vérification.';
            setVerifyError(msg);
            setVerification(v => ({ ...v, status: 'idle' }));
        }
    };

    const handleRenameTitle = async () => {
        const trimmed = titleDraft.trim();
        setIsEditingTitle(false);
        if (!trimmed || trimmed === podcastInfo.title) return;
        try {
            await api.patch(`/podcasts/${podcastId}/title`, { title: trimmed });
            setPodcastInfo(prev => ({ ...prev, title: trimmed }));
        } catch (e) { console.error('Erreur renommage:', e); }
    };

    const handleGenerateAudio = async (settings: AudioSettings) => {
        setIsAudioModalOpen(false);
        setIsGeneratingAudio(true);
        try {
            const res = await api.post(`/podcasts/${podcastId}/generate-audio`, {
                voiceInes: settings.voiceInes, voiceYannick: settings.voiceYannick, speed: settings.speed,
            }, { timeout: 300000 });
            const base = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            setAudioUrl(`${base}${res.data.audio_url}`);
        } catch (e: any) {
            if (e?.response?.data?.error === 'tts_not_configured') alert('La génération audio sera disponible prochainement.');
            else if (e?.response?.status === 429) alert('Quota Make dépassé. Réessayez dans quelques minutes.');
            else { console.error('Erreur TTS:', e); alert('Erreur lors de la génération audio.'); }
        } finally { setIsGeneratingAudio(false); }
    };

    const handleExport = async (format: 'word' | 'pdf' | 'json') => {
        try {
            const endpoint = format === 'json'
                ? `/podcasts/${podcastId}/export/json`
                : format === 'word'
                ? `/podcasts/${podcastId}/export-word/studio`
                : `/podcasts/${podcastId}/export-pdf/studio`;
            const res = await api.get(endpoint, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            const disposition = res.headers['content-disposition'];
            let filename = format === 'word' ? 'export.docx' : format === 'pdf' ? 'export.pdf' : 'export.json';
            if (disposition?.includes('filename=')) {
                const m = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
                if (m?.[1]) filename = m[1].replace(/['"]/g, '');
            }
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (e) { console.error('Erreur export:', e); }
    };

    const handleNavigateBack = () => {
        if (saveStatus === 'unsaved') {
            if (!window.confirm('Des modifications non sauvegardées seront perdues. Continuer ?')) return;
        }
        navigate(`/editor/${projectId}`, { state: { step: 2 } });
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

    const totalWords = dialogues.reduce((sum, d) => sum + (d.text_studio?.split(/\s+/).filter(Boolean).length ?? 0), 0);
    const totalSecs = dialogues.reduce((sum, d) => sum + (d.duration_seconds ?? 0), 0);
    const totalMins = Math.floor(totalSecs / 60);

    const inesWords = dialogues.filter(d => d.character === 'ines')
        .reduce((sum, d) => sum + (d.text_studio?.split(/\s+/).filter(Boolean).length ?? 0), 0);
    const yannickWords = dialogues.filter(d => d.character === 'yannick')
        .reduce((sum, d) => sum + (d.text_studio?.split(/\s+/).filter(Boolean).length ?? 0), 0);
    const totalCharWords = inesWords + yannickWords;
    const inesRatio = totalCharWords > 0 ? Math.round((inesWords / totalCharWords) * 100) : 70;
    const yannickRatio = 100 - inesRatio;

    if (loading) return (
        <div className="h-screen flex items-center justify-center bg-[#E6E2E6]">
            <Loader2 className="animate-spin text-[#E63337]" size={32} />
        </div>
    );

    return (
        <AppLayout>
            {/* ── Verification banners ── */}
            <AnimatePresence>
                {verification.status === 'running' && (
                    <motion.div initial={{ y: -48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -48, opacity: 0 }}
                        className="fixed top-14 left-0 right-0 z-40 bg-[#6BB8CD] text-white px-6 py-2.5 flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm font-semibold">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Vérification en cours… analyse du chapitre
                        </span>
                        <span className="text-xs opacity-80">Traitement des concepts pédagogiques</span>
                    </motion.div>
                )}
                {verification.status === 'success' && (
                    <motion.div initial={{ y: -48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -48, opacity: 0 }}
                        className="fixed top-14 left-0 right-0 z-40 bg-[#F0F7E0] border-b border-[#BDD145]/40 px-6 py-2 flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm font-semibold text-[#5a6e00]">
                            <CheckCircle className="h-4 w-4" />
                            VÉRIFICATION RÉUSSIE — Fidélité : {verification.score}%
                        </span>
                        <span className="text-xs font-semibold text-[#5a6e00]">Statut : Validé</span>
                    </motion.div>
                )}
                {verification.status === 'insufficient' && (
                    <motion.div initial={{ y: -48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -48, opacity: 0 }}
                        className="fixed top-14 left-0 right-0 z-40 bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                            <AlertTriangle className="h-4 w-4" />
                            Fidélité : {verification.score}% — {verification.missingConcepts.length} concept{verification.missingConcepts.length > 1 ? 's' : ''} manquant{verification.missingConcepts.length > 1 ? 's' : ''} détecté{verification.missingConcepts.length > 1 ? 's' : ''}.
                        </span>
                        <button onClick={handleAutoFix}
                            className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg px-3 py-1.5 transition-colors">
                            <RotateCcw className="h-3.5 w-3.5" />
                            Corriger automatiquement
                        </button>
                    </motion.div>
                )}
                {hasPendingPropositions && (
                    <motion.div initial={{ y: -48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -48, opacity: 0 }}
                        className="fixed top-14 left-0 right-0 z-50 bg-[#FFF3DB] border-b-2 border-[#E6A440]/50 px-6 py-2.5 flex items-center gap-4 flex-wrap">
                        <span className="text-[#7a5200] font-bold text-sm">⚠ {allPropositions.length} proposition{allPropositions.length > 1 ? 's' : ''} à valider</span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => { const i = Math.max(0, currentPropIdx - 1); setCurrentPropIdx(i); scrollToProp(i); }} disabled={currentPropIdx === 0} className="p-1.5 rounded-lg border border-[#E6A440]/50 text-[#7a5200] hover:bg-[#E6A440]/10 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                            <span className="text-sm font-bold text-[#7a5200] tabular-nums min-w-[52px] text-center">{currentPropIdx + 1} / {allPropositions.length}</span>
                            <button onClick={() => { const i = Math.min(allPropositions.length - 1, currentPropIdx + 1); setCurrentPropIdx(i); scrollToProp(i); }} disabled={currentPropIdx >= allPropositions.length - 1} className="p-1.5 rounded-lg border border-[#E6A440]/50 text-[#7a5200] hover:bg-[#E6A440]/10 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                        </div>
                        {activeProp && (
                            <>
                                <button onClick={() => handleAccept(activeProp.dialogueId, activeProp.fullMatch)} className="px-3 py-1.5 rounded-lg bg-[#BDD145]/20 border border-[#BDD145]/40 text-[#5a6e00] font-bold text-sm hover:bg-[#BDD145]/30">✓ Garder</button>
                                <button onClick={() => handleReject(activeProp.dialogueId, activeProp.fullMatch)} className="px-3 py-1.5 rounded-lg bg-[#E63337]/10 border border-[#E63337]/20 text-[#E63337] font-bold text-sm hover:bg-[#E63337]/20">✗ Supprimer</button>
                                <span className="text-xs text-[#7a5200] italic truncate max-w-xs">«&nbsp;{activeProp.content.slice(0, 60)}{activeProp.content.length > 60 ? '…' : ''}&nbsp;»</span>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className={`max-w-[1300px] mx-auto pb-24 ${(verification.status !== 'idle' || hasPendingPropositions) ? 'mt-12' : ''}`}>

                {/* ── Stepper ── */}
                <div className="flex items-center justify-center gap-2 mb-6 mt-1">
                    {[
                        { label: 'Aperçu source', href: `/editor/${projectId}`, navState: undefined },
                        { label: 'Structure du cours', href: `/editor/${projectId}`, navState: { step: 2 } },
                        { label: 'Éditeur', href: null, navState: undefined },
                    ].map((s, i) => {
                        const isDone = i < 2;
                        return (
                            <div key={i} className="flex items-center gap-2">
                                {isDone ? (
                                    <Link to={s.href!} state={s.navState}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white text-foreground border border-[#E0DCE0] hover:border-[#E63337] transition-colors">
                                        <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold bg-green-100 text-green-600">✓</span>
                                        {s.label}
                                    </Link>
                                ) : (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#E63337] text-white shadow-sm">
                                        <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold bg-white/25 text-white">{i + 1}</span>
                                        {s.label}
                                    </div>
                                )}
                                {i < 2 && <div className={`w-8 h-px ${isDone ? 'bg-[#E63337]/40' : 'bg-[#E0DCE0]'}`} />}
                            </div>
                        );
                    })}
                </div>

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, overflow: 'hidden' }}>
                        <button
                            onClick={() => { handleSaveAction(dialogues); navigate(`/project/${projectId}/podcasts`); }}
                            className="p-2 bg-white border border-[#E0DCE0] rounded-lg text-muted-foreground hover:text-foreground hover:border-[#E63337]/30 transition-all flex-shrink-0"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <div style={{ overflow: 'hidden', minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: '100%' }}>
                                    Éditeur de Dialogue
                                </h1>
                                {fidelityScore !== null && (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold flex-shrink-0 ${
                                        fidelityScore >= 95 ? 'bg-[#BDD145]/20 text-[#5a6e00]' :
                                        fidelityScore >= 70 ? 'bg-[#E6A440]/20 text-[#b37a00]' :
                                        'bg-[#E63337]/15 text-[#E63337]'
                                    }`}>{fidelityScore}%</span>
                                )}
                            </div>
                            {isEditingTitle ? (
                                <input autoFocus value={titleDraft}
                                    onChange={e => setTitleDraft(e.target.value)}
                                    onBlur={handleRenameTitle}
                                    onKeyDown={e => { if (e.key === 'Enter') handleRenameTitle(); if (e.key === 'Escape') setIsEditingTitle(false); }}
                                    className="text-sm border border-[#E63337]/40 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-[#E63337]/30 bg-white text-muted-foreground w-full max-w-sm mt-0.5"
                                />
                            ) : (
                                <p style={{ fontSize: '0.875rem', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: '100%', marginTop: '2px', cursor: 'text' }}
                                    onClick={() => { setTitleDraft(podcastInfo.title); setIsEditingTitle(true); }}>
                                    {podcastInfo.project_title ? `${podcastInfo.project_title} — ${podcastInfo.title}` : podcastInfo.title}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={handleShowSource}
                            className="flex items-center gap-1.5 bg-white border border-[#E0DCE0] rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                            <Clock className="h-3.5 w-3.5" />
                            Historique
                        </button>
                        <button
                            onClick={() => { setIsAddingDialogue(true); setInsertAfterId(null); setNewDialogueChar(dialogues[dialogues.length - 1]?.character === 'ines' ? 'yannick' : 'ines'); }}
                            className="flex items-center gap-1.5 bg-white border border-[#E0DCE0] rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-[#3465AE]/30 transition-colors">
                            <Plus className="h-3.5 w-3.5" />
                            Ajouter une réplique
                        </button>
                        <button
                            onClick={() => handleSaveAction(dialogues)}
                            disabled={saveStatus === 'saving'}
                            className="flex items-center gap-1.5 bg-white border border-[#E0DCE0] rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
                        >
                            {saveStatus === 'saved' && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
                            Sauvegarder
                        </button>
                    </div>
                </div>

                {/* ── 2-col layout ── */}
                <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5 items-start">

                    {/* Left — dialogue list */}
                    <div className="space-y-2.5">
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={dialogues.map(d => d.id)} strategy={verticalListSortingStrategy}>
                                {dialogues.map(d => (
                                    <SortableDialogue
                                        key={d.id}
                                        dialogue={d}
                                        onUpdate={handleUpdate}
                                        onAccept={handleAccept}
                                        onReject={handleReject}
                                        onDelete={handleDeleteDialogue}
                                        onAddAfter={handleAddAfter}
                                        activePropositionMatch={activeProp?.dialogueId === d.id ? activeProp.fullMatch : null}
                                        elementRef={el => { if (el) dialogueElRefs.current.set(d.id, el); else dialogueElRefs.current.delete(d.id); }}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>

                        {/* Add dialogue form */}
                        <AnimatePresence>
                            {isAddingDialogue ? (
                                <motion.div key="add-form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                                    className="bg-white border-2 border-[#E63337]/30 rounded-xl p-4 space-y-3">
                                    <div className="flex gap-2">
                                        {(['ines', 'yannick'] as const).map(char => (
                                            <button key={char} type="button" onClick={() => setNewDialogueChar(char)}
                                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold border transition-all ${
                                                    newDialogueChar === char
                                                        ? char === 'ines' ? 'bg-[#E63337]/10 border-[#E63337]/40 text-[#E63337]' : 'bg-[#3465AE]/10 border-[#3465AE]/40 text-[#3465AE]'
                                                        : 'border-[#E0DCE0] text-muted-foreground'
                                                }`}>
                                                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                                                    style={char === 'ines' ? { backgroundColor: '#FDDEDE', color: '#E63337' } : { backgroundColor: '#DEE9FD', color: '#3465AE' }}>
                                                    {char === 'ines' ? 'I' : 'Y'}
                                                </span>
                                                {char === 'ines' ? 'Inès' : 'Yannick'}
                                            </button>
                                        ))}
                                    </div>
                                    <textarea data-no-dnd="true" autoFocus value={newDialogueText}
                                        onChange={e => setNewDialogueText(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Escape') { setIsAddingDialogue(false); setNewDialogueText(''); setInsertAfterId(null); } }}
                                        placeholder="Saisissez la réplique…" rows={3}
                                        className="w-full bg-[#F8F7F8] border border-[#E0DCE0] rounded-lg px-3 py-2 text-[13px] leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[#E63337]/30 focus:border-[#E63337]"
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={() => { setIsAddingDialogue(false); setNewDialogueText(''); setInsertAfterId(null); }}
                                            className="flex-1 py-2 rounded-lg text-xs font-semibold border border-[#E0DCE0] text-muted-foreground hover:bg-[#F0EEF0] transition-colors">
                                            Annuler
                                        </button>
                                        <button
                                            onClick={() => newDialogueText.trim() && handleAddDialogue(newDialogueChar, newDialogueText.trim())}
                                            disabled={!newDialogueText.trim() || isSubmittingNew}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-[#E63337] text-white hover:bg-[#c92d31] disabled:opacity-40 transition-colors">
                                            {isSubmittingNew ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                            Ajouter
                                        </button>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.button key="add-btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    onClick={() => { setIsAddingDialogue(true); setInsertAfterId(null); setNewDialogueChar(dialogues[dialogues.length - 1]?.character === 'ines' ? 'yannick' : 'ines'); }}
                                    className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground border-2 border-dashed border-[#D4D0D4] rounded-xl py-3 hover:border-[#E63337]/50 hover:text-[#E63337] transition-all">
                                    <Plus className="h-4 w-4" />
                                    Ajouter une réplique
                                </motion.button>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Right — panels */}
                    <div className="space-y-4">

                        {/* Card 1 — Vérification de fidélité */}
                        <div className="bg-white rounded-xl border border-[#E0DCE0] shadow-sm p-5">
                            <h3 className="font-bold text-sm text-foreground mb-1">VÉRIFICATION DE FIDÉLITÉ</h3>
                            <p className="text-xs text-muted-foreground mb-4">
                                L'IA analyse votre script par rapport au contenu source (.docx) pour s'assurer qu'aucune information clé n'a été oubliée ou déformée.
                            </p>

                            {verifyError && (
                                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 mb-3">
                                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-red-700 leading-snug">{verifyError}</p>
                                </div>
                            )}

                            {verification.status === 'idle' && (
                                <>
                                    <p className="text-xs italic text-muted-foreground text-center py-3 mb-2">
                                        Le script n'a pas encore été analysé.
                                    </p>
                                    <button onClick={handleVerify}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-[#E63337] text-white hover:bg-[#c92d31] transition-all">
                                        ⚡ Analyser le script
                                    </button>
                                    <p className="text-xs text-muted-foreground text-center mt-2">
                                        L'analyse prend environ 15-30 secondes.
                                    </p>
                                </>
                            )}

                            {verification.status === 'running' && (
                                <div className="flex flex-col items-center py-6 gap-2">
                                    <Loader2 className="animate-spin text-[#E63337]" size={28} />
                                    <p className="text-xs text-muted-foreground">Analyse en cours…</p>
                                </div>
                            )}

                            {(verification.status === 'success' || verification.status === 'insufficient') && (
                                <div className="space-y-3">
                                    <div className="flex justify-center">
                                        <ScoreGauge score={verification.score} />
                                    </div>
                                    {verification.missingConcepts.length > 0 && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 mb-1.5">
                                                {verification.missingConcepts.length} concept{verification.missingConcepts.length > 1 ? 's' : ''} manquant{verification.missingConcepts.length > 1 ? 's' : ''}
                                            </p>
                                            <ul className="space-y-1 max-h-48 overflow-y-auto">
                                                {verification.missingConcepts.map((c, i) => (
                                                    <li key={i} className="text-xs text-amber-800">• {c}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {verification.status === 'insufficient' && (
                                        <button onClick={handleAutoFix}
                                            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-all">
                                            <RotateCcw className="h-3.5 w-3.5" />
                                            Corriger automatiquement
                                        </button>
                                    )}
                                    <button onClick={handleVerify}
                                        className="w-full py-2 rounded-lg text-xs font-semibold border border-[#E0DCE0] text-muted-foreground hover:text-foreground hover:bg-[#F0EEF0] transition-all">
                                        ⚡ Ré-analyser
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Card 2 — Détails du projet */}
                        <div className="bg-white rounded-xl border border-[#E0DCE0] shadow-sm p-5 space-y-4">
                            <h3 className="font-bold text-sm text-foreground">DÉTAILS DU PROJET</h3>

                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2 text-muted-foreground">
                                    <FileText className="h-4 w-4" />
                                    Mots
                                </span>
                                <span className="font-bold">{totalWords.toLocaleString('fr-FR')}</span>
                            </div>

                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2 text-muted-foreground">
                                    <Clock className="h-4 w-4" />
                                    Durée estimée
                                </span>
                                <span className="font-bold text-[#3465AE]">
                                    {totalMins > 0 ? `${totalMins}:${String(totalSecs % 60).padStart(2, '0')} min` : '—'}
                                </span>
                            </div>

                            {/* Speech ratio */}
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                                    RATIO DE PAROLE
                                </p>
                                <div className="h-2.5 rounded-full overflow-hidden flex">
                                    <div className="bg-[#E63337] transition-all" style={{ width: `${inesRatio}%` }} />
                                    <div className="bg-[#3465AE] transition-all" style={{ width: `${yannickRatio}%` }} />
                                </div>
                                <div className="flex justify-between mt-1.5">
                                    <span className="text-[10px] font-semibold text-[#E63337]">Inès {inesRatio}%</span>
                                    <span className="text-[10px] font-semibold text-[#3465AE]">Yannick {yannickRatio}%</span>
                                </div>
                            </div>

                            {/* Conseil PRO */}
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                                <p className="text-[10px] font-bold text-blue-700 mb-1 uppercase tracking-wide">CONSEIL PRO</p>
                                <p className="text-[11px] text-blue-600 leading-relaxed">
                                    Utilisez des pauses (indiquées par "...") pour rendre le dialogue plus naturel entre Inès et Yannick.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Sticky bottom bar ── */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E0DCE0] z-30 flex items-center justify-between px-8 py-3 shadow-[0_-2px_12px_0_rgba(0,0,0,0.06)]">
                {/* Left — chapter navigation */}
                <div className="flex items-center gap-3">
                    <button onClick={handleNavigateBack}
                        className="p-2 rounded-lg border border-[#E0DCE0] text-muted-foreground hover:text-foreground hover:border-[#E63337]/30 transition-colors">
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button disabled className="p-2 rounded-lg border border-[#E0DCE0] text-muted-foreground opacity-40 cursor-not-allowed">
                        <ChevronRight className="h-4 w-4" />
                    </button>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none mb-0.5">
                            CHAPITRE ACTUEL
                        </p>
                        <p className="text-sm font-semibold text-foreground truncate max-w-[220px]">
                            {podcastInfo.title}
                        </p>
                    </div>
                </div>

                {/* Right — export + audio */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground mr-1 uppercase tracking-wide">Exporter :</span>
                    {(['word', 'pdf', 'json'] as const).map(fmt => (
                        <button key={fmt} onClick={() => handleExport(fmt)}
                            className="flex items-center gap-1.5 px-3 py-2 border border-[#E0DCE0] rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-[#E63337]/30 bg-white transition-colors">
                            <FileDown className="h-3.5 w-3.5" />
                            {fmt.charAt(0).toUpperCase() + fmt.slice(1)}
                        </button>
                    ))}
                    <button
                        onClick={() => setIsAudioModalOpen(true)}
                        disabled={isGeneratingAudio}
                        className="flex items-center gap-2 px-4 py-2 bg-[#E63337] text-white rounded-lg text-xs font-bold hover:bg-[#c92d31] disabled:opacity-60 transition-colors ml-1"
                    >
                        {isGeneratingAudio ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '🎵'}
                        Générer Audio
                    </button>
                </div>
            </div>

            {/* Audio player (if ready) */}
            {audioUrl && (
                <div className="fixed bottom-16 left-1/2 -translate-x-1/2 bg-white border border-[#E0DCE0] shadow-xl rounded-full px-5 py-2 flex items-center gap-3 z-20">
                    <span className="text-xs font-semibold text-muted-foreground">Aperçu audio</span>
                    <audio src={audioUrl} controls className="h-8" />
                </div>
            )}

            {/* Audio modal */}
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
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowSourceModal(false)} className="fixed inset-0 bg-black/45 z-40" />
                        <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
                            className="fixed inset-x-4 top-[8%] bottom-[8%] max-w-3xl mx-auto bg-white border border-[#E0DCE0] shadow-2xl rounded-2xl z-50 flex flex-col">
                            <div className="p-5 border-b border-[#E0DCE0] flex items-center justify-between flex-shrink-0">
                                <div>
                                    <h2 className="font-bold text-base">Texte source — {podcastInfo.title}</h2>
                                    <p className="text-xs text-muted-foreground mt-0.5">Contenu du cours correspondant à ce chapitre</p>
                                </div>
                                <button onClick={() => setShowSourceModal(false)} className="p-2 hover:bg-[#F0EEF0] rounded-lg text-muted-foreground">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-5">
                                {loadingSource ? (
                                    <div className="flex items-center justify-center py-16">
                                        <Loader2 className="animate-spin text-[#E63337]" size={28} />
                                    </div>
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
