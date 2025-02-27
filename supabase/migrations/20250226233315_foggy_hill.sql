/*
  # Ajout de la table d'analyse de documents

  1. Nouvelles Tables
    - `document_analysis`
      - `id` (uuid, primary key)
      - `document_name` (text)
      - `analysis_data` (jsonb)
      - `created_at` (timestamptz)
  2. Fonctions
    - Fonction pour créer la table d'analyse si elle n'existe pas
  3. Sécurité
    - Enable RLS sur la table document_analysis
    - Ajout de politiques pour la lecture et l'écriture
*/

-- Création de la table document_analysis si elle n'existe pas
CREATE TABLE IF NOT EXISTS document_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_name text NOT NULL,
  analysis_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Activation de RLS
ALTER TABLE document_analysis ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre aux utilisateurs authentifiés de lire les analyses
CREATE POLICY "Users can read document analysis"
  ON document_analysis
  FOR SELECT
  TO authenticated
  USING (true);

-- Politique pour permettre aux utilisateurs authentifiés d'insérer des analyses
CREATE POLICY "Users can insert document analysis"
  ON document_analysis
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Création d'un index sur document_name pour accélérer les recherches
CREATE INDEX IF NOT EXISTS idx_document_analysis_document_name ON document_analysis(document_name);

-- Fonction pour créer la table document_analysis si elle n'existe pas
CREATE OR REPLACE FUNCTION create_document_analysis_table_if_not_exists()
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'document_analysis'
  ) THEN
    CREATE TABLE document_analysis (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      document_name text NOT NULL,
      analysis_data jsonb NOT NULL,
      created_at timestamptz DEFAULT now()
    );
    
    ALTER TABLE document_analysis ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users can read document analysis"
      ON document_analysis
      FOR SELECT
      TO authenticated
      USING (true);
    
    CREATE POLICY "Users can insert document analysis"
      ON document_analysis
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
    
    CREATE INDEX idx_document_analysis_document_name ON document_analysis(document_name);
  END IF;
END;
$$ LANGUAGE plpgsql;