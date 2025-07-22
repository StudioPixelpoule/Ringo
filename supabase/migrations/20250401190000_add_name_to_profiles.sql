-- Add name field to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS name text;

-- Update the error_logs_with_users view to include user name
DROP VIEW IF EXISTS error_logs_with_users;

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
  p.name as user_name,
  p.role as user_role
FROM error_logs e
LEFT JOIN profiles p ON e.user_id = p.id;

-- Grant access to the view
GRANT SELECT ON error_logs_with_users TO authenticated;

-- Comment
COMMENT ON VIEW error_logs_with_users IS 'View for error logs with user information including name. Uses SECURITY INVOKER to enforce RLS policies of the querying user.'; 