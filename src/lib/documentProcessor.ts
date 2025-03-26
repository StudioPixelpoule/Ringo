import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import mammoth from 'mammoth';
import sharp from 'sharp';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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

// Optimisation d'image pour OCR
async function optimizeImageForOCR(imageData: ImageData): Promise<Buffer> {
  try {
    const buffer = Buffer.from(imageData.data);
    return await sharp(buffer, {
      raw: {
        width: imageData.width,
        height: imageData.height,
        channels: 4
      }
    })
    .greyscale() // Convert to grayscale
    .normalize() // Normalize contrast
    .sharpen() // Enhance edges
    .threshold(128) // Binarize image
    .toBuffer();
  } catch (error) {
    console.error('Image optimization failed:', error);
    return Buffer.from(imageData.data);
  }
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

  // Validate file type
  const validTypes = [
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 
    'audio/x-wav', 'audio/aac', 'audio/ogg', 'audio/webm'
  ];

  if (!validTypes.includes(file.type)) {
    throw new Error(`Type de fichier audio non supporté: ${file.type}`);
  }

  // Validate file size (25MB limit for Whisper API)
  if (file.size > 25 * 1024 * 1024) {
    throw new Error('Le fichier audio ne doit pas dépasser 25MB');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('language', 'fr');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`Échec de la transcription: ${error.error || response.statusText}`);
    }

    const result = await response.json();

    if (!result.text || !Array.isArray(result.segments)) {
      throw new Error('Format de réponse invalide de l\'API Whisper');
    }

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
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('La transcription a pris trop de temps');
      }
      throw new Error(`Échec de la transcription: ${error.message}`);
    }
    throw new Error('Une erreur inattendue est survenue lors de la transcription');
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
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    useWorkerFetch: true,
    isEvalSupported: true,
    useSystemFonts: true
  }).promise;
  
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

    // Extract text content
    for (const item of content.items as any[]) {
      const text = item.str.trim();
      if (!text) continue;

      // Improved heading detection
      const isHeading = 
        item.fontName?.toLowerCase().includes('bold') ||
        item.fontSize > 12 ||
        /^[A-Z0-9\s]{10,}$/.test(text) ||
        /^[\d.]+\s+[A-Z]/.test(text) || // Numbered headings
        text.length < 50 && text.toUpperCase() === text; // Short all-caps lines

      if (isHeading) {
        structure.headings.push(text);
      } else {
        structure.paragraphs.push(text);
      }

      pageText += text + ' ';
    }

    // Perform OCR if needed
    if (pageText.length < 200 || /image|figure|tableau/i.test(pageText)) {
      try {
        const scale = 2.0; // Higher resolution for better OCR
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', {
          willReadFrequently: true,
          alpha: false
        });

        if (context) {
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          // Clear canvas with white background
          context.fillStyle = 'white';
          context.fillRect(0, 0, canvas.width, canvas.height);

          // Render PDF page
          await page.render({
            canvasContext: context,
            viewport,
            background: 'white'
          }).promise;

          // Get image data and optimize for OCR
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const optimizedBuffer = await optimizeImageForOCR(imageData);

          // Perform OCR
          const worker = await createWorker();
          await worker.loadLanguage('fra+eng');
          await worker.initialize('fra+eng');
          const { data: ocrResult } = await worker.recognize(optimizedBuffer);
          await worker.terminate();

          if (ocrResult.text.length > pageText.length * 0.5) {
            const cleanedOCRText = cleanText(ocrResult.text);
            
            // Merge OCR text with existing text
            const combinedText = new Set([
              ...pageText.split(/[.!?]+/).map(s => s.trim()),
              ...cleanedOCRText.split(/[.!?]+/).map(s => s.trim())
            ]);
            
            pageText = Array.from(combinedText)
              .filter(s => s.length > 10) // Remove fragments
              .join('. ');
            
            totalConfidence += ocrResult.confidence / 100;
          } else {
            totalConfidence += pageText.length > 0 ? 1 : 0.5;
          }
        }
      } catch (ocrError) {
        console.warn(`OCR failed for page ${i}:`, ocrError);
        totalConfidence += pageText.length > 0 ? 0.7 : 0.3;
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

  // Improved structure extraction
  const sections = pages.flatMap((page, index) => {
    const sections: Array<{
      heading?: string;
      content: string;
      pageNumber: number;
    }> = [];

    let currentHeading = '';
    let currentContent: string[] = [];

    // Process headings and content
    page.structure.headings.forEach((heading, i) => {
      if (currentHeading) {
        sections.push({
          heading: currentHeading,
          content: currentContent.join('\n'),
          pageNumber: index + 1
        });
      }
      currentHeading = heading;
      currentContent = [page.structure.paragraphs[i] || ''];
    });

    // Add remaining content
    if (currentHeading || currentContent.length > 0) {
      sections.push({
        heading: currentHeading,
        content: currentContent.join('\n'),
        pageNumber: index + 1
      });
    }

    return sections;
  });

  // Calculate final confidence score
  const confidence = Math.min(1, totalConfidence / pdf.numPages);

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
    confidence,
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