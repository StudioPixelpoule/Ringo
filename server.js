import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import compression from 'compression';
import serveStatic from 'serve-static';
import fs from 'fs';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import FormData from 'form-data';

// Charger les variables d'environnement
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Enable gzip compression
app.use(compression());

// Parse JSON request body
app.use(express.json());

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
    const { audioUrl } = req.body;
    
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
    
    try {
      // Télécharger le fichier audio
      const audioResponse = await fetch(audioUrl);
      
      if (!audioResponse.ok) {
        throw new Error(`Erreur HTTP: ${audioResponse.status}`);
      }
      
      // Convertir la réponse en buffer
      const audioBuffer = await audioResponse.buffer();
      
      // Vérifier la taille du fichier
      const fileSizeInBytes = audioBuffer.length;
      const maxSizeInBytes = 25 * 1024 * 1024; // 25 MB
      
      if (fileSizeInBytes > maxSizeInBytes) {
        console.warn('[API] Fichier audio trop volumineux:', fileSizeInBytes, 'octets');
        return res.status(400).json({ 
          error: 'Audio file is too large',
          message: 'Le fichier audio est trop volumineux pour être transcrit automatiquement (limite de 25 Mo).'
        });
      }
      
      // Créer un FormData pour l'envoi à l'API
      const formData = new FormData();
      formData.append('file', audioBuffer, { filename: 'audio.mp3' });
      formData.append('model', 'whisper-1');
      formData.append('language', 'fr'); // Langue française
      
      // Appeler l'API OpenAI pour la transcription
      console.log('[API] Envoi à l\'API OpenAI pour transcription');
      
      const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData
      });
      
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
      
    } catch (fetchError) {
      console.error('[API] Erreur lors du traitement du fichier audio:', fetchError);
      res.status(500).json({ 
        error: 'Audio processing error',
        message: fetchError.message
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