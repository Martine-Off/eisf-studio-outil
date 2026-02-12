import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Upload, FileText, Clock, ChevronRight, LogOut, Trash2 } from 'lucide-react';

interface Project {
    id: number;
    title: string;
    status: string;
    created_at: string;
    updated_at: string;
}

export default function Dashboard() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const { user, logout } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', file.name.replace(/\.[^/.]+$/, ""));

        setIsUploading(true);
        try {
            const response = await api.post('/projects/create', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            // Rediriger vers l'éditeur/générateur pour ce projet
            navigate(`/project/${response.data.project.id}`);
        } catch (error) {
            console.error('Erreur upload:', error);
            alert("Erreur lors de l'import du fichier");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: number) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm('Voulez-vous vraiment supprimer ce projet ?')) return;

        try {
            await api.delete(`/projects/${id}`);
            setProjects(projects.filter(p => p.id !== id));
        } catch (error) {
            console.error('Erreur suppression:', error);
        }
    };

    return (
        <div className="min-h-screen bg-eisf-bg">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-eisf-blue to-eisf-blue-light rounded-xl flex items-center justify-center text-white shadow-md">
                            <span className="text-xl">🎙️</span>
                        </div>
                        <h1 className="text-xl font-bold text-eisf-blue-dark tracking-tight">Studio EISF</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-100">
                            <div className="w-8 h-8 bg-eisf-beige rounded-full flex items-center justify-center text-eisf-blue font-bold border border-orange-100">
                                {user?.first_name[0]}
                            </div>
                            <span className="text-sm font-medium text-gray-700 hidden sm:block">{user?.first_name}</span>
                        </div>
                        <button
                            onClick={logout}
                            className="p-2 text-gray-400 hover:text-eisf-red hover:bg-red-50 rounded-full transition-colors"
                            title="Déconnexion"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900">Mes Projets</h2>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="btn-primary shadow-lg hover:shadow-eisf-blue/20"
                        disabled={isUploading}
                    >
                        {isUploading ? (
                            <span className="animate-spin mr-2">⏳</span>
                        ) : (
                            <Plus size={20} />
                        )}
                        {isUploading ? 'Import...' : 'Nouveau Projet'}
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".docx,.doc"
                        className="hidden"
                    />
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-48 skeleton"></div>
                        ))}
                    </div>
                ) : projects.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                            <Upload size={40} />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Aucun projet</h3>
                        <p className="text-gray-500 mb-6 max-w-sm mx-auto">Commencez par importer un cours au format Word pour générer votre premier podcast.</p>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="btn-secondary"
                        >
                            Importer un fichier Word
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map(project => (
                            <Link
                                key={project.id}
                                to={`/project/${project.id}`}
                                className="card group hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-eisf-blue to-eisf-blue-light opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-eisf-blue group-hover:bg-eisf-blue group-hover:text-white transition-colors duration-300">
                                            <FileText size={24} />
                                        </div>
                                        <div className="relative">
                                            <button
                                                onClick={(e) => handleDelete(e, project.id)}
                                                className="p-2 text-gray-300 hover:text-eisf-red hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                                title="Supprimer"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-eisf-blue transition-colors">
                                        {project.title}
                                    </h3>

                                    <div className="flex items-center text-sm text-gray-500 mb-4">
                                        <Clock size={14} className="mr-1.5" />
                                        <span>Modifié le {new Date(project.updated_at).toLocaleDateString()}</span>
                                    </div>

                                    <div className="flex items-center justify-between mt-4">
                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${project.status === 'draft' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
                                            }`}>
                                            {project.status === 'draft' ? 'Brouillon' : 'Publié'}
                                        </span>
                                        <span className="text-eisf-blue opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300 flex items-center text-sm font-semibold">
                                            Ouvrir <ChevronRight size={16} className="ml-0.5" />
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
