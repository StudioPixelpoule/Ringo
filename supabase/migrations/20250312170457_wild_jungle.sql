/*
  # Create Report Templates Table

  1. New Tables
    - `report_templates`
      - `id` (uuid, primary key)
      - `name` (text, required)
      - `description` (text)
      - `icon` (text, required)
      - `type` (text, required)
      - `prompt` (text, required)
      - `structure` (jsonb)
      - `is_active` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS
    - Add policies for admin management
    - Add policies for user read access

  3. Initial Data
    - Create default report templates
*/

-- Create report templates table
CREATE TABLE IF NOT EXISTS report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text NOT NULL,
  type text NOT NULL CHECK (type IN ('summary', 'analysis', 'comparison', 'extraction')),
  prompt text NOT NULL,
  structure jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger
CREATE TRIGGER update_report_templates_updated_at
  BEFORE UPDATE ON report_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX idx_report_templates_type ON report_templates(type);
CREATE INDEX idx_report_templates_is_active ON report_templates(is_active);

-- RLS Policies
CREATE POLICY "Admins can manage report templates"
  ON report_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.status = true
    )
  );

CREATE POLICY "Users can read active report templates"
  ON report_templates
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.status = true
    )
  );

-- Insert default templates
INSERT INTO report_templates (name, description, icon, type, prompt, structure) VALUES
(
  'Résumé Exécutif',
  'Synthèse concise des points clés et conclusions principales',
  'FileText',
  'summary',
  'Génère un résumé exécutif clair et concis des documents fournis. 
   Structure ta réponse avec :
   - Une introduction présentant le contexte
   - Les points clés identifiés
   - Les conclusions principales
   - Les recommandations essentielles',
  '{
    "sections": [
      {"title": "Introduction", "required": true},
      {"title": "Points Clés", "required": true},
      {"title": "Conclusions", "required": true},
      {"title": "Recommandations", "required": true}
    ]
  }'
),
(
  'Analyse Approfondie',
  'Analyse détaillée avec sections et interprétations',
  'FileText',
  'analysis',
  'Réalise une analyse approfondie des documents fournis.
   Structure ta réponse avec :
   - Une introduction détaillée
   - Une analyse exhaustive du contenu
   - Les implications identifiées
   - Des recommandations détaillées',
  '{
    "sections": [
      {"title": "Introduction", "required": true},
      {"title": "Analyse Détaillée", "required": true},
      {"title": "Implications", "required": true},
      {"title": "Recommandations", "required": true},
      {"title": "Conclusion", "required": true}
    ]
  }'
),
(
  'Comparaison de Documents',
  'Mise en parallèle des similarités et différences',
  'FileText',
  'comparison',
  'Compare et contraste les documents fournis.
   Structure ta réponse avec :
   - Une introduction présentant les documents
   - Les points communs identifiés
   - Les différences significatives
   - Une synthèse comparative',
  '{
    "sections": [
      {"title": "Introduction", "required": true},
      {"title": "Points Communs", "required": true},
      {"title": "Différences", "required": true},
      {"title": "Synthèse", "required": true}
    ]
  }'
),
(
  'Extraction de Données',
  'Exportation des données structurées en format tabulaire',
  'FileText',
  'extraction',
  'Extrais et structure les données clés des documents.
   Structure ta réponse avec :
   - Les données principales identifiées
   - Les métriques importantes
   - Les tendances observées
   - Une synthèse des données',
  '{
    "sections": [
      {"title": "Données Extraites", "required": true},
      {"title": "Métriques", "required": true},
      {"title": "Tendances", "required": true},
      {"title": "Synthèse", "required": true}
    ]
  }'
);