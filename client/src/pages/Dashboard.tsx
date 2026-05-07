import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Clock, Trash2, FileText, BookOpen, Search, SlidersHorizontal, CalendarDays, CheckCircle, Loader2 } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { motion, AnimatePresence } from 'framer-motion';

interface Project {
    id: number;
    title: string;
    status: string;
    created_at: string;
    updated_at: string;
    podcast_count: number;
    total_duration_min?: number;
    chapter_count?: number;
}

type StatusKey = 'verified' | 'published' | 'in_progress' | 'draft' | string;

const STATUS_MAP: Record<string, { label: string; className: string }> = {
    verified: {
        label: 'Vérifié',
        className: 'bg-[#BDD145]/20 text-[#5a6e00] border border-[#BDD145]/40',
    },
    published: {
        label: 'Vérifié',
        className: 'bg-[#BDD145]/20 text-[#5a6e00] border border-[#BDD145]/40',
    },
    in_progress: {
        label: 'En cours',
        className: 'bg-[#6BB8CD]/20 text-[#1a6a80] border border-[#6BB8CD]/40',
    },
    draft: {
        label: 'Brouillon',
        className: 'bg-white text-muted-foreground border border-[#D4D0D4]',
    },
};

function formatUpdatedAt(dateStr: string): string {
    const d = new Date(dateStr);
    const date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `Modifié le ${date} à ${h}h${m}`;
}

function getStatus(status: StatusKey) {
    return STATUS_MAP[status] ?? STATUS_MAP['in_progress'];
}

