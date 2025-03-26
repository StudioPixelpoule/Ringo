/*
  # Create reports table

  1. New Tables
    - `reports`
      - `id` (uuid, primary key)
      - `conversation_id` (uuid, foreign key)
      - `template_id` (uuid, foreign key)
      - `title` (text)
      - `content` (text)
      - `url` (text)
      - `created_at` (timestamptz)
      - `status` (text)

  2. Security
    - Enable RLS on `reports` table
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  template_id uuid REFERENCES report_templates(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text,
  url text,
  created_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  error_message text
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Users can read their own reports
CREATE POLICY "Users can read their own reports"
  ON reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = reports.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- Users can create reports for their conversations
CREATE POLICY "Users can create reports"
  ON reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = reports.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- Update report templates table to track usage
ALTER TABLE report_templates
  ADD COLUMN IF NOT EXISTS usage_count integer DEFAULT 0;

-- Function to increment template usage count
CREATE OR REPLACE FUNCTION increment_template_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE report_templates
  SET usage_count = usage_count + 1
  WHERE id = NEW.template_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to increment usage count when report is created
CREATE TRIGGER increment_template_usage_trigger
  AFTER INSERT ON reports
  FOR EACH ROW
  EXECUTE FUNCTION increment_template_usage();