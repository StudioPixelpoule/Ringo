/*
  # Add document content and processing status

  1. Changes
    - Add content column to documents table for storing extracted text
    - Add processed flag to track document processing status
    - Add index on processed flag for efficient queries

  2. Security
    - Maintain existing RLS policies
*/

-- Add content column for storing extracted text
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS content text,
ADD COLUMN IF NOT EXISTS processed boolean DEFAULT false;

-- Add index on processed flag
CREATE INDEX IF NOT EXISTS idx_documents_processed ON documents(processed);

-- Update RLS policies to include new columns
DROP POLICY IF EXISTS "Users can read documents" ON documents;
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