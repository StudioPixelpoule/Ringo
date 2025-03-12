/*
  # Create document_contents table

  1. New Tables
    - `document_contents`
      - `id` (uuid, primary key)
      - `document_id` (uuid, foreign key to documents)
      - `content` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes
    - Move content from documents table to document_contents
    - Add foreign key constraint
    - Add RLS policies
    - Add indexes for performance

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

-- Remove content column from documents
ALTER TABLE documents DROP COLUMN IF EXISTS content;