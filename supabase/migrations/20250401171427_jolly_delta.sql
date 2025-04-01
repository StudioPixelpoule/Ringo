/*
  # Create Help Requests System

  1. New Tables
    - `help_requests`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `message` (text)
      - `availability` (text)
      - `status` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `resolved_at` (timestamptz)
      - `hours_spent` (numeric)
      - `admin_notes` (text)

  2. Security
    - Enable RLS
    - Add policies for user and admin access
    - Add indexes for performance
*/

-- Create help_requests table
CREATE TABLE IF NOT EXISTS help_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message text NOT NULL,
  availability text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  hours_spent numeric,
  admin_notes text,
  CONSTRAINT message_length CHECK (char_length(message) <= 300)
);

-- Enable RLS
ALTER TABLE help_requests ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_help_requests_user_id ON help_requests(user_id);
CREATE INDEX idx_help_requests_status ON help_requests(status);
CREATE INDEX idx_help_requests_created_at ON help_requests(created_at DESC);

-- Create updated_at trigger
CREATE TRIGGER update_help_requests_updated_at
  BEFORE UPDATE ON help_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create RLS policies
CREATE POLICY "Users can create help requests"
  ON help_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND status = true
    )
  );

CREATE POLICY "Users can view own help requests"
  ON help_requests
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND status = true
    )
  );

CREATE POLICY "Admins can manage all help requests"
  ON help_requests
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

-- Create view for help requests with user info
CREATE VIEW help_requests_with_users 
WITH (security_invoker = on)
AS
SELECT 
  h.*,
  p.email as user_email,
  p.role as user_role
FROM help_requests h
JOIN profiles p ON h.user_id = p.id;

-- Grant access to the view
GRANT SELECT ON help_requests_with_users TO authenticated;

-- Add comment
COMMENT ON TABLE help_requests IS 'Stores user requests for assistance with time tracking';
COMMENT ON VIEW help_requests_with_users IS 'View for help requests with user information. Uses SECURITY INVOKER to enforce RLS policies of the querying user.';