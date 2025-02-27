import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import compression from 'compression';
import serveStatic from 'serve-static';
import fs from 'fs';
import dotenv from 'dotenv';

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