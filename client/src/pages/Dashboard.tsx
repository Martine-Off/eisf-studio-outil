import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Link } from 'react-router-dom';
import { Plus, Clock, Trash2, FileText, CheckCircle } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { motion, AnimatePresence } from 'framer-motion';

interface Project {
    id: number;
    title: string;
    status: string;
    created_at: string;
    updated_at: string;
    podcast_count: number;
}

export default function Dashboard() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleteCandidate, setDeleteCandidate] = useState<number | null>(null);

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

    return (
        <AppLayout>
            {/* Header section with Stats */}
            <div className="mb-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                    <div>
                        <h1 className="text-4xl font-extrabold text-foreground tracking-tight font-display mb-2">
                            Tableau de bord
                        </h1>
                        <p className="text-muted-foreground text-lg">
                            Bienvenue dans votre espace de création Studio EISF.
                        </p>
                    </div>

                    <Link
                        to="/new-project"
                        className="flex items-center gap-2 eisf-gradient text-primary-foreground px-6 py-3.5 rounded-xl font-bold shadow-eisf transition-all hover:opacity-90 active:scale-95"
                    >
                        <Plus size={20} />
                        Nouveau Projet
                    </Link>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCard icon={FileText} label="Total Projets" value={projects.length} color="blue" />
                    <StatCard icon={CheckCircle} label="Terminés" value={projects.filter(p => p.status === 'published').length} color="green" />
                    <StatCard icon={Clock} label="En cours" value={projects.filter(p => p.status === 'draft').length} color="amber" />
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-56 bg-card border border-border rounded-2xl shadow-sm animate-pulse"></div>
                    ))}
                </div>
            ) : projects.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-3xl border-2 border-dashed border-border p-16 text-center flex flex-col items-center justify-center"
                >
                    <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6">
                        <FileText size={40} className="text-primary opacity-50" />
                    </div>
                    <h3 className="text-2xl font-bold text-foreground mb-2">
                        Aucun projet pour le moment
                    </h3>
                    <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                        Commencez par créer votre premier projet pour générer du contenu audio pédagogique.
                    </p>
                    <Link
                        to="/new-project"
                        className="inline-flex items-center gap-2 eisf-gradient text-primary-foreground px-8 py-3.5 rounded-xl font-bold shadow-lg transition-all hover:opacity-90"
                    >
                        <Plus size={18} />
                        Créer maintenant
                    </Link>
                </motion.div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map((project, index) => (
                        <motion.div
                            key={project.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <Link
                                to={`/project/${project.id}/podcasts`}
                                className="group block bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-eisf-hover transition-all duration-300 h-full flex flex-col relative overflow-hidden"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${project.status === 'published'
                                        ? 'bg-green-100 text-green-700 border border-green-200'
                                        : 'bg-secondary text-primary border border-border'
                                        }`}>
                                        {project.status === 'published' ? 'Généré' : 'Brouillon'}
                                    </div>

                                    <button
                                        onClick={(e) => handleDeleteClick(e, project.id)}
                                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                        title="Supprimer"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div className="flex-1 mb-6">
                                    <h3 className="text-xl font-bold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors font-display">
                                        {project.title}
                                    </h3>
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                        Dernière modification le {new Date(project.updated_at).toLocaleDateString()}
                                    </p>
                                </div>

                                <div className="pt-4 border-t border-border flex items-center justify-between text-xs font-semibold text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <Clock size={14} />
                                        <span>{project.podcast_count > 0 ? `${project.podcast_count} podcast${project.podcast_count > 1 ? 's' : ''}` : 'Aucun podcast'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-primary group-hover:translate-x-1 transition-transform">
                                        <span>Ouvrir</span>
                                        <Plus size={14} />
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteCandidate !== null && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-card border border-border shadow-2xl rounded-2xl max-w-md w-full p-6 text-center"
                        >
                            <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 size={32} />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Supprimer ce projet ?</h3>
                            <p className="text-muted-foreground mb-6">
                                Cette action est irréversible.
                            </p>
                            <div className="flex items-center gap-3 w-full">
                                <button
                                    onClick={() => setDeleteCandidate(null)}
                                    className="flex-1 bg-secondary text-foreground font-bold py-3 rounded-xl hover:bg-secondary/80 transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 bg-destructive text-destructive-foreground font-bold py-3 rounded-xl hover:bg-destructive/90 transition-colors"
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

function StatCard({ icon: Icon, label, value, color }: { icon: any, label: string, value: number, color: string }) {
    return (
        <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4 shadow-sm">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${color === 'blue' ? 'bg-primary/10 text-primary' :
                color === 'green' ? 'bg-green-100 text-green-600' :
                    'bg-amber-100 text-amber-600'
                }`}>
                <Icon size={24} />
            </div>
            <div>
                <p className="text-sm font-medium text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold text-foreground">{value}</p>
            </div>
        </div>
    );
}

