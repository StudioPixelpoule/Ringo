/*
  # Document Management System

  1. New Tables
    - `document_contents` - Store document content separately
    - `document_cache` - Cache processed documents
    - Add size tracking to documents table
    - Add processing status tracking

  2. Security
    - Enable RLS on all tables
    - Add policies for admin and user access
    - Add indexes for performance
*/

-- Drop existing triggers and functions if they exist
DROP TRIGGER IF EXISTS update_document_contents_updated_at ON document_contents;
DROP TRIGGER IF EXISTS update_document_processed_trigger ON documents;
DROP TRIGGER IF EXISTS hourly_cache_cleanup ON document_cache;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins can manage document contents" ON document_contents;
DROP POLICY IF EXISTS "Users can read document contents" ON document_contents;
DROP POLICY IF EXISTS "Admins can manage document cache" ON document_cache;
DROP POLICY IF EXISTS "Users can read documents" ON documents;
DROP POLICY IF EXISTS "Admins can manage documents" ON documents;

-- Create document_contents table
CREATE TABLE IF NOT EXISTS document_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(document_id)
);

-- Create document_cache table
CREATE TABLE IF NOT EXISTS document_cache (
  hash text PRIMARY KEY,
  content text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  cached_at timestamptz DEFAULT now()
);

-- Add size column to documents
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS size bigint,
ADD COLUMN IF NOT EXISTS processed boolean DEFAULT false;

-- Add comment for size column
COMMENT ON COLUMN documents.size IS 'File size in bytes';

-- Enable RLS
ALTER TABLE document_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_cache ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_documents_processed ON documents(processed);
CREATE INDEX IF NOT EXISTS idx_documents_size ON documents(size);
CREATE INDEX IF NOT EXISTS idx_document_contents_document_id ON document_contents(document_id);
CREATE INDEX IF NOT EXISTS idx_document_contents_content_search 
  ON document_contents USING gin(to_tsvector('french', content));
CREATE INDEX IF NOT EXISTS idx_document_cache_cached_at ON document_cache(cached_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_document_contents_updated_at
  BEFORE UPDATE ON document_contents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to update document processed status
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
CREATE TRIGGER update_document_processed_trigger
  BEFORE INSERT OR UPDATE
  ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_document_processed();

-- Function to clean old cache entries
CREATE OR REPLACE FUNCTION cleanup_document_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM document_cache
  WHERE cached_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Function to check if cleanup is needed
CREATE OR REPLACE FUNCTION should_cleanup_cache()
RETURNS boolean AS $$
BEGIN
  RETURN EXTRACT(MINUTE FROM CURRENT_TIMESTAMP) = 0;
END;
$$ LANGUAGE plpgsql;

-- Create cleanup trigger function
CREATE OR REPLACE FUNCTION trigger_cleanup_document_cache()
RETURNS TRIGGER AS $$
BEGIN
  IF should_cleanup_cache() THEN
    PERFORM cleanup_document_cache();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create cleanup trigger
CREATE TRIGGER hourly_cache_cleanup
  AFTER INSERT ON document_cache
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_cleanup_document_cache();

-- RLS Policies for document_contents
CREATE POLICY "Admins can manage document contents"
  ON document_contents
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Users can read document contents"
  ON document_contents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.status = true
    )
  );

-- RLS Policies for document_cache
CREATE POLICY "Admins can manage document cache"
  ON document_cache
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

-- Update existing documents table policies
CREATE POLICY "Users can read documents"
  ON documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.status = true
    )
  );

CREATE POLICY "Admins can manage documents"
  ON documents
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));