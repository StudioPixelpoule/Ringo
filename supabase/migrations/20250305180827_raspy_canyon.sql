/*
  # Add document content and processing status

  1. Changes
    - Add content column to documents table for storing extracted text
    - Add processed flag to track document processing status
    - Update existing documents to mark as unprocessed

  2. Security
    - Maintain existing RLS policies
*/

-- Add content column for storing extracted text
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS content text,
ADD COLUMN IF NOT EXISTS processed boolean DEFAULT false;

-- Update existing documents to mark as unprocessed
UPDATE documents SET processed = false WHERE processed IS NULL;