/*
  # Conversation Statistics Security Update
  
  1. Security Changes
    - Create secure access function for conversation stats
    - Update materialized view comment
    - Configure auth settings
  
  2. Access Control
    - Restrict direct access to materialized view
    - Provide controlled access through security definer function
    - Allow users to view only their own stats
    - Allow admins to view all stats
*/

-- Revoke public and anon access
REVOKE ALL ON conversation_stats FROM anon;
REVOKE ALL ON conversation_stats FROM public;

-- Create secure access function
CREATE OR REPLACE FUNCTION get_conversation_stats(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS SETOF conversation_stats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user is active
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND status = true
  ) THEN
    RAISE EXCEPTION 'User account is not active';
  END IF;

  -- Return stats based on user role
  RETURN QUERY
  SELECT *
  FROM conversation_stats
  WHERE
    -- User can see their own stats
    user_id = COALESCE(
      -- If user is admin/super_admin, they can override user_id parameter
      CASE WHEN (
        SELECT role IN ('admin', 'super_admin')
        FROM profiles
        WHERE id = auth.uid()
      )
      THEN p_user_id
      -- Otherwise, user can only see their own stats
      ELSE auth.uid()
      END,
      -- If no user_id provided, use authenticated user's id
      auth.uid()
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_conversation_stats TO authenticated;

-- Update auth settings
ALTER SYSTEM SET auth.otp_expiry_seconds = 3600; -- Set to 1 hour
ALTER SYSTEM SET auth.enable_leaked_password_protection = true;

-- Add comment explaining security model
COMMENT ON MATERIALIZED VIEW conversation_stats IS 'Conversation statistics with built-in security context. Only shows conversations for active users.';

-- Refresh materialized view
REFRESH MATERIALIZED VIEW conversation_stats;