/*
  # Create document_contents table and migrate content

  1. New Tables
    - `document_contents`
      - `id` (uuid, primary key)
      - `document_id` (uuid, foreign key to documents)
      - `content` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes
    - Create new table for document contents
    - Migrate existing content
    - Drop old trigger and content column safely
    - Add new indexes and policies

  3. Security
    - Enable RLS
    - Add policies for admin and user access
*/

-- Create document_contents table
CREATE TABLE IF NOT EXISTS document_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(document_id)
);

-- Enable RLS
ALTER TABLE document_contents ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_document_contents_document_id ON document_contents(document_id);
CREATE INDEX IF NOT EXISTS idx_document_contents_content_search ON document_contents USING gin(to_tsvector('french', content));

-- Create updated_at trigger
CREATE TRIGGER update_document_contents_updated_at
  BEFORE UPDATE ON document_contents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
CREATE POLICY "Admins have full access to document contents"
  ON document_contents
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

CREATE POLICY "Users can read document contents"
  ON document_contents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.status = true
    )
  );

-- Migrate existing content
INSERT INTO document_contents (document_id, content)
SELECT id, content
FROM documents
WHERE content IS NOT NULL;

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS update_document_processed_trigger ON documents;

-- Drop the content column
ALTER TABLE documents DROP COLUMN IF EXISTS content;

-- Recreate the processed trigger with updated logic
CREATE OR REPLACE FUNCTION update_document_processed()
RETURNS trigger AS $$
BEGIN
  NEW.processed := EXISTS (
    SELECT 1 FROM document_contents
    WHERE document_id = NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create new trigger that checks document_contents instead
CREATE TRIGGER update_document_processed_trigger
  BEFORE INSERT OR UPDATE
  ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_document_processed();