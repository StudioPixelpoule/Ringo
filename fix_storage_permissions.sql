-- Script pour corriger les permissions Storage
-- Supprime d'abord les politiques existantes avant de les recréer

-- 1. Supprimer TOUTES les anciennes politiques pour temp
DROP POLICY IF EXISTS "Users can upload temp files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their temp files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their temp files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read temp files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete temp files" ON storage.objects;

-- 2. Recréer les politiques correctes

-- Permettre l'upload dans temp/
CREATE POLICY "Users can upload temp files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = 'temp'
);

-- Permettre la lecture dans temp/
CREATE POLICY "Users can read temp files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = 'temp'
);

-- Permettre la suppression dans temp/
CREATE POLICY "Users can delete temp files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = 'temp'
);

-- 3. Vérifier le résultat
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%temp%';

-- Message de succès
DO $$
BEGIN
  RAISE NOTICE '✅ Permissions Storage corrigées avec succès !';
END $$; 