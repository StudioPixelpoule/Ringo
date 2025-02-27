/*
  # Création de la table document_contents

  1. Nouvelle Table
    - `document_contents`
      - `id` (uuid, clé primaire)
      - `document_id` (uuid, référence à documents.id)
      - `content` (text, contenu extrait du document)
      - `extraction_status` (text, statut de l'extraction)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  2. Sécurité
    - Activation de RLS sur la table `document_contents`
    - Ajout de politiques pour les utilisateurs authentifiés
  3. Fonction
    - Création d'une fonction pour créer la table si elle n'existe pas
*/

-- Création de la table document_contents si elle n'existe pas
CREATE TABLE IF NOT EXISTS document_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  content text,
  extraction_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Activation de RLS
ALTER TABLE document_contents ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre aux utilisateurs de lire le contenu des documents auxquels ils ont accès
CREATE POLICY "Users can read document contents they have access to"
  ON document_contents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_id
      AND documents.user_id = auth.uid()
    )
  );

-- Politique pour permettre aux utilisateurs d'insérer du contenu pour leurs documents
CREATE POLICY "Users can insert document contents for their documents"
  ON document_contents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_id
      AND documents.user_id = auth.uid()
    )
  );

-- Politique pour permettre aux utilisateurs de mettre à jour le contenu de leurs documents
CREATE POLICY "Users can update document contents for their documents"
  ON document_contents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_id
      AND documents.user_id = auth.uid()
    )
  );

-- Fonction pour créer la table document_contents si elle n'existe pas
CREATE OR REPLACE FUNCTION create_document_contents_if_not_exists()
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'document_contents'
  ) THEN
    CREATE TABLE document_contents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id uuid REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
      content text,
      extraction_status text DEFAULT 'pending',
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    
    ALTER TABLE document_contents ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users can read document contents they have access to"
      ON document_contents
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM documents
          WHERE documents.id = document_id
          AND documents.user_id = auth.uid()
        )
      );
    
    CREATE POLICY "Users can insert document contents for their documents"
      ON document_contents
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM documents
          WHERE documents.id = document_id
          AND documents.user_id = auth.uid()
        )
      );
    
    CREATE POLICY "Users can update document contents for their documents"
      ON document_contents
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM documents
          WHERE documents.id = document_id
          AND documents.user_id = auth.uid()
        )
      );
  END IF;
END;
$$ LANGUAGE plpgsql;