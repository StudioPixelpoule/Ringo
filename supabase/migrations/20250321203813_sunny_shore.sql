/*
  # Add Error Logging System

  1. New Tables
    - `error_logs`
      - `id` (uuid, primary key)
      - `error` (text)
      - `stack` (text)
      - `context` (jsonb)
      - `user_id` (uuid)
      - `created_at` (timestamptz)
      - `status` (text)
      - `resolution` (text)

  2. Security
    - Enable RLS
    - Only super admins can access error logs
    - Add indexes for efficient querying
*/

-- Create error_logs table
CREATE TABLE IF NOT EXISTS error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error text NOT NULL,
  stack text,
  context jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'resolved')),
  resolution text,
  CONSTRAINT error_content_length CHECK (char_length(error) <= 10000)
);

-- Enable RLS
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_error_logs_status ON error_logs(status);
CREATE INDEX idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX idx_error_logs_user_id ON error_logs(user_id);

-- Create RLS policies
CREATE POLICY "Super admins can access error logs"
  ON error_logs
  FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()));

-- Create view for error logs with user info
CREATE VIEW error_logs_with_users AS
SELECT 
  e.*,
  p.email as user_email,
  p.role as user_role
FROM error_logs e
LEFT JOIN profiles p ON e.user_id = p.id;

-- Grant access to view
GRANT SELECT ON error_logs_with_users TO authenticated;

-- Add comment
COMMENT ON TABLE error_logs IS 'System error logs accessible only to super admins';