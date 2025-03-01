import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dossier temporaire pour stocker les fichiers audio
const TEMP_DIR = path.join(__dirname, '..', '..', 'temp');

// Nombre maximum de tentatives pour les opérations
const MAX_RETRIES = 3;

// Délai entre les tentatives (en ms)
const RETRY_DELAY = 2000;

// Créer le dossier temporaire s'il n'existe pas
if (!fs.existsSync(TEMP_DIR)) {
  try {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    console.log('[FFMPEG_SERVICE] Dossier temporaire créé:', TEMP_DIR);
  } catch (error) {
    console.error('[FFMPEG_SERVICE] Erreur lors de la création du dossier temporaire:', error);
  }
}

/**
 * Télécharge un fichier audio depuis une URL
 * @param {string} url URL du fichier audio
 * @returns {Promise<string>} Chemin du fichier téléchargé
 */
export async function downloadAudio(url) {
  try {
    console.log('[FFMPEG_SERVICE] Téléchargement du fichier audio:', url);
    
    // Générer un nom de fichier unique
    const fileId = uuidv4();
    const fileExtension = path.extname(url) || '.mp3';
    const outputPath = path.join(TEMP_DIR, `input_${fileId}${fileExtension}`);
    
    // Télécharger le fichier avec un timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000); // 5 minutes timeout
    
    try {
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: {
          'Connection': 'keep-alive',
          'Keep-Alive': 'timeout=300'
        },
        timeout: 300000 // 5 minutes
      });
      clearTimeout(timeout);
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(outputPath, Buffer.from(buffer));
      
      console.log('[FFMPEG_SERVICE] Fichier téléchargé avec succès:', outputPath, 'Taille:', buffer.byteLength, 'octets');
      return outputPath;
    } catch (fetchError) {
      clearTimeout(timeout);
      
      if (fetchError.name === 'AbortError') {
        throw new Error('Le téléchargement a expiré après 5 minutes');
      }
      
      throw fetchError;
    }
  } catch (error) {
    console.error('[FFMPEG_SERVICE] Erreur lors du téléchargement du fichier audio:', error);
    throw error;
  }
}

/**
 * Obtient la durée d'un fichier audio
 * @param {string} filePath Chemin du fichier audio
 * @returns {Promise<number>} Durée en secondes
 */
export function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    try {
      console.log('[FFMPEG_SERVICE] Analyse du fichier audio pour obtenir la durée:', filePath);
      
      // Vérifier que le fichier existe
      if (!fs.existsSync(filePath)) {
        return reject(new Error(`Le fichier n'existe pas: ${filePath}`));
      }
      
      // Définir un timeout pour ffprobe
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout lors de l\'analyse du fichier audio'));
      }, 60000); // 1 minute
      
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        clearTimeout(timeoutId);
        
        if (err) {
          console.error('[FFMPEG_SERVICE] Erreur lors de l\'analyse du fichier audio:', err);
          return reject(err);
        }
        
        if (!metadata || !metadata.format || !metadata.format.duration) {
          console.error('[FFMPEG_SERVICE] Métadonnées invalides:', metadata);
          return reject(new Error('Impossible d\'obtenir la durée du fichier audio'));
        }
        
        const durationInSeconds = metadata.format.duration;
        console.log('[FFMPEG_SERVICE] Durée du fichier audio:', durationInSeconds, 'secondes');
        resolve(durationInSeconds);
      });
    } catch (error) {
      console.error('[FFMPEG_SERVICE] Exception lors de l\'analyse du fichier audio:', error);
      reject(error);
    }
  });
}

/**
 * Découpe un fichier audio en segments
 * @param {string} inputPath Chemin du fichier audio d'entrée
 * @param {number} segmentDuration Durée de chaque segment en secondes
 * @returns {Promise<string[]>} Chemins des segments créés
 */
