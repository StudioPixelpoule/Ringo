import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { processAudioFile } from './audioProcessor';
import { parsePPTX, isOldPPTFormat } from './pptxParser';
// Retirer l'import statique qui cause l'erreur
// import { PPTXInHTMLOut } from 'pptx-in-html-out';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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

interface AudioProcessingResult {
  content: string;
  metadata: {
    title: string;
    duration: number;
    language: string;
    fileType: string;
    fileName: string;
    audioDescription?: string;
    segments: Array<{ start: number; end: number; text: string }>;
  };
  confidence: number;
  processingDate: string;
}

export interface ProcessingProgress {
  stage: 'processing' | 'complete';
  progress: number;
  message: string;
  canCancel: boolean;
}

export interface ProcessingOptions {
  openaiApiKey?: string;
  audioDescription?: string;
  onProgress?: (progress: ProcessingProgress) => void;
  signal?: AbortSignal;
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

async function processDataFile(file: File, options?: ProcessingOptions): Promise<ProcessingResult> {
  try {
    if (options?.onProgress) {
      options.onProgress({
        stage: 'processing',
        progress: 10,
        message: 'Lecture du fichier de données...',
        canCancel: true
      });
    }

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
      if (options?.onProgress) {
        options.onProgress({
          stage: 'processing',
          progress: 40,
          message: 'Traitement du fichier Excel...',
          canCancel: true
        });
      }
      
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
      
      if (options?.onProgress) {
        options.onProgress({
          stage: 'processing',
          progress: 60,
          message: 'Données Excel extraites avec succès',
          canCancel: true
        });
      }
    }

    if (options?.onProgress) {
      options.onProgress({
        stage: 'processing',
        progress: 70,
        message: 'Structuration des données...',
        canCancel: true
      });
    }

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

    if (options?.onProgress) {
      options.onProgress({
        stage: 'complete',
        progress: 100,
        message: 'Traitement terminé',
        canCancel: false
      });
    }

    return {
      content: JSON.stringify(formattedData, null, 2),
      metadata: {
        fileName: file.name,
        fileType: file.type,
        language: 'unknown'
      },
      confidence: 1,
      processingDate: new Date().toISOString()
    };
  } catch (error) {
    console.error('[Data Processing] Error:', error);
    throw error;
  }
}

async function processTextDocument(file: File, options?: ProcessingOptions): Promise<ProcessingResult> {
  try {
    if (options?.onProgress) {
      options.onProgress({
        stage: 'processing',
        progress: 10,
        message: 'Préparation du document texte...',
        canCancel: true
      });
    }

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

    if (options?.onProgress) {
      options.onProgress({
        stage: 'processing',
        progress: 50,
        message: 'Nettoyage et structuration du texte...',
        canCancel: true
      });
    }

    // Clean and structure text
    text = cleanText(text);

    if (options?.onProgress) {
      options.onProgress({
        stage: 'complete',
        progress: 100,
        message: 'Traitement terminé',
        canCancel: false
      });
    }

    return {
      content: text,
      metadata: {
        fileName: file.name,
        fileType: file.type,
        language: detectLanguage(text)
      },
      confidence: 1,
      processingDate: new Date().toISOString()
    };
  } catch (error) {
    console.error('[Text Processing] Error:', error);
    throw error;
  }
}

