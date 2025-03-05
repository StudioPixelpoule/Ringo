/*
  # Add trigger for document content processing

  1. Changes
    - Add trigger function to update document processed status
    - Add trigger to automatically update processed flag when content changes

  2. Security
    - Function is owned by postgres to ensure proper execution
*/

-- Create trigger function
CREATE OR REPLACE FUNCTION update_document_processed()
RETURNS trigger AS $$
BEGIN
  -- Set processed to true if content is not null or empty
  NEW.processed := NEW.content IS NOT NULL AND length(trim(NEW.content)) > 0;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_document_processed_trigger ON documents;
CREATE TRIGGER update_document_processed_trigger
  BEFORE INSERT OR UPDATE OF content
  ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_document_processed();