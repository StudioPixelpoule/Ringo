import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import mammoth from 'mammoth';

// Types communs
export interface ProcessingResult {
  content: string;
  metadata: {
    title?: string;
    author?: string;
    date?: string;
    language?: string;
    duration?: number;
    fileType: string;
    fileName: string;
    pageCount?: number;
    segments?: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  };
  structure?: {
    title?: string;
    abstract?: string;
    sections: Array<{
      heading?: string;
      content: string;
      pageNumber?: number;
    }>;
  };
  confidence: number;
  processingDate: string;
}

interface ProcessingProgress {
  stage: 'upload' | 'processing' | 'complete';
  progress: number;
  message: string;
  canCancel?: boolean;
}

// Utilitaires
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\n\r]+/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function detectLanguage(text: string): string {
  const frenchPattern = /^(le|la|les|un|une|des|je|tu|il|elle|nous|vous|ils|elles|et|ou|mais|donc)\s/i;
  return frenchPattern.test(text) ? 'fra' : 'eng';
}

// Traitement des fichiers audio
async function processAudioFile(
  file: File,
  apiKey: string,
  onProgress?: (progress: ProcessingProgress) => void,
  signal?: AbortSignal
): Promise<ProcessingResult> {
  if (signal?.aborted) {
    throw new Error('Traitement annulé');
  }

  onProgress?.({
    stage: 'processing',
    progress: 10,
    message: 'Préparation du fichier audio...',
    canCancel: true
  });

  const formData = new FormData();
  formData.append('file', file);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');

  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
      signal
    });

    if (!response.ok) {
      throw new Error(`Échec de la transcription: ${response.statusText}`);
    }

    const result = await response.json();

    onProgress?.({
      stage: 'processing',
      progress: 90,
      message: 'Finalisation de la transcription...',
      canCancel: true
    });

    return {
      content: result.text,
      metadata: {
        title: file.name.replace(/\.[^/.]+$/, ''),
        duration: result.duration,
        language: detectLanguage(result.text),
        fileType: file.type,
        fileName: file.name,
        segments: result.segments.map((s: any) => ({
          start: Number(s.start) || 0,
          end: Number(s.end) || 0,
          text: String(s.text || '').trim()
        }))
      },
      confidence: 0.95,
      processingDate: new Date().toISOString()
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Traitement annulé');
    }
    throw error;
  }
}

// Traitement des documents PDF
async function processPDFDocument(
  file: File,
  onProgress?: (progress: ProcessingProgress) => void,
  signal?: AbortSignal
): Promise<ProcessingResult> {
  if (signal?.aborted) {
    throw new Error('Traitement annulé');
  }

  onProgress?.({
    stage: 'processing',
    progress: 10,
    message: 'Analyse du document PDF...',
    canCancel: true
  });

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const metadata = await pdf.getMetadata();

  const pages: Array<{
    text: string;
    structure: {
      headings: string[];
      paragraphs: string[];
    };
  }> = [];

  let totalConfidence = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    if (signal?.aborted) {
      throw new Error('Traitement annulé');
    }

    onProgress?.({
      stage: 'processing',
      progress: 10 + (i / pdf.numPages) * 80,
      message: `Traitement de la page ${i}/${pdf.numPages}...`,
      canCancel: true
    });

    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let pageText = '';
    const structure = {
      headings: [] as string[],
      paragraphs: [] as string[]
    };

    for (const item of content.items as any[]) {
      const text = item.str.trim();
      if (!text) continue;

      // Détection des titres
      if (
        item.fontName?.toLowerCase().includes('bold') ||
        item.fontSize > 12 ||
        /^[A-Z0-9\s]{10,}$/.test(text)
      ) {
        structure.headings.push(text);
      } else {
        structure.paragraphs.push(text);
      }

      pageText += text + ' ';
    }

    // OCR si peu de texte détecté
    if (pageText.length < 100) {
      const scale = 2.0;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport,
        }).promise;

        const worker = await createWorker();
        const lang = detectLanguage(pageText);
        await worker.loadLanguage(lang);
        await worker.initialize(lang);

        const { data } = await worker.recognize(canvas);
        await worker.terminate();

        if (data.text.length > pageText.length) {
          pageText = cleanText(data.text);
          totalConfidence += data.confidence / 100;
        } else {
          totalConfidence += 1;
        }
      }
    } else {
      totalConfidence += 1;
    }

    pages.push({
      text: cleanText(pageText),
      structure
    });
  }

  onProgress?.({
    stage: 'processing',
    progress: 90,
    message: 'Finalisation du traitement...',
    canCancel: true
  });

  // Extraction de la structure globale
  const sections = pages.flatMap((page, index) => {
    return page.structure.headings.map((heading, i) => ({
      heading,
      content: page.structure.paragraphs[i] || '',
      pageNumber: index + 1
    }));
  });

  return {
    content: pages.map(p => p.text).join('\n\n'),
    metadata: {
      title: metadata.info?.Title || sections[0]?.heading,
      author: metadata.info?.Author,
      date: metadata.info?.CreationDate,
      language: detectLanguage(pages[0]?.text || ''),
      fileType: file.type,
      fileName: file.name,
      pageCount: pdf.numPages
    },
    structure: {
      title: sections[0]?.heading,
      abstract: pages[0]?.structure.paragraphs[0],
      sections
    },
    confidence: totalConfidence / pdf.numPages,
    processingDate: new Date().toISOString()
  };
}

