/*
  # Optimize RLS Policies and Document Management

  1. Changes
    - Consolidate RLS policies for documents and contents
    - Add efficient user access checks
    - Improve policy performance with indexes
    - Add document content and cache management

  2. Security
    - Maintain strict access control
    - Preserve data isolation
    - Enable proper auditing
*/

-- Drop existing policies to avoid conflicts
DO $$ 
BEGIN
  -- Drop document policies
  DROP POLICY IF EXISTS "Users can read documents" ON documents;
  DROP POLICY IF EXISTS "Admins can manage documents" ON documents;
  
  -- Drop document contents policies
  DROP POLICY IF EXISTS "Admins can manage document contents" ON document_contents;
  DROP POLICY IF EXISTS "Users can read document contents" ON document_contents;
  
  -- Drop document cache policies
  DROP POLICY IF EXISTS "Admins can manage document cache" ON document_cache;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create document_contents table if not exists
CREATE TABLE IF NOT EXISTS document_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(document_id)
);

-- Create document_cache table if not exists
CREATE TABLE IF NOT EXISTS document_cache (
  hash text PRIMARY KEY,
  content text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  cached_at timestamptz DEFAULT now()
);

-- Add columns to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS size bigint,
ADD COLUMN IF NOT EXISTS processed boolean DEFAULT false;

-- Add column comment
COMMENT ON COLUMN documents.size IS 'File size in bytes';

-- Enable RLS
ALTER TABLE document_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_cache ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_documents_processed ON documents(processed);
CREATE INDEX IF NOT EXISTS idx_documents_size ON documents(size);
CREATE INDEX IF NOT EXISTS idx_document_contents_document_id ON document_contents(document_id);
CREATE INDEX IF NOT EXISTS idx_document_contents_content_search 
  ON document_contents USING gin(to_tsvector('french', content));
CREATE INDEX IF NOT EXISTS idx_document_cache_cached_at ON document_cache(cached_at);

-- Create function to check user access
CREATE OR REPLACE FUNCTION check_user_access(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND status = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check admin access
CREATE OR REPLACE FUNCTION check_admin_access(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND role = 'admin'
    AND status = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies for documents
CREATE POLICY "Users can read documents"
  ON documents
  FOR SELECT
  TO authenticated
  USING (check_user_access(auth.uid()));

CREATE POLICY "Admins can manage documents"
  ON documents
  FOR ALL
  TO authenticated
  USING (check_admin_access(auth.uid()));

-- Create RLS policies for document_contents
CREATE POLICY "Users can read document contents"
  ON document_contents
  FOR SELECT
  TO authenticated
  USING (check_user_access(auth.uid()));

CREATE POLICY "Admins can manage document contents"
  ON document_contents
  FOR ALL
  TO authenticated
  USING (check_admin_access(auth.uid()));

-- Create RLS policies for document_cache
CREATE POLICY "Admins can manage document cache"
  ON document_cache
  FOR ALL
  TO authenticated
  USING (check_admin_access(auth.uid()));

-- Create function for document processing status
CREATE OR REPLACE FUNCTION update_document_processed()
RETURNS TRIGGER AS $$
BEGIN
  NEW.processed := EXISTS (
    SELECT 1 FROM document_contents
    WHERE document_id = NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for document processing status
DROP TRIGGER IF EXISTS update_document_processed_trigger ON documents;
CREATE TRIGGER update_document_processed_trigger
  BEFORE INSERT OR UPDATE
  ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_document_processed();

-- Create function for cache cleanup
CREATE OR REPLACE FUNCTION cleanup_document_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM document_cache
  WHERE cached_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Create trigger for cache cleanup
DROP TRIGGER IF EXISTS hourly_cache_cleanup ON document_cache;
CREATE TRIGGER hourly_cache_cleanup
  AFTER INSERT ON document_cache
  FOR EACH STATEMENT
  WHEN (EXTRACT(minute FROM CURRENT_TIMESTAMP) = 0)
  EXECUTE FUNCTION cleanup_document_cache();