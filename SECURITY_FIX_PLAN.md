# Plan de Correction de Sécurité - Clé API OpenAI

## 🚨 Problème Critique

La clé API OpenAI (`VITE_OPENAI_API_KEY`) est exposée côté client dans plusieurs fichiers :

1. `src/lib/openai.ts` - Client OpenAI initialisé directement avec la clé
2. `src/lib/secureProcessor.ts` - Utilise la clé pour le traitement des documents
3. `src/lib/documentStore.ts` - Utilise la clé pour le traitement
4. `src/lib/universalDocumentStore.ts` - Utilise la clé pour le traitement
5. `src/components/WebContentImporter.tsx` - ✅ Déjà corrigé

## 🛡️ Solution Proposée

### Phase 1 : Edge Functions Existantes

Nous avons déjà ces Edge Functions disponibles :
- `process-chat` - Pour les conversations
- `process-chat-stream` - Pour le streaming
- `process-audio` - Pour l'audio
- `process-web-content` - ✅ Nouvellement créée

### Phase 2 : Modifications Nécessaires

1. **Supprimer l'initialisation directe d'OpenAI** dans `src/lib/openai.ts`
2. **Remplacer tous les appels directs** par des appels aux Edge Functions
3. **Activer le chat sécurisé** dans `src/lib/secureChat.ts`
4. **Supprimer la clé API** du fichier `.env` côté client

### Phase 3 : Architecture Cible

```
Client (React) → Edge Function (Supabase) → OpenAI API
```

- Le client n'a jamais accès à la clé API
- Toute la logique OpenAI est côté serveur
- Authentication via Supabase JWT

## 📋 Tâches

1. [ ] Modifier `openai.ts` pour utiliser `secureChat.ts`
2. [ ] Activer `USE_SECURE_CHAT = true` dans `secureChat.ts`
3. [ ] Modifier `secureProcessor.ts` pour utiliser les Edge Functions
4. [ ] Modifier `documentStore.ts` et `universalDocumentStore.ts`
5. [ ] Retirer `VITE_OPENAI_API_KEY` de tous les fichiers
6. [ ] Mettre à jour la documentation
7. [ ] Tester toutes les fonctionnalités

## ⚠️ Impact

- **Chat** : Utilisera `process-chat-stream` au lieu d'appels directs
- **Documents** : Le traitement sera fait côté serveur
- **Performance** : Légère latence supplémentaire due aux Edge Functions

## 🔒 Résultat Final

- Aucune clé API exposée côté client
- Sécurité renforcée
- Architecture scalable et maintenable 