// 1. On définit la structure exacte que l'IA devra nous renvoyer
export interface IAFeedback {
  concepts_manquants: string[];
  informations_erronees: string[];
  suggestions: string[];
}

// 2. On met à jour l'interface du Podcast (l'épisode de 4-7 min)
export interface Podcast {
  id: string; // ou number selon ta BDD
  project_id: string;
  title: string;
  script_content: any; // La structure JSON de tes blocs Dnd-kit (Inès/Yannick)
  word_count: number;
  duration_minutes: number;
  
  // Nouvelles colonnes ajoutées pour la V2
  ia_feedback?: IAFeedback | null;
  audio_url?: string | null;
}

// 3. On met à jour l'interface du Projet (le cours global)
export interface Project {
  id: string;
  title: string;
  original_docx_path: string;
  
  // Nouvelles colonnes pour la macro-analyse
  macro_score?: number | null;
  macro_feedback?: any | null;
}
