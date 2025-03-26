import { ProcessingProgress, ProcessingOptions, ProcessingResult } from './types';
import { validateFileSize, validateFileType, getFileCategory } from './constants';
import { logError } from './errorLogger';
import { handleError } from './errorHandler';
import { FileErrorType } from './errorTypes';
import { processDocument as processDocumentBase } from './documentProcessor';
import { processAudioFile } from './audioProcessor';
import { processCSV } from './csvProcessor';
import { processPDF } from './pdfProcessor';
import * as mammoth from 'mammoth';
import { read, utils } from 'xlsx';

export async function processDocument(
  file: File,
  options?: ProcessingOptions
): Promise<ProcessingResult> {
  try {
    // Validate file size
    const sizeValidation = validateFileSize(file);
    if (!sizeValidation.valid) {
      throw new Error(sizeValidation.message);
    }

    // Validate file type
    const typeValidation = validateFileType(file);
    if (!typeValidation.valid) {
      throw new Error(typeValidation.message);
    }

    options?.onProgress?.({
      stage: 'preparation',
      progress: 10,
      message: 'Préparation du fichier...'
    });

    // Get file category and process accordingly
    const category = getFileCategory(file.type);
    let result: ProcessingResult;

    switch (category) {
      case 'audio':
        if (!options?.openaiApiKey) {
          throw new Error('OpenAI API key required for audio processing');
        }
        const audioContent = await processAudioFile(file, options?.onProgress, options?.signal);
        result = {
          content: audioContent,
          metadata: {
            fileName: file.name,
            fileType: file.type,
            size: file.size,
            timestamp: new Date().toISOString()
          }
        };
        break;

      case 'document':
        if (file.type.includes('pdf')) {
          const arrayBuffer = await file.arrayBuffer();
          const pdfContent = await processPDF(arrayBuffer, options);
          result = {
            content: pdfContent,
            metadata: {
              fileName: file.name,
              fileType: file.type,
              size: file.size,
              timestamp: new Date().toISOString()
            }
          };
        } else {
          const arrayBuffer = await file.arrayBuffer();
          const { value: content } = await mammoth.extractRawText({ arrayBuffer });
          result = {
            content,
            metadata: {
              fileName: file.name,
              fileType: file.type,
              size: file.size,
              timestamp: new Date().toISOString()
            }
          };
        }
        break;

      case 'data':
        if (file.type.includes('csv')) {
          const csvContent = await processCSV(file, options);
          result = {
            content: csvContent,
            metadata: {
              fileName: file.name,
              fileType: file.type,
              size: file.size,
              timestamp: new Date().toISOString()
            }
          };
        } else {
          const arrayBuffer = await file.arrayBuffer();
          const workbook = read(arrayBuffer, {
            type: 'array',
            cellDates: true,
            cellNF: false,
            cellText: false
          });

          const data = workbook.SheetNames.reduce((acc, sheetName) => {
            const sheet = workbook.Sheets[sheetName];
            acc[sheetName] = utils.sheet_to_json(sheet, {
              raw: false,
              dateNF: 'YYYY-MM-DD',
              defval: null
            });
            return acc;
          }, {} as Record<string, any>);

          result = {
            content: JSON.stringify(data, null, 2),
            metadata: {
              fileName: file.name,
              fileType: file.type,
              size: file.size,
              timestamp: new Date().toISOString()
            }
          };
        }
        break;

      case 'text':
        const textContent = await file.text();
        result = {
          content: textContent,
          metadata: {
            fileName: file.name,
            fileType: file.type,
            size: file.size,
            timestamp: new Date().toISOString()
          }
        };
        break;

      default:
        throw new Error(`Type de fichier non supporté: ${file.type}`);
    }

    options?.onProgress?.({
      stage: 'complete',
      progress: 100,
      message: 'Traitement terminé'
    });

    return result;
  } catch (error) {
    // Log error with context
    await logError(error, {
      component: 'universalProcessor',
      action: 'processDocument',
      fileType: file.type,
      fileName: file.name,
      fileSize: file.size
    });

    // Throw appropriate error
    throw await handleError(error, {
      component: 'universalProcessor',
      action: 'processDocument',
      type: FileErrorType.PROCESSING_FAILED,
      context: {
        fileType: file.type,
        fileName: file.name,
        fileSize: file.size
      }
    });
  }
}