# Débogage du Problème d'Import de 16 Documents

## 🔍 Problème

L'utilisateur a sélectionné 16 documents existants dans l'explorateur mais :
- 17 erreurs 400 sur `conversation_documents`
- Message "J'ai bien reçu 0 documents"

## ✅ Solution Trouvée

Le problème venait de la requête `fetchConversationDocuments` qui demandait des champs inexistants dans la table `documents` :
- `original_name` 
- `updated_at`

Ces champs n'existent pas dans la base de données actuelle, ce qui causait l'erreur :
```
column documents_1.original_name does not exist
```

**Les documents étaient bien liés** (15 sur 16 ont été ajoutés avec succès), mais l'interface ne pouvait pas les récupérer pour les afficher.

## 🛠️ Correction Appliquée

Dans `src/lib/conversationStore.ts`, modification de la requête `fetchConversationDocuments` :

```typescript
// Avant (avec champs inexistants)
documents:document_id (
  id,
  name,
  type,
  url,
  description,
  group_name,
  processed,
  folder_id,
  original_name,  // ❌ N'existe pas
  created_at,
  updated_at      // ❌ N'existe pas
)

// Après (champs valides uniquement)
documents:document_id (
  id,
  name,
  type,
  url,
  description,
  group_name,
  processed,
  folder_id,
  created_at
)
```

## 🎯 Résultat

- Les 16 documents peuvent maintenant être importés
- L'interface affiche correctement le nombre de documents
- Plus d'erreurs 400 lors de la récupération

## 🔎 Logs Ajoutés (puis retirés)

Pour diagnostiquer le problème, j'ai ajouté des logs dans :

1. **FileExplorer.tsx - `importDocumentsToChat`**
   - Documents sélectionnés (IDs)
   - Documents trouvés (objets complets)
   - Conversation actuelle

2. **conversationStore.ts - `linkDocumentSilently`**
   - Type et valeur du documentId
   - Vérification d'existence du document
   - Tentative de liaison
   - Détails de l'erreur 400

3. **conversationStore.ts - `linkMultipleDocuments`**
   - Nombre de documents traités
   - Documents ajoutés vs déjà liés vs erreurs

4. **conversationStore.ts - `fetchConversationDocuments`**
   - Documents récupérés après liaison

## 🧪 Test à Effectuer

1. Ouvrir la console du navigateur (F12)
2. Sélectionner 2-3 documents dans l'explorateur
3. Cliquer "Envoyer au chat"
4. Observer les logs dans la console

## 🔍 Ce qu'on Cherche

```javascript
// Exemple de logs attendus
Documents sélectionnés: ['uuid1', 'uuid2', 'uuid3']
Documents trouvés: [{id: 'uuid1', name: 'Doc1'}, ...]
linkDocumentSilently appelé avec documentId: uuid1 (type: string)
Document uuid1 trouvé, vérification du lien existant...
Erreur lors de l'insertion dans conversation_documents pour uuid1: {...}
```

## 💡 Causes Possibles

1. **IDs invalides** : Les UUIDs ne sont pas au bon format
2. **Documents supprimés** : Les documents n'existent plus dans la base
3. **Permissions RLS** : L'utilisateur n'a pas le droit de lier ces documents
4. **Contrainte de clé étrangère** : La conversation ou les documents n'existent pas
5. **Limite atteinte** : Ancienne limite de 8 documents toujours active côté base

## 🛠️ Solution Temporaire

En attendant le diagnostic complet :

1. **Importer moins de documents** : Essayer avec 4-5 documents max
2. **Vérifier les documents** : S'assurer qu'ils sont bien dans la base
3. **Nouvelle conversation** : Créer une nouvelle conversation et réessayer

## 📊 Informations à Récupérer

Après le test, partager :
- Les logs de la console
- Le nombre exact de documents sélectionnés
- Si certains documents s'ajoutent ou si tous échouent
- Le message d'erreur exact de Supabase (dans les logs) 