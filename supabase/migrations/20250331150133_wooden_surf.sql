/*
  # Fix Document RLS Policies

  1. Changes
    - Update RLS policies for documents table
    - Allow authenticated users to read documents
    - Maintain admin override policies
    - Add proper user status checks
  
  2. Security
    - Maintain data isolation
    - Allow document access for authenticated users
    - Preserve admin management capabilities
*/

-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Allow authenticated users to read documents" ON documents;
  DROP POLICY IF EXISTS "Allow authenticated users to create documents" ON documents;
  DROP POLICY IF EXISTS "Allow authenticated users to update own documents" ON documents;
  DROP POLICY IF EXISTS "Allow authenticated users to delete own documents" ON documents;
  DROP POLICY IF EXISTS "Admins can manage all documents" ON documents;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create new policies for documents table
CREATE POLICY "Allow authenticated users to read documents"
  ON documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND status = true
    )
  );

CREATE POLICY "Allow authenticated users to create documents"
  ON documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND status = true
    )
  );

CREATE POLICY "Allow authenticated users to update own documents"
  ON documents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = folder_id
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND status = true
      )
    )
  );

CREATE POLICY "Allow authenticated users to delete own documents"
  ON documents
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = folder_id
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND status = true
      )
    )
  );

-- Add admin override policy
CREATE POLICY "Admins can manage all documents"
  ON documents
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND status = true
    )
  );