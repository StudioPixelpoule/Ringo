import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { downloadAudio, splitAudioFile, cleanupFiles, cleanupAllTempFiles } from './ffmpegService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Maximum size for direct transcription (25MB)
const MAX_DIRECT_SIZE = 25 * 1024 * 1024;

// Optimal segment duration in seconds
const SEGMENT_DURATION = 45;

// Maximum retries for transcription attempts
const MAX_RETRIES = 3;

// Delay between retries (in ms)
const RETRY_DELAY = 2000;

// Timeout for transcription requests (5 minutes)
const TRANSCRIPTION_TIMEOUT = 300000;

/**
 * Transcrit un fichier audio en utilisant l'API Whisper d'OpenAI
 * @param {string} audioFilePath Chemin vers le fichier audio à transcrire
 * @param {string} apiKey Clé API OpenAI
 * @param {string} language Code de langue (optionnel, par défaut 'fr')
 * @param {number} retryCount Nombre de tentatives actuelles
 * @returns {Promise<string>} Texte transcrit
 */
export async function transcribeAudioFile(audioFilePath, apiKey, language = 'fr', retryCount = 0) {
  try {
    console.log('[WHISPER_SERVICE] Début de la transcription pour:', audioFilePath, 'tentative:', retryCount + 1);
    
    if (!apiKey) {
      throw new Error('Clé API OpenAI non fournie');
    }
    
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Le fichier audio n'existe pas: ${audioFilePath}`);
    }
    
    // Vérifier la taille du fichier
    const stats = fs.statSync(audioFilePath);
    const fileSizeInBytes = stats.size;
    
    console.log('[WHISPER_SERVICE] Taille du fichier:', fileSizeInBytes, 'octets');
    
    // Vérifier que le fichier n'est pas vide
    if (fileSizeInBytes === 0) {
      throw new Error('Le fichier audio est vide');
    }
    
    // Vérifier que le fichier n'est pas trop volumineux pour l'API
    if (fileSizeInBytes > MAX_DIRECT_SIZE) {
      throw new Error(`Le fichier est trop volumineux pour l'API (${fileSizeInBytes} octets > ${MAX_DIRECT_SIZE} octets)`);
    }
    
    // Créer un FormData pour l'envoi à l'API
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFilePath));
    formData.append('model', 'whisper-1');
    
    if (language) {
      formData.append('language', language);
    }
    
    console.log('[WHISPER_SERVICE] Envoi à l\'API OpenAI pour transcription');
    
    // Appeler l'API OpenAI pour la transcription avec un timeout plus long
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TRANSCRIPTION_TIMEOUT);
    
    try {
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Connection': 'keep-alive',
          'Keep-Alive': 'timeout=300'
        },
        body: formData,
        signal: controller.signal,
        timeout: TRANSCRIPTION_TIMEOUT
      });
      
      clearTimeout(timeout);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('[WHISPER_SERVICE] Erreur API OpenAI:', errorData);
        
        // Si c'est une erreur de rate limit ou de serveur, on peut réessayer
        if ((response.status === 429 || response.status >= 500) && retryCount < MAX_RETRIES) {
          console.log(`[WHISPER_SERVICE] Erreur temporaire, nouvelle tentative ${retryCount + 1}/${MAX_RETRIES} dans ${RETRY_DELAY/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          return transcribeAudioFile(audioFilePath, apiKey, language, retryCount + 1);
        }
        
        throw new Error(`Erreur API OpenAI: ${errorData.error?.message || response.statusText}`);
      }
      
      const result = await response.json();
      console.log('[WHISPER_SERVICE] Transcription réussie');
      
      return result.text || '';
    } catch (fetchError) {
      clearTimeout(timeout);
      
      if (fetchError.name === 'AbortError') {
        console.log('[WHISPER_SERVICE] La requête a expiré après 5 minutes');
        
        // Si c'est un timeout et qu'on n'a pas dépassé le nombre de tentatives, on réessaie
        if (retryCount < MAX_RETRIES) {
          console.log(`[WHISPER_SERVICE] Nouvelle tentative ${retryCount + 1}/${MAX_RETRIES} après timeout...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          return transcribeAudioFile(audioFilePath, apiKey, language, retryCount + 1);
        }
        
        throw new Error('La requête a expiré après plusieurs tentatives');
      }
      
      throw fetchError;
    }
  } catch (error) {
    console.error('[WHISPER_SERVICE] Erreur lors de la transcription audio:', error);
    throw error;
  }
}