export function splitAudioFile(inputPath, segmentDuration = 60) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('[FFMPEG_SERVICE] Découpage du fichier audio en segments de', segmentDuration, 'secondes');
      
      // Vérifier que le fichier existe
      if (!fs.existsSync(inputPath)) {
        return reject(new Error(`Le fichier d'entrée n'existe pas: ${inputPath}`));
      }
      
      // Obtenir la durée totale du fichier
      let totalDuration;
      try {
        totalDuration = await getAudioDuration(inputPath);
      } catch (durationError) {
        console.error('[FFMPEG_SERVICE] Erreur lors de l\'obtention de la durée, utilisation d\'une valeur par défaut:', durationError);
        totalDuration = 600; // 10 minutes par défaut
      }
      
      // Calculer le nombre de segments
      const numSegments = Math.ceil(totalDuration / segmentDuration);
      console.log('[FFMPEG_SERVICE] Nombre de segments à créer:', numSegments);
      
      // Limiter le nombre de segments pour éviter les problèmes de mémoire
      const maxSegments = 20;
      const actualNumSegments = Math.min(numSegments, maxSegments);
      
      if (actualNumSegments < numSegments) {
        console.log(`[FFMPEG_SERVICE] Limitation à ${maxSegments} segments pour éviter les problèmes de mémoire`);
        // Ajuster la durée des segments pour couvrir tout le fichier
        segmentDuration = Math.ceil(totalDuration / maxSegments);
        console.log(`[FFMPEG_SERVICE] Nouvelle durée des segments: ${segmentDuration} secondes`);
      }
      
      // Générer un ID unique pour ce groupe de segments
      const batchId = uuidv4();
      const segmentPaths = [];
      
      // Créer une promesse pour chaque segment
      const segmentPromises = [];
      
      for (let i = 0; i < actualNumSegments; i++) {
        const startTime = i * segmentDuration;
        const outputPath = path.join(TEMP_DIR, `segment_${batchId}_${i}.mp3`);
        segmentPaths.push(outputPath);
        
        const segmentPromise = new Promise((resolveSegment, rejectSegment) => {
          // Fonction récursive pour créer un segment avec des tentatives
          const createSegment = (retryCount = 0) => {
            try {
              // Définir un timeout pour la commande ffmpeg
              const timeoutId = setTimeout(() => {
                console.error(`[FFMPEG_SERVICE] Timeout lors de la création du segment ${i+1}`);
                
                // Si on n'a pas dépassé le nombre de tentatives, on réessaie
                if (retryCount < MAX_RETRIES) {
                  console.log(`[FFMPEG_SERVICE] Nouvelle tentative ${retryCount + 1}/${MAX_RETRIES} pour le segment ${i+1}...`);
                  
                  setTimeout(() => {
                    createSegment(retryCount + 1);
                  }, RETRY_DELAY);
                  return;
                }
                
                rejectSegment(new Error(`Timeout lors de la création du segment ${i+1}`));
              }, 120000); // 2 minutes
              
              const command = ffmpeg(inputPath)
                .setStartTime(startTime)
                .setDuration(segmentDuration)
                .output(outputPath)
                .audioCodec('libmp3lame')
                .audioQuality(3) // Qualité moyenne (0-9, 0 étant la meilleure)
                .on('start', (commandLine) => {
                  console.log(`[FFMPEG_SERVICE] Commande pour le segment ${i+1}:`, commandLine);
                })
                .on('progress', (progress) => {
                  console.log(`[FFMPEG_SERVICE] Progression du segment ${i+1}: ${progress.percent}%`);
                })
                .on('end', () => {
                  clearTimeout(timeoutId);
                  console.log(`[FFMPEG_SERVICE] Segment ${i+1}/${actualNumSegments} créé:`, outputPath);
                  resolveSegment(outputPath);
                })
                .on('error', (err) => {
                  clearTimeout(timeoutId);
                  console.error(`[FFMPEG_SERVICE] Erreur lors de la création du segment ${i+1}:`, err);
                  
                  // Si on n'a pas dépassé le nombre de tentatives, on réessaie
                  if (retryCount < MAX_RETRIES) {
                    console.log(`[FFMPEG_SERVICE] Nouvelle tentative ${retryCount + 1}/${MAX_RETRIES} pour le segment ${i+1}...`);
                    
                    setTimeout(() => {
                      createSegment(retryCount + 1);
                    }, RETRY_DELAY);
                    return;
                  }
                  
                  rejectSegment(err);
                });
              
              command.run();
            } catch (error) {
              console.error(`[FFMPEG_SERVICE] Exception lors de la création du segment ${i+1}:`, error);
              
              // Si on n'a pas dépassé le nombre de tentatives, on réessaie
              if (retryCount < MAX_RETRIES) {
                console.log(`[FFMPEG_SERVICE] Nouvelle tentative ${retryCount + 1}/${MAX_RETRIES} pour le segment ${i+1}...`);
                
                setTimeout(() => {
                  createSegment(retryCount + 1);
                }, RETRY_DELAY);
                return;
              }
              
              rejectSegment(error);
            }
          };
          
          // Lancer la création du segment
          createSegment();
        });
        
        segmentPromises.push(segmentPromise);
      }
      
      // Traiter les segments par lots pour éviter de surcharger le système
      const batchSize = 3;
      const successfulSegments = [];
      
      for (let i = 0; i < segmentPromises.length; i += batchSize) {
        const batch = segmentPromises.slice(i, i + batchSize);
        console.log(`[FFMPEG_SERVICE] Traitement du lot de segments ${i+1} à ${Math.min(i+batchSize, segmentPromises.length)}`);
        
        const results = await Promise.allSettled(batch);
        
        // Ajouter les segments réussis
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            successfulSegments.push(segmentPaths[i + index]);
          } else {
            console.error(`[FFMPEG_SERVICE] Échec du segment ${i + index + 1}:`, result.reason);
          }
        });
        
        // Attendre un peu entre les lots pour éviter de surcharger le système
        if (i + batchSize < segmentPromises.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      if (successfulSegments.length === 0) {
        throw new Error('Aucun segment n\'a pu être créé');
      }
      
      console.log('[FFMPEG_SERVICE] Segments créés avec succès:', successfulSegments.length, '/', actualNumSegments);
      resolve(successfulSegments);
    } catch (error) {
      console.error('[FFMPEG_SERVICE] Erreur lors du découpage du fichier audio:', error);
      reject(error);
    }
  });
}

