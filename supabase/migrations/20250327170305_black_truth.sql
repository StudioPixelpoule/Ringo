/*
  # Fix Document Processing and Content Storage

  1. Changes
    - Add missing columns to documents table
    - Add missing columns to document_contents table
    - Fix constraints and indexes
    - Update processing trigger

  2. Security
    - Maintain existing RLS policies
    - Add proper constraints
*/

-- Drop existing trigger
DROP TRIGGER IF EXISTS update_document_processed_trigger ON documents;

-- Add missing columns to documents
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS is_chunked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS manifest_path text;

-- Add missing columns to document_contents
ALTER TABLE document_contents 
ADD COLUMN IF NOT EXISTS is_chunked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS chunk_index integer,
ADD COLUMN IF NOT EXISTS total_chunks integer;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_documents_chunked 
ON documents(is_chunked) 
WHERE is_chunked = true;

CREATE INDEX IF NOT EXISTS idx_documents_manifest 
ON documents(manifest_path) 
WHERE manifest_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_contents_chunks 
ON document_contents(document_id, chunk_index) 
WHERE is_chunked = true;

-- Add constraint for chunk data
ALTER TABLE document_contents
DROP CONSTRAINT IF EXISTS valid_chunk_data;

ALTER TABLE document_contents
ADD CONSTRAINT valid_chunk_data
  CHECK (
    (is_chunked = false AND chunk_index IS NULL AND total_chunks IS NULL) OR
    (is_chunked = true AND chunk_index IS NOT NULL AND total_chunks IS NOT NULL)
  );

-- Update document processing trigger
CREATE OR REPLACE FUNCTION update_document_processed()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- For chunked documents, check if all chunks are present
  IF NEW.is_chunked THEN
    NEW.processed := EXISTS (
      SELECT 1 
      FROM document_contents dc
      WHERE dc.document_id = NEW.id
      GROUP BY dc.document_id, dc.total_chunks
      HAVING COUNT(*) = MAX(dc.total_chunks)
    );
  ELSE
    NEW.processed := EXISTS (
      SELECT 1 
      FROM document_contents dc
      WHERE dc.document_id = NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER update_document_processed_trigger
  BEFORE INSERT OR UPDATE
  ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_document_processed();

-- Add comments
COMMENT ON COLUMN documents.is_chunked IS 'Indicates if the document is stored as multiple chunks';
COMMENT ON COLUMN documents.manifest_path IS 'Path to the manifest file for chunked documents';
COMMENT ON COLUMN document_contents.is_chunked IS 'Indicates if this content is part of a chunked document';
COMMENT ON COLUMN document_contents.chunk_index IS 'Index of this chunk in the sequence (0-based)';
COMMENT ON COLUMN document_contents.total_chunks IS 'Total number of chunks for this document';