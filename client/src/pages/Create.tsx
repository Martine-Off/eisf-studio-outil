// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import AppLayout from '../components/AppLayout';
import { UploadCloud, FileText, Hash, BookOpen, ArrowRight, Loader2, X, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import mammoth from 'mammoth';

interface ParsedStats {
    wordCount: number;
    estimatedChapters: number;
    contentBlocks: number;
    fileName: string;
    fileSize: number;
}

function deriveTitle(fileName: string): string {
    return fileName
        .replace(/\.(docx?|pdf)$/i, '')
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export default function Create() {
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);

    const [file, setFile] = useState<File | null>(null);
    const [stats, setStats] = useState<ParsedStats | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');

    const parseFile = async (f: File) => {
        setIsParsing(true);
        setError('');
        try {
            const buffer = await f.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer: buffer });
            const text = result.value;
            const words = text.trim().split(/\s+/).filter(Boolean).length;
            const paragraphs = text.split(/\n\s*\n/).filter(s => s.trim().length > 0);
            setStats({
                wordCount: words,
                estimatedChapters: Math.ceil(words / 700),
                contentBlocks: paragraphs.length,
                fileName: f.name,
                fileSize: f.size,
            });
            setFile(f);
        } catch {
            setError("Impossible de lire ce fichier. Vérifiez qu'il est bien au format .docx.");
            setFile(null);
            setStats(null);
        } finally {
            setIsParsing(false);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const dropped = e.dataTransfer.files[0];
        if (!dropped) return;
        if (!dropped.name.toLowerCase().endsWith('.docx')) {
            setError('Seuls les fichiers .docx sont acceptés (max 25 Mo).');
            return;
        }
        parseFile(dropped);
    }, []);

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!f.name.toLowerCase().endsWith('.docx')) {
            setError('Seuls les fichiers .docx sont acceptés (max 25 Mo).');
            return;
        }
        parseFile(f);
    };

    const handleContinue = async () => {
        if (!file || !stats) return;
        setIsUploading(true);
        setError('');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', deriveTitle(stats.fileName));

        try {
            const response = await api.post('/projects/create', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            navigate(`/editor/${response.data.project.id}`);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Erreur lors de la création du projet.');
            setIsUploading(false);
        }
    };

    const resetFile = () => {
        setFile(null);
        setStats(null);
        setError('');
        if (inputRef.current) inputRef.current.value = '';
    };

    return (
        <AppLayout>
            <div className="max-w-2xl mx-auto py-4">
                {/* Card */}
                <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-surface rounded-lg shadow-pop border border-border overflow-hidden"
                >
                    {/* Card header */}
                    <div className="flex items-center justify-between px-8 pt-8 pb-0">
                        <h1 className="text-lg font-heading font-bold text-ink">Importer un fichier .docx</h1>
                        <span className="text-[10px] font-medium bg-border-soft text-ink-soft px-2.5 py-1 rounded-pill">
                            Nouveau projet
                        </span>
                    </div>
                    <p className="px-8 mt-1 text-sm text-ink-soft">
                        Commencez par importer votre document source pour structurer votre module de formation.
                    </p>

                    <div className="px-8 py-7 space-y-5">
                        {/* Drop Zone */}
                        <div
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => !file && inputRef.current?.click()}
                            className={`relative flex flex-col items-center justify-center rounded border-2 border-dashed transition-all cursor-pointer py-10 px-6 ${
                                isDragging
                                    ? 'border-primary bg-primary/[.04]'
                                    : file
                                    ? 'border-emerald bg-emerald/[.05] cursor-default'
                                    : 'border-border bg-black/[.02] hover:border-primary/40 hover:bg-black/[.03]'
                            }`}
                        >
                            <input
                                ref={inputRef}
                                type="file"
                                accept=".docx"
                                onChange={handleFileInput}
                                className="hidden"
                            />

                            {isParsing ? (
                                <>
                                    <Loader2 className="h-10 w-10 text-primary animate-spin mb-3" />
                                    <p className="text-sm text-ink-soft">Analyse du document…</p>
                                </>
                            ) : file ? (
                                <>
                                    <FileText className="h-10 w-10 text-emerald mb-3" />
                                    <p className="text-sm font-semibold text-ink">{stats?.fileName}</p>
                                    <p className="text-xs text-ink-soft mt-0.5">
                                        {stats ? `${(stats.fileSize / 1024).toFixed(0)} Ko` : ''}
                                    </p>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); resetFile(); }}
                                        className="mt-3 text-xs text-primary hover:underline flex items-center gap-1"
                                    >
                                        <X className="h-3 w-3" /> Changer de fichier
                                    </button>
                                </>
                            ) : (
                                <>
                                    <UploadCloud className="h-10 w-10 text-ink-faint mb-3" />
                                    <p className="text-sm font-semibold text-ink">Glissez-déposez votre document ici</p>
                                    <p className="text-xs text-ink-soft mt-0.5">
                                        Ou cliquez pour parcourir vos fichiers locaux
                                    </p>
                                    <div className="flex items-center gap-1 mt-3 text-[11px] text-ink-faint">
                                        <Info className="h-3 w-3" />
                                        Format supporté : .docx (max 25 Mo)
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Stats — visible only after analysis */}
                        <AnimatePresence>
                            {stats && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="grid grid-cols-3 gap-3"
                                >
                                    <StatCard icon={FileText} value={stats.wordCount.toLocaleString('fr-FR')} label="Mots détectés" />
                                    <StatCard icon={BookOpen} value={String(stats.estimatedChapters)} label="Chapitres estimés" />
                                    <StatCard icon={Hash} value={String(stats.contentBlocks)} label="Blocs de contenu" />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {stats && (
                            <p className="text-xs text-ink-soft leading-relaxed">
                                Conseil : numérotez vos projets pour les retrouver facilement
                                (ex&nbsp;: <em>01 - La panification</em>, <em>02 - Les farines…</em>)
                            </p>
                        )}

                        {/* Processing notice */}
                        {isParsing && (
                            <p className="text-xs text-ink-faint text-center italic">
                                L'analyse automatique peut prendre quelques secondes…
                            </p>
                        )}

                        {/* Error */}
                        {error && (
                            <div className="flex items-center gap-2 text-sm text-danger bg-danger/[.06] border border-danger/20 rounded-lg px-4 py-3">
                                <X className="h-4 w-4 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        {/* CTA */}
                        <button
                            onClick={handleContinue}
                            disabled={!file || isParsing || isUploading}
                            className="flex w-full items-center justify-center gap-2 bg-primary text-white font-medium py-3 rounded text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Création du projet…
                                </>
                            ) : (
                                <>
                                    Continuer
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>

                {/* Step indicator */}
                <div className="flex items-center justify-center gap-3 mt-6">
                    <div className="h-0.5 w-16 bg-primary rounded-full" />
                    <span className="text-xs font-medium text-ink-faint">
                        Étape 1 / 3
                    </span>
                    <div className="h-0.5 w-16 bg-border rounded-full" />
                </div>
            </div>
        </AppLayout>
    );
}

function StatCard({ icon: Icon, value, label }: { icon: React.ElementType; value: string; label: string }) {
    return (
        <div className="flex flex-col items-center justify-center bg-surface border border-border rounded py-4 px-3 text-center">
            <Icon className="h-5 w-5 text-primary mb-2" />
            <p className="text-xl font-heading font-bold text-ink">{value}</p>
            <p className="text-[10px] text-ink-faint mt-0.5">{label}</p>
        </div>
    );
}
