/*
  # Create Report Templates Table

  1. New Tables
    - `report_templates`
      - `id` (uuid, primary key)
      - `title` (text, not null)
      - `prompt` (text, not null)
      - `usage_count` (integer, default 0)
      - `created_at` (timestamp with time zone)

  2. Security
    - Enable RLS
    - Add policies for admin access
    - Add policies for user read access

  Note: This migration creates a table for storing report templates with proper security policies.
*/

-- Check if table exists and drop if it does
DROP TABLE IF EXISTS report_templates;

-- Create report templates table
CREATE TABLE report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  prompt text NOT NULL,
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;

-- Only admins can manage templates
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

-- All authenticated users can read templates
CREATE POLICY "Users can read report templates"
  ON report_templates
  FOR SELECT
  TO authenticated
  USING (true);

-- Create index for faster lookups
CREATE INDEX idx_report_templates_created_at ON report_templates(created_at);