function StatusBadge({ status }: { status: string }) {
    const s = getStatus(status);
    const isActive = status === 'in_progress';
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${s.className}`}>
            {isActive ? (
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : (
                <span className={`h-1.5 w-1.5 rounded-full ${status === 'draft' ? 'bg-[#999]' : 'bg-current'}`} />
            )}
            {s.label}
        </span>
    );
}

export default function Dashboard() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [deleteCandidate, setDeleteCandidate] = useState<number | null>(null);
    const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
    const [editTitle, setEditTitle] = useState('');

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const response = await api.get('/projects');
            setProjects(response.data);
        } catch (error) {
            console.error('Erreur chargement projets:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = (e: React.MouseEvent, id: number) => {
        e.preventDefault();
        e.stopPropagation();
        setDeleteCandidate(id);
    };

    const confirmDelete = async () => {
        if (deleteCandidate === null) return;
        try {
            await api.delete(`/projects/${deleteCandidate}`);
            setProjects(projects.filter(p => p.id !== deleteCandidate));
            setDeleteCandidate(null);
        } catch (error) {
            console.error('Erreur suppression:', error);
        }
    };

    const handleRenameProject = async (id: number, newTitle: string) => {
        const trimmed = newTitle.trim();
        setEditingProjectId(null);
        if (!trimmed) return;
        try {
            const res = await api.patch(`/projects/${id}/title`, { title: trimmed });
            setProjects(prev => prev.map(p =>
                p.id === id ? { ...p, title: trimmed, updated_at: res.data.updated_at ?? p.updated_at } : p
            ));
        } catch (error) {
            console.error('Erreur renommage projet:', error);
        }
    };

    const filtered = projects.filter(p =>
        p.title.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <AppLayout>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-extrabold text-foreground mb-0.5">Mes Projets</h1>
                    <p className="text-sm text-muted-foreground">
                        Gérez vos contenus de formation et podcasts e-learning.
                    </p>
                </div>
                {!loading && (
                    <span className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-white px-3 py-1.5 rounded-full border border-[#E0DCE0] self-start">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#D6475B]" />
                        {projects.length} projet{projects.length > 1 ? 's' : ''} au total
                    </span>
                )}
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher un projet…"
                        className="w-full bg-white border border-[#E0DCE0] rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#D6475B]/30 focus:border-[#D6475B] transition-all"
                    />
                </div>
                <button className="flex items-center gap-1.5 bg-white border border-[#E0DCE0] rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-[#D4D0D4] transition-colors">
                    <SlidersHorizontal className="h-4 w-4" />
                    Filtrer par statut
                </button>
                <button className="flex items-center gap-1.5 bg-white border border-[#E0DCE0] rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-[#D4D0D4] transition-colors">
                    <CalendarDays className="h-4 w-4" />
                    Trier par date
                </button>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-44 bg-white border border-[#E0DCE0] rounded-xl shadow-sm animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filtered.map((project, index) => (
                        <motion.div
                            key={project.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.04 }}
                        >
                            <div
                                className="group relative flex flex-col bg-white border border-[#E0DCE0] rounded-xl p-5 shadow-sm hover:shadow-[0_4px_20px_0_rgb(0,0,0,0.09)] hover:border-[#D6475B]/30 transition-all duration-200 h-full cursor-pointer"
                                onClick={() => { if (editingProjectId !== project.id) navigate(`/project/${project.id}/podcasts`); }}
                            >
                                {/* Title + Date */}
                                <div className="flex-1 mb-4">
                                    {editingProjectId === project.id ? (
                                        <input
                                            autoFocus
                                            value={editTitle}
                                            onChange={e => setEditTitle(e.target.value)}
                                            onBlur={() => handleRenameProject(project.id, editTitle)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleRenameProject(project.id, editTitle);
                                                if (e.key === 'Escape') setEditingProjectId(null);
                                            }}
                                            onClick={e => { e.preventDefault(); e.stopPropagation(); }}
                                            className="w-full text-sm font-bold border border-[#D6475B]/40 rounded px-1.5 py-0.5 mb-1.5 focus:outline-none focus:ring-2 focus:ring-[#D6475B]/30 bg-white text-foreground"
                                        />
                                    ) : (
                                        <h3
                                            className="font-bold text-sm text-foreground line-clamp-2 mb-1.5 group-hover:text-[#D6475B] transition-colors leading-snug cursor-text"
                                            onClick={e => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setEditingProjectId(project.id);
                                                setEditTitle(project.title);
                                            }}
                                        >
                                            {project.title}
                                        </h3>
                                    )}
                                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                        <CalendarDays className="h-3 w-3" />
                                        {formatUpdatedAt(project.updated_at)}
                                    </div>
                                </div>

                                {/* Status badge */}
                                <div className="mb-4">
                                    <StatusBadge status={project.status} />
                                </div>

                                {/* Footer stats */}
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-[#F0EEF0] pt-3">
                                    <span className="flex items-center gap-1">
                                        <BookOpen className="h-3 w-3" />
                                        {project.chapter_count ?? project.podcast_count ?? 0} chapitre{(project.chapter_count ?? project.podcast_count ?? 0) > 1 ? 's' : ''}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {project.total_duration_min
                                            ? `${project.total_duration_min} min`
                                            : '—'}
                                    </span>
                                </div>

                                {/* Delete button */}
                                <button
                                    onClick={(e) => handleDeleteClick(e, project.id)}
                                    className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-[#D6475B] hover:bg-[#D6475B]/10 opacity-0 group-hover:opacity-100 transition-all"
                                    title="Supprimer"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </motion.div>
                    ))}

                    {/* New project card */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: filtered.length * 0.04 }}
                    >
                        <Link
                            to="/new-project"
                            className="flex flex-col items-center justify-center border-2 border-dashed border-[#D4D0D4] rounded-xl p-5 text-center hover:border-[#D6475B] hover:bg-[#D6475B]/[0.02] transition-all duration-200 h-full min-h-[160px] group"
                        >
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F0EEF0] group-hover:bg-[#D6475B]/10 mb-3 transition-colors">
                                <Plus className="h-5 w-5 text-muted-foreground group-hover:text-[#D6475B] transition-colors" />
                            </div>
                            <p className="text-sm font-semibold text-muted-foreground group-hover:text-[#D6475B] transition-colors">
                                Créer un nouveau projet
                            </p>
                            <p className="text-xs text-muted-foreground/70 mt-1">
                                Importez votre fichier .docx
                            </p>
                        </Link>
                    </motion.div>
                </div>
            )}

            {/* Delete Modal */}
            <AnimatePresence>
                {deleteCandidate !== null && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/45 z-50 flex items-center justify-center p-4"
                        onClick={() => setDeleteCandidate(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white border border-[#E0DCE0] shadow-2xl rounded-2xl max-w-sm w-full p-6 text-center"
                        >
                            <div className="w-12 h-12 bg-[#D6475B]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 className="h-6 w-6 text-[#D6475B]" />
                            </div>
                            <h3 className="text-lg font-bold mb-1">Supprimer ce projet ?</h3>
                            <p className="text-sm text-muted-foreground mb-6">
                                Cette action est irréversible. Tous les podcasts associés seront supprimés.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteCandidate(null)}
                                    className="flex-1 bg-[#F0EEF0] text-foreground font-semibold py-2.5 rounded-lg hover:bg-[#E6E2E6] transition-colors text-sm"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 bg-[#D6475B] text-white font-semibold py-2.5 rounded-lg hover:bg-[#c03d50] transition-colors text-sm"
                                >
                                    Confirmer
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </AppLayout>
    );
}
