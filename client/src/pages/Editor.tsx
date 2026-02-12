import { useState, useEffect } from 'react';
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
    Save, ArrowLeft, Wand2, GripVertical,
    FileDown, FileJson, Loader2
} from 'lucide-react';
import api from '../utils/api';
import { useKeyboardNav } from '../hooks/useKeyboardNav';

// Types
interface Dialogue {
    id: number;
    character: 'anabelle' | 'bryan';
    text_studio: string;
    section: string;
    duration_seconds: number;
    order_index: number;
}

interface Project {
    id: number;
    title: string;
    source_file_path: string;
}

// Sortable Item Component
function SortableDialogue({
    dialogue,
    onUpdate
}: {
    dialogue: Dialogue;
    onUpdate: (id: number, text: string) => void;
}) {
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

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-eisf-blue/30 transition-all ${isDragging ? 'shadow-xl ring-2 ring-eisf-blue rotate-1' : ''
                }`}
        >
            <div className="flex gap-4">
                {/* Drag Handle */}
                <div
                    {...attributes}
                    {...listeners}
                    className="mt-2 text-gray-300 hover:text-eisf-blue cursor-grab active:cursor-grabbing"
                >
                    <GripVertical size={20} />
                </div>

                {/* Content */}
                <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${dialogue.character === 'anabelle'
                                ? 'bg-blue-50 text-eisf-blue'
                                : 'bg-red-50 text-eisf-red'
                                }`}>
                                {dialogue.character}
                            </span>
                            <span className="text-xs text-gray-400 font-medium">
                                {dialogue.section && `• ${dialogue.section}`}
                            </span>
                        </div>
                        <span className="text-xs text-gray-300 font-mono">
                            {Math.floor(dialogue.duration_seconds / 60)}:{(dialogue.duration_seconds % 60).toString().padStart(2, '0')}
                        </span>
                    </div>

                    <textarea
                        className="w-full text-gray-800 text-base leading-relaxed p-2 -ml-2 rounded-lg border border-transparent hover:border-gray-100 focus:border-eisf-blue focus:ring-2 focus:ring-eisf-blue/10 outline-none transition-all resize-none bg-transparent focus:bg-white"
                        value={dialogue.text_studio}
                        onChange={(e) => onUpdate(dialogue.id, e.target.value)}
                        rows={Math.max(2, Math.ceil(dialogue.text_studio.length / 80))}
                    />
                </div>
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
    const [isGenerating, setIsGenerating] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        if (projectId) loadData();
    }, [projectId]);

    // Keyboard Shortcuts
    useKeyboardNav({
        onSave: () => handleSave(),
        onGenerate: () => dialogues.length === 0 && handleGenerate(5),
    });

    const loadData = async () => {
        try {
            const [projRes, dialRes] = await Promise.all([
                api.get(`/projects/${projectId}`),
                api.get(`/podcasts/${projectId}/dialogues`)
            ]);

            const podcasts = projRes.data.podcasts;
            let currentDialogues = [];

            if (podcasts.length > 0) {
                // Utiliser les dialogues récupérés s'ils existent
                currentDialogues = dialRes.data;

                // Si vide, et qu'on a un podcast ID, on tente le fetch spécifique (fallback)
                if (currentDialogues.length === 0 && podcasts[0].id) {
                    const dRes = await api.get(`/podcasts/${podcasts[0].id}/dialogues`);
                    currentDialogues = dRes.data;
                }
            }

            setProject(projRes.data.project);
            setDialogues(currentDialogues);
        } catch (error) {
            console.error('Erreur chargement:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async (duration: number) => {
        setIsGenerating(true);
        try {
            const response = await api.post('/ai/generate-from-project', {
                projectId,
                targetDuration: duration
            });

            // Recharger les dialogues
            const podcastId = response.data.podcastId;
            const dRes = await api.get(`/podcasts/${podcastId}/dialogues`);
            setDialogues(dRes.data);
        } catch (error) {
            console.error('Erreur génération:', error);
            alert('Erreur lors de la génération');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleUpdate = (id: number, text: string) => {
        setDialogues(items =>
            items.map(item => item.id === id ? { ...item, text_studio: text } : item)
        );
        setSaveStatus('unsaved');
    };

    // Auto-save debounce could be added here
    const handleSave = async () => {
        if (saveStatus === 'saved') return;
        setSaveStatus('saving');

        // Pour l'instant on sauvegarde individuellement, en prod on ferait un batch
        // Cette partie est simplifiée pour le prototype
        try {
            // On sauvegarde juste l'ordre si changé + textes modifiés
            // Ici on suppose que le backend gère les updates unitaires pour le texte
            // Optimisation : identifier les dialogues modifiés
            await new Promise(resolve => setTimeout(resolve, 500)); // Simuler délai réseau

            // En réalité on enverrait les modifs au backend
            // TODO: Implémenter le batch update côté backend

            setSaveStatus('saved');
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            setDialogues((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over?.id);
                const newItems = arrayMove(items, oldIndex, newIndex);

                // Sauvegarder le nouvel ordre
                if (project) {
                    // Récupérer l'ID du podcast (supposé 1er ici pour simplifier, à améliorer)
                    // En vrai il faudrait stocker podcastId dans le state
                    // api.put(`/podcasts/${podcastId}/reorder`, { 
                    //   dialogues: newItems.map((d, i) => ({ id: d.id, order_index: i })) 
                    // });
                }

                return newItems;
            });
        }
    };

    if (loading) return (
        <div className="h-screen flex items-center justify-center bg-eisf-bg">
            <Loader2 className="animate-spin text-eisf-blue" size={40} />
        </div>
    );

    return (
        <div className="min-h-screen bg-eisf-bg flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/')}
                            className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900">{project?.title || 'Chargement...'}</h1>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span className={`w-2 h-2 rounded-full ${saveStatus === 'saved' ? 'bg-green-500' :
                                    saveStatus === 'saving' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-300'
                                    }`} />
                                {saveStatus === 'saved' ? 'Enregistré' : saveStatus === 'saving' ? 'Enregistrement...' : 'Modifications non enregistrées'}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Export Buttons */}
                        <div className="flex bg-gray-100 rounded-lg p-1 mr-4">
                            <button className="p-2 hover:bg-white rounded-md text-gray-600 transition-all" title="Export Word">
                                <FileDown size={18} />
                            </button>
                            <button className="p-2 hover:bg-white rounded-md text-gray-600 transition-all" title="Export JSON">
                                <FileJson size={18} />
                            </button>
                        </div>

                        <button className="btn-secondary" onClick={() => handleSave()}>
                            <Save size={18} />
                            <span className="hidden sm:inline">Enregistrer</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
                {dialogues.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg animate-pulse-glow">
                            <Wand2 size={40} className="text-eisf-blue" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Générer le podcast</h2>
                        <p className="text-gray-500 mb-8 max-w-md mx-auto">
                            L'IA va analyser votre cours et créer un dialogue captivant entre Anabelle et Bryan.
                        </p>

                        <div className="flex gap-4 justify-center">
                            {[3, 5, 7].map(min => (
                                <button
                                    key={min}
                                    onClick={() => handleGenerate(min)}
                                    disabled={isGenerating}
                                    className="group px-6 py-4 bg-white border border-gray-200 rounded-xl hover:border-eisf-blue hover:shadow-lg transition-all text-left w-32"
                                >
                                    <div className="text-lg font-bold text-gray-900 mb-1 group-hover:text-eisf-blue">{min} min</div>
                                    <div className="text-xs text-gray-400">~{min * 150} mots</div>
                                </button>
                            ))}
                        </div>

                        {isGenerating && (
                            <div className="mt-8 flex flex-col items-center animate-fade-in">
                                <Loader2 className="animate-spin text-eisf-blue mb-2" size={32} />
                                <p className="text-eisf-blue font-medium">Rédaction du script en cours...</p>
                                <p className="text-xs text-gray-400 mt-1">Cela peut prendre jusqu'à 30 secondes</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={dialogues.map(d => d.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-4 pb-20">
                                {dialogues.map((dialogue) => (
                                    <SortableDialogue
                                        key={dialogue.id}
                                        dialogue={dialogue}
                                        onUpdate={handleUpdate}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
            </main>
        </div>
    );
}
