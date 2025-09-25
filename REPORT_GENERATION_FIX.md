# Correction de la Génération de Rapports

## Problème identifié
Les rapports ne pouvaient pas être générés avec l'erreur "No content found for document" car le système ne trouvait pas le contenu des documents importés.

## Cause racine
Il existe deux flux d'importation de documents dans l'application :
1. **Nouveau flux** : Stocke le contenu dans la table `document_contents`
2. **Ancien flux** : Stocke le contenu dans la colonne `content` de la table `documents`

Le générateur de rapports ne cherchait que dans `document_contents`, causant des échecs pour les documents importés avec l'ancien système.

## Solutions appliquées

### 1. Double recherche du contenu
Le système cherche maintenant dans les deux emplacements possibles :
- D'abord dans `document_contents` (nouveau système)
- Si non trouvé, dans `documents.content` (ancien système)

### 2. Migration automatique
Création d'un système de migration automatique qui :
- Détecte les documents sans contenu dans `document_contents`
- Migre automatiquement le contenu depuis `documents.content`
- S'exécute en arrière-plan lors du chargement d'une conversation
- S'exécute avant la génération d'un rapport

### 3. Gestion améliorée des formats
Le système gère maintenant différents formats de contenu :
- Texte brut
- JSON stringifié
- Objets avec propriété `content` ou `text`
- Structures complexes

### 4. Logs détaillés
Ajout de logs pour faciliter le débogage :
- Identification des documents traités
- Source du contenu (document_contents ou documents)
- Format du contenu détecté
- Erreurs de migration

## Fichiers modifiés

### `src/lib/reportGenerator.ts`
- Import de `generateChatResponseSecure` au lieu de `generateChatResponse`
- Recherche du contenu dans les deux tables
- Gestion des différents formats
- Appel à la migration automatique
- Logs détaillés

### `src/lib/migrateDocumentContent.ts` (nouveau)
- Fonction de migration pour un document unique
- Fonction de migration pour tous les documents d'une conversation
- Gestion des erreurs et logs

### `src/lib/conversationStore.ts`
- Import du module de migration
- Migration automatique en arrière-plan lors du chargement des documents

## Utilisation

### Migration manuelle
Si nécessaire, la migration peut être déclenchée manuellement :

```typescript
import { migrateDocumentContent, migrateConversationDocuments } from './lib/migrateDocumentContent';

// Migrer un document spécifique
await migrateDocumentContent('document-id-here');

// Migrer tous les documents d'une conversation
await migrateConversationDocuments('conversation-id-here');
```

### Vérification dans la console
Les logs de migration apparaissent dans la console du navigateur avec le préfixe `[Migration]` :
- `[Migration] Checking if document X needs content migration...`
- `[Migration] Successfully migrated content for document X`
- `[Migration] Document X already has content in document_contents`

## Impact
- Les rapports peuvent maintenant être générés pour TOUS les documents, peu importe leur méthode d'importation
- Migration transparente sans intervention utilisateur
- Aucune perte de données
- Performance optimisée avec cache dans `document_contents`

## Recommandations futures
1. Migrer progressivement tous les documents existants
2. Standardiser sur un seul flux d'importation
3. Éventuellement supprimer la colonne `content` de la table `documents` après migration complète
