import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

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

interface ProcessingOptions {
  onProgress?: (progress: ProcessingProgress) => void;
  signal?: AbortSignal;
}

async function processDataFile(file: File, options?: ProcessingOptions): Promise<string> {
  try {
    options?.onProgress?.({
      stage: 'upload',
      progress: 10,
      message: 'Lecture du fichier de données...'
    });

    let data: any;
    const extension = file.name.split('.').pop()?.toLowerCase();

    // Handle different file types
    if (extension === 'json') {
      const text = await file.text();
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Le fichier JSON est invalide');
      }
    } else if (extension === 'csv') {
      const text = await file.text();
      const parseResult = await new Promise((resolve, reject) => {
        Papa.parse(text, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          delimitersToGuess: [',', ';', '\t', '|'],
          complete: resolve,
          error: reject
        });
      });

      if ('errors' in parseResult && parseResult.errors?.length > 0) {
        console.warn('CSV parsing warnings:', parseResult.errors);
      }

      data = parseResult.data;
    } else if (extension === 'xlsx' || extension === 'xls') {
      options?.onProgress?.({
        stage: 'processing',
        progress: 40,
        message: 'Traitement du fichier Excel...'
      });
      
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, {
        type: 'array',
        cellDates: true,
        cellText: true
      });
      
      // Extract all sheets
      data = {};
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        // Convert each sheet to JSON
        data[sheetName] = XLSX.utils.sheet_to_json(worksheet, {
          defval: '',
          raw: false
        });
      });
      
      // If no data was extracted
      if (!data || Object.keys(data).length === 0) {
        throw new Error('Aucune donnée trouvée dans le fichier Excel');
      }
      
      options?.onProgress?.({
        stage: 'processing',
        progress: 60,
        message: 'Données Excel extraites avec succès'
      });
    }

    options?.onProgress?.({
      stage: 'processing',
      progress: 70,
      message: 'Structuration des données...'
    });

    // Format data for storage
    const formattedData = {
      type: extension,
      fileName: file.name,
      data,
      metadata: {
        rowCount: Array.isArray(data) ? data.length : 
                 typeof data === 'object' ? Object.values(data).reduce((sum: number, sheet: any[]) => sum + sheet.length, 0) : 1,
        fields: Array.isArray(data) ? Object.keys(data[0] || {}) :
                typeof data === 'object' ? Object.keys(data).map(sheet => ({
                  sheet,
                  fields: Object.keys(data[sheet][0] || {})
                })) : Object.keys(data || {}),
        size: file.size,
        sheets: extension === 'xlsx' || extension === 'xls' ? Object.keys(data) : undefined
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
    throw error;
  }
}

// Traitement des documents texte
async function processTextDocument(file: File, options?: ProcessingOptions): Promise<string> {
  try {
    options?.onProgress?.({
      stage: 'upload',
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
    throw error;
  }
}

// Fonction principale de traitement
export async function processDocument(
  file: File,
  options: {
    openaiApiKey?: string;
    onProgress?: (progress: ProcessingProgress) => void;
    signal?: AbortSignal;
  } = {}
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

        case 'text/html':
          // For HTML reports, just return the content as is
          result = await file.text();
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