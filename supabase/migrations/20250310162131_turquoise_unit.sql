/*
  # Add size column to documents table

  1. Changes
    - Add `size` column to documents table to store file sizes in bytes
    - Make column nullable to maintain compatibility with existing records
    - Add index for better query performance when filtering by size

  2. Notes
    - Using BIGINT to support files larger than 2GB
    - No default value to avoid assumptions about file sizes
    - Safe migration that won't affect existing records
*/

-- Add size column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'documents' AND column_name = 'size'
  ) THEN
    ALTER TABLE documents ADD COLUMN size BIGINT;
    
    -- Add index for size column
    CREATE INDEX idx_documents_size ON documents(size);
    
    -- Add comment explaining the column
    COMMENT ON COLUMN documents.size IS 'File size in bytes';
  END IF;
END $$;