/*
  # Add chunked file tracking to document cache

  1. Changes
    - Add is_chunked boolean field to document_cache table
    - Add manifest_path field for chunked files
    - Add indexes for better performance
    - Update existing records
  
  2. Security
    - Maintain existing RLS policies
    - Keep admin-only access
*/

-- Add new columns to document_cache
ALTER TABLE document_cache 
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
  manifest record;
BEGIN
  -- Get expired chunked files
  FOR manifest IN 
    SELECT manifest_path 
    FROM document_cache 
    WHERE is_chunked = true 
    AND cached_at < NOW() - INTERVAL '1 hour'
  LOOP
    -- Delete manifest file
    DELETE FROM storage.objects 
    WHERE bucket_id = 'documents' 
    AND name = manifest.manifest_path;
    
    -- Delete associated chunks
    DELETE FROM storage.objects 
    WHERE bucket_id = 'documents' 
    AND name LIKE REPLACE(manifest.manifest_path, '_manifest.json', '_chunk_%');
  END;

  -- Delete expired cache entries
  DELETE FROM document_cache
  WHERE cached_at < NOW() - INTERVAL '1 hour';
END;
$$;

-- Add comment
COMMENT ON COLUMN document_cache.is_chunked IS 'Indicates if the file is stored as multiple chunks with a manifest';
COMMENT ON COLUMN document_cache.manifest_path IS 'Path to the manifest file for chunked storage';