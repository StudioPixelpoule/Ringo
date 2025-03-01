import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import compression from 'compression';
import serveStatic from 'serve-static';
import fs from 'fs';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import FormData from 'form-data';
import multer from 'multer';
import { transcribeAudioFromUrl } from './src/server/whisperService.js';

// Charger les variables d'environnement
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Configuration de multer pour le stockage temporaire des fichiers
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tempDir = join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // Limite à 100 MB
});

// Enable gzip compression
app.use(compression());

// Augmenter les limites pour les requêtes JSON
app.use(express.json({ 
  limit: '50mb',
  extended: true
}));

// Augmenter les limites pour les données URL-encoded
app.use(express.urlencoded({
  limit: '50mb',
  extended: true,
  parameterLimit: 50000
}));

// Augmenter le timeout des requêtes
app.use((req, res, next) => {
  // Définir un timeout de 10 minutes
  req.setTimeout(600000);
  res.setTimeout(600000);
  next();
});

// Middleware pour éviter les erreurs de socket hang up
app.use((req, res, next) => {
  // Configurer les en-têtes pour maintenir la connexion ouverte
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=600');
  next();
});

// API endpoint to save OpenAI API key
app.post('/api/save-openai-key', (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey) {
      console.error('[API] Erreur: Clé API manquante');
      return res.status(400).json({ error: 'API key is required' });
    }
    
    if (!apiKey.startsWith('sk-')) {
      console.error('[API] Erreur: Format de clé API invalide');
      return res.status(400).json({ error: 'Invalid API key format' });
    }
    
    console.log('[API] Sauvegarde de la clé API OpenAI');
    
    // Mettre à jour la variable d'environnement en mémoire
    process.env.VITE_OPENAI_API_KEY = apiKey;
    
    // Essayer de mettre à jour le fichier .env si possible
    try {
      const envPath = join(__dirname, '.env');
      let envContent = '';
      
      // Lire le fichier .env s'il existe
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
        
        // Remplacer ou ajouter la clé API
        if (envContent.includes('VITE_OPENAI_API_KEY=')) {
          envContent = envContent.replace(
            /VITE_OPENAI_API_KEY=.*/,
            `VITE_OPENAI_API_KEY=${apiKey}`
          );
        } else {
          envContent += `\nVITE_OPENAI_API_KEY=${apiKey}\n`;
        }
      } else {
        // Créer un nouveau fichier .env
        envContent = `VITE_OPENAI_API_KEY=${apiKey}\n`;
      }
      
      // Écrire le fichier .env
      fs.writeFileSync(envPath, envContent);
      console.log('[API] Fichier .env mis à jour avec succès');
    } catch (fileError) {
      console.error('[API] Erreur lors de la mise à jour du fichier .env:', fileError);
      console.log('[API] Clé API OpenAI stockée uniquement en mémoire');
    }
    
    // Return success response
    res.status(200).json({ 
      success: true, 
      message: 'API key saved successfully'
    });
  } catch (error) {
    console.error('[API] Erreur lors de la sauvegarde de la clé API OpenAI:', error);
    res.status(500).json({ error: 'Failed to save API key' });
  }
});

// API endpoint for audio transcription
app.post('/api/transcribe-audio', async (req, res) => {
  try {
    const { audioUrl, documentId, forceChunked } = req.body;
    
    if (!audioUrl) {
      console.error('[API] Erreur: URL audio manquante');
      return res.status(400).json({ error: 'Audio URL is required' });
    }
    
    // Récupérer la clé API OpenAI
    const apiKey = process.env.VITE_OPENAI_API_KEY;
    
    if (!apiKey || apiKey === 'dummy-key' || apiKey === 'your-openai-api-key-here') {
      console.error('[API] Erreur: Clé API OpenAI non configurée');
      return res.status(400).json({ error: 'OpenAI API key is not configured' });
    }
    
    console.log('[API] Début de la transcription audio pour:', audioUrl);
    
    // Créer un canal SSE pour suivre la progression si documentId est fourni
    let progressCallback = null;
    
    if (documentId) {
      progressCallback = (message, progress) => {
        console.log(`[API] Progression de la transcription: ${progress}% - ${message}`);
      };
    }
    
    // Définir un timeout plus long pour les requêtes de transcription
    req.setTimeout(600000); // 10 minutes
    res.setTimeout(600000); // 10 minutes
    
    try {
      // Utiliser notre service de transcription avec un paramètre pour forcer le découpage
      const transcription = await transcribeAudioFromUrl(
        audioUrl, 
        apiKey, 
        'fr', 
        progressCallback,
        forceChunked // Passer le paramètre pour forcer le découpage
      );
      
      console.log('[API] Transcription réussie, longueur:', transcription.length);
      
      // Retourner le résultat
      res.status(200).json({ 
        success: true, 
        transcription: transcription || ''
      });
      
    } catch (transcriptionError) {
      console.error('[API] Erreur lors de la transcription:', transcriptionError);
      res.status(500).json({ 
        error: 'Transcription failed',
        message: transcriptionError.message
      });
    }
    
  } catch (error) {
    console.error('[API] Erreur lors de la transcription audio:', error);
    res.status(500).json({ 
      error: 'Transcription failed',
      message: error.message
    });
  }
});

// API endpoint for direct file upload and transcription
app.post('/api/upload-audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }
    
    // Récupérer la clé API OpenAI
    const apiKey = process.env.VITE_OPENAI_API_KEY;
    
    if (!apiKey || apiKey === 'dummy-key' || apiKey === 'your-openai-api-key-here') {
      console.error('[API] Erreur: Clé API OpenAI non configurée');
      return res.status(400).json({ error: 'OpenAI API key is not configured' });
    }
    
    const filePath = req.file.path;
    console.log('[API] Fichier audio téléversé:', filePath);
    
    // Vérifier la taille du fichier
    const stats = fs.statSync(filePath);
    console.log('[API] Taille du fichier:', stats.size, 'octets');
    
    // Définir un timeout plus long pour les requêtes de transcription
    req.setTimeout(600000); // 10 minutes
    res.setTimeout(600000); // 10 minutes
    
    // Créer un FormData pour l'envoi à l'API
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('model', 'whisper-1');
    formData.append('language', 'fr');
    
    // Appeler l'API OpenAI pour la transcription
    console.log('[API] Envoi à l\'API OpenAI pour transcription');
    
    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData,
      // Ajouter un timeout plus long
      timeout: 300000 // 5 minutes
    });
    
    // Supprimer le fichier temporaire
    fs.unlinkSync(filePath);
    
    if (!transcriptionResponse.ok) {
      const errorData = await transcriptionResponse.json();
      console.error('[API] Erreur API OpenAI:', errorData);
      return res.status(500).json({ 
        error: 'OpenAI API error',
        message: errorData.error?.message || transcriptionResponse.statusText
      });
    }
    
    const transcriptionResult = await transcriptionResponse.json();
    console.log('[API] Transcription réussie');
    
    // Retourner le résultat
    res.status(200).json({ 
      success: true, 
      transcription: transcriptionResult.text || ''
    });
    
  } catch (error) {
    console.error('[API] Erreur lors de la transcription du fichier audio:', error);
    res.status(500).json({ 
      error: 'Transcription failed',
      message: error.message
    });
  }
});

// Serve static files with proper caching
app.use(serveStatic(join(__dirname, 'dist'), {
  maxAge: '1y',
  etag: false
}));

// Handle all routes by serving index.html
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

const port = process.env.PORT || 3000;

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});