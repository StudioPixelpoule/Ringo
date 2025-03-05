/*
  # Document Management Schema

  1. New Tables
    - `folders` - Hierarchical folder structure
    - `documents` - Document metadata and storage
  
  2. Security
    - Enable RLS on both tables
    - Policies for admin and user access
    - Storage bucket policies
  
  3. Performance
    - Indexes for common queries
    - Trigger for updated_at timestamps
*/

-- Create folders table if it doesn't exist
CREATE TABLE IF NOT EXISTS folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES folders(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT folder_depth CHECK (
    parent_id != id -- Prevent self-reference
  )
);

-- Create documents table if it doesn't exist
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid REFERENCES folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  group_name text,
  description text,
  url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers if they don't exist
DROP TRIGGER IF EXISTS update_folders_updated_at ON folders;
CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_documents_folder_id ON documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_folders_name ON folders(name);
CREATE INDEX IF NOT EXISTS idx_documents_name ON documents(name);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_group ON documents(group_name);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins have full access to folders" ON folders;
DROP POLICY IF EXISTS "Users can read folders" ON folders;
DROP POLICY IF EXISTS "Admins have full access to documents" ON documents;
DROP POLICY IF EXISTS "Users can read documents" ON documents;

-- Create RLS Policies for folders
CREATE POLICY "Admins have full access to folders"
  ON folders
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
      AND status = true
    )
  );

CREATE POLICY "Users can read folders"
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

-- Create RLS Policies for documents
CREATE POLICY "Admins have full access to documents"
  ON documents
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
      AND status = true
    )
  );

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

-- Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name)
VALUES ('documents', 'documents')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Authenticated users can read document objects" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload document objects" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update document objects" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete document objects" ON storage.objects;

-- Create storage policies
CREATE POLICY "Authenticated users can read document objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "Admins can upload document objects"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
      AND status = true
    )
  );

CREATE POLICY "Admins can update document objects"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
      AND status = true
    )
  );

CREATE POLICY "Admins can delete document objects"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
      AND status = true
    )
  );