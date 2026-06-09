// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Loader2, RefreshCw, Zap, X } from 'lucide-react';
import api from '../utils/api';
import ErrorModal from './ErrorModal';

interface VerificationResult {
    concepts_manquants: string[];
    concepts_incertains?: string[];
    informations_erronees: string[];
    suggestions?: string[];
}

interface PassInfo {
    pass: number;
    score: number;
    missingCount: number;
    missing: string[];
}

interface AutoFixResult {
    finalScore: number;
    targetReached: boolean;
    passCount: number;
    passHistory: PassInfo[];
}

interface AIVerificationPanelProps {
    podcastId: string | number;
    onCorrectionDone?: (score: number) => void;
    dialogues?: { is_grounded: boolean | null }[];
}

function ScoreGauge({ score }: { score: number }) {
    const radius = 34;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const color =
        score >= 95 ? '#BDD145' :
        score >= 70 ? '#E6A440' : '#D6475B';
    const label =
        score >= 95 ? 'Excellent' :
        score >= 70 ? 'Acceptable' : 'Insuffisant';

    return (
        <div className="flex flex-col items-center gap-2">
            <div className="relative w-20 h-20">
                <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                    <circle cx="40" cy="40" r={radius} fill="none" stroke="#E0DCE0" strokeWidth="7" />
                    <circle
                        cx="40" cy="40" r={radius}
                        fill="none"
                        stroke={color}
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-extrabold text-foreground leading-none">{score}%</span>
                </div>
            </div>
            <span className="text-xs font-semibold" style={{ color }}>{label}</span>
        </div>
    );
}

