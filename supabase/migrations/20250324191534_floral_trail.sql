-- Add archived column to error_logs
ALTER TABLE error_logs 
ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;

-- Add index for archived status
CREATE INDEX IF NOT EXISTS idx_error_logs_archived 
ON error_logs(archived);

-- Drop existing view
DROP VIEW IF EXISTS error_logs_with_users;

-- Recreate view with archived column
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
  e.archived,
  p.email as user_email,
  p.role as user_role
FROM error_logs e
LEFT JOIN profiles p ON e.user_id = p.id;

-- Grant access to the view
GRANT SELECT ON error_logs_with_users TO authenticated;

-- Add comment explaining security settings
COMMENT ON VIEW error_logs_with_users IS 'View for error logs with user information. Uses SECURITY INVOKER to enforce RLS policies of the querying user.';