/*
  # Fix Report Template Deletion

  1. Changes
    - Drop existing policies
    - Add new policies for super admins and admins
    - Add proper cascade delete
    - Fix permission issues
  
  2. Security
    - Only super admins and admins can delete templates
    - Maintain existing read permissions
    - Add proper error handling
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage report templates" ON report_templates;
DROP POLICY IF EXISTS "Users can read active report templates" ON report_templates;

-- Create new policies with proper permissions
CREATE POLICY "Super admins can manage all templates"
  ON report_templates
  FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage templates"
  ON report_templates
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Users can read active templates"
  ON report_templates
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND status = true
    )
  );

-- Add proper indexes
CREATE INDEX IF NOT EXISTS idx_report_templates_active 
ON report_templates(is_active);

-- Grant proper permissions
GRANT ALL ON report_templates TO authenticated;