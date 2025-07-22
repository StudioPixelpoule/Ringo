# Correction de l'Upload Audio - Payload Too Large

## 🚨 Problème

L'erreur "Payload Too Large" se produisait lors de l'upload de fichiers audio volumineux car :
- Les Edge Functions Supabase ont une limite de taille de payload (environ 6MB)
- Les fichiers audio étaient envoyés directement dans le body de la requête

## 🛡️ Solution Implémentée

### Architecture Avant ❌
```
Client → Edge Function (fichier dans le body) → OpenAI
```

### Architecture Après ✅
```
Client → Storage → Edge Function (récupère depuis Storage) → OpenAI
```

## 📝 Changements Effectués

### 1. **secureProcessor.ts**
- ✅ Ajout d'une limite de 100MB pour les fichiers audio
- ✅ Upload du fichier sur Supabase Storage d'abord
- ✅ Envoi uniquement du chemin du fichier à l'Edge Function
- ✅ Nettoyage automatique des fichiers temporaires

### 2. **process-audio Edge Function**
- ✅ Reçoit le chemin du fichier au lieu du fichier directement
- ✅ Télécharge le fichier depuis Storage
- ✅ Continue le traitement normal avec OpenAI

## 🚀 Configuration Requise

### 1. **Déployer l'Edge Function Mise à Jour**
```bash
supabase functions deploy process-audio --project-ref votre-ref
```

### 2. **Permissions Storage**
Assurez-vous que le bucket `documents` existe et a les bonnes permissions :
- Les utilisateurs authentifiés peuvent uploader dans `temp/*`
- Les Edge Functions peuvent lire/supprimer les fichiers

### 3. **Politique RLS pour le Storage**
```sql
-- Permettre aux utilisateurs authentifiés d'uploader dans temp/
CREATE POLICY "Users can upload temp files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'temp');

-- Permettre aux utilisateurs de supprimer leurs propres fichiers temp
CREATE POLICY "Users can delete their temp files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'temp' AND auth.uid()::text = owner);
```

## 📊 Avantages

1. **Plus de limite de taille** : Peut gérer des fichiers jusqu'à 100MB
2. **Meilleure fiabilité** : Utilise l'infrastructure Storage de Supabase
3. **Nettoyage automatique** : Les fichiers temporaires sont supprimés après usage

## ⚠️ Notes

- Les fichiers sont stockés temporairement dans `documents/temp/`
- Ils sont automatiquement supprimés après traitement (succès ou échec)
- La limite de 100MB peut être ajustée dans `secureProcessor.ts` 