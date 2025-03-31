-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can read and list folders" ON folders;
  DROP POLICY IF EXISTS "Admins can manage folders" ON folders;
  DROP POLICY IF EXISTS "Users can read documents" ON documents;
  DROP POLICY IF EXISTS "Admins can manage documents" ON documents;
  DROP POLICY IF EXISTS "Users can read document contents" ON document_contents;
  DROP POLICY IF EXISTS "Admins can manage document contents" ON document_contents;
  DROP POLICY IF EXISTS "Users can read storage objects" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can manage storage objects" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create new policies for folders
CREATE POLICY "Users can read and list folders"
  ON folders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND status = true
    )
  );

CREATE POLICY "Admins can manage folders"
  ON folders
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

-- Create new policies for documents
CREATE POLICY "Users can read documents"
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

CREATE POLICY "Admins can manage documents"
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

-- Create new policies for document contents
CREATE POLICY "Users can read document contents"
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

CREATE POLICY "Admins can manage document contents"
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

-- Create new policies for storage
CREATE POLICY "Users can read storage objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND status = true
    )
  );

CREATE POLICY "Admins can manage storage objects"
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

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_auth_check 
ON profiles (id, role, status);

CREATE INDEX IF NOT EXISTS idx_profiles_active_users
ON profiles (id, status) 
WHERE status = true;

CREATE INDEX IF NOT EXISTS idx_profiles_admin_check
ON profiles (id, role, status) 
WHERE role IN ('admin', 'super_admin') AND status = true;

-- Add comments
COMMENT ON POLICY "Users can read and list folders" ON folders IS 'Allows active users to read and list folders';
COMMENT ON POLICY "Users can read documents" ON documents IS 'Allows active users to read documents';
COMMENT ON POLICY "Users can read document contents" ON document_contents IS 'Allows active users to read document contents';
COMMENT ON POLICY "Users can read storage objects" ON storage.objects IS 'Allows active users to read document files';