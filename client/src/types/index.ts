export interface IAFeedback {
  concepts_manquants: string[];
  informations_erronees: string[];
  suggestions: string[];
}

export interface Podcast {
  id: number;
  project_id: number;
  title: string;
  order_index?: number;
  word_count?: number;
  duration_seconds?: number;
  fidelity_score?: number | null;
  ia_feedback?: IAFeedback | null;
  audio_url?: string | null;
  created_at?: string;
}

export interface Project {
  id: number;
  user_id?: number;
  title: string;
  status?: string;
  source_file_path?: string;
  cleaned_text?: string;
  macro_score?: number | null;
  macro_feedback?: string[] | null;
  created_at?: string;
  updated_at?: string;
  podcast_count?: number;
}
