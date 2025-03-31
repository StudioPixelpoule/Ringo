-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Allow authenticated users to read folders" ON folders;
  DROP POLICY IF EXISTS "Allow admins to manage folders" ON folders;
  DROP POLICY IF EXISTS "Users can read folders" ON folders;
  DROP POLICY IF EXISTS "Admins can manage folders" ON folders;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create new policies for folders
CREATE POLICY "Users can read and list folders"
  ON folders
  FOR SELECT
  TO authenticated
  USING (true);

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

-- Drop existing document policies
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

-- Create new policies for documents
CREATE POLICY "Users can read documents"
  ON documents
  FOR SELECT
  TO authenticated
  USING (true);

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

-- Drop existing document contents policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Allow authenticated users to read document contents" ON document_contents;
  DROP POLICY IF EXISTS "Allow authenticated users to create document contents" ON document_contents;
  DROP POLICY IF EXISTS "Allow authenticated users to update own document contents" ON document_contents;
  DROP POLICY IF EXISTS "Allow authenticated users to delete own document contents" ON document_contents;
  DROP POLICY IF EXISTS "Admins can manage all document contents" ON document_contents;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create new policies for document contents
CREATE POLICY "Users can read document contents"
  ON document_contents
  FOR SELECT
  TO authenticated
  USING (true);

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

-- Drop existing storage policies
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
CREATE POLICY "Users can read storage objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');

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

-- Add comments
COMMENT ON POLICY "Users can read and list folders" ON folders IS 'Allows all authenticated users to read and list folders';
COMMENT ON POLICY "Users can read documents" ON documents IS 'Allows all authenticated users to read documents';
COMMENT ON POLICY "Users can read document contents" ON document_contents IS 'Allows all authenticated users to read document contents';
COMMENT ON POLICY "Users can read storage objects" ON storage.objects IS 'Allows all authenticated users to read document files';