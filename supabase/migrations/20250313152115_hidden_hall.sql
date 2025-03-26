/*
  # Fix Conversation Permissions and Materialized View

  1. Changes
    - Drop existing materialized view
    - Recreate with proper ownership and permissions
    - Simplify RLS policies
    - Fix function permissions
  
  2. Security
    - Maintain data isolation
    - Keep admin access
    - Preserve user permissions
*/

-- Drop existing materialized view and related objects
DROP MATERIALIZED VIEW IF EXISTS conversation_stats;
DROP TRIGGER IF EXISTS refresh_conversation_stats_messages ON messages;
DROP TRIGGER IF EXISTS refresh_conversation_stats_documents ON conversation_documents;
DROP TRIGGER IF EXISTS refresh_conversation_stats_conversations ON conversations;
DROP FUNCTION IF EXISTS refresh_materialized_views();

-- Create function to refresh materialized views with proper ownership
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

ALTER FUNCTION refresh_materialized_views() OWNER TO postgres;

-- Create materialized view with proper ownership
CREATE MATERIALIZED VIEW conversation_stats AS
SELECT 
  c.id AS conversation_id,
  c.user_id,
  c.title,
  COUNT(DISTINCT m.id) AS message_count,
  COUNT(DISTINCT cd.id) AS document_count,
  MAX(m.created_at) AS last_message_at,
  MIN(m.created_at) AS first_message_at,
  MAX(cd.created_at) AS last_document_at,
  COUNT(DISTINCT m.sender) AS participant_count,
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = c.user_id
    AND p.role = 'admin'
    AND p.status = true
  ) AS is_admin_conversation
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
LEFT JOIN conversation_documents cd ON cd.conversation_id = c.id
GROUP BY c.id, c.user_id, c.title;

ALTER MATERIALIZED VIEW conversation_stats OWNER TO postgres;

-- Create indexes on materialized view
CREATE UNIQUE INDEX ON conversation_stats(conversation_id);
CREATE INDEX ON conversation_stats(user_id);
CREATE INDEX ON conversation_stats(last_message_at DESC);

-- Create triggers to refresh materialized view
CREATE TRIGGER refresh_conversation_stats_messages
  AFTER INSERT OR DELETE OR UPDATE ON messages
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_materialized_views();

CREATE TRIGGER refresh_conversation_stats_documents
  AFTER INSERT OR DELETE OR UPDATE ON conversation_documents
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_materialized_views();

CREATE TRIGGER refresh_conversation_stats_conversations
  AFTER INSERT OR DELETE OR UPDATE ON conversations
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_materialized_views();

-- Grant permissions
GRANT SELECT ON conversation_stats TO authenticated;
GRANT SELECT ON conversation_stats TO anon;
GRANT EXECUTE ON FUNCTION refresh_materialized_views() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_materialized_views() TO anon;

-- Drop existing conversation policies
DROP POLICY IF EXISTS "Users can read own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can insert own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON conversations;
DROP POLICY IF EXISTS "Admins can do anything" ON conversations;

-- Create simplified policies
CREATE POLICY "Users can manage own conversations"
  ON conversations
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all conversations"
  ON conversations
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

-- Refresh materialized view
REFRESH MATERIALIZED VIEW conversation_stats;