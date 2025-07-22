import { supabase } from './supabase';
import { ProcessingResult, ProcessingProgress, ProcessingOptions } from './universalProcessor';
import { processDocument as processDocumentLocal } from './universalProcessor';

// Helper pour déterminer le type de document
function getDocumentType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  return extension === 'pdf' ? 'pdf' :
         ['doc', 'docx'].includes(extension || '') ? 'doc' :
         ['ppt', 'pptx'].includes(extension || '') ? 'presentation' :
         ['json', 'csv', 'xlsx', 'xls'].includes(extension || '') ? 'data' :
         ['mp3', 'wav', 'wave', 'aac', 'ogg', 'webm', 'm4a', 'mp4', 'mpga'].includes(extension || '') ? 'audio' :
         extension === 'html' ? 'report' : 'unknown';
}

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
  const documentType = getDocumentType(file.name);

  // Pour l'audio, utiliser l'Edge Function
  if (documentType === 'audio' && USE_SECURE_PROCESSING.audio) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Non authentifié');
      }

      // Limiter la taille des fichiers audio à 100MB
      const MAX_AUDIO_SIZE = 100 * 1024 * 1024; // 100MB
      if (file.size > MAX_AUDIO_SIZE) {
        throw new Error(`Le fichier audio est trop volumineux (${Math.round(file.size / 1024 / 1024)}MB). La limite est de 100MB.`);
      }

      options.onProgress?.({
        stage: 'processing',
        progress: 10,
        message: 'Upload du fichier audio...',
        canCancel: true
      });

      // Générer un nom unique pour le fichier
      // Nettoyer le nom du fichier original (garder seulement alphanumérique, tirets et points)
      const cleanFileName = file.name
        .replace(/[^a-zA-Z0-9.-]/g, '_')  // Remplacer les caractères spéciaux par _
        .replace(/_+/g, '_')               // Remplacer plusieurs _ consécutifs par un seul
        .replace(/^_|_$/g, '');            // Supprimer _ au début et à la fin
      
      const fileName = `audio_${Date.now()}_${Math.random().toString(36).substring(7)}_${cleanFileName}`;
      const filePath = `temp/${fileName}`;

      // Uploader le fichier sur Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Erreur lors de l'upload: ${uploadError.message}`);
      }

      options.onProgress?.({
        stage: 'processing',
        progress: 30,
        message: 'Transcription en cours sur le serveur...',
        canCancel: false
      });

      // Envoyer l'URL du fichier à l'Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-audio`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filePath,
            fileName: file.name,
            audioDescription: options.audioDescription
          })
        }
      );

      if (!response.ok) {
        // Nettoyer le fichier temporaire en cas d'erreur
        await supabase.storage.from('documents').remove([filePath]);
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors du traitement audio');
      }

      const { result } = await response.json();

      // Nettoyer le fichier temporaire après traitement
      await supabase.storage.from('documents').remove([filePath]);

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
      throw new Error(error instanceof Error ? error.message : 'Erreur lors du traitement audio. Veuillez réessayer.');
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