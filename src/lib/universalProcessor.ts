import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import mammoth from 'mammoth';
import { processAudioFile } from './audioProcessor';

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
async function optimizeImageForOCR(imageData: ImageData): Promise<ImageData> {
  const { width, height, data } = imageData;
  const newData = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < data.length; i += 4) {
    // Convert to grayscale using luminance formula
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

    // Apply threshold for binarization
    const value = gray > 128 ? 255 : 0;

    // Set RGBA values
    newData[i] = value;     // R
    newData[i + 1] = value; // G
    newData[i + 2] = value; // B
    newData[i + 3] = 255;   // A
  }

  return new ImageData(newData, width, height);
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
          const optimizedImageData = await optimizeImageForOCR(imageData);
          
          // Put optimized image data back to canvas
          const optimizedCanvas = document.createElement('canvas');
          optimizedCanvas.width = imageData.width;
          optimizedCanvas.height = imageData.height;
          const optimizedContext = optimizedCanvas.getContext('2d');
          
          if (optimizedContext) {
            optimizedContext.putImageData(optimizedImageData, 0, 0);

            // Perform OCR
            const worker = await createWorker();
            await worker.loadLanguage('fra+eng');
            await worker.initialize('fra+eng');
            const { data: ocrResult } = await worker.recognize(optimizedCanvas);
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