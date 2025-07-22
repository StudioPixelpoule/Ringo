# Traitement des Gros Fichiers Audio (jusqu'à 200MB)

## 🚀 Solution Implémentée

### Architecture

```
Fichier < 25MB  → process-audio         → Traitement direct
Fichier > 25MB  → process-audio-chunked → Découpage + Traitement parallèle
```

## 📊 Capacités

- **Limite maximale** : 200MB (configurable)
- **Découpage automatique** : Chunks de 24MB
- **Traitement parallèle** : Tous les chunks en même temps
- **Fusion intelligente** : Transcriptions et timestamps alignés

## 🔧 Comment ça Marche

### 1. **Upload et Détection**
```javascript
// Le client détecte la taille et choisit la bonne Edge Function
if (file.size > 25MB) {
  useChunkedProcessing = true
}
```

### 2. **Découpage Automatique**
- Fichier de 100MB → 5 chunks de ~20MB chacun
- Fichier de 200MB → 9 chunks de ~22MB chacun

### 3. **Traitement Parallèle**
```javascript
// Tous les chunks sont traités simultanément
const results = await Promise.all(chunkPromises)
```

### 4. **Fusion des Résultats**
- Transcriptions fusionnées avec marqueurs de segments
- Timestamps ajustés pour la continuité
- Métadonnées complètes préservées

## 📈 Performance

### Temps de Traitement Estimés
- **25MB** : ~30-45 secondes
- **50MB** : ~45-60 secondes (2 chunks parallèles)
- **100MB** : ~60-90 secondes (5 chunks parallèles)
- **200MB** : ~90-120 secondes (9 chunks parallèles)

### Optimisations
- ✅ Traitement parallèle des chunks
- ✅ Pas de re-téléchargement
- ✅ Streaming des résultats
- ✅ Nettoyage automatique

## 🎯 Exemples de Résultats

### Fichier de 50MB (2 chunks)
```
== CONTEXTE DE L'ENREGISTREMENT ==
Réunion stratégique du 28 mars 2024

== TRANSCRIPTION ==
[Contenu du chunk 1...]

[Contenu du chunk 2...] [Segment 2/2]
```

### Métadonnées Enrichies
```json
{
  "processedChunks": 2,
  "originalSize": "50MB",
  "duration": 3600,
  "segments": [...] // Tous les segments avec timestamps ajustés
}
```

## 🛠️ Configuration

### Variables d'Environnement
- `MAX_AUDIO_SIZE` : Limite cliente (200MB par défaut)
- `MAX_CHUNK_SIZE` : Taille des chunks (24MB par défaut)
- `CHUNK_THRESHOLD` : Seuil pour chunking (25MB par défaut)

### Déploiement
```bash
# Déployer la nouvelle Edge Function
supabase functions deploy process-audio-chunked --project-ref votre-ref

# L'ancienne reste pour les petits fichiers
supabase functions deploy process-audio --project-ref votre-ref
```

## 🎧 Formats et Qualité

### Recommandations par Durée
- **< 30 min** : MP3 128kbps (< 25MB)
- **30-60 min** : MP3 96kbps (< 50MB)
- **1-2 heures** : MP3 64kbps (< 100MB)
- **2-4 heures** : MP3 64kbps mono (< 200MB)

### Formats Supportés
- MP3, M4A, WAV, WebM, OGG, AAC, MP4, MPGA

## ⚡ Limitations Techniques

1. **Edge Function Timeout** : 5 minutes max
   - Solution : Traitement parallèle pour rester dans les limites

2. **Mémoire** : 256MB par Edge Function
   - Solution : Streaming et chunks de 24MB max

3. **Découpage Audio** : Peut couper au milieu d'un mot
   - Impact : Minimal, OpenAI gère bien les coupures

## 🔍 Monitoring

Les logs affichent :
```
Processing large audio file: reunion-2024.mp3
File size: 85MB
Splitting into 4 chunks
Processing chunk 1/4: reunion-2024.mp3_chunk_1_of_4.mp3
Processing chunk 2/4: reunion-2024.mp3_chunk_2_of_4.mp3
...
```

## 🚨 Gestion d'Erreurs

- Si un chunk échoue → Erreur globale (pour cohérence)
- Nettoyage automatique des fichiers temp
- Messages d'erreur détaillés par chunk

## 🔮 Améliorations Futures

1. **Découpage Intelligent**
   - Couper sur les silences
   - Éviter de couper les mots

2. **Reprise sur Erreur**
   - Retry automatique des chunks échoués
   - Sauvegarde partielle

3. **Streaming Progressif**
   - Retourner les résultats au fur et à mesure
   - Barre de progression détaillée

4. **Compression Automatique**
   - Réduire automatiquement le bitrate si nécessaire
   - Conversion format côté serveur 