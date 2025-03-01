# Ringo AI Assistant

Ringo est un assistant IA spécialisé pour l'IRSST (Institut de recherche Robert-Sauvé en santé et en sécurité du travail), conçu pour aider les utilisateurs à trouver des informations sur la santé et la sécurité au travail.

## Fonctionnalités

- **Analyse de documents** : Téléchargez et analysez des documents dans divers formats (PDF, DOCX, TXT, etc.)
- **Transcription audio** : Convertissez des fichiers audio en texte pour analyse
- **Visualisation de données** : Explorez vos documents via une interface de mind map interactive
- **Chat IA** : Posez des questions et obtenez des réponses basées sur vos documents
- **Gestion des utilisateurs** : Interface d'administration pour gérer les utilisateurs et leurs droits

## Technologies utilisées

- **Frontend** : React, TypeScript, Tailwind CSS
- **Backend** : Node.js, Express
- **Base de données** : Supabase (PostgreSQL)
- **IA** : OpenAI API (GPT-4, Whisper)
- **Visualisation** : ReactFlow, D3.js

## Prérequis

- Node.js 18.x ou supérieur
- Compte Supabase
- Clé API OpenAI

## Installation

1. Clonez le dépôt
2. Installez les dépendances avec `npm install`
3. Copiez `.env.example` vers `.env` et configurez les variables d'environnement
4. Lancez le serveur de développement avec `npm run dev`

## Configuration

### Variables d'environnement

```
# Supabase Configuration
VITE_SUPABASE_URL=your-supabase-url-here
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here

# OpenAI Configuration
VITE_OPENAI_API_KEY=your-openai-api-key-here

# Server Configuration
PORT=3000
NODE_ENV=development
```

### Base de données Supabase

Le projet utilise Supabase comme base de données. Les migrations SQL sont disponibles dans le dossier `supabase/migrations`.

## Déploiement

Le projet peut être déployé sur Netlify en utilisant le fichier `netlify.toml` inclus.

```bash
npm run build
```

## Licence

Tous droits réservés © 2025