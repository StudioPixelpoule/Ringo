/*
  # Fix Remaining Security Issues

  1. Changes
    - Fix materialized view permissions
    - Add proper RLS policies
    - Remove anon access
    - Add security settings
  
  2. Security
    - Restrict materialized view access
    - Improve auth security
    - Add proper user isolation
*/

-- Revoke public and anon access from materialized view
REVOKE ALL ON conversation_stats FROM anon;
REVOKE ALL ON conversation_stats FROM public;

-- Grant specific access to authenticated users
GRANT SELECT ON conversation_stats TO authenticated;

-- Create RLS policy for materialized view access
CREATE POLICY "Users can only view their own conversation stats"
  ON conversation_stats
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND status = true
    )
  );

-- Update auth settings
ALTER SYSTEM SET auth.otp_expiry_seconds = 3600; -- Set to 1 hour
ALTER SYSTEM SET auth.enable_leaked_password_protection = true;

-- Add comment explaining security settings
COMMENT ON MATERIALIZED VIEW conversation_stats IS 'Conversation statistics with row-level security. Only accessible to authenticated users for their own conversations or admins.';

-- Refresh materialized view with new security settings
REFRESH MATERIALIZED VIEW CONCURRENTLY conversation_stats;