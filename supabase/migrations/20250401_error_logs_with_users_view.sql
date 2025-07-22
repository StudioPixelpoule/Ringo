-- Create view for error logs with user information
CREATE OR REPLACE VIEW error_logs_with_users AS
SELECT 
  el.*,
  p.email as user_email
FROM error_logs el
LEFT JOIN profiles p ON el.user_id = p.id;

-- Grant permissions
GRANT SELECT ON error_logs_with_users TO authenticated; 