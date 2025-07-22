#!/bin/bash

echo "🔐 Configuration de la clé API OpenAI pour RINGO"
echo "=============================================="
echo ""
echo "Ce script va configurer votre clé API OpenAI dans Supabase."
echo ""
echo "⚠️  IMPORTANT: Votre clé doit commencer par 'sk-'"
echo ""

# Demander la clé API
read -p "Entrez votre clé API OpenAI: " -s OPENAI_KEY
echo ""

# Vérifier que la clé commence par sk-
if [[ ! $OPENAI_KEY =~ ^sk- ]]; then
    echo "❌ Erreur: La clé API doit commencer par 'sk-'"
    exit 1
fi

echo ""
echo "🔄 Configuration en cours..."

# Configurer le secret
supabase secrets set OPENAI_API_KEY=$OPENAI_KEY --project-ref kitzhhrhlaevrtbqnbma

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Clé API configurée avec succès !"
    echo ""
    echo "📝 Prochaines étapes :"
    echo "1. Les fonctions audio sont déjà activées automatiquement"
    echo "2. Testez en uploadant un fichier audio"
    echo "3. Vérifiez les logs dans le dashboard Supabase"
else
    echo ""
    echo "❌ Erreur lors de la configuration"
    echo "Essayez manuellement avec :"
    echo "supabase secrets set OPENAI_API_KEY=votre_clé --project-ref kitzhhrhlaevrtbqnbma"
fi 