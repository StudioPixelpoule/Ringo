/*
  # Add document content processing

  1. Changes
    - Add content column to documents table for storing extracted text
    - Add processed flag to track document processing status
    - Add indexes for content search and processed status

  2. Security
    - Maintain existing RLS policies
*/

-- Add content and processed columns to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS content text,
ADD COLUMN IF NOT EXISTS processed boolean DEFAULT false;

-- Add indexes for content search and processed status
CREATE INDEX IF NOT EXISTS idx_documents_content_search ON documents USING gin (to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_documents_processed ON documents USING btree (processed);

-- Update trigger function to handle content processing
CREATE OR REPLACE FUNCTION update_document_processed()
RETURNS trigger AS $$
BEGIN
  IF NEW.content IS NOT NULL AND NEW.content != '' THEN
    NEW.processed = true;
  ELSE
    NEW.processed = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for content processing
DROP TRIGGER IF EXISTS update_document_processed_trigger ON documents;
CREATE TRIGGER update_document_processed_trigger
  BEFORE INSERT OR UPDATE OF content ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_document_processed();