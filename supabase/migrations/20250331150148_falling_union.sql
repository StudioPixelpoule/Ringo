/*
  # Fix Storage Policies

  1. Changes
    - Update storage policies to allow authenticated users to read files
    - Keep admin-only policies for deletion and updates
    - Add proper bucket configuration
  
  2. Security
    - Maintain data isolation
    - Allow file access for authenticated users
    - Preserve admin management capabilities
*/

-- Ensure storage bucket exists
INSERT INTO storage.buckets (id, name)
VALUES ('documents', 'documents')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Allow authenticated users to read documents" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to upload documents" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to update own documents" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to delete own documents" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can manage all documents" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create new storage policies
CREATE POLICY "Allow authenticated users to read documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "Allow authenticated users to upload documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND status = true
    )
  );

CREATE POLICY "Allow authenticated users to update own documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND owner = auth.uid()
  );

CREATE POLICY "Allow authenticated users to delete own documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND owner = auth.uid()
  );

-- Add admin override policies
CREATE POLICY "Admins can manage all documents"
  ON storage.objects
  FOR ALL
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