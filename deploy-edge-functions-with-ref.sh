#!/bin/bash

echo "🚀 Déploiement des Edge Functions RINGO"
echo "======================================="

# Demander le project-ref si non fourni
if [ -z "$1" ]; then
    echo ""
    echo "❌ Project-ref manquant !"
    echo ""
    echo "Usage: ./deploy-edge-functions-with-ref.sh [PROJECT_REF]"
    echo ""
    echo "Pour trouver votre project-ref :"
    echo "1. Allez sur https://app.supabase.com"
    echo "2. Ouvrez votre projet"
    echo "3. Dans Settings > General, copiez le 'Reference ID'"
    echo ""
    echo "Exemple: ./deploy-edge-functions-with-ref.sh abcdefghijklmnop"
    exit 1
fi

PROJECT_REF=$1

echo ""
echo "📋 Edge Functions à déployer:"
echo "  • process-audio (Transcription sécurisée)"
echo "  • process-chat (Chat sécurisé)"
echo "  • process-chat-stream (Chat streaming)"
echo "  • process-presentation (Support PPT/PPTX)"
echo ""
echo "📌 Project-ref: $PROJECT_REF"
echo ""

# Demander confirmation
read -p "Voulez-vous déployer ces fonctions? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Déploiement annulé"
    exit 1
fi

echo ""
echo "🔄 Déploiement en cours..."

# Déployer chaque fonction
functions=("process-audio" "process-chat" "process-chat-stream" "process-presentation")

for func in "${functions[@]}"; do
    echo ""
    echo "📦 Déploiement de $func..."
    supabase functions deploy $func --project-ref $PROJECT_REF
    
    if [ $? -eq 0 ]; then
        echo "✅ $func déployée avec succès"
    else
        echo "❌ Erreur lors du déploiement de $func"
        exit 1
    fi
done

echo ""
echo "✅ Toutes les Edge Functions ont été déployées avec succès!"
echo ""
echo "⚠️  N'oubliez pas de configurer les secrets dans Supabase:"
echo "   • OPENAI_API_KEY"
echo ""
echo "Pour configurer le secret:"
echo "supabase secrets set OPENAI_API_KEY=votre_clé_api --project-ref $PROJECT_REF"
echo "" 