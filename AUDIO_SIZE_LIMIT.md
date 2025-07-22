# Limite de Taille des Fichiers Audio

## 🎯 Limite Actuelle

**25 MB** - Limite imposée par l'API OpenAI Whisper

## 📊 Pour Référence

- **1 minute** d'audio MP3 (128 kbps) ≈ 1 MB
- **25 MB** ≈ 25 minutes d'audio MP3
- En WAV non compressé : environ 2-3 minutes seulement

## 🛠️ Solutions pour les Fichiers Plus Gros

### 1. **Compression Audio (Recommandé)**
Avant l'upload, compresser l'audio :
- Utiliser un format compressé (MP3, M4A)
- Réduire le bitrate (64-128 kbps suffisant pour la voix)
- Mono au lieu de stéréo pour les enregistrements vocaux

### 2. **Découpage Automatique** (Future amélioration)
Implémenter un découpage automatique :
```javascript
// Pseudo-code pour une future implémentation
if (file.size > MAX_SIZE) {
  const chunks = splitAudioFile(file, MAX_SIZE);
  const transcriptions = await Promise.all(
    chunks.map(chunk => transcribeChunk(chunk))
  );
  return mergeTranscriptions(transcriptions);
}
```

### 3. **Conversion Côté Client** (Future amélioration)
Utiliser une librairie comme FFmpeg.js pour :
- Convertir en MP3
- Réduire le bitrate
- Extraire des segments

## 📝 Message d'Erreur Actuel

```
Le fichier audio est trop volumineux (XX MB). La limite est de 25MB pour la transcription.
```

## 🎧 Formats Supportés

- MP3 ✅ (Recommandé)
- M4A ✅
- WAV ✅ (Mais volumineux)
- WebM ✅
- MP4 ✅
- MPGA ✅
- OGG ✅
- AAC ✅

## 💡 Conseils aux Utilisateurs

1. **Pour les réunions longues** : Enregistrer en MP3 128kbps
2. **Pour les interviews** : MP3 64kbps mono suffit
3. **Éviter** : WAV non compressé pour les longs enregistrements 