# 🚀 Guide de déploiement des Edge Functions RINGO

## 📋 Étapes de déploiement

### 1. Obtenir votre Project Reference ID

1. Connectez-vous à [app.supabase.com](https://app.supabase.com)
2. Ouvrez votre projet
3. Allez dans **Settings** → **General**
4. Copiez le **Reference ID** (ressemble à : `abcdefghijklmnop`)

### 2. Déployer les Edge Functions

```bash
# Utiliser le script avec votre project-ref
./deploy-edge-functions-with-ref.sh VOTRE_PROJECT_REF

# Exemple :
./deploy-edge-functions-with-ref.sh abcdefghijklmnop
```

### 3. Configurer la clé API OpenAI

```bash
# Après le déploiement, configurez le secret
supabase secrets set OPENAI_API_KEY=sk-... --project-ref VOTRE_PROJECT_REF
```

## 📦 Edge Functions déployées

1. **`process-audio`** - Transcription audio sécurisée
   - Utilise Whisper API d'OpenAI
   - Ne expose pas la clé API côté client

2. **`process-chat`** - Chat sécurisé
   - Gère les conversations avec GPT-4o
   - Prêt mais désactivé par défaut

3. **`process-chat-stream`** - Chat en streaming
   - Version streaming du chat
   - Support des réponses en temps réel

4. **`process-presentation`** - Support PPT/PPTX
   - Placeholder pour traitement futur
   - Actuellement limité côté client

## ⚙️ Configuration post-déploiement

### Activer progressivement les fonctions

Dans `src/lib/secureProcessor.ts` :

```typescript
const USE_SECURE_PROCESSING = {
  audio: true,      // ✅ Déjà activé
  presentation: false, // À activer quand prêt
  chat: false,      // À activer plus tard
  other: false      
};
```

### Vérifier le déploiement

1. Allez dans votre dashboard Supabase
2. Section **Edge Functions**
3. Vérifiez que les 4 fonctions apparaissent

## 🔧 Dépannage

### Erreur "Cannot find project ref"
- Utilisez le script `deploy-edge-functions-with-ref.sh`
- Ou liez d'abord : `supabase link --project-ref VOTRE_REF`

### Erreur "OpenAI API key not configured"
- Configurez le secret : `supabase secrets set OPENAI_API_KEY=...`

### Les fonctions ne se déclenchent pas
- Vérifiez que `USE_SECURE_PROCESSING` est activé
- Vérifiez les logs dans Supabase Dashboard

## 🎯 Prochaines étapes

1. **Tester l'audio** : Uploadez un fichier audio
2. **Monitorer** : Vérifiez les logs dans Supabase
3. **Activer le chat** : Quand prêt, activez dans `secureProcessor.ts` 