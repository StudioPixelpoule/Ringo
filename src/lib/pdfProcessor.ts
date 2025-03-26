import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import { logError } from './errorLogger';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface ProcessingProgress {
  stage: 'preparation' | 'processing' | 'extraction' | 'complete';
  progress: number;
  message: string;
}

interface ProcessingOptions {
  onProgress?: (progress: ProcessingProgress) => void;
  signal?: AbortSignal;
}

// Detect if text content is meaningful
function isTextMeaningful(text: string): boolean {
  // Remove common noise patterns
  const cleanText = text
    .replace(/\s+/g, ' ')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim();

  // Check text length and word count
  const words = cleanText.split(/\s+/);
  return cleanText.length > 50 && words.length > 10;
}

// Create canvas for rendering PDF pages
function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// Process a single PDF page
async function processPage(
  page: any,
  options: ProcessingOptions,
  ocrWorker?: Tesseract.Worker
): Promise<string> {
  try {
    // First try text extraction
    const content = await page.getTextContent();
    const text = content.items.map((item: any) => item.str).join(' ');

    // Check if extracted text is meaningful
    if (isTextMeaningful(text)) {
      return text;
    }

    // If text is not meaningful, try OCR
    if (!ocrWorker) {
      ocrWorker = await createWorker('fra+eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            options.onProgress?.({
              stage: 'processing',
              progress: m.progress * 100,
              message: 'OCR en cours...'
            });
          }
        }
      });
    }

    // Render page to canvas for OCR
    const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not create canvas context');
    }

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    // Perform OCR
    const { data: { text: ocrText } } = await ocrWorker.recognize(canvas);

    // Clean up canvas
    canvas.width = 0;
    canvas.height = 0;

    return ocrText;
  } catch (error) {
    logError(error, {
      component: 'pdfProcessor',
      action: 'processPage',
      pageNumber: page.pageNumber
    });
    throw error;
  }
}

export async function processPDF(
  file: ArrayBuffer,
  options: ProcessingOptions = {}
): Promise<string> {
  let ocrWorker: Tesseract.Worker | undefined;

  try {
    options.onProgress?.({
      stage: 'preparation',
      progress: 10,
      message: 'Chargement du PDF...'
    });

    // Load PDF document
    const pdf = await pdfjsLib.getDocument({
      data: file,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true
    }).promise;

    let text = '';
    let requiresOCR = false;

    // First pass: try text extraction
    for (let i = 1; i <= pdf.numPages; i++) {
      if (options.signal?.aborted) {
        throw new Error('Processing cancelled');
      }

      options.onProgress?.({
        stage: 'processing',
        progress: (i / pdf.numPages) * 40 + 10,
        message: `Extraction du texte de la page ${i}/${pdf.numPages}...`
      });

      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(' ');

      text += pageText + '\n';

      // Check if page might need OCR
      if (!isTextMeaningful(pageText)) {
        requiresOCR = true;
      }
    }

    // If text extraction wasn't sufficient, perform OCR
    if (requiresOCR) {
      options.onProgress?.({
        stage: 'processing',
        progress: 50,
        message: 'Initialisation de l\'OCR...'
      });

      ocrWorker = await createWorker('fra+eng', 1);
      text = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        if (options.signal?.aborted) {
          await ocrWorker.terminate();
          throw new Error('Processing cancelled');
        }

        options.onProgress?.({
          stage: 'processing',
          progress: (i / pdf.numPages) * 40 + 50,
          message: `OCR de la page ${i}/${pdf.numPages}...`
        });

        const page = await pdf.getPage(i);
        const pageText = await processPage(page, options, ocrWorker);
        text += pageText + '\n';
      }
    }

    options.onProgress?.({
      stage: 'complete',
      progress: 100,
      message: 'Traitement terminé'
    });

    return text.trim();
  } catch (error) {
    logError(error, {
      component: 'pdfProcessor',
      action: 'processPDF',
      fileSize: file.byteLength,
      requiresOCR: ocrWorker !== undefined
    });
    throw error;
  } finally {
    if (ocrWorker) {
      await ocrWorker.terminate();
    }
  }
}