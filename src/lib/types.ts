// Base types
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at?: string;
}

// Document types
export interface Document extends BaseEntity {
  folder_id: string;
  name: string;
  type: string;
  group_name?: string;
  description?: string;
  url: string;
  processed: boolean;
  size?: number;
}

export interface Folder extends BaseEntity {
  name: string;
  parent_id: string | null;
}

// Conversation types
export interface Conversation extends BaseEntity {
  user_id: string;
  title: string;
}

export interface Message extends BaseEntity {
  conversation_id: string;
  sender: 'user' | 'assistant';
  content: string;
}

export interface ConversationDocument extends BaseEntity {
  conversation_id: string;
  document_id: string;
  documents: Document;
}

// Processing types
export interface ProcessingProgress {
  stage: 'preparation' | 'processing' | 'extraction' | 'complete' | 'upload';
  progress: number;
  message: string;
  canCancel?: boolean;
}

export interface ProcessingOptions {
  onProgress?: (progress: ProcessingProgress) => void;
  signal?: AbortSignal;
  openaiApiKey?: string;
}

export interface ProcessingResult {
  content: string;
  metadata: DocumentMetadata;
}

export interface DocumentMetadata {
  title?: string;
  language?: string;
  timestamp: string;
  wordCount?: number;
  hasImages?: boolean;
  url?: string;
  fileType?: string;
  fileName?: string;
  size?: number;
}

// Streaming types
export interface StreamingOptions {
  maxChunkSize?: number;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

// Modal types
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface ModalState<T = any> {
  isOpen: boolean;
  data: T | null;
}

// Store types
export interface StoreState {
  loading: boolean;
  error: string | null;
}

// Error types
export interface ErrorContext {
  component?: string;
  action?: string;
  timestamp?: string;
  [key: string]: any;
}

// User types
export interface Profile extends BaseEntity {
  email: string;
  role: 'super_admin' | 'g_admin' | 'admin' | 'user';
  status: boolean;
}

// Report types
export interface ReportTemplate extends BaseEntity {
  name: string;
  description?: string;
  icon: string;
  type: string;
  prompt: string;
  structure?: {
    sections: Array<{
      title: string;
      required: boolean;
    }>;
  };
  is_active: boolean;
}

export interface ReportType extends BaseEntity {
  name: string;
  description?: string;
  order: number;
  is_active: boolean;
}