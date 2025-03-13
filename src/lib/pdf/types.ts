// Types communs pour le traitement PDF
export interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
  pageCount?: number;
}

export interface PDFPage {
  pageNumber: number;
  text: string;
  structure: {
    title?: string;
    headings: string[];
    paragraphs: string[];
    lists: string[][];
    tables: string[][];
  };
  confidence: number;
}

export interface ProcessedPDF {
  metadata: PDFMetadata;
  pages: PDFPage[];
  text: string;
  structure: {
    title?: string;
    abstract?: string;
    sections: {
      heading?: string;
      content: string;
    }[];
  };
  confidence: number;
  processingDate: string;
}

export interface ProcessingProgress {
  stage: 'preparation' | 'processing' | 'extraction' | 'complete';
  progress: number;
  message: string;
  canCancel?: boolean;
}