import React, { useState } from 'react';
import api from '../utils/api';

interface VerificationResult {
    concepts_manquants: string[];
    informations_erronees: string[];
    suggestions?: string[];
}

interface AutoFixResult {
    finalScore: number;
    targetReached: boolean;
    iterations: number;
    history: { iteration: number; score: number; missingCount: number }[];
    remainingConcepts: string[];
    remainingFacts: string[];
}

interface AIVerificationPanelProps {
    podcastId: string | number;
    onCorrectionDone?: () => void;
}

function ScoreBadge({ score }: { score: number }) {
    const color =
        score >= 95 ? 'bg-green-100 text-green-800 border-green-200' :
        score >= 70 ? 'bg-orange-100 text-orange-800 border-orange-200' :
                      'bg-red-100 text-red-800 border-red-200';
    const label =
        score >= 95 ? 'Excellent' :
        score >= 70 ? 'Acceptable' : 'A corriger';
    return (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-2xl ${color}`}>
            {score}%
            <span className="text-sm font-normal">{label}</span>
        </div>
    );
}

export const AIVerificationPanel: React.FC<AIVerificationPanelProps> = ({
    podcastId,
    onCorrectionDone,
}) => {
    const [feedback, setFeedback] = useState<VerificationResult | null>(null);
    const [score, setScore] = useState<number | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isAutoFixing, setIsAutoFixing] = useState(false);
    const [autoFixResult, setAutoFixResult] = useState<AutoFixResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<string>('');

    // Étape 1 : vérification simple
    const runAnalysis = async () => {
        setIsAnalyzing(true);
        setError(null);
        setAutoFixResult(null);
        setProgress('Analyse du script en cours...');
        try {
            const res = await api.post(`/podcasts/${podcastId}/verify`);
            const data = res.data;
            setFeedback(data.ia_feedback);
            setScore(data.fidelity_score ?? null);
        } catch (err) {
            setError("Impossible de joindre le serveur de vérification.");
            console.error(err);
        } finally {
            setIsAnalyzing(false);
            setProgress('');
        }
    };

    // Étape 2 : boucle auto jusqu'à 95%
    const runAutoFix = async () => {
        setIsAutoFixing(true);
        setError(null);
        setProgress('Lancement de la correction automatique (jusqu\'à 4 passes)...');
        try {
            const res = await api.post('/ai/auto-verify-and-fix', { podcastId: Number(podcastId) }, {
                timeout: 300000, // 5 min max
            });
            const data: AutoFixResult = res.data;
            setAutoFixResult(data);
            setScore(data.finalScore);
            setFeedback(null); // Rafraîchir l'affichage
            if (onCorrectionDone) onCorrectionDone();
        } catch (err) {
            setError("Erreur lors de la correction automatique.");
            console.error(err);
        } finally {
            setIsAutoFixing(false);
            setProgress('');
        }
    };

    const isLoading = isAnalyzing || isAutoFixing;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col gap-5">

            {/* En-tête */}
            <div className="flex justify-between items-start border-b pb-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-800">Verification IA</h3>
                    <p className="text-xs text-gray-400 mt-1">
                        Compare le script genere au cours source et corrige automatiquement.
                    </p>
                </div>
                {score !== null && <ScoreBadge score={score} />}
            </div>

            {/* Etat initial */}
            {!feedback && !autoFixResult && !isLoading && (
                <div className="text-center py-4 flex flex-col gap-3">
                    <p className="text-gray-500 text-sm">Le script n'a pas encore ete analyse.</p>
                    <div className="flex gap-3 justify-center flex-wrap">
                        <button
                            onClick={runAnalysis}
                            className="px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition text-sm"
                        >
                            Analyser le script
                        </button>
                        <button
                            onClick={runAutoFix}
                            className="px-5 py-2 bg-[#E63337] text-white rounded-lg font-semibold hover:bg-red-700 transition text-sm"
                        >
                            Corriger automatiquement jusqu'a 95%
                        </button>
                    </div>
                </div>
            )}

            {/* Chargement */}
            {isLoading && (
                <div className="text-center py-8 flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-blue-700 font-semibold">{progress || 'Traitement en cours...'}</p>
                    <p className="text-gray-400 text-xs">Ne fermez pas cette fenetre.</p>
                </div>
            )}

            {/* Résultat analyse simple */}
            {feedback && !isLoading && (
                <div className="flex flex-col gap-4">
                    <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
                        <h4 className="font-bold text-orange-800 mb-2">
                            Concepts manquants ({feedback.concepts_manquants?.length || 0})
                        </h4>
                        {feedback.concepts_manquants?.length > 0 ? (
                            <ul className="list-disc list-inside text-sm text-orange-900 space-y-1 max-h-48 overflow-y-auto">
                                {feedback.concepts_manquants.map((c, i) => <li key={i}>{c}</li>)}
                            </ul>
                        ) : (
                            <p className="text-sm text-green-700 font-medium">Aucun concept manquant.</p>
                        )}
                    </div>

                    {feedback.informations_erronees?.length > 0 && (
                        <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                            <h4 className="font-bold text-red-800 mb-2">
                                Informations erronees ({feedback.informations_erronees.length})
                            </h4>
                            <ul className="list-disc list-inside text-sm text-red-900 space-y-1 max-h-40 overflow-y-auto">
                                {feedback.informations_erronees.map((e, i) => <li key={i}>{e}</li>)}
                            </ul>
                        </div>
                    )}

                    <button
                        onClick={runAutoFix}
                        className="w-full py-3 bg-[#E63337] text-white rounded-xl font-bold text-base hover:bg-red-700 transition"
                    >
                        Corriger automatiquement jusqu'a 95% →
                    </button>

                    <button onClick={runAnalysis} className="text-xs text-gray-400 hover:text-gray-600 underline self-center">
                        Relancer l'analyse
                    </button>
                </div>
            )}

            {/* Résultat correction automatique */}
            {autoFixResult && !isLoading && (
                <div className="flex flex-col gap-4">
                    <div className={`rounded-xl p-4 border text-center ${autoFixResult.targetReached ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
                        <p className={`font-bold text-lg ${autoFixResult.targetReached ? 'text-green-800' : 'text-orange-800'}`}>
                            {autoFixResult.targetReached
                                ? `Script valide — ${autoFixResult.finalScore}% de fidelite`
                                : `Score final : ${autoFixResult.finalScore}% (${autoFixResult.iterations} passe(s))`}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                            {autoFixResult.targetReached
                                ? 'Le contenu du cours est correctement retranscrit.'
                                : 'Correction partielle — voir les points restants ci-dessous.'}
                        </p>
                    </div>

                    {/* Concepts encore manquants → à corriger manuellement */}
                    {!autoFixResult.targetReached && autoFixResult.remainingConcepts?.length > 0 && (
                        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                            <p className="font-bold text-orange-800 mb-2 text-sm">
                                À ajouter manuellement ({autoFixResult.remainingConcepts.length} concept{autoFixResult.remainingConcepts.length > 1 ? 's' : ''}) :
                            </p>
                            <ul className="list-disc list-inside text-sm text-orange-900 space-y-1 max-h-48 overflow-y-auto">
                                {autoFixResult.remainingConcepts.map((c, i) => (
                                    <li key={i}>{c}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {!autoFixResult.targetReached && autoFixResult.remainingFacts?.length > 0 && (
                        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                            <p className="font-bold text-red-800 mb-2 text-sm">
                                Faits à vérifier ({autoFixResult.remainingFacts.length}) :
                            </p>
                            <ul className="list-disc list-inside text-sm text-red-900 space-y-1 max-h-32 overflow-y-auto">
                                {autoFixResult.remainingFacts.map((f, i) => (
                                    <li key={i}>{f}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="text-xs text-gray-400 space-y-1">
                        <p className="font-semibold text-gray-500">Detail des passes :</p>
                        {autoFixResult.history.map(h => (
                            <div key={h.iteration} className="flex justify-between">
                                <span>Passe {h.iteration}</span>
                                <span>{h.score}% — {h.missingCount >= 0 ? `${h.missingCount} concept(s)` : 'erreur'}</span>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={runAutoFix}
                        disabled={isAutoFixing}
                        className="text-xs text-gray-400 hover:text-gray-600 underline self-center disabled:opacity-50"
                    >
                        Relancer une correction
                    </button>
                </div>
            )}

            {error && <p className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg">{error}</p>}
        </div>
    );
};