/**
 * Télécharge un fichier audio depuis une URL et le transcrit
 * @param {string} audioUrl URL du fichier audio à télécharger
 * @param {string} apiKey Clé API OpenAI
 * @param {string} language Code de langue (optionnel, par défaut 'fr')
 * @param {Function} progressCallback Fonction de callback pour suivre la progression
 * @param {boolean} forceChunked Force le traitement par segments même pour les petits fichiers
 * @returns {Promise<string>} Texte transcrit
 */
export async function transcribeAudioFromUrl(audioUrl, apiKey, language = 'fr', progressCallback = null, forceChunked = false) {
  let inputPath = null;
  let segmentPaths = [];
  
  try {
    console.log('[WHISPER_SERVICE] Téléchargement et transcription pour:', audioUrl);
    
    if (!apiKey) {
      throw new Error('Clé API OpenAI non fournie');
    }
    
    // Mettre à jour la progression
    if (progressCallback) {
      progressCallback('Téléchargement du fichier audio...', 10);
    }
    
    // Télécharger le fichier audio
    try {
      inputPath = await downloadAudio(audioUrl);
      console.log('[WHISPER_SERVICE] Fichier téléchargé:', inputPath);
    } catch (downloadError) {
      console.error('[WHISPER_SERVICE] Erreur lors du téléchargement:', downloadError);
      throw new Error(`Erreur lors du téléchargement: ${downloadError.message}`);
    }
    
    // Vérifier que le fichier existe
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Le fichier téléchargé n'existe pas: ${inputPath}`);
    }
    
    // Vérifier la taille du fichier
    const stats = fs.statSync(inputPath);
    const fileSizeInBytes = stats.size;
    console.log('[WHISPER_SERVICE] Taille du fichier téléchargé:', fileSizeInBytes, 'octets');
    
    // Mettre à jour la progression
    if (progressCallback) {
      progressCallback('Analyse du fichier audio...', 20);
    }
    
    // Si le fichier est petit et qu'on ne force pas le découpage, le transcrire directement
    if (fileSizeInBytes <= MAX_DIRECT_SIZE && !forceChunked) {
      console.log('[WHISPER_SERVICE] Fichier de taille raisonnable, transcription directe');
      
      if (progressCallback) {
        progressCallback('Transcription en cours...', 30);
      }
      
      try {
        const transcription = await transcribeAudioFile(inputPath, apiKey, language);
        
        // Nettoyer les fichiers temporaires
        cleanupFiles([inputPath]);
        inputPath = null;
        
        if (progressCallback) {
          progressCallback('Transcription terminée', 100);
        }
        
        return transcription;
      } catch (transcriptionError) {
        console.error('[WHISPER_SERVICE] Erreur lors de la transcription directe:', transcriptionError);
        
        // Si la transcription directe échoue, essayer avec le découpage
        console.log('[WHISPER_SERVICE] Tentative avec découpage après échec de la transcription directe');
        
        if (progressCallback) {
          progressCallback('Nouvelle tentative avec découpage...', 35);
        }
        
        // Ne pas supprimer le fichier d'entrée car on va l'utiliser pour le découpage
      }
    }
    
    // Pour les fichiers volumineux ou si la transcription directe a échoué, les découper en segments
    console.log('[WHISPER_SERVICE] Fichier volumineux ou découpage forcé, découpage en segments');
    
    if (progressCallback) {
      progressCallback('Découpage du fichier audio en segments...', 30);
    }
    
    // Découper le fichier en segments
    try {
      segmentPaths = await splitAudioFile(inputPath, SEGMENT_DURATION);
      console.log('[WHISPER_SERVICE] Segments créés:', segmentPaths);
    } catch (splitError) {
      console.error('[WHISPER_SERVICE] Erreur lors du découpage:', splitError);
      
      // Nettoyer le fichier d'entrée
      if (inputPath) {
        cleanupFiles([inputPath]);
        inputPath = null;
      }
      
      throw new Error(`Erreur lors du découpage: ${splitError.message}`);
    }
    
    if (!segmentPaths || segmentPaths.length === 0) {
      // Nettoyer le fichier d'entrée
      if (inputPath) {
        cleanupFiles([inputPath]);
        inputPath = null;
      }
      
      throw new Error('Aucun segment n\'a été créé');
    }
    
    console.log('[WHISPER_SERVICE] Nombre de segments créés:', segmentPaths.length);
    
    // Transcrire chaque segment
    const transcriptions = [];
    let successCount = 0;
    
    for (let i = 0; i < segmentPaths.length; i++) {
      const segmentPath = segmentPaths[i];
      
      if (!fs.existsSync(segmentPath)) {
        console.error(`[WHISPER_SERVICE] Le segment ${i+1} n'existe pas:`, segmentPath);
        transcriptions.push(`[Segment ${i+1} non disponible]`);
        continue;
      }
      
      if (progressCallback) {
        const progress = 30 + Math.floor((i / segmentPaths.length) * 60);
        progressCallback(`Transcription du segment ${i+1}/${segmentPaths.length}...`, progress);
      }
      
      // Utiliser un système de tentatives pour chaque segment
      let segmentTranscription = '';
      let segmentSuccess = false;
      
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          console.log(`[WHISPER_SERVICE] Transcription du segment ${i+1}/${segmentPaths.length}, tentative ${attempt+1}/${MAX_RETRIES}`);
          segmentTranscription = await transcribeAudioFile(segmentPath, apiKey, language);
          segmentSuccess = true;
          break;
        } catch (segmentError) {
          console.error(`[WHISPER_SERVICE] Erreur lors de la transcription du segment ${i+1}, tentative ${attempt+1}:`, segmentError);
          
          // Si c'est la dernière tentative, on abandonne
          if (attempt === MAX_RETRIES - 1) {
            console.error(`[WHISPER_SERVICE] Échec de toutes les tentatives pour le segment ${i+1}`);
            segmentTranscription = `[Segment ${i+1} non transcrit après ${MAX_RETRIES} tentatives]`;
          } else {
            // Sinon on attend un peu avant de réessayer
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          }
        }
      }
      
      if (segmentSuccess) {
        successCount++;
      }
      
      transcriptions.push(segmentTranscription);
      
      // Ajouter un délai entre les segments pour éviter les limitations de l'API
      if (i < segmentPaths.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Vérifier si au moins un segment a été transcrit
    if (successCount === 0) {
      throw new Error('Aucun segment n\'a pu être transcrit');
    }
    
    // Combiner les transcriptions
    const combinedTranscription = transcriptions.join(' ');
    
    // Nettoyer les espaces et ponctuations en double
    const cleanedTranscription = combinedTranscription
      .replace(/\s+/g, ' ')
      .replace(/\.\s+\./g, '.')
      .replace(/\,\s+\,/g, ',')
      .replace(/\?\s+\?/g, '?')
      .replace(/\!\s+\!/g, '!')
      .trim();
    
    if (progressCallback) {
      progressCallback('Transcription terminée', 100);
    }
    
    return cleanedTranscription;
  } catch (error) {
    console.error('[WHISPER_SERVICE] Erreur lors du téléchargement et de la transcription audio:', error);
    throw error;
  } finally {
    // Nettoyer tous les fichiers temporaires
    try {
      const filesToClean = [];
      if (inputPath) filesToClean.push(inputPath);
      if (segmentPaths.length > 0) filesToClean.push(...segmentPaths);
      
      if (filesToClean.length > 0) {
        console.log('[WHISPER_SERVICE] Nettoyage des fichiers temporaires:', filesToClean.length, 'fichiers');
        cleanupFiles(filesToClean);
      }
    } catch (cleanupError) {
      console.error('[WHISPER_SERVICE] Erreur lors du nettoyage des fichiers:', cleanupError);
    }
  }
}