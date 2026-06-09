// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
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
    X, FileDown, Plus, AlertTriangle, RotateCcw, Clock, FileText, Trash2, Volume2, Unlink
} from 'lucide-react';
import api from '../utils/api';
import { useKeyboardNav } from '../hooks/useKeyboardNav';
import AppLayout from '../components/AppLayout';
import ErrorModal from '../components/ErrorModal';
import { motion, AnimatePresence } from 'framer-motion';
import { ProgressMeter } from './ui/ProgressMeter';
import { ChecklistItem } from './ui/ChecklistItem';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Dialogue {
    id: number;
    character: 'ines' | 'yannick';
    text_studio: string;
    text_reading?: string;
    section: string;
    is_grounded?: boolean | null;
    sound_before?: boolean;
    duration_seconds: number;
    order_index: number;
    podcast_id?: number;
}

interface TextPart { type: 'text' | 'proposition' | 'break'; content: string; fullMatch: string; }
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
    const regex = /\[PROPOSITION:\s*(.*?)\]|<break\s+time="([^"]+)"\s*\/>/g;
    let lastIndex = 0, match;
    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) parts.push({ type: 'text', content: text.slice(lastIndex, match.index), fullMatch: '' });
        if (match[0].startsWith('[PROPOSITION:')) {
            parts.push({ type: 'proposition', content: match[1].trim(), fullMatch: match[0] });
        } else {
            parts.push({ type: 'break', content: match[2], fullMatch: match[0] });
        }
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
    if (score === null) return null;
    return <ProgressMeter value={score} threshold={95} label="Fidélité" className="w-full max-w-[220px]" />;
}

// ─── Dialogue card ────────────────────────────────────────────────────────────

