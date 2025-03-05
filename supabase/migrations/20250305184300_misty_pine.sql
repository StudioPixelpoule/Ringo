/*
  # Ajout du stockage de contenu pour les documents

  1. Modifications
    - Ajout de la colonne `content` pour stocker le texte extrait des documents
    - Ajout de la colonne `processed` pour suivre l'état de traitement
    - Ajout d'un index de recherche plein texte sur le contenu

  2. Sécurité
    - Mise à jour des politiques pour protéger le contenu des documents
    - Seuls les utilisateurs authentifiés peuvent accéder au contenu
*/

-- Ajout des nouvelles colonnes
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS content text,
ADD COLUMN IF NOT EXISTS processed boolean DEFAULT false;

-- Création d'un index de recherche plein texte sur le contenu
CREATE INDEX IF NOT EXISTS idx_documents_content_search 
ON documents USING gin(to_tsvector('french', coalesce(content, '')));

-- Mise à jour des politiques de sécurité
CREATE POLICY "Les utilisateurs peuvent lire le contenu des documents"
ON documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.status = true
  )
);