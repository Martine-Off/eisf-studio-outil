import React, { useState } from 'react';
import api from '../utils/api'; 

interface ProjectMacroAnalysisProps {
  projectId: string;
  initialScore?: number | null;
  initialObservations?: string[] | null;
}

export default function ProjectMacroAnalysis({ 
  projectId, 
  initialScore = null, 
  initialObservations = [] 
}: ProjectMacroAnalysisProps) {
  const [score, setScore] = useState<number | null>(initialScore);
  const [observations, setObservations] = useState<string[]>(initialObservations || []);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleMacroVerify = async () => {
    setIsAnalyzing(true);
    try {
      const response = await api.post(`/projects/${projectId}/macro-verify`);
      setScore(response.data.macro_score ?? response.data.score);
      
      let parsedObservations = [];
      if (response.data.macro_feedback) {
        if (typeof response.data.macro_feedback === 'string') {
          parsedObservations = JSON.parse(response.data.macro_feedback);
        } else {
          // Si c'est déjà un objet
          parsedObservations = response.data.macro_feedback.suggestions || [];
        }
      } else if (response.data.observations) {
        parsedObservations = response.data.observations;
      }
      setObservations(parsedObservations);
    } catch (error) {
      console.error('Erreur Macro-Analyse:', error);
      alert("Erreur lors de l'analyse globale du projet. (La route /api/projects/:id/macro-verify n'existe peut-être pas encore !)");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Couleur dynamique pour la note
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-400';
    if (s >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-slate-900 rounded-2xl shadow-lg p-6 mb-8 text-white border border-slate-700">
      <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
        
        {/* Colonne de Gauche : Bouton / Score */}
        <div className="flex flex-col items-center justify-center min-w-[200px] border-b md:border-b-0 md:border-r border-slate-700 pb-6 md:pb-0 md:pr-8">
          <h2 className="text-xl font-bold mb-4 text-slate-200 text-center">Fidélité Globale</h2>
          
          {score === null && !isAnalyzing ? (
            <button 
              onClick={handleMacroVerify}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-xl transition shadow-lg shadow-indigo-900/50"
            >
              🚀 Analyser le cours
            </button>
          ) : isAnalyzing ? (
            <div className="animate-pulse flex flex-col items-center">
              <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-indigo-300 font-medium">Lecture des épisodes...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span className={`text-6xl font-extrabold ${getScoreColor(score!)} drop-shadow-md`}>
                {score}%
              </span>
              <button 
                onClick={handleMacroVerify}
                className="mt-4 text-sm text-slate-400 hover:text-white underline"
              >
                🔄 Mettre à jour l'analyse
              </button>
            </div>
          )}
        </div>

        {/* Colonne de Droite : Observations */}
        <div className="flex-1 w-full">
          <h3 className="text-lg font-semibold text-slate-300 mb-3 flex items-center gap-2">
            💡 Observations de l'IA
          </h3>
          
          {score === null && !isAnalyzing && (
            <p className="text-slate-500 italic">
              Lancez l'analyse pour vérifier si tous les concepts clés du document original sont bien couverts par la suite d'épisodes.
            </p>
          )}

          {isAnalyzing && (
            <div className="space-y-3">
              <div className="h-4 bg-slate-800 rounded w-3/4 animate-pulse"></div>
              <div className="h-4 bg-slate-800 rounded w-full animate-pulse"></div>
              <div className="h-4 bg-slate-800 rounded w-5/6 animate-pulse"></div>
            </div>
          )}

          {score !== null && !isAnalyzing && (
            <ul className="space-y-3">
              {observations.length > 0 ? (
                observations.map((obs, idx) => (
                  <li key={idx} className="flex items-start gap-3 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                    <span className="text-indigo-400 mt-1">⚬</span>
                    <span className="text-slate-200 leading-relaxed">{obs}</span>
                  </li>
                ))
              ) : (
                <li className="text-green-400 font-medium">Aucune remarque particulière, le cours semble parfaitement couvert !</li>
              )}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}
