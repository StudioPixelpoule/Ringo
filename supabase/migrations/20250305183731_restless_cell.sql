/*
  # Ajout du contenu des documents et mise à jour des politiques

  1. Modifications
    - Ajout de la colonne `content` à la table `documents`
    - Ajout de la colonne `processed` pour suivre l'état du traitement
    - Création d'un index de recherche plein texte sur le contenu
  
  2. Sécurité
    - Mise à jour des politiques pour permettre l'accès au contenu
    - Ajout de politiques pour la recherche dans les documents
*/

-- Ajout des colonnes pour le contenu et l'état de traitement
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'documents' AND column_name = 'content'
  ) THEN
    ALTER TABLE documents ADD COLUMN content text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'documents' AND column_name = 'processed'
  ) THEN
    ALTER TABLE documents ADD COLUMN processed boolean DEFAULT false;
  END IF;
END $$;

-- Index pour la recherche plein texte
CREATE INDEX IF NOT EXISTS idx_documents_content_search 
ON documents USING gin(to_tsvector('french', coalesce(content, '')));

-- Mise à jour des politiques existantes
DROP POLICY IF EXISTS "Users can read documents" ON documents;
DROP POLICY IF EXISTS "Admins have full access to documents" ON documents;

-- Nouvelles politiques
CREATE POLICY "Users can read documents"
ON documents FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = true
  )
);

CREATE POLICY "Admins have full access to documents"
ON documents FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
    AND profiles.status = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
    AND profiles.status = true
  )
);

-- Trigger pour mettre à jour l'état de traitement
CREATE OR REPLACE FUNCTION update_document_processed()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.processed = NEW.content IS NOT NULL AND length(NEW.content) > 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_document_processed_trigger ON documents;
CREATE TRIGGER update_document_processed_trigger
  BEFORE INSERT OR UPDATE OF content ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_document_processed();