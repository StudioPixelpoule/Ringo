#!/bin/bash

echo "🚀 Déploiement des Edge Functions RINGO"
echo "======================================="

# Vérifier que Supabase CLI est installé
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI n'est pas installé."
    echo "Installez-le avec: brew install supabase/tap/supabase"
    exit 1
fi

echo ""
echo "📋 Edge Functions à déployer:"
echo "  • process-audio (Transcription sécurisée)"
echo "  • process-chat (Chat sécurisé)"
echo "  • process-chat-stream (Chat streaming)"
echo "  • process-presentation (Support PPT/PPTX)"
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
    supabase functions deploy $func
    
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
echo "supabase secrets set OPENAI_API_KEY=votre_clé_api"
echo "" 