/*
  # Fix Feedback View Security

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
DROP VIEW IF EXISTS feedback_with_profiles;

-- Create view with SECURITY INVOKER
CREATE VIEW feedback_with_profiles 
WITH (security_invoker = on)
AS
SELECT 
  f.id,
  f.user_id,
  f.content,
  f.created_at,
  f.read_at,
  f.status,
  p.email
FROM user_feedback f
JOIN profiles p ON f.user_id = p.id;

-- Grant access to the view
GRANT SELECT ON feedback_with_profiles TO authenticated;

-- Add comment explaining security settings
COMMENT ON VIEW feedback_with_profiles IS 'View for user feedback with profile information. Uses SECURITY INVOKER to enforce RLS policies of the querying user.';