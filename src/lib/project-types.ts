export interface Project {
  id: string;
  full_name: string;
  name: string;
  description: string;
  html_url: string;
  stars: number;
  language: string | null;
  topics: string[];
  category: string;
  updated_at: string;
}

export interface EmbeddingIndex {
  metadata: {
    model: string;
    dimension: number;
    total_chunks: number;
    generated_at: string;
  };
  chunks: EmbeddingChunk[];
}

export interface EmbeddingChunk {
  id: string;
  repo_full_name: string;
  category: string;
  section_title: string;
  chunk_index: number;
  text: string;
  embedding: number[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  projects?: Project[];
  suggestions?: string[];
  options?: string[];
  failed?: boolean;
  timestamp: number;
}

export interface CategoryInfo {
  name: string;
  emoji: string;
  label: string;
  description: string;
  projectCount: number;
}

export interface ProjectsRequestBody {
  question: string;
  history: ChatMessage[];
  mode?: 'guided' | 'assistant';
  category?: string;
}