/**
 * Nettoie les fichiers temporaires
 * @param {string[]} filePaths Chemins des fichiers à supprimer
 */
export function cleanupFiles(filePaths) {
  console.log('[FFMPEG_SERVICE] Nettoyage des fichiers temporaires');
  
  filePaths.forEach(filePath => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('[FFMPEG_SERVICE] Fichier supprimé:', filePath);
      }
    } catch (error) {
      console.error('[FFMPEG_SERVICE] Erreur lors de la suppression du fichier:', filePath, error);
    }
  });
}

/**
 * Nettoie tous les fichiers temporaires du dossier temp
 */
export function cleanupAllTempFiles() {
  try {
    console.log('[FFMPEG_SERVICE] Nettoyage de tous les fichiers temporaires');
    
    if (fs.existsSync(TEMP_DIR)) {
      const files = fs.readdirSync(TEMP_DIR);
      
      files.forEach(file => {
        const filePath = path.join(TEMP_DIR, file);
        try {
          fs.unlinkSync(filePath);
          console.log('[FFMPEG_SERVICE] Fichier supprimé:', filePath);
        } catch (error) {
          console.error('[FFMPEG_SERVICE] Erreur lors de la suppression du fichier:', filePath, error);
        }
      });
      
      console.log('[FFMPEG_SERVICE] Nettoyage terminé, suppression de', files.length, 'fichiers');
    }
  } catch (error) {
    console.error('[FFMPEG_SERVICE] Erreur lors du nettoyage des fichiers temporaires:', error);
  }
}