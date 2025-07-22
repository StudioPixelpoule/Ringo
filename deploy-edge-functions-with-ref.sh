#!/bin/bash

# Script de déploiement des Edge Functions Supabase avec référence de projet

PROJECT_REF="$1"

if [ -z "$PROJECT_REF" ]; then
  echo "❌ Erreur: Veuillez fournir la référence du projet Supabase"
  echo "Usage: ./deploy-edge-functions-with-ref.sh <project-ref>"
  exit 1
fi

echo "🚀 Déploiement des Edge Functions sur le projet: $PROJECT_REF"

# Déployer process-audio
echo "📦 Déploiement de process-audio..."
echo "y" | supabase functions deploy process-audio --project-ref "$PROJECT_REF"

# Déployer process-presentation
echo "📦 Déploiement de process-presentation..."
echo "y" | supabase functions deploy process-presentation --project-ref "$PROJECT_REF"

# Déployer process-pdf (nouvelle)
echo "📦 Déploiement de process-pdf..."
echo "y" | supabase functions deploy process-pdf --project-ref "$PROJECT_REF"

# Déployer process-document (nouvelle)
echo "📦 Déploiement de process-document..."
echo "y" | supabase functions deploy process-document --project-ref "$PROJECT_REF"

# Déployer process-chat
echo "📦 Déploiement de process-chat..."
echo "y" | supabase functions deploy process-chat --project-ref "$PROJECT_REF"

# Déployer process-chat-stream
echo "📦 Déploiement de process-chat-stream..."
echo "y" | supabase functions deploy process-chat-stream --project-ref "$PROJECT_REF"

echo "✅ Déploiement terminé !"
echo ""
echo "📌 N'oubliez pas de configurer le secret OPENAI_API_KEY si ce n'est pas déjà fait:"
echo "   supabase secrets set OPENAI_API_KEY=sk-... --project-ref $PROJECT_REF" 