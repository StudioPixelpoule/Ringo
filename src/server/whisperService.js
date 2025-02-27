import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Transcrit un fichier audio en utilisant l'API Whisper d'OpenAI
 * @param {string} audioFilePath Chemin vers le fichier audio à transcrire
 * @param {string} apiKey Clé API OpenAI
 * @param {string} language Code de langue (optionnel, par défaut 'fr')
 * @returns {Promise<string>} Texte transcrit
 */
export async function transcribeAudioFile(audioFilePath, apiKey, language = 'fr') {
  try {
    console.log('[WHISPER_SERVICE] Début de la transcription pour:', audioFilePath);
    
    if (!apiKey) {
      throw new Error('Clé API OpenAI non fournie');
    }
    
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Le fichier audio n'existe pas: ${audioFilePath}`);
    }
    
    // Vérifier la taille du fichier
    const stats = fs.statSync(audioFilePath);
    const fileSizeInBytes = stats.size;
    const maxSizeInBytes = 25 * 1024 * 1024; // 25 MB
    
    if (fileSizeInBytes > maxSizeInBytes) {
      throw new Error(`Le fichier audio est trop volumineux: ${fileSizeInBytes} octets (max: ${maxSizeInBytes} octets)`);
    }
    
    // Créer un FormData pour l'envoi à l'API
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFilePath));
    formData.append('model', 'whisper-1');
    
    if (language) {
      formData.append('language', language);
    }
    
    console.log('[WHISPER_SERVICE] Envoi à l\'API OpenAI pour transcription');
    
    // Appeler l'API OpenAI pour la transcription
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...formData.getHeaders()
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[WHISPER_SERVICE] Erreur API OpenAI:', errorData);
      throw new Error(`Erreur API OpenAI: ${errorData.error?.message || response.statusText}`);
    }
    
    const result = await response.json();
    console.log('[WHISPER_SERVICE] Transcription réussie');
    
    return result.text || '';
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
 * @returns {Promise<string>} Texte transcrit
 */
export async function transcribeAudioFromUrl(audioUrl, apiKey, language = 'fr') {
  try {
    console.log('[WHISPER_SERVICE] Téléchargement et transcription pour:', audioUrl);
    
    if (!apiKey) {
      throw new Error('Clé API OpenAI non fournie');
    }
    
    // Créer un dossier temporaire s'il n'existe pas
    const tempDir = path.join(__dirname, '..', '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 10);
    const fileExtension = path.extname(audioUrl) || '.mp3';
    const fileName = `audio_${timestamp}_${randomString}${fileExtension}`;
    const filePath = path.join(tempDir, fileName);
    
    console.log('[WHISPER_SERVICE] Téléchargement du fichier audio:', audioUrl);
    
    // Télécharger le fichier audio
    const response = await fetch(audioUrl);
    
    if (!response.ok) {
      throw new Error(`Erreur lors du téléchargement du fichier audio: ${response.statusText}`);
    }
    
    const fileStream = fs.createWriteStream(filePath);
    
    await new Promise((resolve, reject) => {
      response.body.pipe(fileStream);
      response.body.on('error', (err) => {
        reject(err);
      });
      fileStream.on('finish', function() {
        resolve();
      });
    });
    
    console.log('[WHISPER_SERVICE] Fichier audio téléchargé avec succès:', filePath);
    
    // Transcrire le fichier audio
    const transcription = await transcribeAudioFile(filePath, apiKey, language);
    
    // Supprimer le fichier temporaire
    fs.unlinkSync(filePath);
    
    return transcription;
  } catch (error) {
    console.error('[WHISPER_SERVICE] Erreur lors du téléchargement et de la transcription audio:', error);
    throw error;
  }
}