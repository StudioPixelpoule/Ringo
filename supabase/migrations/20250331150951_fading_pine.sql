/*
  # Fix Folder Access Permissions

  1. Changes
    - Update RLS policies for folders table
    - Allow all authenticated users to read folders
    - Maintain admin management capabilities
    - Add proper user status checks
  
  2. Security
    - Keep proper access control
    - Allow read access for all users
    - Preserve admin privileges
*/

-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can read folders" ON folders;
  DROP POLICY IF EXISTS "Admins can manage folders" ON folders;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create new policies for folders
CREATE POLICY "Allow authenticated users to read folders"
  ON folders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND status = true
    )
  );

CREATE POLICY "Allow admins to manage folders"
  ON folders
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND status = true
    )
  );

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_folders_hierarchy 
ON folders(parent_id, name);

CREATE INDEX IF NOT EXISTS idx_folders_lookup 
ON folders(id, parent_id);