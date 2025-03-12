import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import mammoth from 'mammoth';

// Initialize PDF.js worker
const workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface ProcessingProgress {
  stage: 'preparation' | 'processing' | 'extraction' | 'complete';
  progress: number;
  message: string;
}

interface ProcessingOptions {
  onProgress?: (progress: ProcessingProgress) => void;
  signal?: AbortSignal;
}

async function processDataFile(file: File, options?: ProcessingOptions): Promise<string> {
  try {
    options?.onProgress?.({
      stage: 'preparation',
      progress: 10,
      message: 'Lecture du fichier de données...'
    });

    const text = await file.text();
    let data: any;

    options?.onProgress?.({
      stage: 'processing',
      progress: 30,
      message: 'Analyse du contenu...'
    });

    // Handle different file types
    if (file.name.toLowerCase().endsWith('.json')) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Le fichier JSON est invalide');
      }
    } else if (file.name.toLowerCase().endsWith('.csv')) {
      // Parse CSV
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      const rows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        return headers.reduce((obj, header, i) => {
          obj[header] = values[i];
          return obj;
        }, {} as any);
      });
      data = rows;
    } else if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
      throw new Error('Les fichiers Excel binaires ne sont pas supportés. Veuillez exporter en CSV.');
    }

    options?.onProgress?.({
      stage: 'extraction',
      progress: 70,
      message: 'Structuration des données...'
    });

    // Format data for storage
    const formattedData = {
      type: file.name.split('.').pop()?.toLowerCase(),
      fileName: file.name,
      data,
      metadata: {
        rowCount: Array.isArray(data) ? data.length : 1,
        fields: Array.isArray(data) ? Object.keys(data[0] || {}) : Object.keys(data || {}),
        size: text.length
      },
      processingDate: new Date().toISOString()
    };

    options?.onProgress?.({
      stage: 'complete',
      progress: 100,
      message: 'Traitement terminé'
    });

    return JSON.stringify(formattedData, null, 2);
  } catch (error) {
    console.error('[Data Processing] Error:', error);
    throw new Error(`Erreur lors du traitement du fichier: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }
}

async function processTextDocument(file: File, options?: ProcessingOptions): Promise<string> {
  try {
    options?.onProgress?.({
      stage: 'preparation',
      progress: 10,
      message: 'Préparation du document texte...'
    });

    let text: string;

    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      text = result.value;
    } else {
      text = await file.text();
    }

    if (!text?.trim()) {
      throw new Error(`Aucun contenu extrait du document: ${file.name}`);
    }

    options?.onProgress?.({
      stage: 'processing',
      progress: 50,
      message: 'Nettoyage et structuration du texte...'
    });

    // Clean and structure text
    text = text
      .replace(/\s+/g, ' ')
      .replace(/[\n\r]+/g, '\n')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    options?.onProgress?.({
      stage: 'complete',
      progress: 100,
      message: 'Traitement terminé'
    });

    return text;
  } catch (error) {
    console.error('[Text Processing] Error:', error);
    throw new Error(`Erreur lors du traitement du document texte: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }
}

async function processPDFDocument(file: File, options?: ProcessingOptions): Promise<string> {
  try {
    options?.onProgress?.({
      stage: 'preparation',
      progress: 10,
      message: 'Chargement du PDF...'
    });

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true,
      standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
      cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
      disableFontFace: false
    }).promise;

    const numPages = pdf.numPages;
    let extractedText = '';
    let currentPage = 1;

    for (let i = 1; i <= numPages; i++) {
      if (options?.signal?.aborted) {
        throw new Error('Processing cancelled');
      }

      options?.onProgress?.({
        stage: 'processing',
        progress: Math.round((i / numPages) * 80) + 10,
        message: `Traitement de la page ${i}/${numPages}...`
      });

      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let pageText = '';

      // Extract text while preserving structure
      for (const item of content.items as any[]) {
        if (item.str?.trim()) {
          pageText += item.str + ' ';
        }
      }

      // If page has little text, try OCR
      if (pageText.length < 100) {
        try {
          const scale = 2.0;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');

          if (context) {
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
              canvasContext: context,
              viewport
            }).promise;

            const worker = await createWorker();
            await worker.loadLanguage('fra+eng');
            await worker.initialize('fra+eng');
            const { data } = await worker.recognize(canvas);
            await worker.terminate();

            if (data.text.length > pageText.length) {
              pageText = data.text;
            }
          }
        } catch (ocrError) {
          console.warn(`OCR failed for page ${i}:`, ocrError);
        }
      }

      extractedText += pageText.trim() + '\n\n';
      currentPage++;
    }

    options?.onProgress?.({
      stage: 'extraction',
      progress: 90,
      message: 'Finalisation de l\'extraction...'
    });

    const cleanedText = extractedText
      .replace(/\s+/g, ' ')
      .replace(/[\n\r]+/g, '\n')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!cleanedText) {
      throw new Error(`Aucun texte extrait du PDF: ${file.name}`);
    }

    options?.onProgress?.({
      stage: 'complete',
      progress: 100,
      message: 'Traitement terminé'
    });

    return cleanedText;
  } catch (error) {
    console.error('[PDF Processing] Error:', error);
    throw new Error(`Erreur lors du traitement du PDF: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }
}

export async function processDocument(
  file: File,
  options?: ProcessingOptions
): Promise<string> {
  try {
    console.log('📄 Starting document processing:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    // Validate file size
    if (file.size > 100 * 1024 * 1024) { // 100MB limit
      throw new Error('Le fichier est trop volumineux (limite: 100MB)');
    }

    let result: string;
    const extension = file.name.split('.').pop()?.toLowerCase();

    // Handle data files
    if (['json', 'csv', 'xlsx', 'xls'].includes(extension || '')) {
      result = await processDataFile(file, options);
    }
    // Handle documents
    else {
      switch (file.type.toLowerCase()) {
        case 'application/pdf':
          result = await processPDFDocument(file, options);
          break;

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'text/plain':
          result = await processTextDocument(file, options);
          break;

        default:
          throw new Error(`Type de fichier non supporté: ${file.type}`);
      }
    }

    if (!result?.trim()) {
      throw new Error(`Aucun contenu valide extrait de ${file.name}`);
    }

    console.log('✅ Document processing completed:', {
      fileName: file.name,
      contentLength: result.length,
      excerpt: result.substring(0, 100) + '...'
    });

    return result;
  } catch (error) {
    console.error('[Document Processing] Error:', error);
    throw error;
  }
}