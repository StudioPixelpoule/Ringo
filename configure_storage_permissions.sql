-- Script pour configurer le Storage et les permissions pour l'upload audio
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. S'assurer que le bucket 'documents' existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Users can upload temp files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their temp files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their temp files" ON storage.objects;

-- 3. Créer les nouvelles politiques pour le dossier temp/

-- Permettre aux utilisateurs authentifiés d'uploader dans temp/
CREATE POLICY "Users can upload temp files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = 'temp'
);

-- Permettre aux utilisateurs de lire tous les fichiers temp (nécessaire pour les Edge Functions)
CREATE POLICY "Users can read temp files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = 'temp'
);

-- Permettre aux utilisateurs de supprimer tous les fichiers temp
CREATE POLICY "Users can delete temp files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = 'temp'
);

-- 4. Vérifier que les politiques sont bien créées
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%temp%'
ORDER BY policyname;

-- 5. Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Configuration du Storage terminée !';
  RAISE NOTICE '📁 Le bucket "documents" est configuré';
  RAISE NOTICE '🔒 Les permissions pour le dossier temp/ sont en place';
  RAISE NOTICE '🎯 Les utilisateurs peuvent maintenant uploader des fichiers audio temporaires';
END $$; 