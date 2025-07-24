# Implémentation du Mode Hybride GPT-4o/Claude

## 🎯 Vue d'Ensemble

Cette implémentation ajoute un **mode hybride** qui permet à Ringo d'utiliser intelligemment soit GPT-4o soit Claude selon les besoins, tout en restant **100% transparent** pour l'utilisateur.

## ✅ Caractéristiques

### Sécurité et Isolation
- ✅ **Zero régression** : Nouvelle Edge Function isolée
- ✅ **Feature flag** : Activation/désactivation instantanée
- ✅ **Fallback automatique** : Si un modèle échoue, bascule sur l'autre
- ✅ **Code existant intact** : Aucune modification des fonctions actuelles

### Intelligence de Sélection
- ✅ **Sélection automatique** basée sur :
  - Nombre de documents (> 8 → Claude)
  - Nombre de tokens (> 100k → Claude)
  - Complexité de la requête
- ✅ **Override manuel** possible via `preferredModel`
- ✅ **Logs détaillés** du modèle utilisé et la raison

### Capacités Augmentées
- **GPT-4o** : 128k tokens, rapide, économique
- **Claude 3 Opus** : 200k tokens (+56%), analyses complexes
- Support jusqu'à **15-20 documents** sans compression agressive

## 🔧 Architecture

```
┌─────────────────┐
│ Client (React)  │
└────────┬────────┘
         │
    ┌────▼────┐     Feature Flag OFF    ┌─────────────────┐
    │ Secure  ├─────────────────────────►│ process-chat    │ (GPT-4o)
    │  Chat   │                          │ process-chat-   │
    └────┬────┘                          │ stream          │
         │                               └─────────────────┘
         │ Feature Flag ON
         │                               ┌─────────────────┐
         └───────────────────────────────►│ process-chat-   │
                                         │ hybrid          │
                                         └────────┬────────┘
                                                  │
                                         ┌────────▼────────┐
                                         │ Model Selector  │
                                         └────┬───────┬────┘
                                              │       │
                                         ┌────▼──┐ ┌─▼─────┐
                                         │OpenAI │ │Claude │
                                         └───────┘ └───────┘
```

## 📁 Fichiers Créés/Modifiés

### Nouveaux Fichiers
- `supabase/functions/process-chat-hybrid/index.ts` : Nouvelle Edge Function hybride

### Fichiers Modifiés (Minimal)
- `src/lib/constants.ts` : Ajout des feature flags
- `src/lib/secureChat.ts` : Support du mode hybride

## 🚀 Activation et Tests

### 1. Déployer l'Edge Function

```bash
# Déployer la nouvelle fonction
supabase functions deploy process-chat-hybrid --project-ref votre-ref

# Vérifier le secret Anthropic
supabase secrets list --project-ref votre-ref
# Devrait contenir ANTHROPIC_API_KEY
```

### 2. Activer le Mode Hybride

Dans `src/lib/constants.ts` :

```typescript
export const FEATURE_FLAGS = {
  USE_HYBRID_MODE: true, // ← Activer ici
  HYBRID_MODE_DOCUMENT_THRESHOLD: 4,
};
```

### 3. Tester Progressivement

#### Test 1 : Vérifier GPT-4o (≤ 4 documents)
1. Créer une conversation avec 3-4 documents
2. Vérifier dans la console : `[SecureChat] Using process-chat (3 documents)`
3. Fonctionnement normal attendu

#### Test 2 : Vérifier Claude (> 4 documents)
1. Créer une conversation avec 5-8 documents
2. Vérifier dans la console : `[SecureChat] Using process-chat-hybrid (6 documents)`
3. Vérifier : `[SecureChat] Model used: claude - Reason: Plus de 4 documents (6)`

#### Test 3 : Tester le Fallback
1. Temporairement invalider une clé API
2. Vérifier que le système bascule automatiquement
3. Message dans les logs : `[Hybrid] Falling back to openai`

### 4. Monitoring en Production

Les logs affichent :
- Quel modèle est utilisé
- La raison de la sélection
- Les erreurs et fallbacks
- Le temps de réponse

## 🔍 Logique de Sélection

```typescript
// Critères de sélection (dans l'ordre)
1. Si > 8 documents → Claude
2. Si requête complexe (mots-clés) → Claude  
3. Si > 100k tokens estimés → Claude
4. Sinon → GPT-4o (défaut)

// Fallback automatique
Si échec → Essayer l'autre modèle
Si double échec → Erreur utilisateur
```

## 📊 Exemples de Cas d'Usage

| Scénario | Documents | Tokens | Modèle | Raison |
|----------|-----------|---------|---------|---------|
| Chat simple | 2 | 20k | GPT-4o | Utilisation standard |
| Analyse PDF | 4 | 80k | GPT-4o | Sous les seuils |
| Comparaison | 6 | 90k | Claude | Plus de 4 documents |
| Gros corpus | 8 | 150k | Claude | Dépassement tokens |
| Synthèse complexe | 3 | 40k | Claude | Requête complexe |

## ⚙️ Configuration Avancée

### Ajuster les Seuils

Dans `process-chat-hybrid/index.ts` :

```typescript
const SELECTION_THRESHOLDS = {
  tokenLimit: 100000,      // Modifier selon besoins
  documentLimit: 8,        // Ajuster le seuil
  complexityKeywords: ['comparer', 'synthèse'], // Ajouter des mots-clés
};
```

### Changer le Modèle Claude

```typescript
const MODEL_CONFIG = {
  claude: {
    model: 'claude-3-sonnet-20240229', // Plus économique
    // ou 'claude-3-opus-20240229' pour max qualité
  }
};
```

### Forcer un Modèle Spécifique

```typescript
// Dans une future version
body: JSON.stringify({ 
  messages, 
  documentContent,
  preferredModel: 'claude' // Force Claude
})
```

## 🛡️ Sécurité

- ✅ Clés API sécurisées dans Supabase
- ✅ Authentification requise
- ✅ Isolation complète du code
- ✅ Aucune exposition côté client

## 📈 Évolutions Futures

1. **Interface Utilisateur**
   - Toggle pour choisir le modèle
   - Indicateur du modèle utilisé
   - Statistiques d'utilisation

2. **Optimisations**
   - Cache des réponses similaires
   - Pré-processing des documents
   - Compression adaptative par modèle

3. **Analytiques**
   - Coûts par modèle
   - Temps de réponse
   - Taux de fallback

## ❓ FAQ

**Q: L'utilisateur voit-il une différence ?**
R: Non, totalement transparent. Toujours "Ringo".

**Q: Que se passe-t-il si les deux APIs sont down ?**
R: Fallback sur le traitement local (si clé disponible).

**Q: Comment désactiver rapidement ?**
R: Mettre `USE_HYBRID_MODE: false` et redéployer.

**Q: Impact sur les performances ?**
R: Négligeable. La sélection prend < 1ms.

**Q: Coûts supplémentaires ?**
R: Claude est ~2x plus cher. Utilisé uniquement quand nécessaire.

## 🚨 Rollback d'Urgence

Si problème :

```typescript
// Dans src/lib/constants.ts
export const FEATURE_FLAGS = {
  USE_HYBRID_MODE: false, // ← Désactiver
};
```

Redéployer et le système revient instantanément au mode GPT-4o uniquement. 