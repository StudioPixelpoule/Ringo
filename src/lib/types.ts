export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  user_id: string;
  folder: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  role: 'admin' | 'user';
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  conversation_id: string;
}

export interface Conversation {
  id: string;
  title: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentContent {
  id: string;
  document_id: string;
  content: string;
  extraction_status: 'pending' | 'processing' | 'success' | 'failed' | 'partial' | 'manual';
  created_at: string;
  updated_at: string;
}

export interface DocumentAnalysis {
  id: string;
  document_name: string;
  analysis_data: {
    entities: Array<{
      text: string;
      type: string;
      relevance: number;
    }>;
    concepts: Array<{
      text: string;
      relevance: number;
    }>;
    themes: Array<{
      text: string;
      relevance: number;
    }>;
    keywords: Array<{
      text: string;
      relevance: number;
    }>;
    summary: string;
  };
  created_at: string;
}

export interface DocumentEmbedding {
  id: string;
  document_id: string;
  embedding: number[];
  created_at: string;
}