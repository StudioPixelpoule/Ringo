/*
  # Add document cache table

  1. New Tables
    - `document_cache`
      - `hash` (text, primary key)
      - `content` (text)
      - `file_name` (text)
      - `file_type` (text)
      - `file_size` (bigint)
      - `cached_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for admin access
    - Add cleanup function
*/

-- Create document cache table
CREATE TABLE IF NOT EXISTS document_cache (
  hash text PRIMARY KEY,
  content text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  cached_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE document_cache ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage document cache"
  ON document_cache
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

-- Create index for cache cleanup
CREATE INDEX idx_document_cache_cached_at ON document_cache(cached_at);

-- Function to clean old cache entries
CREATE OR REPLACE FUNCTION cleanup_document_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM document_cache
  WHERE cached_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Function to check if it's time to cleanup
CREATE OR REPLACE FUNCTION should_cleanup_cache()
RETURNS boolean AS $$
BEGIN
  RETURN EXTRACT(MINUTE FROM CURRENT_TIMESTAMP) = 0;
END;
$$ LANGUAGE plpgsql;

-- Create event trigger for cleanup
CREATE OR REPLACE FUNCTION trigger_cleanup_document_cache()
RETURNS trigger AS $$
BEGIN
  IF should_cleanup_cache() THEN
    PERFORM cleanup_document_cache();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hourly_cache_cleanup
  AFTER INSERT ON document_cache
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_cleanup_document_cache();