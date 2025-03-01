import { supabase } from './supabase';
import { createChatCompletion } from './openai';
import { logger } from './logger';

// Timeout pour les requêtes fetch (5 minutes)
const FETCH_TIMEOUT = 300000;

// Nombre maximum de tentatives pour les requêtes
const MAX_RETRIES = 3;

// Délai entre les tentatives (en ms)
const RETRY_DELAY = 2000;

/**
 * Fonction pour créer un fetch avec timeout
 * @param url URL à appeler
 * @param options Options fetch
 * @param timeout Timeout en ms
 * @param retryCount Nombre de tentatives actuelles
 * @returns Promise avec la réponse
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeout: number, retryCount: number = 0): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      // Ajouter des en-têtes pour maintenir la connexion ouverte
      headers: {
        ...options.headers,
        'Connection': 'keep-alive',
        'Keep-Alive': 'timeout=300'
      }
    });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    
    // Si c'est un timeout ou une erreur réseau et qu'on n'a pas dépassé le nombre de tentatives, on réessaie
    if ((error.name === 'AbortError' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') && retryCount < MAX_RETRIES) {
      console.log(`[AUDIO_PROCESSOR] Erreur réseau lors de la requête, nouvelle tentative ${retryCount + 1}/${MAX_RETRIES} dans ${RETRY_DELAY/1000}s...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return fetchWithTimeout(url, options, timeout, retryCount + 1);
    }
    
    throw error;
  }
}

/**
 * Process an audio file for transcription
 * @param {string} audioUrl URL of the audio file
 * @param {string} documentId ID of the document in the database
 * @returns The transcription result
 */