export const AIVerificationPanel: React.FC<AIVerificationPanelProps> = ({
    podcastId,
    onCorrectionDone,
    dialogues = [],
}) => {
    const [feedback, setFeedback] = useState<VerificationResult | null>(null);
    const [score, setScore] = useState<number | null>(null);

    useEffect(() => {
        const loadExistingScore = async () => {
            try {
                const res = await api.get(`/podcasts/${podcastId}`);
                if (res.data.fidelity_score != null && res.data.fidelity_score > 0) {
                    setScore(res.data.fidelity_score);
                }
            } catch {
                // silencieux
            }
        };
        loadExistingScore();
    }, [podcastId]);
    const [status, setStatus] = useState<'idle' | 'running' | 'fixing' | 'success' | 'insufficient'>('idle');
    const [autoFixResult, setAutoFixResult] = useState<AutoFixResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [quotaError, setQuotaError] = useState<'verify' | 'fix' | null>(null);

    const runAnalysis = async () => {
        setStatus('running');
        setError(null);
        setQuotaError(null);
        setAutoFixResult(null);
        try {
            const res = await api.post(`/podcasts/${podcastId}/verify`);
            const data = res.data;
            setFeedback(data.ia_feedback);
            const s = data.fidelity_score ?? 0;
            setScore(s);
            setStatus(s >= 95 ? 'success' : 'insufficient');
            if (onCorrectionDone) onCorrectionDone(s);
        } catch (err: any) {
            const code = err?.response?.data?.error;
            if (err?.response?.status === 429 || code === 'quota_make_exceeded' || code === 'MAKE_QUOTA_EXCEEDED') {
                setQuotaError('verify');
            } else if (code === 'MAKE_TIMEOUT') {
                setError("Make n'a pas répondu à temps. Réessayez dans quelques instants. Si le problème persiste, vérifiez que le scénario Make est bien activé sur make.com.");
            } else {
                setError("Une erreur inattendue s'est produite. Réessayez dans quelques instants.");
            }
            setStatus('idle');
        }
    };

    const runAutoFix = async () => {
        setStatus('fixing');
        setError(null);
        setQuotaError(null);
        try {
            const res = await api.post('/ai/auto-verify-and-fix', { podcastId: Number(podcastId) }, {
                timeout: 300000,
            });
            const data: AutoFixResult = res.data;
            setAutoFixResult(data);
            setScore(data.finalScore);
            setFeedback(null);
            setStatus(data.targetReached ? 'success' : 'insufficient');
            if (onCorrectionDone) onCorrectionDone(data.finalScore);
        } catch (err: any) {
            const code = err?.response?.data?.error;
            if (err?.response?.status === 429 || code === 'quota_make_exceeded' || code === 'MAKE_QUOTA_EXCEEDED') {
                setQuotaError('fix');
            } else if (code === 'MAKE_TIMEOUT') {
                setError("Make n'a pas répondu à temps. Réessayez dans quelques instants. Si le problème persiste, vérifiez que le scénario Make est bien activé sur make.com.");
            } else {
                setError("Une erreur inattendue s'est produite. Réessayez dans quelques instants.");
            }
            setStatus('insufficient');
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-[#E0DCE0] shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-[#F0EEF0] flex items-start justify-between gap-3">
                <div>
                    <h3 className="font-bold text-sm text-foreground">Vérification de fidélité</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Compare le script au cours source, concept par concept.
                    </p>
                </div>
                {score !== null && <ScoreGauge score={score} />}
            </div>

            <div className="p-5 flex flex-col gap-4">
                {/* Idle state */}
                {status === 'idle' && (
                    <div className="text-center py-4 flex flex-col items-center gap-3">
                        <p className="text-sm text-muted-foreground">Le script n'a pas encore été analysé.</p>
                        <button
                            onClick={runAnalysis}
                            className="flex items-center gap-2 bg-[#D6475B] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#c03d50] transition-colors"
                        >
                            <Zap className="h-4 w-4" />
                            Analyser le script
                        </button>
                        <p className="text-[11px] text-muted-foreground/70">L'analyse est requise avant toute exportation.</p>
                    </div>
                )}

                {/* Running */}
                {(status === 'running' || status === 'fixing') && (
                    <div className="flex flex-col items-center gap-3 py-6">
                        <Loader2 className="h-8 w-8 text-[#6BB8CD] animate-spin" />
                        <p className="text-sm font-semibold text-[#1a6a80]">
                            {status === 'fixing' ? 'Correction automatique en cours…' : 'Analyse en cours…'}
                        </p>
                        <p className="text-[11px] text-muted-foreground">Ne fermez pas cette fenêtre.</p>
                    </div>
                )}

                {/* Success */}
                <AnimatePresence>
                    {status === 'success' && score !== null && (
                        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            <div className="flex items-start gap-3 bg-[#BDD145]/10 border border-[#BDD145]/30 rounded-xl px-4 py-3">
                                <CheckCircle2 className="h-5 w-5 text-[#5a6e00] flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-[#5a6e00]">
                                        Script validé — {score}% de fidélité
                                    </p>
                                    <p className="text-xs text-[#5a6e00]/80 mt-0.5">
                                        Le contenu est correctement retranscrit. Export débloqué.
                                    </p>
                                </div>
                            </div>

                            {autoFixResult && (
                                <div className="mt-3 bg-[#F8F7F8] border border-[#E0DCE0] rounded-xl px-4 py-3 text-xs text-muted-foreground space-y-1">
                                    <p className="font-semibold text-foreground mb-1">Détail des passes</p>
                                    {autoFixResult.passHistory?.map(h => (
                                        <div key={h.pass} className="flex justify-between">
                                            <span>Passe {h.pass}</span>
                                            <span>{h.score}% — {h.missingCount} concept(s) manquant(s)</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button
                                onClick={runAnalysis}
                                className="mt-3 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
                            >
                                <RefreshCw className="h-3 w-3" />
                                Relancer l'analyse
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Insufficient */}
                <AnimatePresence>
                    {status === 'insufficient' && score !== null && (
                        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
                            <div className="flex items-start gap-3 bg-[#E6A440]/10 border border-[#E6A440]/30 rounded-xl px-4 py-3">
                                <AlertTriangle className="h-5 w-5 text-[#b37a00] flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-[#b37a00]">
                                        Fidélité insuffisante — {score}%
                                    </p>
                                    <p className="text-xs text-[#b37a00]/80 mt-0.5">
                                        L'export est bloqué tant que le score est inférieur à 95%.
                                    </p>
                                </div>
                            </div>

                            {feedback?.concepts_manquants && feedback.concepts_manquants.length > 0 && (
                                <div className="bg-[#F8F7F8] border border-[#E0DCE0] rounded-xl px-4 py-3">
                                    <p className="text-xs font-semibold text-foreground mb-2">
                                        Concepts manquants ({feedback.concepts_manquants.length})
                                    </p>
                                    <ul className="space-y-1 max-h-36 overflow-y-auto">
                                        {feedback.concepts_manquants.map((c, i) => (
                                            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                                                <X className="h-3 w-3 text-[#D6475B] flex-shrink-0 mt-0.5" />
                                                {c}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {feedback?.concepts_incertains && feedback.concepts_incertains.length > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                                    <p className="text-xs font-semibold text-amber-800 mb-2">
                                        À vérifier ({feedback.concepts_incertains.length})
                                    </p>
                                    <ul className="space-y-1 max-h-36 overflow-y-auto">
                                        {feedback.concepts_incertains.map((c, i) => (
                                            <li key={i} className="flex items-start gap-2 text-xs text-amber-700">
                                                <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0 mt-0.5" />
                                                {c}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800">
                                💡 <span><strong>Conseil :</strong> Certains concepts peuvent être des faux positifs. Lancez la correction automatique pour atteindre 95%+ et déclencher la vérification des inventions potentielles, signalées en rouge dans l'éditeur.</span>
                            </div>

                            {autoFixResult && (
                                <div className="bg-[#F8F7F8] border border-[#E0DCE0] rounded-xl px-4 py-3 text-xs text-muted-foreground space-y-1">
                                    <p className="font-semibold text-foreground mb-1">Détail des passes</p>
                                    {autoFixResult.passHistory?.map(h => (
                                        <div key={h.pass} className="flex justify-between">
                                            <span>Passe {h.pass}</span>
                                            <span>{h.score}% — {h.missingCount} concept(s) manquant(s)</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={runAutoFix}
                                    className="flex items-center justify-center gap-2 bg-[#D6475B] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#c03d50] transition-colors"
                                >
                                    <Zap className="h-4 w-4" />
                                    Corriger automatiquement
                                </button>
                                <button
                                    onClick={runAnalysis}
                                    className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                                >
                                    <RefreshCw className="h-3 w-3" />
                                    Relancer l'analyse
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Grounding status */}
                {(() => {
                    const ungroundedCount = dialogues.filter(d => d.is_grounded === false).length;
                    const uncertainCount = dialogues.filter(d => d.is_grounded === null).length;
                    return (
                        <>
                            {ungroundedCount > 0 && (
                                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-800">
                                    🔴 <span><strong>{ungroundedCount} réplique{ungroundedCount > 1 ? 's' : ''}</strong> contiennent des informations potentiellement inventées — vérifiez les passages en rouge dans l'éditeur.</span>
                                </div>
                            )}
                            {uncertainCount > 0 && (
                                <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-xs text-orange-800">
                                    🟠 <span><strong>{uncertainCount} réplique{uncertainCount > 1 ? 's' : ''}</strong> à vérifier — vérifiez les passages en orange dans l'éditeur.</span>
                                </div>
                            )}
                        </>
                    );
                })()}

                {quotaError && (
                    <div className="flex items-center justify-between gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-2 text-xs text-orange-800">
                            <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                            <span>Quota Make dépassé — réessayez dans quelques minutes.</span>
                        </div>
                        <button
                            onClick={() => { setQuotaError(null); quotaError === 'fix' ? runAutoFix() : runAnalysis(); }}
                            className="flex items-center gap-1.5 bg-orange-100 hover:bg-orange-200 text-orange-800 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
                        >
                            <RefreshCw className="h-3 w-3" />
                            Réessayer
                        </button>
                    </div>
                )}

                {error && <ErrorModal message={error} onClose={() => setError(null)} />}
            </div>
        </div>
    );
};
