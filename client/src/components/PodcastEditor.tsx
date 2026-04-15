import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Loader2, CheckCircle, ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
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

// Composant de réplique
function SortableDialogue({
    dialogue, onUpdate
}: {
    dialogue: Dialogue;
    onUpdate: (id: number, field: 'studio' | 'reading', text: string) => void;
}) {
    const [editingField, setEditingField] = useState<'studio' | 'reading'>('studio');
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: dialogue.id });

    const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 'auto', opacity: isDragging ? 0.8 : 1 };
    const isInes = dialogue.character.toLowerCase() === 'ines';

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={`group relative flex gap-4 p-6 rounded-2xl border-2 transition-all duration-200 outline-none ${isDragging ? 'shadow-xl scale-[1.01] border-primary' : ''} ${isInes ? 'bg-card border-transparent hover:border-primary/30 shadow-sm' : 'bg-accent/5 border-transparent hover:border-accent/30 shadow-sm'}`}>
            <div className="w-20 flex flex-col items-center py-6 gap-3 flex-shrink-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ${isInes ? 'bg-secondary text-primary' : 'bg-card border border-accent/20 text-accent'}`}>{isInes ? 'I' : 'Y'}</div>
            </div>
            
            <div className="w-8 flex flex-col items-center justify-center gap-2 cursor-grab text-muted-foreground hover:text-primary transition-colors" {...attributes} {...listeners}>
                <GripVertical size={20} />
            </div>
            
            <div className="flex-1">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex flex-col items-center justify-center font-bold text-sm shadow-inner ${isInes ? 'bg-[#f4ebe1] text-[#3465ae]' : 'bg-[#fcebdf] text-[#e63337]'}`}>{isInes ? 'I' : 'Y'}</div>
                        <span className={`font-black uppercase tracking-wide text-sm ${isInes ? 'text-[#3465ae]' : 'text-[#e63337]'}`}>{isInes ? 'Inès' : 'Yannick'}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 mb-2 mt-1">
                    <button onClick={() => setEditingField('studio')} className={`text-[10px] px-2 py-1 rounded uppercase tracking-wider font-bold transition-all ${editingField === 'studio' ? 'bg-primary text-white shadow-sm' : 'bg-secondary border border-border text-muted-foreground hover:bg-secondary/80'}`}>Texte Studio</button>
                    <button onClick={() => setEditingField('reading')} className={`text-[10px] px-2 py-1 rounded uppercase tracking-wider font-bold transition-all ${editingField === 'reading' ? 'bg-accent text-white shadow-sm' : 'bg-secondary border border-border text-muted-foreground hover:bg-secondary/80'}`}>Texte Export (Lecture)</button>
                </div>
                <textarea data-no-dnd="true" onPointerDown={(e) => e.stopPropagation()} className="w-full bg-transparent border-none p-0 text-lg text-foreground leading-relaxed resize-none focus:ring-0 outline-none font-sans" value={editingField === 'studio' ? dialogue.text_studio : (dialogue.text_reading ?? dialogue.text_studio)} onChange={(e) => onUpdate(dialogue.id, editingField, e.target.value)} rows={Math.max(2, Math.ceil((editingField === 'studio' ? dialogue.text_studio : (dialogue.text_reading ?? dialogue.text_studio)).length / 80))} spellCheck={false} placeholder="Écrivez le dialogue ici..." />
            </div>
        </div>
    );
}

export default function PodcastEditor() {
    const { projectId, podcastId } = useParams();
    const navigate = useNavigate();
    const [dialogues, setDialogues] = useState<Dialogue[]>([]);
    const [loading, setLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
    const [podcastInfo, setPodcastInfo] = useState<{title: string}>({ title: 'Chargement...' });

    const [showVerificationPanel, setShowVerificationPanel] = useState(false);
    const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    const saveStateRef = useRef({ status: saveStatus, dialogues });
    useEffect(() => { saveStateRef.current = { status: saveStatus, dialogues }; }, [saveStatus, dialogues]);

    useEffect(() => {
        if (podcastId) loadData();
    }, [podcastId]);

    useEffect(() => {
        const timer = setInterval(() => {
            if (saveStateRef.current.status === 'unsaved') {
                handleSaveAction(saveStateRef.current.dialogues);
            }
        }, 30000);
        return () => clearInterval(timer);
    }, []);

    useKeyboardNav({ onSave: () => handleSaveAction(dialogues) });

    const loadData = async () => {
        try {
            const infoRes = await api.get(`/podcasts/${podcastId}`);
            setPodcastInfo(infoRes.data);
            const dlgsRes = await api.get(`/podcasts/${podcastId}/dialogues`);
            setDialogues(dlgsRes.data || []);
        } catch (error) {
            console.error('Erreur chargement podcast:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = (id: number, field: 'studio' | 'reading', text: string) => {
        setDialogues(items => items.map(item => item.id === id ? { ...item, [field === 'studio' ? 'text_studio' : 'text_reading']: text } : item));
        setSaveStatus('unsaved');
    };

    const handleSaveAction = async (currentDialogues: Dialogue[]) => {
        if (saveStatus === 'saving') return;
        setSaveStatus('saving');

        try {
            await Promise.all(currentDialogues.map(d =>
                api.patch(`/dialogues/${d.id}`, { text_studio: d.text_studio, text_reading: d.text_reading || d.text_studio })
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

    const handleVerify = () => {
        setShowVerificationPanel(true);
    };

    const handleGenerateAudio = async () => {
        try {
            const response = await api.post(`/podcasts/${podcastId}/generate-audio`);
            setAudioUrl(response.data.audio_url);
            setIsAudioModalOpen(false);
            alert("Audio généré avec succès !");
        } catch (error) {
            console.error("Erreur TTS:", error);
            alert("Erreur lors de la génération audio.");
        }
    };


    if (loading) return (
        <div className="h-screen flex items-center justify-center bg-background"><Loader2 className="animate-spin text-primary" size={40} /></div>
    );

    return (
        <AppLayout>
            <div className="max-w-5xl mx-auto pb-20 mt-8">
                <div className="flex flex-col md:flex-row justify-between gap-6 mb-8 mt-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => { handleSaveAction(dialogues); navigate(`/project/${projectId}/podcasts`); }} className="p-2.5 bg-card border border-border rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-all shadow-sm">
                            <ChevronLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-3xl font-extrabold text-foreground tracking-tight font-display">{podcastInfo.title || 'Éditeur de podcast'}</h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button onClick={() => window.open(`/api/podcasts/${podcastId}/export-word/studio`)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100">
                            📄 Export Studio
                        </button>
                        <button onClick={() => window.open(`/api/podcasts/${podcastId}/export-word/lecture`)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm bg-green-50 border border-green-200 text-green-700 hover:bg-green-100">
                            📄 Export Lecture
                        </button>
                        <button onClick={handleVerify} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20">
                            ✨ Vérifier (IA)
                        </button>
                        <button onClick={() => handleSaveAction(dialogues)} disabled={saveStatus === 'saving'} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm bg-card border border-border text-foreground hover:bg-secondary">
                            {saveStatus === 'saving' && <Loader2 size={16} className="animate-spin" />}
                            {saveStatus === 'saved' && <CheckCircle size={16} className="text-green-500" />}
                            Sauvegarder
                        </button>
                        <button
                            onClick={() => setIsAudioModalOpen(true)}
                            disabled={audioUrl !== null}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm ${
                                audioUrl
                                    ? 'bg-green-100 text-green-700 cursor-default'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`}
                        >
                            {audioUrl ? '✅ Audio prêt' : '🎙️ Générer le podcast'}
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={dialogues.map(d => d.id)} strategy={verticalListSortingStrategy}>
                            {dialogues.map(d => (
                                <SortableDialogue key={d.id} dialogue={d} onUpdate={handleUpdate} />
                            ))}
                        </SortableContext>
                    </DndContext>
                </div>
            </div>

            <AnimatePresence>
                {showVerificationPanel && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowVerificationPanel(false)} className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40" />
                        <motion.div initial={{ x: '100%', opacity: 0.5 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0.5 }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="fixed right-0 top-0 bottom-0 w-[400px] bg-card border-l border-border shadow-2xl z-50 flex flex-col">
                            <div className="p-6 border-b border-border flex items-center justify-between">
                                <div><h2 className="font-bold text-lg">Vérification de l'IA</h2><p className="text-sm text-muted-foreground mt-1">Analyse de fidélité au script d'origine</p></div>
                                <button onClick={() => setShowVerificationPanel(false)} className="p-2 hover:bg-secondary rounded-full"><ChevronRight size={20} className="text-muted-foreground" /></button>
                            </div>
                            <div className="p-6 flex-1 overflow-y-auto">
                                <AIVerificationPanel podcastId={podcastId!} onAutoCorrectSuccess={loadData} />
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

            {audioUrl && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white p-2 rounded-full shadow-2xl border flex items-center gap-4 px-6">
                    <span className="text-sm font-bold text-gray-500">Aperçu Audio :</span>
                    <audio src={audioUrl} controls className="h-8" />
                </div>
            )}
        </AppLayout>
    );
}
