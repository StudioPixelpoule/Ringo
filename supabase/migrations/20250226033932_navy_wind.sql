/*
  # Add folder column to documents table

  1. Changes
    - Add nullable folder column to documents table to support folder organization
    - The folder column will store the full path (e.g., "marketing/presentations/2024")
    
  2. Notes
    - Folder paths are stored as text strings with '/' as separator
    - NULL value means the document is at the root level
*/

ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS folder text;

-- Update the insert policy to allow setting the folder
DROP POLICY IF EXISTS "Users can upload own documents" ON documents;
CREATE POLICY "Users can upload own documents"
  ON documents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Update the select policy to allow reading documents in folders
DROP POLICY IF EXISTS "Users can read own documents" ON documents;
CREATE POLICY "Users can read own documents"
  ON documents
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);