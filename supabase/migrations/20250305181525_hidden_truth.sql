/*
  # Improve document processing and content storage

  1. Changes
    - Add content column for storing extracted text
    - Add processed flag for tracking document processing status
    - Add indexes for efficient querying
    - Update RLS policies to include new columns

  2. Security
    - Maintain existing RLS policies
    - Add policies for content access
*/

-- Add content and processed columns if they don't exist
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

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_documents_processed ON documents(processed);
CREATE INDEX IF NOT EXISTS idx_documents_content_search ON documents USING gin(to_tsvector('english', coalesce(content, '')));

-- Update RLS policies to include new columns
DROP POLICY IF EXISTS "Users can read documents" ON documents;
CREATE POLICY "Users can read documents"
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

-- Add function to update processed status
CREATE OR REPLACE FUNCTION update_document_processed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.content IS NOT NULL AND NEW.content != '' THEN
    NEW.processed = true;
  ELSE
    NEW.processed = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to automatically update processed status
DROP TRIGGER IF EXISTS update_document_processed_trigger ON documents;
CREATE TRIGGER update_document_processed_trigger
  BEFORE INSERT OR UPDATE OF content
  ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_document_processed();