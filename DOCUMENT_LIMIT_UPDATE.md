# Augmentation de la Limite de Documents par Conversation

## 📋 Résumé des Modifications

La limite de documents par conversation a été augmentée de **4 à 8 documents** avec l'ajout d'un système de compression intelligente pour garantir le bon fonctionnement.

## 🔧 Modifications Techniques

### 1. **Constantes Mises à Jour** (`src/lib/constants.ts`)
- `MAX_DOCUMENTS_PER_CONVERSATION`: 4 → 8
- `MAX_TOKENS_PER_DOC`: 70% → 85% (optimisation de l'utilisation des tokens)
- `MAX_HISTORY_TOKENS`: 4000 → 3000 (libération d'espace pour les documents)

### 2. **Système de Compression Intelligente** (`src/lib/documentCompressor.ts`)
Nouveau module créé pour gérer la compression automatique des documents :

- **Compression activée** : Quand plus de 4 documents sont ajoutés
- **Allocation dynamique** : ~15 000 tokens par document avec 8 documents
- **Compression intelligente** :
  - Préservation des sections importantes (titres, données structurées)
  - Priorisation basée sur les mots-clés de la requête
  - Résumé automatique des sections moins importantes

### 3. **Intégration dans le Store** (`src/lib/conversationStore.ts`)
- Import du module de compression
- Application automatique de la compression pour > 4 documents
- Logs détaillés du processus de compression
- Notification visuelle quand un document est compressé

### 4. **Logs d'Allocation** (`src/lib/openai.ts`)
- Ajout de logs pour tracer l'allocation des tokens
- Affichage du nombre de tokens par document
- Surveillance de l'utilisation totale

## 📊 Capacités du Système

### Avec 8 Documents :
- **Tokens disponibles** : 119 000 (après réservation système)
- **Tokens par document** : ~14 875
- **Caractères par document** : ~59 500 (sans compression)

### Algorithme de Compression :
1. Documents < 14 875 tokens : Pas de compression
2. Documents > 14 875 tokens : Compression intelligente
   - Sections importantes préservées
   - Contenu moins pertinent résumé
   - Note de compression ajoutée

## ✅ Avantages

1. **Capacité doublée** : Support de 8 documents au lieu de 4
2. **Préservation de la qualité** : Compression intelligente garde l'essentiel
3. **Transparence** : Utilisateur informé quand compression appliquée
4. **Performance maintenue** : Reste dans les limites de GPT-4o
5. **Aucune régression** : Toutes les fonctionnalités existantes préservées

## 🎯 Cas d'Usage

- Analyse comparative de multiples documents
- Synthèse de réunions multiples
- Revue de documentation technique volumineuse
- Analyse de rapports financiers multiples

## ⚡ Limitations

- Maximum absolu : 8 documents par conversation
- Documents très volumineux seront compressés
- La compression peut omettre certains détails mineurs

## 🔍 Monitoring

Pour suivre le fonctionnement :
1. Ouvrir la console du navigateur
2. Observer les logs `📊 Allocation des tokens`
3. Vérifier les logs `🗜️ Compression nécessaire`

## 🚀 Évolutions Futures

1. **Compression adaptative** : Ajuster selon le type de document
2. **Mode focus** : Permettre de prioriser certains documents
3. **Pagination** : Pour supporter > 8 documents avec navigation
4. **Cache intelligent** : Réutiliser les documents compressés 