/*
  # Fix Error Logs View Security

  1. Changes
    - Drop existing view
    - Recreate view with SECURITY INVOKER
    - Add proper RLS policies
    - Fix view permissions
  
  2. Security
    - Ensure proper access control
    - Maintain data isolation
    - Preserve admin access
*/

-- Drop existing view
DROP VIEW IF EXISTS error_logs_with_users;

-- Create view with SECURITY INVOKER
CREATE VIEW error_logs_with_users 
WITH (security_invoker = on)
AS
SELECT 
  e.id,
  e.error,
  e.stack,
  e.context,
  e.user_id,
  e.created_at,
  e.status,
  e.resolution,
  p.email as user_email,
  p.role as user_role
FROM error_logs e
LEFT JOIN profiles p ON e.user_id = p.id;

-- Grant access to the view
GRANT SELECT ON error_logs_with_users TO authenticated;

-- Add comment explaining security settings
COMMENT ON VIEW error_logs_with_users IS 'View for error logs with user information. Uses SECURITY INVOKER to enforce RLS policies of the querying user.';

-- Drop existing policies
DROP POLICY IF EXISTS "Super admins can access error logs" ON error_logs;

-- Create new policies
CREATE POLICY "Super admins can access error logs"
  ON error_logs
  FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at 
ON error_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_logs_status 
ON error_logs(status);

CREATE INDEX IF NOT EXISTS idx_error_logs_user_id 
ON error_logs(user_id);