import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useNavigate } from 'react-router-dom';
import {
    Plus, Trash2, FileText, Search,
    ExternalLink, Pencil, ChevronDown,
} from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { motion, AnimatePresence } from 'framer-motion';

interface Project {
    id: number;
    title: string;
    status: string;
    created_at: string;
    updated_at: string;
    podcast_count: number;
    chapter_count?: number;
}

type StatusFilter = 'all' | 'draft' | 'published';
type SortOrder = 'recent' | 'oldest' | 'name_asc';

function formatDate(dateStr: string): string {
    const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${d.getFullYear()}`;
}

function formatUpdatedAt(dateStr: string): string {
    const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${d.getFullYear()} ${h}:${m}`;
}

function isPublished(status: string): boolean {
    return status === 'published' || status === 'verified';
}

function StatusBadge({ status }: { status: string }) {
    if (isPublished(status)) {
        return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                Publié
            </span>
        );
    }
    return (
        <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: '#E6E2E6', color: '#666666' }}
        >
            Brouillon
        </span>
    );
}

export default function Dashboard() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [sortOrder, setSortOrder] = useState<SortOrder>('recent');
    const [deleteCandidate, setDeleteCandidate] = useState<number | null>(null);
    const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
    const [editTitle, setEditTitle] = useState('');

    useEffect(() => { fetchProjects(); }, []);

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
            setProjects(prev => prev.filter(p => p.id !== deleteCandidate));
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

    let filtered = projects.filter(p => {
        const matchSearch = p.title.toLowerCase().includes(search.toLowerCase());
        const matchStatus =
            statusFilter === 'all' ||
            (statusFilter === 'published' && isPublished(p.status)) ||
            (statusFilter === 'draft' && !isPublished(p.status));
        return matchSearch && matchStatus;
    });

    if (sortOrder === 'recent') {
        filtered = [...filtered].sort((a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
    } else if (sortOrder === 'oldest') {
        filtered = [...filtered].sort((a, b) =>
            new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
        );
    } else {
        filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    }

    return (
        <AppLayout>
        <div className="min-h-screen bg-[#E6E2E6]">
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
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Rechercher un projet…"
                        className="w-full bg-white border border-[#E0DCE0] rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#D6475B]/30 focus:border-[#D6475B] transition-all"
                    />
                </div>

                <div className="flex gap-3">
                    <div className="relative">
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                            className="appearance-none bg-white border border-gray-200 rounded-xl px-4 py-2 pr-8 text-sm font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50 focus:outline-none cursor-pointer transition-all min-w-[160px]"
                        >
                            <option value="all">Tous les statuts</option>
                            <option value="draft">Brouillon</option>
                            <option value="published">Publié</option>
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>

                    <div className="relative">
                        <select
                            value={sortOrder}
                            onChange={e => setSortOrder(e.target.value as SortOrder)}
                            className="appearance-none bg-white border border-gray-200 rounded-xl px-4 py-2 pr-8 text-sm font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50 focus:outline-none cursor-pointer transition-all min-w-[160px]"
                        >
                            <option value="recent">Plus récent</option>
                            <option value="oldest">Plus ancien</option>
                            <option value="name_asc">Nom A→Z</option>
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-14 border-b border-[#F0EEF0] animate-pulse bg-gray-50 last:border-0" />
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-2xl overflow-hidden">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b border-[#F0EEF0]">
                                {['NOM DU PROJET', 'STATUT', 'CHAPITRES', 'DERNIÈRE MODIFICATION', 'DATE DE CRÉATION', 'ACTIONS'].map(col => (
                                    <th
                                        key={col}
                                        className="text-left text-[11px] font-semibold text-muted-foreground tracking-wide px-5 py-3 whitespace-nowrap"
                                    >
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(project => (
                                <tr
                                    key={project.id}
                                    className="border-b border-[#F0EEF0] last:border-0 cursor-pointer transition-colors hover:bg-[#EBF2FA] hover:shadow-[inset_4px_0_0_#3465AE]"
                                    onClick={() => {
                                        if (editingProjectId !== project.id) {
                                            navigate(`/project/${project.id}/podcasts`);
                                        }
                                    }}
                                >
                                    <td className="px-5 py-4 font-semibold text-sm text-foreground max-w-[260px]">
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
                                                className="w-full text-sm font-bold border border-[#D6475B]/40 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-[#D6475B]/30 bg-white text-foreground"
                                            />
                                        ) : (
                                            <span className="line-clamp-2">{project.title}</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4">
                                        <StatusBadge status={project.status} />
                                    </td>
                                    <td className="px-5 py-4 text-sm text-muted-foreground">
                                        <span className="flex items-center gap-1.5">
                                            <FileText className="h-4 w-4 flex-shrink-0" />
                                            {project.chapter_count ?? project.podcast_count ?? 0}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 text-sm text-muted-foreground whitespace-nowrap">
                                        {formatUpdatedAt(project.updated_at)}
                                    </td>
                                    <td className="px-5 py-4 text-sm text-muted-foreground whitespace-nowrap">
                                        {formatDate(project.created_at)}
                                    </td>
                                    <td className="px-5 py-4">
                                        <div
                                            className="flex items-center gap-1"
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <button
                                                onClick={() => navigate(`/project/${project.id}`)}
                                                className="p-1.5 rounded text-muted-foreground hover:text-[#3465AE] hover:bg-[#EBF2FA] transition-colors"
                                                title="Ouvrir"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setEditingProjectId(project.id);
                                                    setEditTitle(project.title);
                                                }}
                                                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-[#F0EEF0] transition-colors"
                                                title="Renommer"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={e => handleDeleteClick(e, project.id)}
                                                className="p-1.5 rounded text-muted-foreground hover:text-[#D6475B] hover:bg-[#D6475B]/10 transition-colors"
                                                title="Supprimer"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {/* Create new project */}
                            <tr>
                                <td colSpan={6} className="px-5 py-4">
                                    <div
                                        className="flex flex-col items-center justify-center border-2 border-dashed border-[#D4D0D4] rounded-xl py-6 cursor-pointer hover:border-[#3465AE] hover:bg-[#EBF2FA]/40 transition-all group"
                                        onClick={() => navigate('/create')}
                                    >
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F0EEF0] group-hover:bg-[#EBF2FA] mb-2 transition-colors">
                                            <Plus className="h-5 w-5 text-muted-foreground group-hover:text-[#3465AE] transition-colors" />
                                        </div>
                                        <p className="font-semibold mt-2">Créer un nouveau projet</p>
                                        <p className="text-sm text-gray-400 italic">Importez votre fichier .docx pour commencer</p>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
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
                            onClick={e => e.stopPropagation()}
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
        </div>
        </AppLayout>
    );
}
