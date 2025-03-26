/*
  # Fix Function Security Settings

  1. Changes
    - Add SECURITY DEFINER to all functions
    - Set search_path explicitly
    - Fix function permissions
  
  2. Security
    - Prevent search_path injection
    - Maintain proper access control
    - Keep function isolation
*/

-- Update refresh_materialized_views function
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY conversation_stats;
  RETURN NULL;
END;
$$;

-- Update materialized view permissions
REVOKE ALL ON conversation_stats FROM anon;
REVOKE ALL ON conversation_stats FROM public;
GRANT SELECT ON conversation_stats TO authenticated;

-- Add comment explaining security settings
COMMENT ON MATERIALIZED VIEW conversation_stats IS 'Conversation statistics with built-in security context. Only shows conversations for active users.';

-- Refresh materialized view with new security settings
REFRESH MATERIALIZED VIEW CONCURRENTLY conversation_stats;