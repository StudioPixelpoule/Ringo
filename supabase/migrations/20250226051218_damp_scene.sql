/*
  # Mise à jour des politiques de suppression

  1. Sécurité
    - Mise à jour de la politique de suppression pour les documents
    - Mise à jour de la politique de suppression pour les fichiers du storage

  2. Changements
    - Suppression et recréation des politiques existantes pour éviter les conflits
    - Ajout de vérifications pour éviter les erreurs
*/

-- Politique de suppression pour les documents
DROP POLICY IF EXISTS "Users can delete own documents" ON documents;
CREATE POLICY "Users can delete own documents"
ON documents
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Supprimer d'abord la politique existante pour le storage
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

-- Recréer la politique de suppression pour les fichiers du storage
CREATE POLICY "Users can delete own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);