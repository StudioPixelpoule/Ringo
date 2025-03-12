/*
  # Create Report Templates Table

  1. New Tables
    - `report_templates`
      - `id` (uuid, primary key)
      - `title` (text, required)
      - `prompt` (text, required)
      - `usage_count` (integer, default 0)
      - `created_at` (timestamp with timezone)

  2. Security
    - Enable RLS on `report_templates` table
    - Add policy for admins to manage templates
    - Add policy for all authenticated users to read templates

  Note: Using IF NOT EXISTS and DROP IF EXISTS to handle idempotency
*/

-- Drop existing policies if they exist
DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins can manage report templates" ON report_templates;
  DROP POLICY IF EXISTS "Users can read report templates" ON report_templates;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;

-- Create report templates table
CREATE TABLE IF NOT EXISTS report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  prompt text NOT NULL,
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;

-- Only admins can manage templates
DO $$ BEGIN
  CREATE POLICY "Admins can manage report templates"
    ON report_templates
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.status = true
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- All authenticated users can read templates
DO $$ BEGIN
  CREATE POLICY "Users can read report templates"
    ON report_templates
    FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;