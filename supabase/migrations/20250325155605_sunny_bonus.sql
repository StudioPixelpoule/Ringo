/*
  # Fix Storage Configuration for Large Files

  1. Changes
    - Create schema for storage validation functions
    - Add file size validation function
    - Update storage policies with size checks
    - Fix file size validation using metadata
  
  2. Security
    - Maintain existing security model
    - Add proper file size validation
    - Keep access control policies
*/

-- Create schema for custom storage functions if it doesn't exist
CREATE SCHEMA IF NOT EXISTS storage_private;

-- Create function to validate file size based on type
CREATE OR REPLACE FUNCTION storage_private.validate_file_size(
  bucket_id text,
  name text,
  owner uuid,
  metadata jsonb,
  content_type text
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  max_size bigint;
  file_size bigint;
BEGIN
  -- Get file size from metadata
  file_size := (metadata->>'size')::bigint;
  
  -- Set size limit based on file type
  max_size := CASE 
    WHEN content_type LIKE 'audio/%' OR content_type LIKE 'video/%' THEN 104857600  -- 100MB
    ELSE 52428800  -- 50MB
  END;
  
  RETURN COALESCE(file_size, 0) <= max_size;
END;
$$;

-- Drop existing policies first
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Allow authenticated users to read documents" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to upload documents" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to update own documents" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to delete own documents" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can manage all documents" ON storage.objects;
  DROP POLICY IF EXISTS "authenticated_read" ON storage.objects;
  DROP POLICY IF EXISTS "authenticated_insert" ON storage.objects;
  DROP POLICY IF EXISTS "authenticated_update" ON storage.objects;
  DROP POLICY IF EXISTS "authenticated_delete" ON storage.objects;
  DROP POLICY IF EXISTS "admin_all" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create new storage policies
CREATE POLICY "storage_authenticated_read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

CREATE POLICY "storage_authenticated_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND storage_private.validate_file_size(
    bucket_id,
    name,
    auth.uid(),
    metadata,
    coalesce(metadata->>'mimetype', 'application/octet-stream')
  )
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND status = true
  )
);

CREATE POLICY "storage_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND owner = auth.uid()
);

CREATE POLICY "storage_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND owner = auth.uid()
);

CREATE POLICY "storage_admin_all"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND status = true
  )
);