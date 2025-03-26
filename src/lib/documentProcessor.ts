import { ProcessingProgress, ProcessingOptions, ProcessingResult } from './types';
import { config } from './config';
import { logError } from './errorLogger';
import { handleError } from './errorHandler';
import { AuthErrorType } from './errorTypes';
import { sessionManager } from './sessionManager';
import { supabase } from './supabase';

export async function processDocument(
  file: File,
  options?: ProcessingOptions
): Promise<ProcessingResult> {
  try {
    options?.onProgress?.({
      stage: 'preparation',
      progress: 10,
      message: 'Préparation du document...'
    });

    // Validate auth state first
    const sessionState = sessionManager.getState();
    if (!sessionState.session) {
      throw await handleError(new Error('No valid session'), {
        component: 'documentProcessor',
        action: 'validateAuth',
        type: AuthErrorType.SESSION_EXPIRED
      });
    }

    // Verify user profile is active
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', sessionState.session.user.id)
      .single();

    if (profileError || !profile?.status) {
      throw await handleError(new Error('Profile inactive or not found'), {
        component: 'documentProcessor',
        action: 'validateAuth',
        type: AuthErrorType.SESSION_EXPIRED
      });
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    let content: string;

    // Handle audio files
    if (file.type.startsWith('audio/')) {
      content = JSON.stringify({
        type: 'audio',
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        duration: 'unknown',
        processingDate: new Date().toISOString(),
        metadata: {
          format: extension,
          source: 'upload'
        }
      }, null, 2);

      options?.onProgress?.({
        stage: 'complete',
        progress: 100,
        message: 'Traitement audio terminé'
      });

      return {
        content,
        metadata: {
          fileName: file.name,
          fileType: file.type,
          size: file.size,
          timestamp: new Date().toISOString()
        }
      };
    }

    // Process other file types
    if (extension === 'pdf') {
      const arrayBuffer = await file.arrayBuffer();
      content = await processPDF(arrayBuffer, options);
    } else if (['doc', 'docx'].includes(extension || '')) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      content = result.value;
    } else if (['json', 'csv', 'xlsx', 'xls'].includes(extension || '')) {
      if (extension === 'json') {
        content = await file.text();
        // Validate and format JSON
        const parsed = JSON.parse(content);
        content = JSON.stringify(parsed, null, 2);
      } else if (extension === 'csv') {
        content = await processCSV(file, options);
      } else {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, {
          type: 'array',
          cellDates: true,
          cellNF: false,
          cellText: false
        });

        // Process all sheets
        const result = workbook.SheetNames.reduce((acc, sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          acc[sheetName] = XLSX.utils.sheet_to_json(sheet, {
            raw: false,
            dateNF: 'YYYY-MM-DD',
            defval: null
          });
          return acc;
        }, {} as Record<string, any>);

        content = JSON.stringify(result, null, 2);
      }
    } else {
      content = await file.text();
    }

    options?.onProgress?.({
      stage: 'complete',
      progress: 100,
      message: 'Traitement terminé'
    });

    return {
      content,
      metadata: {
        fileName: file.name,
        fileType: file.type,
        size: file.size,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    // Log error with context
    await logError(error, {
      component: 'documentProcessor',
      action: 'processDocument',
      fileType: file.type,
      fileName: file.name,
      fileSize: file.size
    });

    // Throw appropriate error
    throw await handleError(error, {
      component: 'documentProcessor',
      action: 'processDocument',
      type: AuthErrorType.SESSION_EXPIRED,
      context: {
        fileType: file.type,
        fileName: file.name,
        fileSize: file.size
      }
    });
  }
}