// Traitement des documents Word
async function processWordDocument(
  file: File,
  onProgress?: (progress: ProcessingProgress) => void,
  signal?: AbortSignal
): Promise<ProcessingResult> {
  if (signal?.aborted) {
    throw new Error('Traitement annulé');
  }

  onProgress?.({
    stage: 'processing',
    progress: 30,
    message: 'Extraction du contenu Word...',
    canCancel: true
  });

  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = cleanText(result.value);

  // Analyse de la structure
  const lines = text.split('\n');
  const sections: Array<{
    heading?: string;
    content: string;
  }> = [];

  let currentSection = { content: '' };
  let abstract = '';

  lines.forEach(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    if (
      trimmedLine.toUpperCase() === trimmedLine ||
      /^\d+[.\s]/.test(trimmedLine)
    ) {
      if (currentSection.content) {
        sections.push({ ...currentSection });
      }
      currentSection = {
        heading: trimmedLine,
        content: ''
      };
    } else {
      if (!abstract && !currentSection.heading) {
        abstract = trimmedLine;
      } else {
        currentSection.content += (currentSection.content ? '\n' : '') + trimmedLine;
      }
    }
  });

  if (currentSection.content) {
    sections.push(currentSection);
  }

  return {
    content: text,
    metadata: {
      title: sections[0]?.heading,
      fileType: file.type,
      fileName: file.name,
      language: detectLanguage(text)
    },
    structure: {
      title: sections[0]?.heading,
      abstract,
      sections
    },
    confidence: 1,
    processingDate: new Date().toISOString()
  };
}

// Fonction principale de traitement
export async function processDocument(
  file: File,
  options: {
    openaiApiKey?: string;
    onProgress?: (progress: ProcessingProgress) => void;
    signal?: AbortSignal;
  } = {}
): Promise<ProcessingResult> {
  const { openaiApiKey, onProgress, signal } = options;

  try {
    // Validation du type de fichier
    const fileType = file.type.toLowerCase();
    
    // Traitement audio
    if (fileType.startsWith('audio/')) {
      if (!openaiApiKey) {
        throw new Error('Clé API OpenAI requise pour le traitement audio');
      }
      return await processAudioFile(file, openaiApiKey, onProgress, signal);
    }
    
    // Traitement PDF
    if (fileType === 'application/pdf') {
      return await processPDFDocument(file, onProgress, signal);
    }
    
    // Traitement Word
    if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileType === 'application/msword'
    ) {
      return await processWordDocument(file, onProgress, signal);
    }

    throw new Error(`Type de fichier non supporté: ${fileType}`);
  } catch (error) {
    console.error('[Universal Processor] Erreur:', error);
    throw error;
  }
}