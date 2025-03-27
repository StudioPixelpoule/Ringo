/*
  # Add Chunked Storage Support

  1. Changes
    - Add is_chunked column to documents table
    - Add manifest_path column for chunked files
    - Add indexes for efficient querying
    - Update document_contents table schema
  
  2. Security
    - Maintain existing RLS policies
    - Add proper constraints
*/

-- Add new columns to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS is_chunked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS manifest_path text;

-- Add index for chunked files
CREATE INDEX IF NOT EXISTS idx_documents_chunked 
ON documents(is_chunked) 
WHERE is_chunked = true;

-- Add manifest path index
CREATE INDEX IF NOT EXISTS idx_documents_manifest 
ON documents(manifest_path) 
WHERE manifest_path IS NOT NULL;

-- Update document_contents table to support chunked content
ALTER TABLE document_contents 
ADD COLUMN IF NOT EXISTS is_chunked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS chunk_index integer,
ADD COLUMN IF NOT EXISTS total_chunks integer;

-- Add index for chunk ordering
CREATE INDEX IF NOT EXISTS idx_document_contents_chunks 
ON document_contents(document_id, chunk_index) 
WHERE is_chunked = true;

-- Add constraint to ensure chunk_index is set when chunked
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
  IF TG_OP = 'INSERT' OR NEW.content IS DISTINCT FROM OLD.content THEN
    -- For chunked documents, check if all chunks are present
    IF NEW.is_chunked THEN
      NEW.processed := EXISTS (
        SELECT 1 
        FROM document_contents dc
        WHERE dc.document_id = NEW.document_id
        GROUP BY dc.document_id, dc.total_chunks
        HAVING COUNT(*) = MAX(dc.total_chunks)
      );
    ELSE
      NEW.processed := NEW.content IS NOT NULL AND length(NEW.content) > 0;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Add comments
COMMENT ON COLUMN documents.is_chunked IS 'Indicates if the document is stored as multiple chunks';
COMMENT ON COLUMN documents.manifest_path IS 'Path to the manifest file for chunked documents';
COMMENT ON COLUMN document_contents.is_chunked IS 'Indicates if this content is part of a chunked document';
COMMENT ON COLUMN document_contents.chunk_index IS 'Index of this chunk in the sequence (0-based)';
COMMENT ON COLUMN document_contents.total_chunks IS 'Total number of chunks for this document';