/*
  # Add Report Types Management

  1. New Tables
    - `report_types`
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text)
      - `order` (integer)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for admin access
    - Add indexes for performance
*/

-- Create report_types table
CREATE TABLE IF NOT EXISTS report_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  "order" integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE report_types ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger
CREATE TRIGGER update_report_types_updated_at
  BEFORE UPDATE ON report_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX idx_report_types_order ON report_types("order");
CREATE INDEX idx_report_types_active ON report_types(is_active);

-- Create RLS policies
CREATE POLICY "Super admins can manage all types"
  ON report_types
  FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage types"
  ON report_types
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Users can read active types"
  ON report_types
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND status = true
    )
  );

-- Insert default types
INSERT INTO report_types (name, description, "order") VALUES
('summary', 'Résumé concis des points clés', 1),
('analysis', 'Analyse détaillée et approfondie', 2),
('comparison', 'Comparaison entre documents', 3),
('extraction', 'Extraction de données structurées', 4);

-- Add foreign key to report_templates
ALTER TABLE report_templates
DROP CONSTRAINT IF EXISTS report_templates_type_check,
ADD COLUMN IF NOT EXISTS type_id uuid REFERENCES report_types(id);

-- Update existing templates with type_id
UPDATE report_templates t
SET type_id = (
  SELECT id FROM report_types rt 
  WHERE rt.name = t.type
)
WHERE type_id IS NULL;