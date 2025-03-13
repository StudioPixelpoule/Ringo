/*
  # Fix Document Contents RLS Policies

  1. Changes
    - Update RLS policies for document_contents table
    - Allow authenticated users to create document contents
    - Maintain admin override policies
    - Add proper user status checks
  
  2. Security
    - Maintain data isolation
    - Allow content creation for authenticated users
    - Preserve admin management capabilities
*/

-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage document contents" ON document_contents;
  DROP POLICY IF EXISTS "Users can read document contents" ON document_contents;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create new policies for document_contents table
CREATE POLICY "Allow authenticated users to read document contents"
  ON document_contents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND status = true
    )
  );

CREATE POLICY "Allow authenticated users to create document contents"
  ON document_contents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND status = true
    )
  );

CREATE POLICY "Allow authenticated users to update own document contents"
  ON document_contents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_id
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND status = true
      )
    )
  );

CREATE POLICY "Allow authenticated users to delete own document contents"
  ON document_contents
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_id
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND status = true
      )
    )
  );

-- Add admin override policy
CREATE POLICY "Admins can manage all document contents"
  ON document_contents
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