/*
  # Add document content storage

  1. New Columns
    - Add `content` column to documents table for storing extracted text
    - Add `processed` boolean flag to track processing status

  2. Changes
    - Update existing tables to support document content storage
    - Add index on content for better search performance
*/

-- Add new columns to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS content text,
ADD COLUMN IF NOT EXISTS processed boolean DEFAULT false;

-- Add index for content search
CREATE INDEX IF NOT EXISTS idx_documents_content_search ON documents USING gin(to_tsvector('english', content));

-- Update RLS policies to include new columns
CREATE POLICY "Users can read document content"
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