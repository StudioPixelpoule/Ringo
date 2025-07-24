# Guide de Débogage du Mode Hybride

## 🐛 Problème Résolu

Le mode hybride ne basculait jamais vers Claude à cause d'une **incohérence de configuration** :

- **Frontend** : Active `process-chat-hybrid` pour > 4 documents ✅
- **Backend** (ancien) : Utilisait Claude pour > 8 documents ❌
- **Backend** (corrigé) : Utilise Claude pour > 4 documents ✅

## 🔍 Comment Vérifier la Bascule

### 1. Dans la Console du Navigateur

Vous verrez ces logs lors de l'envoi d'un message :

```javascript
// Frontend - Indique quel endpoint est appelé
[SecureChat] Streaming with process-chat-hybrid (5 documents)
```

### 2. Dans les Logs Supabase

Accédez au [Dashboard Supabase](https://supabase.com/dashboard/project/kitzhhrhlaevrtbqnbma/functions) > Functions > Logs

Vous verrez :

```
[Hybrid API] Request received: {
  messagesCount: 3,
  hasDocumentContent: true,
  documentCount: 5,
  stream: true
}

[Hybrid API] API Keys status: {
  openaiConfigured: true,
  anthropicConfigured: true  // ⚠️ Doit être true !
}

[SelectModel] Document count: 5, Threshold: 4
[SelectModel] Selecting Claude - Document count (5) exceeds threshold
[Hybrid] Model selected: claude - Reason: Plus de 4 documents (5)
[Hybrid API] Response generated with claude - Reason: Plus de 4 documents (5)
```

### 3. Dans le Playground Anthropic

Après un test avec 5+ documents, vous devriez voir l'utilisation de votre clé API dans :
- [Console Anthropic](https://console.anthropic.com/) > Usage

## 🧪 Test Rapide

1. **Créer une conversation avec exactement 5 documents**
2. **Envoyer une question** (ex: "Compare ces documents")
3. **Vérifier les logs** dans la console et Supabase

## 📊 Règles de Sélection du Modèle

| Condition | Modèle | Raison |
|-----------|---------|---------|
| ≤ 4 documents | GPT-4o | Configuration standard |
| > 4 documents | Claude 3 | Meilleur pour volumes importants |
| Mots-clés complexes* | Claude 3 | Analyse approfondie |
| > 100k tokens | Claude 3 | Capacité étendue |

*Mots-clés : "comparer", "comparaison", "analyse approfondie", "synthèse complexe"

## ⚠️ Points de Vérification

### 1. Clé API Anthropic

Si vous voyez `anthropicConfigured: false` dans les logs :

1. Allez dans [Supabase Dashboard](https://supabase.com/dashboard/project/kitzhhrhlaevrtbqnbma/settings/vault)
2. Ajoutez le secret : `ANTHROPIC_API_KEY`
3. Redéployez la fonction

### 2. Nombre de Documents

Le système compte les occurrences de `====== DOCUMENT ACTIF` dans le contexte.
Assurez-vous que vos documents sont bien formatés.

### 3. Headers de Réponse

Dans l'onglet Network du navigateur, vérifiez les headers de la réponse :
- `X-Model-Used: claude` ou `openai`
- `X-Model-Reason: Plus de 4 documents (5)`

## 🚨 Dépannage

### Claude n'est jamais utilisé

1. **Vérifiez le nombre de documents** : Doit être > 4
2. **Vérifiez la clé API** : `anthropicConfigured` doit être `true`
3. **Vérifiez les logs d'erreur** : Peut-être un fallback silencieux

### Erreur "Anthropic API key not configured"

→ La clé API n'est pas dans les secrets Supabase

### Les logs n'apparaissent pas

→ Activez le streaming des logs dans le Dashboard Supabase

## 📱 Monitoring en Production

Pour un suivi continu :

1. **Dashboard Supabase** : Surveillez les logs des fonctions
2. **Console Anthropic** : Vérifiez l'utilisation de l'API
3. **Analytics** : Ajoutez des métriques personnalisées si nécessaire

## ✅ Checklist de Validation

- [ ] Mode hybride activé : `USE_HYBRID_MODE: true`
- [ ] Fonction déployée avec les corrections
- [ ] Clé API Anthropic configurée
- [ ] Test avec 5+ documents effectué
- [ ] Logs confirmant l'utilisation de Claude
- [ ] Usage visible dans le dashboard Anthropic 