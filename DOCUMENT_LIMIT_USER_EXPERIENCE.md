# Limite de Documents dans RINGO - Expérience Utilisateur

## 📊 Limite Actuelle

**8 documents maximum par conversation**

## 🎯 Comment l'Utilisateur le Voit

### 1. Badge Permanent
Dans la section "Documents actifs" :
```
Documents actifs 3/8
```
- **Vert** (couleur RINGO) : Sous la limite
- **Orange** : Limite atteinte

### 2. Messages d'Information

#### Quand la limite est atteinte :
```
⚠️ Limite atteinte : Maximum 8 documents par conversation pour optimiser les performances.
```

#### Lors de la sélection de documents :
```
❌ Vous ne pouvez sélectionner que X document(s) supplémentaire(s). 
   La limite est de 8 documents par conversation.
```

### 3. Astuce pour Multi-Documents
Entre 2 et 7 documents :
```
💡 Astuce : Demandez-moi de comparer, synthétiser ou croiser les informations entre ces documents.
```

## 🔍 Ce que l'Utilisateur NE Voit PAS

- Le mode hybride (GPT-4o / Claude)
- La bascule automatique entre modèles
- Les limites techniques de tokens
- La compression des documents
- Les stratégies d'optimisation

## 📱 Emplacements dans l'Interface

| Emplacement | Visibilité | Information |
|-------------|------------|-------------|
| **Liste des documents** | Toujours visible | `X/8` |
| **Explorateur de fichiers** | Lors de la sélection | Message si dépassement |
| **Zone de chat** | Si limite atteinte | Avertissement orange |

## ✅ Points Forts de l'UX Actuelle

1. **Transparence** : La limite est claire dès le début
2. **Feedback immédiat** : Messages lors des tentatives de dépassement
3. **Guidage** : Suggestions pour exploiter les multi-documents
4. **Simplicité** : Un seul nombre à retenir : 8

## 💡 Recommandations (si besoin)

### Option 1 : Message d'Accueil
Ajouter dans le chat initial :
```
💬 Bienvenue dans RINGO ! Vous pouvez analyser jusqu'à 8 documents 
   simultanément dans cette conversation.
```

### Option 2 : Tooltip Informatif
Sur le badge `X/8`, ajouter au survol :
```
"Analysez jusqu'à 8 documents ensemble. Au-delà, créez une nouvelle conversation."
```

### Option 3 : Guide Contextuel
Quand l'utilisateur approche de la limite (6-7 docs) :
```
💡 Vous approchez de la limite de 8 documents. Profitez-en pour 
   demander une synthèse complète avant d'ajouter plus de documents !
```

## 🎯 Conclusion

La limite de **8 documents** est :
- ✅ **Clairement communiquée**
- ✅ **Visible en permanence**
- ✅ **Justifiée simplement** ("pour optimiser les performances")
- ✅ **Sans détails techniques** complexes

L'utilisateur comprend la contrainte sans avoir besoin de connaître le fonctionnement technique sous-jacent (compression, mode hybride, tokens, etc.). 