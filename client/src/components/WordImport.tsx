import React, { useState } from 'react';
import mammoth from 'mammoth';
import { Upload, CheckCircle2, Loader2 } from 'lucide-react';

interface ParseProgress {
  step: string;
  percent: number;
}

interface WordImportProps {
  onImportComplete: (text: string) => void;
  onError: (message: string) => void;
}

export const WordImport: React.FC<WordImportProps> = ({ onImportComplete, onError }) => {
  const [parseProgress, setParseProgress] = useState<ParseProgress>({ step: '', percent: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.docx')) {
      onError('Seuls les fichiers .docx sont acceptés.');
      return;
    }

    setIsProcessing(true);
    setParseProgress({ step: 'Lecture du fichier...', percent: 20 });

    try {
      const reader = new FileReader();
      
      const fileData = await new Promise<ArrayBuffer>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
        reader.readAsArrayBuffer(file);
      });

      // Simulation légère pour l'effet visuel de progression
      await new Promise(r => setTimeout(r, 500));
      setParseProgress({ step: 'Extraction du texte...', percent: 50 });

      const result = await mammoth.extractRawText({ arrayBuffer: fileData });
      const rawText = result.value;

      await new Promise(r => setTimeout(r, 500));
      setParseProgress({ step: 'Détection des chapitres...', percent: 75 });
      
      // Ici on pourrait ajouter une logique de prétraitement si nécessaire
      // Pour l'instant on suit le workflow demandé

      await new Promise(r => setTimeout(r, 500));
      setParseProgress({ step: 'Sauvegarde...', percent: 90 });

      // On simule la fin de l'appel API ou traitement
      await new Promise(r => setTimeout(r, 500));
      setParseProgress({ step: '✅ Terminé !', percent: 100 });

      setTimeout(() => {
        onImportComplete(rawText);
        setIsProcessing(false);
        setParseProgress({ step: '', percent: 0 });
      }, 500);

    } catch (err: any) {
      console.error('Erreur lors de l\'import Word:', err);
      onError('Erreur lors de l\'extraction du contenu Word.');
      setIsProcessing(false);
      setParseProgress({ step: '', percent: 0 });
    }
  };

  if (!isProcessing && parseProgress.percent === 0) {
    return (
      <div className="relative">
        <input
          type="file"
          accept=".docx"
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
        </label>
      </div>
    );
  }

  return (
    <div className="w-full mt-6 animate-fade-in">
      <div className="bg-white p-6 rounded-2xl shadow-eisf border border-eisf-blue/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {parseProgress.percent < 100 ? (
              <Loader2 className="w-5 h-5 text-eisf-blue animate-spin" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            )}
            <span className="font-semibold text-eisf-blue">{parseProgress.step}</span>
          </div>
          <span className="text-sm font-bold text-eisf-blue">{parseProgress.percent}%</span>
        </div>
        
        <div className="w-full h-3 bg-eisf-beige rounded-full overflow-hidden">
          <div 
            className="h-full bg-eisf-blue transition-all duration-500 ease-out shadow-[0_0_8px_rgba(52,101,174,0.4)]"
            style={{ width: `${parseProgress.percent}%` }}
          />
        </div>

        <div className="mt-4 flex justify-between text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60">
          <span>Lecture</span>
          <span>Extraction</span>
          <span>Analyse</span>
          <span>Finalisation</span>
        </div>
      </div>
    </div>
  );
};

export default WordImport;
