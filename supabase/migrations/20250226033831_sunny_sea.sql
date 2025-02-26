/*
  # Create storage bucket for documents

  1. Storage
    - Create a new public bucket named 'documents' for storing user files
    - Enable public access to allow file downloads
    
  2. Security
    - Add RLS policies to control access:
      - Authenticated users can upload their own files
      - Anyone can download files
*/

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true);

-- Policy to allow authenticated users to upload files
CREATE POLICY "Users can upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Policy to allow anyone to download files
CREATE POLICY "Anyone can download files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'documents');