async function processPowerPointDocument(file: File, options?: ProcessingOptions): Promise<ProcessingResult> {
  try {
    console.log('[PowerPoint Processing] Starting processing:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    if (options?.onProgress) {
      options.onProgress({
        stage: 'processing',
        progress: 10,
        message: 'Préparation du fichier PowerPoint...',
        canCancel: true
      });
    }

    // Vérifier si c'est un ancien format PPT
    if (isOldPPTFormat(file)) {
      console.warn('[PowerPoint Processing] Old PPT format detected, limited support');
      
      const placeholderContent = `
# Fichier PowerPoint (Format ancien) : ${file.name}

**Type :** ${file.type || 'application/vnd.ms-powerpoint'}
**Taille :** ${(file.size / 1024 / 1024).toFixed(2)} MB

**Note :** Ce fichier utilise l'ancien format PowerPoint (.ppt). 
Pour une meilleure extraction du contenu, veuillez convertir ce fichier au format moderne (.pptx).

Vous pouvez convertir votre fichier :
1. En l'ouvrant dans PowerPoint et en le sauvegardant comme .pptx
2. En utilisant un service de conversion en ligne

Le fichier a été enregistré et vous pouvez poser des questions générales à son sujet.
`;
      
      return {
        content: placeholderContent,
        metadata: {
          fileName: file.name,
          fileType: file.type || 'application/vnd.ms-powerpoint',
          language: 'fr',
          pageCount: 0
        },
        confidence: 0.5,
        processingDate: new Date().toISOString()
      };
    }

    if (options?.onProgress) {
      options.onProgress({
        stage: 'processing',
        progress: 30,
        message: 'Extraction du contenu PowerPoint...',
        canCancel: true
      });
    }

    // Utiliser le nouveau parser PPTX
    const content = await parsePPTX(file);

    if (options?.onProgress) {
      options.onProgress({
        stage: 'complete',
        progress: 100,
        message: 'Traitement terminé',
        canCancel: false
      });
    }

    console.log('✅ PowerPoint file processed successfully');

    // Compter le nombre de slides dans le contenu
    const slideCount = (content.match(/## Slide \d+/g) || []).length;

    return {
      content,
      metadata: {
        fileName: file.name,
        fileType: file.type || 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        language: detectLanguage(content),
        pageCount: slideCount
      },
      confidence: 0.95,
      processingDate: new Date().toISOString()
    };

  } catch (error) {
    console.error('[PowerPoint Processing] Error:', error);
    
    // En cas d'erreur, retourner un contenu minimal
    const fallbackContent = `
# Présentation PowerPoint : ${file.name}

**Type :** ${file.type}
**Taille :** ${(file.size / 1024 / 1024).toFixed(2)} MB

**Erreur lors de l'extraction du contenu**

Une erreur s'est produite lors de l'extraction du contenu de cette présentation.
Erreur : ${error instanceof Error ? error.message : 'Erreur inconnue'}

Le fichier a été enregistré et vous pouvez poser des questions générales à son sujet.
`;

    return {
      content: fallbackContent,
      metadata: {
        fileName: file.name,
        fileType: file.type,
        language: 'fr',
        pageCount: 0,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      confidence: 0.3,
      processingDate: new Date().toISOString()
    };
  }
}

async function processPDFDocument(file: File, options?: ProcessingOptions): Promise<ProcessingResult> {
  try {
    if (options?.onProgress) {
      options.onProgress({
        stage: 'processing',
        progress: 10,
        message: 'Chargement du PDF...',
        canCancel: true
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      useWorkerFetch: true,
      isEvalSupported: true,
      useSystemFonts: true
    }).promise;

    // Extraire les métadonnées du PDF
    const metadata = await pdf.getMetadata();

    const numPages = pdf.numPages;
    let extractedText = '';
    let currentPage = 1;
    let totalConfidence = 0;

    for (let i = 1; i <= numPages; i++) {
      if (options?.signal?.aborted) {
        throw new Error('Processing cancelled');
      }

      if (options?.onProgress) {
        options.onProgress({
          stage: 'processing',
          progress: Math.round((i / numPages) * 80) + 10,
          message: `Traitement de la page ${i}/${numPages}...`,
          canCancel: true
        });
      }

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

      extractedText += pageText.trim() + '\n\n';
      currentPage++;
    }

    if (options?.onProgress) {
      options.onProgress({
        stage: 'processing',
        progress: 90,
        message: 'Finalisation de l\'extraction...',
        canCancel: true
      });
    }

    const cleanedText = cleanText(extractedText);

    if (!cleanedText) {
      throw new Error(`Aucun texte extrait du PDF: ${file.name}`);
    }

    // Calculate final confidence score
    const confidence = Math.min(1, totalConfidence / pdf.numPages);

    if (options?.onProgress) {
      options.onProgress({
        stage: 'complete',
        progress: 100,
        message: 'Traitement terminé',
        canCancel: false
      });
    }

    return {
      content: cleanedText,
      metadata: {
        title: metadata.info?.Title,
        author: metadata.info?.Author,
        date: metadata.info?.CreationDate,
        language: detectLanguage(cleanedText),
        fileType: file.type,
        fileName: file.name,
        pageCount: pdf.numPages
      },
      confidence,
      processingDate: new Date().toISOString()
    };
  } catch (error) {
    console.error('[PDF Processing] Error:', error);
    throw error;
  }
}

// Fonction principale de traitement
export async function processDocument(
  file: File,
  options: ProcessingOptions = {}
): Promise<ProcessingResult> {
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

    let result: ProcessingResult;
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

        case 'application/vnd.ms-powerpoint':
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
          result = await processPowerPointDocument(file, options);
          break;

        case 'text/html':
          // For HTML reports, just return the content as is
          const text = await file.text();
          result = {
            content: text,
            metadata: {
              fileName: file.name,
              fileType: file.type,
              language: detectLanguage(text)
            },
            confidence: 1,
            processingDate: new Date().toISOString()
          };
          break;

        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        case 'application/vnd.ms-excel':
        case 'text/csv':
        case 'application/json':
          result = await processDataFile(file, options);
          break;

        default:
          if (file.type.startsWith('audio/')) {
            if (!options.openaiApiKey) {
              throw new Error('Clé API OpenAI requise pour le traitement audio');
            }
            const audioResult = await processAudioFile(
              file, 
              options.openaiApiKey, 
              undefined, // audioDescription
              options.onProgress, 
              options.signal
            );
            result = {
              content: audioResult.content,
              metadata: audioResult.metadata,
              confidence: audioResult.confidence,
              processingDate: audioResult.processingDate
            };
            break;
          }
          // Fallback basé sur l'extension pour PowerPoint
          if (['ppt', 'pptx'].includes(extension || '')) {
            result = await processPowerPointDocument(file, options);
            break;
          }
          throw new Error(`Type de fichier non supporté: ${file.type}`);
      }
    }

    if (!result?.content?.trim()) {
      throw new Error(`Aucun contenu valide extrait de ${file.name}`);
    }

    console.log('✅ Document processing completed:', {
      fileName: file.name,
      contentLength: result.content.length,
      excerpt: result.content.substring(0, 100) + '...'
    });

    return result;
  } catch (error) {
    console.error('[Document Processing] Error:', error);
    throw error;
  }
}