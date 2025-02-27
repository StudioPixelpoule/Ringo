-- Création d'un index pour la table document_contents
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'document_contents'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'document_contents' 
      AND indexname = 'idx_document_contents_document_id'
    ) THEN
      CREATE INDEX idx_document_contents_document_id ON document_contents(document_id);
    END IF;
  END IF;
END
$$;

-- Création de la fonction pour mettre à jour le timestamp updated_at
CREATE OR REPLACE FUNCTION update_document_contents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Création du trigger pour mettre à jour le timestamp updated_at
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'document_contents'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname = 'update_document_contents_updated_at'
    ) THEN
      CREATE TRIGGER update_document_contents_updated_at
      BEFORE UPDATE ON document_contents
      FOR EACH ROW
      EXECUTE FUNCTION update_document_contents_updated_at();
    END IF;
  END IF;
END
$$;