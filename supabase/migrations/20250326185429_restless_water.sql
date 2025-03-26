/*
  # Add Report Folders Support

  1. New Tables
    - `report_folders`
      - `id` (uuid, primary key)
      - `name` (text)
      - `parent_id` (uuid, self-referential)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes
    - Add `folder_id` to report_templates table
    - Add foreign key constraint
    - Add indexes for better performance
    - Add RLS policies
*/

-- Create report_folders table
CREATE TABLE IF NOT EXISTS report_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES report_folders(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT folder_depth CHECK (parent_id != id)
);

-- Enable RLS
ALTER TABLE report_folders ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_report_folders_parent_id ON report_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_report_folders_name ON report_folders(name);

-- Add folder_id to report_templates
ALTER TABLE report_templates 
ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES report_folders(id) ON DELETE SET NULL;

-- Create index for folder lookup
CREATE INDEX IF NOT EXISTS idx_report_templates_folder_id ON report_templates(folder_id);

-- Create updated_at trigger
CREATE TRIGGER update_report_folders_updated_at
  BEFORE UPDATE ON report_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for report_folders

-- Admins can manage folders
CREATE POLICY "Admins can manage report folders"
  ON report_folders
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

-- Users can read folders
CREATE POLICY "Users can read report folders"
  ON report_folders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND status = true
    )
  );

-- Insert default folders with proper UUIDs
WITH folders AS (
  INSERT INTO report_folders (name, parent_id) VALUES
    -- Main categories
    ('SST Général', NULL),
    ('Ergonomie', NULL),
    ('Hygiène industrielle', NULL),
    ('Sécurité', NULL),
    ('Psychosocial', NULL),
    ('Recherche', NULL)
  RETURNING id, name
),
sst_general AS (
  SELECT id FROM folders WHERE name = 'SST Général'
),
ergonomics AS (
  SELECT id FROM folders WHERE name = 'Ergonomie'
),
industrial_hygiene AS (
  SELECT id FROM folders WHERE name = 'Hygiène industrielle'
),
safety AS (
  SELECT id FROM folders WHERE name = 'Sécurité'
),
psychosocial AS (
  SELECT id FROM folders WHERE name = 'Psychosocial'
),
research AS (
  SELECT id FROM folders WHERE name = 'Recherche'
)
INSERT INTO report_folders (name, parent_id)
SELECT name, parent_id
FROM (
  -- SST Général subcategories
  SELECT 'Analyse des risques' as name, (SELECT id FROM sst_general) as parent_id
  UNION ALL
  SELECT 'Programmes de prévention', (SELECT id FROM sst_general)
  UNION ALL
  SELECT 'Rapports d''incidents', (SELECT id FROM sst_general)
  
  -- Ergonomie subcategories
  UNION ALL
  SELECT 'Analyse de postes', (SELECT id FROM ergonomics)
  UNION ALL
  SELECT 'Charge physique', (SELECT id FROM ergonomics)
  UNION ALL
  SELECT 'Troubles musculosquelettiques', (SELECT id FROM ergonomics)
  
  -- Hygiène industrielle subcategories
  UNION ALL
  SELECT 'Qualité de l''air', (SELECT id FROM industrial_hygiene)
  UNION ALL
  SELECT 'Bruit et vibrations', (SELECT id FROM industrial_hygiene)
  UNION ALL
  SELECT 'Exposition chimique', (SELECT id FROM industrial_hygiene)
  
  -- Sécurité subcategories
  UNION ALL
  SELECT 'Sécurité des machines', (SELECT id FROM safety)
  UNION ALL
  SELECT 'Équipements de protection', (SELECT id FROM safety)
  UNION ALL
  SELECT 'Procédures d''urgence', (SELECT id FROM safety)
  
  -- Psychosocial subcategories
  UNION ALL
  SELECT 'Gestion du stress', (SELECT id FROM psychosocial)
  UNION ALL
  SELECT 'Violence au travail', (SELECT id FROM psychosocial)
  UNION ALL
  SELECT 'Santé mentale', (SELECT id FROM psychosocial)
  
  -- Recherche subcategories
  UNION ALL
  SELECT 'Études scientifiques', (SELECT id FROM research)
  UNION ALL
  SELECT 'Statistiques', (SELECT id FROM research)
  UNION ALL
  SELECT 'Meilleures pratiques', (SELECT id FROM research)
) AS subfolders;

-- Update existing templates to be in appropriate folders
WITH folder_refs AS (
  SELECT 
    id,
    name,
    CASE 
      WHEN name = 'Programmes de prévention' THEN 'summary'
      WHEN name = 'Analyse des risques' THEN 'analysis'
      WHEN name = 'Études scientifiques' THEN 'comparison'
      WHEN name = 'Statistiques' THEN 'extraction'
    END as template_type
  FROM report_folders
  WHERE name IN (
    'Programmes de prévention',
    'Analyse des risques',
    'Études scientifiques',
    'Statistiques'
  )
)
UPDATE report_templates rt
SET folder_id = fr.id
FROM folder_refs fr
WHERE rt.type = fr.template_type
AND rt.folder_id IS NULL;