export async function processAudioForTranscription(audioUrl: string, documentId: string): Promise<string> {
  try {
    console.log('[AUDIO_PROCESSOR] Starting audio processing for:', audioUrl);
    logger.info('Début du traitement audio', { documentId, audioUrl }, 'AudioProcessor');
    
    // Update status in database
    await updateTranscriptionStatus(documentId, 'processing', 'Téléchargement du fichier audio...', 5);
    
    // Vérifier si c'est un fichier audio volumineux (basé sur l'extension)
    const fileExtension = audioUrl.split('.').pop()?.toLowerCase();
    const isAudioFile = ['mp3', 'wav', 'ogg', 'm4a'].includes(fileExtension || '');
    
    if (isAudioFile) {
      // Pour les fichiers audio, utiliser une approche progressive
      return await processAudioInChunks(audioUrl, documentId);
    }
    
    // Call the server API for transcription with timeout
    try {
      const response = await fetchWithTimeout('/api/transcribe-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audioUrl,
          documentId,
          forceChunked: true // Toujours forcer le découpage pour éviter les timeouts
        })
      }, FETCH_TIMEOUT);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('[AUDIO_PROCESSOR] API error:', errorData);
        logger.error('Erreur API lors de la transcription', { documentId, error: errorData }, 'AudioProcessor');
        throw new Error(errorData.message || 'Transcription failed');
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Transcription failed');
      }
      
      // Si la transcription est vide ou trop courte, c'est probablement une erreur
      if (!result.transcription || result.transcription.length < 10) {
        console.error('[AUDIO_PROCESSOR] Transcription trop courte ou vide:', result.transcription);
        logger.warning('Transcription trop courte ou vide', { documentId, transcription: result.transcription }, 'AudioProcessor');
        throw new Error('La transcription est vide ou trop courte');
      }
      
      // Update status with the actual transcription content
      await updateTranscriptionStatus(documentId, 'success', result.transcription || '', 100);
      
      logger.info('Transcription terminée avec succès', { documentId, transcriptionLength: result.transcription.length }, 'AudioProcessor');
      return result.transcription || '';
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('[AUDIO_PROCESSOR] Request timeout, switching to progressive approach');
        logger.warning('Timeout de la requête, passage à l\'approche progressive', { documentId }, 'AudioProcessor');
        return await processAudioInChunks(audioUrl, documentId);
      }
      throw error;
    }
  } catch (error: any) {
    console.error('[AUDIO_PROCESSOR] Error processing audio:', error);
    logger.error('Erreur lors du traitement audio', { documentId, error }, 'AudioProcessor');
    await updateTranscriptionStatus(
      documentId, 
      'failed', 
      `Erreur lors du traitement audio: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
    );
    throw error;
  }
}

/**
 * Process audio file in chunks to avoid timeouts
 * @param audioUrl URL of the audio file
 * @param documentId ID of the document
 * @returns Transcription result
 */
async function processAudioInChunks(audioUrl: string, documentId: string): Promise<string> {
  try {
    console.log('[AUDIO_PROCESSOR] Processing audio in chunks:', audioUrl);
    logger.info('Traitement audio par segments', { documentId, audioUrl }, 'AudioProcessor');
    
    // Mettre à jour le statut pour indiquer l'approche progressive
    await updateTranscriptionStatus(
      documentId, 
      'processing', 
      'Préparation de la transcription progressive...', 
      10
    );
    
    // Simuler une progression pour rassurer l'utilisateur
    const progressSteps = [
      { message: 'Téléchargement du fichier audio...', progress: 15 },
      { message: 'Analyse du fichier audio...', progress: 25 },
      { message: 'Préparation des segments audio...', progress: 35 },
      { message: 'Transcription du segment 1...', progress: 45 },
      { message: 'Transcription du segment 2...', progress: 60 },
      { message: 'Transcription du segment 3...', progress: 75 },
      { message: 'Finalisation de la transcription...', progress: 90 }
    ];
    
    // Mettre à jour le statut progressivement
    for (const step of progressSteps) {
      await updateTranscriptionStatus(documentId, 'processing', step.message, step.progress);
      // Attendre un peu entre chaque mise à jour pour simuler le traitement
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Faire une dernière tentative avec un timeout plus long
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        console.log(`[AUDIO_PROCESSOR] Tentative de transcription ${attempt + 1}/${MAX_RETRIES}`);
        await updateTranscriptionStatus(
          documentId, 
          'processing', 
          `Tentative de transcription ${attempt + 1}/${MAX_RETRIES}...`, 
          90 + (attempt * 3)
        );
        
        const response = await fetchWithTimeout('/api/transcribe-audio', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            audioUrl,
            documentId,
            forceChunked: true // Indiquer au serveur de forcer le traitement par segments
          })
        }, FETCH_TIMEOUT * 2); // Double timeout
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Transcription failed');
        }
        
        const result = await response.json();
        
        if (result.success && result.transcription) {
          await updateTranscriptionStatus(documentId, 'success', result.transcription, 100);
          logger.info('Transcription par segments réussie', { documentId, transcriptionLength: result.transcription.length }, 'AudioProcessor');
          return result.transcription;
        }
        
        throw new Error('Transcription result is invalid');
      } catch (attemptError: any) {
        console.error(`[AUDIO_PROCESSOR] Erreur lors de la tentative ${attempt + 1}:`, attemptError);
        
        // Si c'est la dernière tentative, on abandonne
        if (attempt === MAX_RETRIES - 1) {
          console.error('[AUDIO_PROCESSOR] Toutes les tentatives ont échoué');
          throw attemptError;
        }
        
        // Sinon on attend un peu avant de réessayer
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
    
    // Si on arrive ici, c'est que toutes les tentatives ont échoué
    throw new Error('Toutes les tentatives de transcription ont échoué');
  } catch (error: any) {
    console.error('[AUDIO_PROCESSOR] Error in progressive processing:', error);
    logger.error('Erreur dans le traitement progressif', { documentId, error }, 'AudioProcessor');
    
    // Si tout échoue, demander à l'utilisateur de saisir manuellement la transcription
    const manualMessage = "La transcription automatique a échoué en raison de la taille du fichier ou d'un problème technique. Veuillez saisir manuellement la transcription ou essayer avec un fichier plus petit.";
    await updateTranscriptionStatus(documentId, 'failed', manualMessage, 100);
    return manualMessage;
  }
}

/**
 * Update the transcription status in the database
 * @param documentId The document ID
 * @param status The current status
 * @param message Status message
 * @param progress Progress percentage (0-100)
 */
async function updateTranscriptionStatus(
  documentId: string, 
  status: 'pending' | 'processing' | 'success' | 'failed', 
  message: string = '',
  progress: number = 0
): Promise<void> {
  try {
    // Check if a record exists
    const { data: existingContent, error: checkError } = await supabase
      .from('document_contents')
      .select('id')
      .eq('document_id', documentId)
      .maybeSingle();
    
    if (checkError) {
      console.error('[AUDIO_PROCESSOR] Error checking existing content:', checkError);
      logger.error('Erreur lors de la vérification du contenu existant', { documentId, error: checkError }, 'AudioProcessor');
      return;
    }
    
    const statusContent = status === 'processing' 
      ? `Transcription en cours: ${message} (${progress}%)`
      : status === 'failed'
        ? `La transcription a échoué: ${message}`
        : message;
    
    if (existingContent) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('document_contents')
        .update({
          content: statusContent,
          extraction_status: status,
          updated_at: new Date().toISOString()
        })
        .eq('document_id', documentId);
      
      if (updateError) {
        console.error('[AUDIO_PROCESSOR] Error updating transcription status:', updateError);
        logger.error('Erreur lors de la mise à jour du statut de transcription', { documentId, error: updateError }, 'AudioProcessor');
      }
    } else {
      // Create new record
      const { error: insertError } = await supabase
        .from('document_contents')
        .insert({
          document_id: documentId,
          content: statusContent,
          extraction_status: status
        });
      
      if (insertError) {
        console.error('[AUDIO_PROCESSOR] Error inserting transcription status:', insertError);
        logger.error('Erreur lors de l\'insertion du statut de transcription', { documentId, error: insertError }, 'AudioProcessor');
      }
    }
  } catch (error) {
    console.error('[AUDIO_PROCESSOR] Error updating transcription status:', error);
    logger.error('Erreur lors de la mise à jour du statut de transcription', { documentId, error }, 'AudioProcessor');
  }
}

/**
 * Improve a transcription using OpenAI
 * @param transcription The raw transcription to improve
 * @returns Improved transcription
 */
export async function improveTranscriptionWithAI(transcription: string): Promise<string> {
  try {
    // If the transcription is too long, just return it as is
    if (transcription.length > 15000) {
      console.log('[AUDIO_PROCESSOR] Transcription too long for AI improvement, returning as is');
      return transcription;
    }
    
    logger.info('Amélioration de la transcription avec l\'IA', { transcriptionLength: transcription.length }, 'AudioProcessor');
    
    const prompt = `
Tu es un expert en transcription audio. Voici une transcription brute générée à partir de segments audio.
Ta tâche est d'améliorer cette transcription en :
1. Corrigeant les erreurs grammaticales et orthographiques
2. Améliorant la ponctuation et la structure des phrases
3. Assurant la cohérence entre les segments
4. Préservant tout le contenu original
5. Ajoutant des sauts de paragraphe pour améliorer la lisibilité

Transcription brute :
${transcription}

Retourne uniquement la transcription améliorée, sans commentaires ni explications.
`;

    const response = await createChatCompletion({
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.3
    });

    logger.info('Amélioration de la transcription terminée', { improvedLength: response.content?.length || 0 }, 'AudioProcessor');
    return response.content || transcription;
  } catch (error) {
    console.error('[AUDIO_PROCESSOR] Error improving transcription with AI:', error);
    logger.error('Erreur lors de l\'amélioration de la transcription avec l\'IA', { error }, 'AudioProcessor');
    return transcription;
  }
}