function SortableDialogue({
    dialogue, onUpdate, onAccept, onReject, onDelete, onAddAfter, onValidate, onRevert, onToggleSoundBefore, originalText, activePropositionMatch, elementRef
}: {
    dialogue: Dialogue;
    onUpdate: (id: number, field: 'studio', text: string) => void;
    onAccept: (id: number, fullMatch: string) => void;
    onReject: (id: number, fullMatch: string) => void;
    onDelete: (id: number) => void;
    onValidate: (id: number) => void;
    onRevert: (id: number) => void;
    onToggleSoundBefore: (id: number, current: boolean) => void;
    originalText?: string;
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
    const cleanStudio = (t: string) => t.replace(/sound_before:\s*true/gi, '').trim();
    const textParts = parseTextParts(cleanStudio(dialogue.text_studio));
    const hasProps = textParts.some(p => p.type === 'proposition');
    const isUngrounded = dialogue.is_grounded === false;
    const isUncertain  = dialogue.is_grounded === null;

    const mergedRef = useCallback((el: HTMLDivElement | null) => {
        setNodeRef(el);
        elementRef(el);
    }, [setNodeRef, elementRef]);

    return (
        <div
            ref={mergedRef}
            style={{
                ...style,
                ...(isUngrounded ? {
                    backgroundColor: '#F4F2F5',
                    backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 6px, rgba(0,0,0,.04) 6px, rgba(0,0,0,.04) 8px)',
                } : {}),
            }}
            {...attributes}
            className={[
                'group relative rounded-xl border transition-all duration-150',
                isDragging ? 'shadow-xl scale-[1.01]' : isInes ? 'shadow-[inset_3px_0_0_var(--ines)]' : 'shadow-[inset_3px_0_0_var(--yannick)]',
                isUngrounded ? 'border-border' : isUncertain ? 'bg-amber/12 border-amber/30' : hasProps ? 'bg-amber/12 border-amber/30' : 'bg-surface border-border',
                isInes ? '' : 'ml-10',
            ].filter(Boolean).join(' ')}
        >
            <div className="flex items-start gap-3 px-3 py-3">
                {/* Drag handle */}
                <div
                    className="mt-2 cursor-grab text-ink-faint/50 hover:text-ink-soft transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                    {...listeners}
                >
                    <GripVertical className="h-4 w-4" />
                </div>

<div className="flex-1 min-w-0">
                    {/* Character name — small caps */}
                    <div className="flex items-center gap-2 mb-1.5">
                        <p className={['font-heading text-[11px] tracking-[.18em] uppercase', isInes ? 'text-ines-ink' : 'text-yannick-ink'].join(' ')}>
                            {isInes ? 'Inès' : 'Yannick'}
                        </p>
                        {isUngrounded && (
                            <>
                                <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide bg-border text-ink-soft border border-border-soft rounded px-1.5 py-0.5">
                                    <Unlink className="h-2.5 w-2.5" />
                                    Ancre brisée
                                </span>
                                <button
                                    onClick={() => onValidate(dialogue.id)}
                                    className="text-[9px] font-semibold uppercase tracking-wide bg-surface text-ink-soft border border-border rounded px-1.5 py-0.5 hover:bg-canvas transition-colors"
                                >✓ Valider malgré tout</button>
                            </>
                        )}
                        {isUncertain && (
                            <span className="text-[9px] font-semibold uppercase tracking-wide bg-amber/12 text-amber-ink border border-amber/30 rounded px-1.5 py-0.5">À vérifier</span>
                        )}
                        {dialogue.sound_before
                            ? <button onClick={() => onToggleSoundBefore(dialogue.id, true)}
                                className="text-[9px] font-semibold uppercase tracking-wide bg-surface text-ink-soft border border-border rounded px-1.5 py-0.5 hover:bg-canvas transition-colors">
                                ♪ Transition ×
                              </button>
                            : <button onClick={() => onToggleSoundBefore(dialogue.id, false)}
                                className="text-[9px] font-semibold uppercase tracking-wide text-ink-faint hover:text-ink-soft hover:bg-canvas border border-transparent hover:border-border rounded px-1.5 py-0.5 transition-colors">
                                ♪+
                              </button>
                        }
                        {!isUngrounded && !isUncertain && hasProps && (
                            <span className="text-[9px] font-semibold uppercase tracking-wide bg-amber/12 text-amber-ink border border-amber/30 rounded px-1.5 py-0.5">Proposition IA</span>
                        )}
                    </div>

                    {isUngrounded && (
                        <p className="text-[10px] text-ink-faint mb-1">
                            ⚠️ Information absente du source — à vérifier manuellement
                        </p>
                    )}

                    {/* Text */}
                    {editing && originalText !== undefined && cleanStudio(dialogue.text_studio) !== cleanStudio(originalText) && (
                        <button
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => onRevert(dialogue.id)}
                            className="flex items-center gap-1 text-[10px] text-ink-faint hover:text-danger mb-1 transition-colors"
                        >
                            <RotateCcw className="h-3 w-3" /> Annuler les modifications
                        </button>
                    )}
                    {editing ? (
                        <textarea
                            data-no-dnd="true"
                            onPointerDown={e => e.stopPropagation()}
                            className={[
                                'w-full bg-canvas border border-border rounded-lg px-3 py-2 text-[14px] text-ink leading-[1.8] resize-none focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-transparent',
                                isInes ? 'focus:ring-ines/40' : 'focus:ring-yannick/40',
                            ].join(' ')}
                            value={cleanStudio(dialogue.text_studio)}
                            onChange={e => onUpdate(dialogue.id, 'studio', e.target.value)}
                            onBlur={() => setEditing(false)}
                            onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setEditing(false); } }}
                            rows={Math.max(2, Math.ceil(cleanStudio(dialogue.text_studio).length / 90))}
                            autoFocus
                        />
                    ) : (
                        <div
                            className="text-[13px] text-ink leading-relaxed whitespace-pre-wrap cursor-text"
                            onClick={() => setEditing(true)}
                            title="Cliquez pour éditer"
                        >
                            {textParts.map((part, i) =>
                                part.type === 'proposition' ? (
                                    <span key={i} className={[
                                        'inline-flex items-baseline gap-1 rounded px-1.5 py-0.5 mx-0.5 text-amber-ink font-medium',
                                        part.fullMatch === activePropositionMatch
                                            ? 'bg-amber/30 ring-2 ring-amber'
                                            : 'bg-amber/12 border border-amber/30',
                                    ].join(' ')}>
                                        <span>{part.content}</span>
                                        <button onClick={e => { e.stopPropagation(); onAccept(dialogue.id, part.fullMatch); }} className="ml-1 text-emerald-ink hover:text-emerald font-bold text-sm">✓</button>
                                        <button onClick={e => { e.stopPropagation(); onReject(dialogue.id, part.fullMatch); }} className="text-danger hover:text-danger-ink font-bold text-sm">✗</button>
                                    </span>
                                ) : part.type === 'break' ? (
                                    <span key={i} className="inline-flex items-center mx-0.5 px-1.5 py-px rounded-pill text-[10px] font-mono text-ink-faint border border-dashed border-border select-none">
                                        ⏸ {part.content}
                                    </span>
                                ) : <span key={i}>{part.content}</span>
                            )}
                            {!dialogue.text_studio && (
                                <span className="text-ink-faint italic">Cliquez pour saisir une réplique…</span>
                            )}
                        </div>
                    )}

                    {/* Duration */}
                    <div className="flex items-center gap-1 mt-2 text-[11px] text-ink-faint">
                        <Clock className="h-3 w-3" />
                        <span>Durée estimée : {dialogue.duration_seconds > 0 ? fmtDuration(dialogue.duration_seconds) : '—'}</span>
                    </div>
                </div>

                {/* Top-right actions — + always visible, rest on hover */}
                <div className="flex-shrink-0 flex flex-col gap-1">
                    <button
                        onClick={e => { e.stopPropagation(); onAddAfter(dialogue.id); }}
                        className="p-1.5 text-ink-faint hover:text-ink hover:bg-canvas rounded-lg transition-all"
                        title="Ajouter une réplique après"
                    >
                        <Plus className="h-3.5 w-3.5" />
                    </button>
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                            onClick={() => setEditing(v => !v)}
                            className="p-1.5 text-ink-faint hover:text-ink hover:bg-canvas rounded-lg transition-all"
                            title={editing ? 'Fermer' : 'Éditer'}
                        >
                            {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                        </button>
                        {confirmDelete ? (
                            <button
                                onClick={() => onDelete(dialogue.id)}
                                className="p-1.5 bg-danger text-white rounded-lg text-[9px] font-bold px-1.5 py-1 whitespace-nowrap"
                            >Suppr.</button>
                        ) : (
                            <button
                                onClick={() => setConfirmDelete(true)}
                                className="p-1.5 text-ink-faint hover:text-danger hover:bg-danger/10 rounded-lg transition-all"
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
    const [podcastInfo, setPodcastInfo] = useState<{ title: string; project_title?: string; word_count?: number; order_index?: number }>({ title: 'Chargement...' });
    const [audioConfirmOpen, setAudioConfirmOpen] = useState(false);
    const [audioSaveConfirmOpen, setAudioSaveConfirmOpen] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [audioSuccess, setAudioSuccess] = useState(false);
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
    const [groundingStatus, setGroundingStatus] = useState<'idle' | 'checking' | 'done'>('idle');
    const dialogueElRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const originalTextsRef = useRef<Map<number, string>>(new Map());

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

    useEffect(() => {
        if (!isGeneratingAudio) return;
        const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isGeneratingAudio]);

    useEffect(() => {
        if (verification.status !== 'running') return;
        const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [verification.status]);

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
                passCount: 0,
              });
            }
            if (infoRes.data.audio_url) {
                const base = import.meta.env.VITE_API_URL || 'http://localhost:3001';
                setAudioUrl(`${base}${infoRes.data.audio_url}`);
            }
            const dlgs: Dialogue[] = dlgsRes.data || [];
            dlgs.forEach(d => originalTextsRef.current.set(d.id, d.text_studio));
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
        const textReading = text.replace(/<break\s[^>]*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
        setDialogues(items => items.map(item =>
            item.id === id ? { ...item, text_studio: text, text_reading: textReading } : item
        ));
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
                api.patch(`/dialogues/${d.id}`, { text_studio: d.text_studio.replace(/sound_before:\s*true/gi, '').trim(), text_reading: d.text_reading || d.text_studio })
            ));
            if (current.length > 0) {
                await api.patch('/dialogues/reorder', {
                    dialogues: current.map((d, i) => ({ id: d.id, order_index: i }))
                });
            }
            setSaveStatus('saved');
            current.forEach(d => originalTextsRef.current.set(d.id, d.text_studio));
        } catch (e) { console.error('Erreur sauvegarde:', e); setSaveStatus('unsaved'); }
    };

    const handleRevert = (id: number) => {
        const original = originalTextsRef.current.get(id);
        if (original === undefined) return;
        const textReading = original.replace(/<break\s[^>]*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
        setDialogues(items => items.map(d =>
            d.id === id ? { ...d, text_studio: original, text_reading: textReading } : d
        ));
        setSaveStatus('unsaved');
    };

    const handleToggleSoundBefore = async (id: number, current: boolean) => {
        await api.patch(`/dialogues/${id}`, { sound_before: !current });
        setDialogues(items => items.map(d => d.id === id ? { ...d, sound_before: !current } : d));
    };

    const scrollToFirstUngrounded = () => {
        const first = dialogues.find(d => d.is_grounded === false);
        if (!first) return;
        const el = dialogueElRefs.current.get(first.id);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const handleValidateGrounding = async (id: number) => {
        await api.patch(`/dialogues/${id}`, { is_grounded: true });
        setDialogues(items => items.map(d => d.id === id ? { ...d, is_grounded: true } : d));
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
        setGroundingStatus('idle');
        setVerification(v => ({ ...v, status: 'running' }));
        try {
            const res = await api.post(`/podcasts/${podcastId}/verify`);
            const score: number = res.data.fidelity_score ?? 0;
            const missing: string[] = res.data.ia_feedback?.concepts_manquants ?? [];
            const confusing: string[] = res.data.ia_feedback?.informations_erronees ?? [];
            setVerification({ status: score >= 95 ? 'success' : 'insufficient', score, missingConcepts: missing, confusingElements: confusing, passCount: 0 });
            setFidelityScore(score);
            if (score >= 95) {
                setGroundingStatus('checking');
                let attempts = 0;
                const poll = setInterval(async () => {
                    attempts++;
                    try {
                        const dlgsRes = await api.get(`/podcasts/${podcastId}/dialogues`);
                        const dlgs: Dialogue[] = dlgsRes.data || [];
                        const contentDlgs = dlgs.filter(d => d.section !== 'jingle' && d.section !== 'conclusion');
                        const hasGroundingData = contentDlgs.length === 0
                            || contentDlgs.some(d => d.is_grounded !== null);
                        if (hasGroundingData || attempts >= 20) {
                            setDialogues(dlgs.sort((a, b) => a.order_index - b.order_index));
                            setGroundingStatus('done');
                            clearInterval(poll);
                        }
                    } catch { clearInterval(poll); setGroundingStatus('done'); }
                }, 3000);
            }
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

    const handleGenerateAudio = async () => {
        setAudioConfirmOpen(false);
        setIsGeneratingAudio(true);
        try {
            const res = await api.post(`/podcasts/${podcastId}/generate-audio`, {}, { timeout: 300000 });
            const base = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            setAudioUrl(`${base}${res.data.audioPath}`);
            setAudioSuccess(true);
            setTimeout(() => setAudioSuccess(false), 4000);
        } catch (e: any) {
            const code = e?.response?.data?.error;
            const status = e?.response?.status;
            if (code === 'propositions_unresolved')
                setErrorMessage("Des passages non validés sont présents. Ouvrez l'éditeur, vérifiez les passages en jaune et corrigez-les avant de générer l'audio.");
            else if (code === 'quota_elevenlabs_exceeded')
                setErrorMessage("Quota ElevenLabs dépassé. Attendez 1 à 2 minutes puis réessayez. Si le problème persiste, connectez-vous sur elevenlabs.io pour vérifier les crédits disponibles.");
            else if (status === 401)
                setErrorMessage("Clé API ElevenLabs invalide. Vérifiez la variable ELEVENLABS_API_KEY dans le fichier .env du serveur.");
            else if (e?.code === 'ECONNABORTED' || e?.message?.includes('timeout') || e?.message?.includes('Network Error'))
                setErrorMessage("La génération a pris trop de temps. Vérifiez votre connexion internet et réessayez.");
            else
                setErrorMessage("Une erreur inattendue s'est produite. Réessayez dans quelques instants.");
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

    const handleRequestAudio = () => {
        if (saveStatus === 'unsaved') {
            setAudioSaveConfirmOpen(true);
        } else {
            setAudioConfirmOpen(true);
        }
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
        <div className="h-screen flex items-center justify-center bg-canvas">
            <Loader2 className="animate-spin text-primary" size={32} />
        </div>
    );

    return (
        <AppLayout>
            {/* ── Bandeau avertissement IA permanent ── */}
            <div className="w-full bg-surface border-b border-amber/20 px-6 py-2.5 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber flex-shrink-0" />
                <p className="text-sm font-semibold text-amber-ink">
                    Ce script est généré par IA. Il doit être relu par l'ingénieur pédagogique avant export.
                </p>
            </div>
            {/* ── Verification banners ── */}
            <AnimatePresence>
                {verification.status === 'running' && (
                    <motion.div initial={{ y: -48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -48, opacity: 0 }}
                        className="fixed top-14 left-0 right-0 z-50 bg-surface px-6 py-2.5 flex items-center justify-between"
                        style={{ borderBottom: '1.5px solid var(--border)' }}>
                        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Vérification en cours… analyse du chapitre
                        </span>
                        <span className="text-xs text-ink-soft">Traitement des concepts pédagogiques</span>
                    </motion.div>
                )}
                {verification.status === 'success' && (
                    <motion.div initial={{ y: -48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -48, opacity: 0 }}
                        className="fixed top-14 left-0 right-0 z-50 bg-ines-soft px-6 py-2 flex items-center justify-between"
                        style={{ borderBottom: '1.5px solid var(--emerald)' }}>
                        <span className="flex items-center gap-2 text-sm font-semibold text-emerald-ink">
                            <CheckCircle className="h-4 w-4" />
                            VÉRIFICATION RÉUSSIE — Fidélité : {verification.score}%
                        </span>
                        <span className="text-xs font-semibold text-emerald-ink">Statut : Validé</span>
                    </motion.div>
                )}
                {verification.status === 'insufficient' && (
                    <motion.div initial={{ y: -48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -48, opacity: 0 }}
                        className="fixed top-14 left-0 right-0 z-50 bg-ines-soft px-6 py-2 flex items-center justify-between"
                        style={{ borderBottom: '1.5px solid var(--amber)' }}>
                        <span className="flex items-center gap-2 text-sm font-semibold text-amber-ink">
                            <AlertTriangle className="h-4 w-4" />
                            Fidélité : {verification.score}% — {verification.missingConcepts.length} concept{verification.missingConcepts.length > 1 ? 's' : ''} manquant{verification.missingConcepts.length > 1 ? 's' : ''} détecté{verification.missingConcepts.length > 1 ? 's' : ''}.
                        </span>
                        <button onClick={handleAutoFix}
                            className="flex items-center gap-1.5 text-xs font-semibold text-amber-ink hover:opacity-80 bg-amber/12 hover:bg-amber/20 border border-amber/30 rounded-lg px-3 py-1.5 transition-colors">
                            <RotateCcw className="h-3.5 w-3.5" />
                            Corriger automatiquement
                        </button>
                    </motion.div>
                )}
                {hasPendingPropositions && (
                    <motion.div initial={{ y: -48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -48, opacity: 0 }}
                        className="fixed top-14 left-0 right-0 z-50 bg-surface px-6 py-2.5 flex items-center gap-4 flex-wrap"
                        style={{ borderBottom: '1.5px solid var(--amber)' }}>
                        <span className="text-amber-ink font-bold text-sm">⚠ {allPropositions.length} proposition{allPropositions.length > 1 ? 's' : ''} à valider</span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => { const i = Math.max(0, currentPropIdx - 1); setCurrentPropIdx(i); scrollToProp(i); }} disabled={currentPropIdx === 0} className="p-1.5 rounded-lg border border-amber/30 text-amber-ink hover:bg-amber/10 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                            <span className="text-sm font-bold text-amber-ink tabular-nums min-w-[52px] text-center">{currentPropIdx + 1} / {allPropositions.length}</span>
                            <button onClick={() => { const i = Math.min(allPropositions.length - 1, currentPropIdx + 1); setCurrentPropIdx(i); scrollToProp(i); }} disabled={currentPropIdx >= allPropositions.length - 1} className="p-1.5 rounded-lg border border-amber/30 text-amber-ink hover:bg-amber/10 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                        </div>
                        {activeProp && (
                            <>
                                <button onClick={() => handleAccept(activeProp.dialogueId, activeProp.fullMatch)} className="px-3 py-1.5 rounded-lg bg-emerald/12 border border-emerald/30 text-emerald-ink font-bold text-sm hover:bg-emerald/20">✓ Garder</button>
                                <button onClick={() => handleReject(activeProp.dialogueId, activeProp.fullMatch)} className="px-3 py-1.5 rounded-lg bg-danger/10 border border-danger/20 text-danger font-bold text-sm hover:bg-danger/20">✗ Supprimer</button>
                                <span className="text-xs text-amber-ink italic truncate max-w-xs">«&nbsp;{activeProp.content.slice(0, 60)}{activeProp.content.length > 60 ? '…' : ''}&nbsp;»</span>
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
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-surface text-ink border border-border hover:border-primary transition-colors">
                                        <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold bg-emerald/12 text-emerald-ink">✓</span>
                                        {s.label}
                                    </Link>
                                ) : (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary text-white shadow-sm">
                                        <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold bg-white/25 text-white">{i + 1}</span>
                                        {s.label}
                                    </div>
                                )}
                                {i < 2 && <div className={`w-8 h-px ${isDone ? 'bg-primary/30' : 'bg-border'}`} />}
                            </div>
                        );
                    })}
                </div>

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3 min-w-0 overflow-hidden">
                        <button
                            onClick={() => { handleSaveAction(dialogues); navigate(`/project/${projectId}/podcasts`); }}
                            disabled={verification.status === 'running'}
                            className="p-2 bg-surface border border-border rounded-lg text-ink-faint hover:text-ink hover:border-primary/30 transition-all flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <div className="overflow-hidden min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                                <h1 className="font-heading text-xl font-bold text-ink whitespace-nowrap overflow-hidden text-ellipsis block max-w-full">
                                    {podcastInfo.project_title ?? 'Éditeur de Dialogue'}
                                </h1>
                                {fidelityScore !== null && (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold flex-shrink-0 ${
                                        fidelityScore >= 95 ? 'bg-emerald/12 text-emerald-ink' :
                                        fidelityScore >= 70 ? 'bg-amber/12 text-amber-ink' :
                                        'bg-danger/12 text-danger'
                                    }`}>{fidelityScore}%</span>
                                )}
                            </div>
                            {isEditingTitle ? (
                                <input autoFocus value={titleDraft}
                                    onChange={e => setTitleDraft(e.target.value)}
                                    onBlur={handleRenameTitle}
                                    onKeyDown={e => { if (e.key === 'Enter') handleRenameTitle(); if (e.key === 'Escape') setIsEditingTitle(false); }}
                                    className="text-sm border border-border rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-canvas text-ink w-full max-w-sm mt-0.5"
                                />
                            ) : (
                                <p className="text-sm text-ink-soft whitespace-nowrap overflow-hidden text-ellipsis block max-w-full mt-0.5 cursor-text"
                                    onClick={() => { setTitleDraft(podcastInfo.title); setIsEditingTitle(true); }}>
                                    {podcastInfo.title}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={handleShowSource}
                            className="flex items-center gap-1.5 bg-surface border border-border rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink transition-colors">
                            <Clock className="h-3.5 w-3.5" />
                            Historique
                        </button>
                        <button
                            onClick={() => { setIsAddingDialogue(true); setInsertAfterId(null); setNewDialogueChar(dialogues[dialogues.length - 1]?.character === 'ines' ? 'yannick' : 'ines'); }}
                            className="flex items-center gap-1.5 bg-surface border border-border rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink hover:border-yannick/30 transition-colors">
                            <Plus className="h-3.5 w-3.5" />
                            Ajouter une réplique
                        </button>
                        <button
                            onClick={() => handleSaveAction(dialogues)}
                            disabled={saveStatus === 'saving'}
                            className="flex items-center gap-1.5 bg-surface border border-border rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink transition-all"
                        >
                            {saveStatus === 'saving' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            {saveStatus === 'saved' && <CheckCircle className="h-3.5 w-3.5 text-emerald-ink" />}
                            {saveStatus === 'saving' ? 'Sauvegarde en cours…' : saveStatus === 'saved' ? 'Sauvegardé' : 'Sauvegarder'}
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
                                        onValidate={handleValidateGrounding}
                                        onRevert={handleRevert}
                                        onToggleSoundBefore={handleToggleSoundBefore}
                                        originalText={originalTextsRef.current.get(d.id)}
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
                                    className="bg-surface border border-border shadow-card rounded-xl p-4 space-y-3">
                                    <div className="flex gap-2">
                                        {(['ines', 'yannick'] as const).map(char => (
                                            <button key={char} type="button" onClick={() => setNewDialogueChar(char)}
                                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold border transition-all ${
                                                    newDialogueChar === char
                                                        ? char === 'ines' ? 'bg-ines-soft border-ines/40 text-ines-ink' : 'bg-yannick-soft border-yannick/40 text-yannick-ink'
                                                        : 'border-border text-ink-faint'
                                                }`}>
                                                <span className={['w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold', char === 'ines' ? 'bg-ines-soft text-ines-ink' : 'bg-yannick-soft text-yannick-ink'].join(' ')}>
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
                                        className={[
                                            'w-full bg-canvas border border-border rounded-lg px-3 py-2 text-[14px] text-ink leading-[1.8] resize-none focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-transparent',
                                            newDialogueChar === 'ines' ? 'focus:ring-ines/40' : 'focus:ring-yannick/40',
                                        ].join(' ')}
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={() => { setIsAddingDialogue(false); setNewDialogueText(''); setInsertAfterId(null); }}
                                            className="flex-1 py-2 rounded-lg text-xs font-semibold border border-border text-ink-soft hover:bg-canvas transition-colors">
                                            Annuler
                                        </button>
                                        <button
                                            onClick={() => newDialogueText.trim() && handleAddDialogue(newDialogueChar, newDialogueText.trim())}
                                            disabled={!newDialogueText.trim() || isSubmittingNew}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-primary text-white hover:opacity-90 disabled:opacity-40 transition-colors">
                                            {isSubmittingNew ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                            Ajouter
                                        </button>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.button key="add-btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    onClick={() => { setIsAddingDialogue(true); setInsertAfterId(null); setNewDialogueChar(dialogues[dialogues.length - 1]?.character === 'ines' ? 'yannick' : 'ines'); }}
                                    className="flex w-full items-center justify-center gap-2 text-sm text-ink-faint border-2 border-dashed border-border rounded-xl py-3 hover:border-primary/50 hover:text-primary transition-all">
                                    <Plus className="h-4 w-4" />
                                    Ajouter une réplique
                                </motion.button>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Right — panels */}
                    <div className="space-y-4">

                        {/* Card 1 — Vérification de fidélité */}
                        <div className="bg-surface rounded-xl border border-border shadow-card p-5">
                            <h3 className="font-heading font-bold text-sm text-ink mb-1">VÉRIFICATION DE FIDÉLITÉ</h3>
                            <p className="text-xs text-ink-soft mb-4">
                                L'IA analyse votre script par rapport au contenu source (.docx) pour s'assurer qu'aucune information clé n'a été oubliée ou déformée.
                            </p>

                            {verifyError && (
                                <div className="flex items-start gap-2 bg-danger/8 border border-danger/20 rounded-lg px-3 py-2.5 mb-3">
                                    <AlertTriangle className="h-3.5 w-3.5 text-danger flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-danger-ink leading-snug">{verifyError}</p>
                                </div>
                            )}

                            {verification.status === 'idle' && (
                                <>
                                    <p className="text-xs italic text-ink-faint text-center py-3 mb-2">
                                        Le script n'a pas encore été analysé.
                                    </p>
                                    <button onClick={handleVerify}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-primary text-white hover:opacity-90 transition-all">
                                        Analyser le script
                                    </button>
                                    <p className="text-xs text-ink-faint text-center mt-2">
                                        L'analyse prend environ 15-30 secondes.
                                    </p>
                                </>
                            )}

                            {verification.status === 'running' && (
                                <div className="flex flex-col items-center py-6 gap-2">
                                    <Loader2 className="animate-spin text-primary" size={28} />
                                    <p className="text-xs text-ink-faint">Analyse en cours…</p>
                                </div>
                            )}

                            {(verification.status === 'success' || verification.status === 'insufficient') && (
                                <div className="space-y-3">
                                    <div className="flex justify-center">
                                        <ScoreGauge score={verification.score} />
                                    </div>
                                    {(() => {
                                        const inv = dialogues.filter(d => d.is_grounded === false).length;
                                        const inc = dialogues.filter(d => d.is_grounded === null).length;
                                        return (<>
                                            {inv > 0 && (
                                                <button
                                                    onClick={scrollToFirstUngrounded}
                                                    className="w-full flex items-start gap-2 bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 text-xs text-danger-ink hover:bg-danger/12 transition-colors text-left cursor-pointer"
                                                >
                                                    <span><strong>{inv} réplique{inv > 1 ? 's' : ''}</strong> contiennent des informations potentiellement inventées — cliquez pour y accéder.</span>
                                                </button>
                                            )}
                                            {inc > 0 && (
                                                <div className="flex items-start gap-2 bg-amber/10 border border-amber/20 rounded-lg px-3 py-2 text-xs text-amber-ink">
                                                    <span><strong>{inc} réplique{inc > 1 ? 's' : ''}</strong> à vérifier — vérifiez les passages en orange dans l'éditeur.</span>
                                                </div>
                                            )}
                                        </>);
                                    })()}
                                    {groundingStatus !== 'idle' && (
                                        <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2 text-xs text-ink-soft">
                                            {groundingStatus === 'checking' ? (
                                                <><Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" /><span>Vérification des inventions potentielles en cours…</span></>
                                            ) : (
                                                <span>Vérification complète</span>
                                            )}
                                        </div>
                                    )}
                                    {verification.missingConcepts.length > 0 && (
                                        <div className="bg-amber/10 border border-amber/20 rounded-lg p-3">
                                            <p className="text-[10px] font-heading font-bold uppercase tracking-wide text-amber-ink mb-1.5">
                                                {verification.missingConcepts.length} concept{verification.missingConcepts.length > 1 ? 's' : ''} manquant{verification.missingConcepts.length > 1 ? 's' : ''}
                                            </p>
                                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                                {verification.missingConcepts.map((c, i) => (
                                                    <ChecklistItem key={i}>{c}</ChecklistItem>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {verification.status === 'insufficient' && (
                                        <button onClick={handleAutoFix}
                                            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold bg-primary text-white hover:opacity-90 transition-all">
                                            <RotateCcw className="h-3.5 w-3.5" />
                                            Corriger automatiquement
                                        </button>
                                    )}
                                    <button onClick={handleVerify}
                                        className="w-full py-2 rounded-lg text-xs font-semibold border border-border text-ink-soft hover:text-ink hover:bg-canvas transition-all">
                                        Ré-analyser
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Card 2 — Détails du projet */}
                        <div className="bg-surface rounded-xl border border-border shadow-card p-5 space-y-4">
                            <h3 className="font-heading font-bold text-sm text-ink">DÉTAILS DU PROJET</h3>

                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2 text-ink-soft">
                                    <FileText className="h-4 w-4" />
                                    Mots
                                </span>
                                <span className="font-bold">{totalWords.toLocaleString('fr-FR')}</span>
                            </div>

                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2 text-ink-soft">
                                    <Clock className="h-4 w-4" />
                                    Durée estimée
                                </span>
                                <span className="font-bold text-yannick-ink">
                                    {totalMins > 0 ? `${totalMins}:${String(totalSecs % 60).padStart(2, '0')} min` : '—'}
                                </span>
                            </div>

                            {/* Speech ratio */}
                            <div>
                                <p className="text-[10px] font-heading font-bold uppercase tracking-widest text-ink-faint mb-2">
                                    RATIO DE PAROLE
                                </p>
                                <div className="h-2.5 rounded-full overflow-hidden flex">
                                    <div className="bg-ines transition-all" style={{ width: `${inesRatio}%` }} />
                                    <div className="bg-yannick transition-all" style={{ width: `${yannickRatio}%` }} />
                                </div>
                                <div className="flex justify-between mt-1.5">
                                    <span className="text-[10px] font-semibold text-ines-ink">Inès {inesRatio}%</span>
                                    <span className="text-[10px] font-semibold text-yannick-ink">Yannick {yannickRatio}%</span>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>

            {/* ── Sticky bottom bar ── */}
            <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-30 flex items-center justify-between px-8 py-3 shadow-pop">
                {/* Left — chapter navigation */}
                <div className="flex items-center gap-3">
                    <button onClick={handleNavigateBack}
                        disabled={verification.status === 'running'}
                        className="p-2 rounded-lg border border-border text-ink-faint hover:text-ink hover:border-primary/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button disabled className="p-2 rounded-lg border border-border text-ink-faint opacity-40 cursor-not-allowed">
                        <ChevronRight className="h-4 w-4" />
                    </button>
                    <div>
                        <p className="text-[10px] font-heading font-bold uppercase tracking-widest text-ink-faint leading-none mb-0.5">
                            CHAPITRE ACTUEL
                        </p>
                        <p className="text-sm font-semibold text-ink truncate max-w-[220px]">
                            {podcastInfo.title}
                        </p>
                    </div>
                </div>

                {/* Right — export + audio */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            window.open(`/api/podcasts/${podcastId}/source`, '_blank');
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs font-semibold text-ink-soft hover:text-ink hover:border-yannick/30 bg-surface transition-colors"
                    >
                        <FileText className="h-3.5 w-3.5" />
                        Voir le source
                    </button>
                    <span className="text-xs font-bold text-ink-faint mr-1 uppercase tracking-wide">Exporter :</span>
                    {(['word'] as const).map(fmt => (
                        <button key={fmt} onClick={() => handleExport(fmt)}
                            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs font-semibold text-ink-soft hover:text-ink hover:border-primary/30 bg-surface transition-colors">
                            <FileDown className="h-3.5 w-3.5" />
                            {fmt.charAt(0).toUpperCase() + fmt.slice(1)}
                        </button>
                    ))}
                    {fidelityScore !== null && fidelityScore >= 95 && !dialogues.some(d => d.is_grounded === false) && (
                        audioUrl ? (
                            <div className="flex items-center gap-1.5 ml-1">
                                <span className="text-[11px] font-bold text-emerald-ink bg-emerald/12 border border-emerald/30 rounded-lg px-3 py-2 flex items-center gap-1.5">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    Audio prêt
                                </span>
                                <button
                                    onClick={handleRequestAudio}
                                    disabled={isGeneratingAudio}
                                    className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs font-semibold text-ink-soft hover:text-ink hover:border-primary/30 bg-surface transition-colors disabled:opacity-60"
                                >
                                    {isGeneratingAudio ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
                                    Regénérer
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleRequestAudio}
                                disabled={isGeneratingAudio}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald/12 text-emerald-ink border border-emerald/30 rounded-lg text-xs font-bold hover:bg-emerald/20 disabled:opacity-60 transition-colors ml-1"
                            >
                                {isGeneratingAudio ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
                                Générer l'audio
                            </button>
                        )
                    )}
                </div>
            </div>

            {/* Audio player (if ready) */}
            {audioUrl && (
                <div className="fixed bottom-16 left-1/2 -translate-x-1/2 bg-surface border border-border shadow-pop rounded-full px-5 py-2 flex items-center gap-3 z-20">
                    <span className="text-xs font-semibold text-ink-soft">Aperçu audio</span>
                    <audio src={audioUrl} controls className="h-8" />
                </div>
            )}

            {isGeneratingAudio && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="bg-surface rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
                        <Loader2 className="h-10 w-10 text-ines animate-spin mx-auto mb-4" />
                        <h3 className="font-heading font-bold text-base text-ink mb-1">Génération audio en cours…</h3>
                        <p className="text-sm text-ink-soft mb-5">Ne fermez pas cette fenêtre.</p>
                        <div className="w-full bg-canvas rounded-full h-1.5 overflow-hidden">
                            <div className="w-full h-full bg-ines rounded-full animate-pulse" />
                        </div>
                    </div>
                </div>
            )}

            {audioSuccess && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-emerald text-white px-5 py-2.5 rounded-full shadow-pop text-sm font-semibold flex items-center gap-2 pointer-events-none">
                    <CheckCircle className="h-4 w-4" />
                    Audio généré avec succès !
                </div>
            )}

            {errorMessage && <ErrorModal message={errorMessage} onClose={() => setErrorMessage(null)} />}

            {audioSaveConfirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-surface rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
                        <div className="flex items-start gap-3 mb-4">
                            <AlertTriangle className="h-5 w-5 text-amber flex-shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-heading font-bold text-base text-ink mb-1">Modifications non sauvegardées</h3>
                                <p className="text-sm text-ink-soft leading-relaxed">
                                    Des modifications n'ont pas encore été sauvegardées. Voulez-vous sauvegarder avant de générer l'audio ?
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end mt-5 flex-wrap">
                            <button
                                onClick={() => setAudioSaveConfirmOpen(false)}
                                className="px-4 py-2 rounded-lg text-sm font-semibold border border-border text-ink-soft hover:bg-canvas transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={() => { setAudioSaveConfirmOpen(false); setAudioConfirmOpen(true); }}
                                className="px-4 py-2 rounded-lg text-sm font-semibold border border-border text-ink hover:bg-canvas transition-colors"
                            >
                                Générer sans sauvegarder
                            </button>
                            <button
                                onClick={async () => {
                                    setAudioSaveConfirmOpen(false);
                                    await handleSaveAction(dialogues);
                                    setAudioConfirmOpen(true);
                                }}
                                className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:opacity-90 transition-colors"
                            >
                                Sauvegarder et générer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {audioConfirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-surface rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
                        <div className="flex items-start gap-3 mb-4">
                            <AlertTriangle className="h-5 w-5 text-amber flex-shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-heading font-bold text-base text-ink mb-2">Générer l'audio de ce podcast ?</h3>
                                <p className="text-sm text-ink-soft leading-relaxed">
                                    Cette action va générer les fichiers audio via ElevenLabs et a un coût. Assurez-vous que le script a été relu et validé par l'ingénieur pédagogique avant de lancer — cette action ne peut pas être annulée.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end mt-6">
                            <button onClick={() => setAudioConfirmOpen(false)}
                                className="px-4 py-2 rounded-lg text-sm font-semibold border border-border text-ink-soft hover:bg-canvas transition-colors">
                                Annuler
                            </button>
                            <button onClick={handleGenerateAudio}
                                className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:opacity-90 transition-colors">
                                Générer l'audio
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Source modal */}
            <AnimatePresence>
                {showSourceModal && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowSourceModal(false)} className="fixed inset-0 bg-black/45 z-40" />
                        <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
                            className="fixed inset-x-4 top-[8%] bottom-[8%] max-w-3xl mx-auto bg-surface border border-border shadow-pop rounded-2xl z-50 flex flex-col">
                            <div className="p-5 border-b border-border flex items-center justify-between flex-shrink-0">
                                <div>
                                    <h2 className="font-heading font-bold text-base text-ink">Texte source — {podcastInfo.title}</h2>
                                    <p className="text-xs text-ink-soft mt-0.5">Contenu du cours correspondant à ce chapitre</p>
                                </div>
                                <button onClick={() => setShowSourceModal(false)} className="p-2 hover:bg-canvas rounded-lg text-ink-faint">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-5">
                                {loadingSource ? (
                                    <div className="flex items-center justify-center py-16">
                                        <Loader2 className="animate-spin text-primary" size={28} />
                                    </div>
                                ) : (
                                    <pre className="whitespace-pre-wrap text-sm text-ink font-sans leading-relaxed">{sourceText || 'Aucun texte source disponible.'}</pre>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </AppLayout>
    );
}
