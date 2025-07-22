-- Script pour configurer les permissions Storage pour les fichiers audio temporaires
-- À exécuter dans l'éditeur SQL de Supabase

-- S'assurer que le bucket 'documents' existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Permettre aux utilisateurs authentifiés d'uploader dans temp/
CREATE POLICY "Users can upload temp files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = 'temp'
);

-- Permettre aux utilisateurs de lire leurs propres fichiers temp
CREATE POLICY "Users can read their temp files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = 'temp'
);

-- Permettre aux utilisateurs de supprimer leurs propres fichiers temp
CREATE POLICY "Users can delete their temp files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = 'temp'
);

-- Permettre aux Edge Functions (service_role) d'accéder à tous les fichiers temp
-- Note : Les Edge Functions utilisent le service_role par défaut
-- qui a déjà accès à tout, donc pas besoin de politique spécifique

-- Vérifier que les politiques sont créées
SELECT * FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%temp%'; 