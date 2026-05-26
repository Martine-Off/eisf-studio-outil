// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
import React, { useState } from 'react';
import { Upload, CheckCircle2, Loader2 } from 'lucide-react';

interface WordImportProps {
  onFileReady: (file: File) => void;
  onError: (message: string) => void;
}

export const WordImport: React.FC<WordImportProps> = ({ onFileReady, onError }) => {
  const [step, setStep] = useState<'idle' | 'validating' | 'ready'>('idle');
  const [fileName, setFileName] = useState('');

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.docx') && !file.name.toLowerCase().endsWith('.doc')) {
      onError('Seuls les fichiers .docx sont acceptés.');
      return;
    }

    setStep('validating');
    setFileName(file.name);

    setTimeout(() => {
      setStep('ready');
      onFileReady(file);
    }, 400);
  };

  if (step === 'idle') {
    return (
      <div className="relative">
        <input
          type="file"
          accept=".docx,.doc"
          onChange={handleFileUpload}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          id="word-upload-input"
        />
        <label
          htmlFor="word-upload-input"
          className="flex flex-col items-center justify-center w-full p-8 border-2 border-dashed border-eisf-blue/30 rounded-2xl bg-eisf-beige-light hover:bg-eisf-beige/50 transition-all cursor-pointer group"
        >
          <Upload className="w-12 h-12 text-eisf-blue mb-4 group-hover:scale-110 transition-transform" />
          <p className="text-lg font-semibold text-eisf-blue">Importer un fichier Word (.docx)</p>
          <p className="text-sm text-muted-foreground mt-1">Glissez-déposez ou cliquez pour parcourir</p>
          <p className="text-xs text-muted-foreground/60 mt-2">Conversion Markdown automatique · Chapitres détectés côté serveur</p>
        </label>
      </div>
    );
  }

  return (
    <div className="w-full mt-6 animate-fade-in">
      <div className="bg-white p-6 rounded-2xl shadow-eisf border border-eisf-blue/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {step === 'validating' ? (
              <Loader2 className="w-5 h-5 text-eisf-blue animate-spin" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            )}
            <span className="font-semibold text-eisf-blue">
              {step === 'validating' ? 'Validation...' : `✅ ${fileName}`}
            </span>
          </div>
          <span className="text-xs text-muted-foreground/60">
            {step === 'ready' ? 'Prêt · conversion Markdown au chargement' : ''}
          </span>
        </div>

        <div className="w-full h-3 bg-eisf-beige rounded-full overflow-hidden">
          <div
            className="h-full bg-eisf-blue transition-all duration-500 ease-out shadow-[0_0_8px_rgba(52,101,174,0.4)]"
            style={{ width: step === 'ready' ? '100%' : '50%' }}
          />
        </div>

        <div className="mt-4 flex justify-between text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60">
          <span>Sélection</span>
          <span>Validation</span>
          <span>Word → Markdown</span>
          <span>Chapitres</span>
        </div>
      </div>
    </div>
  );
};

export default WordImport;
