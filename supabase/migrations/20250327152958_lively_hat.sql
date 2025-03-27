/*
  # Add Document Cache Chunking Support

  1. Changes
    - Add is_chunked flag to track chunked files
    - Add manifest_path to store manifest location
    - Add content column for file content or manifest
    - Update cleanup function to handle chunks
  
  2. Security
    - Maintain existing RLS policies
    - Keep admin-only access
*/

-- Add new columns to document_cache
ALTER TABLE document_cache 
ADD COLUMN IF NOT EXISTS content text NOT NULL,
ADD COLUMN IF NOT EXISTS is_chunked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS manifest_path text;

-- Create index for chunked files
CREATE INDEX IF NOT EXISTS idx_document_cache_chunked 
ON document_cache(is_chunked) 
WHERE is_chunked = true;

-- Update cleanup function to handle manifest files
CREATE OR REPLACE FUNCTION cleanup_document_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  manifest_record record;
BEGIN
  -- Get expired chunked files
  FOR manifest_record IN 
    SELECT manifest_path 
    FROM document_cache 
    WHERE is_chunked = true 
    AND cached_at < NOW() - INTERVAL '1 hour'
  LOOP
    -- Delete manifest file
    DELETE FROM storage.objects 
    WHERE bucket_id = 'documents' 
    AND name = manifest_record.manifest_path;
    
    -- Delete associated chunks
    DELETE FROM storage.objects 
    WHERE bucket_id = 'documents' 
    AND name LIKE REPLACE(manifest_record.manifest_path, '_manifest.json', '_chunk_%');
  END LOOP;

  -- Delete expired cache entries
  DELETE FROM document_cache
  WHERE cached_at < NOW() - INTERVAL '1 hour';
END;
$$;

-- Add comments
COMMENT ON COLUMN document_cache.content IS 'File content or manifest JSON for chunked files';
COMMENT ON COLUMN document_cache.is_chunked IS 'Indicates if the file is stored as multiple chunks with a manifest';
COMMENT ON COLUMN document_cache.manifest_path IS 'Path to the manifest file for chunked storage';