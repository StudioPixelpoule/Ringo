import { supabase } from './supabase';
import { ProcessingResult, ProcessingProgress, ProcessingOptions } from './universalProcessor';
import { processDocument as processDocumentLocal } from './universalProcessor';

// Extension des options pour inclure audioDescription
export interface SecureProcessingOptions extends ProcessingOptions {
  audioDescription?: string;
  signal?: AbortSignal;
  onProgress?: (progress: ProcessingProgress) => void;
  openaiApiKey?: string;
}

// Drapeau pour activer/désactiver le mode sécurisé progressivement
const USE_SECURE_PROCESSING = {
  audio: true,        // ✅ Activé - Edge Function en production
  presentation: true, // ✅ Activé - Edge Function en production
  pdf: true,          // ✅ Activé - Nouvelle Edge Function
  document: true,     // ✅ Activé - Nouvelle Edge Function (Word, Excel, CSV)
  chat: false,        // Désactivé pour l'instant
};

export async function processDocumentSecure(
  file: File,
  options: SecureProcessingOptions = {}
): Promise<ProcessingResult> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const documentType = extension === 'pdf' ? 'pdf' :
                      ['doc', 'docx'].includes(extension || '') ? 'doc' :
                      ['ppt', 'pptx'].includes(extension || '') ? 'presentation' :
                      ['json', 'csv', 'xlsx', 'xls'].includes(extension || '') ? 'data' :
                      ['mp3', 'wav', 'wave', 'aac', 'ogg', 'webm', 'm4a', 'mp4', 'mpga'].includes(extension || '') ? 'audio' :
                      extension === 'html' ? 'report' : 'unknown';

  // Pour l'audio, utiliser l'Edge Function
  if (documentType === 'audio' && USE_SECURE_PROCESSING.audio) {
    try {
      options.onProgress?.({
        stage: 'processing',
        progress: 10,
        message: 'Envoi du fichier audio pour traitement sécurisé...',
        canCancel: false
      });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Non authentifié');
      }

      // Extraire la description audio si fournie
      const audioDescription = options.audioDescription;

      const formData = new FormData();
      formData.append('file', file);
      if (audioDescription) {
        formData.append('audioDescription', audioDescription);
      }

      options.onProgress?.({
        stage: 'processing',
        progress: 30,
        message: 'Transcription en cours sur le serveur...',
        canCancel: false
      });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-audio`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors du traitement audio');
      }

      const { result } = await response.json();

      options.onProgress?.({
        stage: 'complete',
        progress: 100,
        message: 'Transcription terminée',
        canCancel: false
      });

      return result;
    } catch (error) {
      console.error('Erreur avec l\'Edge Function pour l\'audio:', error);
      // En cas d'erreur, propager l'erreur au lieu d'exposer la clé API
      throw new Error('Erreur lors du traitement audio. Veuillez réessayer.');
    }
  }

  // Pour les présentations, utiliser l'Edge Function
  if (documentType === 'presentation' && USE_SECURE_PROCESSING.presentation) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Non authentifié');
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-presentation`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors du traitement de la présentation');
      }

      const { result } = await response.json();
      return result;
    } catch (error) {
      console.error('Erreur avec l\'Edge Function:', error);
      // Fallback sur le traitement local
      return processDocumentLocal(file, options);
    }
  }

  // Pour les PDF, utiliser la nouvelle Edge Function
  if (documentType === 'pdf' && USE_SECURE_PROCESSING.pdf) {
    try {
      options.onProgress?.({
        stage: 'processing',
        progress: 10,
        message: 'Envoi du PDF pour traitement sécurisé...',
        canCancel: false
      });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Non authentifié');
      }

      const formData = new FormData();
      formData.append('file', file);

      options.onProgress?.({
        stage: 'processing',
        progress: 30,
        message: 'Extraction du contenu PDF sur le serveur...',
        canCancel: false
      });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-pdf`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors du traitement du PDF');
      }

      const { result } = await response.json();

      options.onProgress?.({
        stage: 'complete',
        progress: 100,
        message: 'Extraction terminée',
        canCancel: false
      });

      return result;
    } catch (error) {
      console.error('Erreur avec l\'Edge Function PDF, fallback sur traitement local:', error);
      // Fallback sur le traitement local
      return processDocumentLocal(file, options);
    }
  }

  // Pour Word, Excel, CSV, JSON, utiliser la nouvelle Edge Function process-document
  if ((documentType === 'doc' || documentType === 'data') && USE_SECURE_PROCESSING.document) {
    try {
      options.onProgress?.({
        stage: 'processing',
        progress: 10,
        message: 'Envoi du document pour traitement sécurisé...',
        canCancel: false
      });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Non authentifié');
      }

      const formData = new FormData();
      formData.append('file', file);

      options.onProgress?.({
        stage: 'processing',
        progress: 30,
        message: 'Traitement du document sur le serveur...',
        canCancel: false
      });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-document`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors du traitement du document');
      }

      const { result } = await response.json();

      options.onProgress?.({
        stage: 'complete',
        progress: 100,
        message: 'Traitement terminé',
        canCancel: false
      });

      return result;
    } catch (error) {
      console.error('Erreur avec l\'Edge Function Document, fallback sur traitement local:', error);
      // Fallback sur le traitement local
      return processDocumentLocal(file, options);
    }
  }

  // Pour tous les autres types (HTML, etc.), utiliser le traitement local
  // Ne pas passer la clé API pour des raisons de sécurité
  return processDocumentLocal(file, options);
}

// Export de la fonction pour remplacer progressivement processDocument
export { processDocumentSecure as processDocument };

// Re-export des types nécessaires
export type { ProcessingResult, ProcessingProgress } from './universalProcessor'; 