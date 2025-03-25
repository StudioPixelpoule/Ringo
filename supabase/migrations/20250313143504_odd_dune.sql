/*
  # Add Materialized Views for Frequently Accessed Data

  1. Changes
    - Create materialized view for conversation statistics
    - Add indexes for efficient querying
    - Add refresh function and trigger
  
  2. Performance
    - Improve query performance for conversation listing
    - Reduce database load for common queries
    - Automatic refresh mechanism
*/

-- Create function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY conversation_stats;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create materialized view for conversation statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS conversation_stats AS
SELECT 
  c.id AS conversation_id,
  c.user_id,
  c.title,
  COUNT(DISTINCT m.id) AS message_count,
  COUNT(DISTINCT cd.id) AS document_count,
  MAX(m.created_at) AS last_message_at,
  MIN(m.created_at) AS first_message_at,
  MAX(cd.created_at) AS last_document_at,
  (
    SELECT COUNT(DISTINCT sender)
    FROM messages m2
    WHERE m2.conversation_id = c.id
  ) AS participant_count,
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = c.user_id
    AND p.role = 'admin'
  ) AS is_admin_conversation
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
LEFT JOIN conversation_documents cd ON cd.conversation_id = c.id
GROUP BY c.id, c.user_id, c.title;

-- Create indexes on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_stats_id 
ON conversation_stats(conversation_id);

CREATE INDEX IF NOT EXISTS idx_conversation_stats_user 
ON conversation_stats(user_id);

CREATE INDEX IF NOT EXISTS idx_conversation_stats_last_message 
ON conversation_stats(last_message_at DESC);

-- Create triggers to refresh materialized view
CREATE TRIGGER refresh_conversation_stats_messages
AFTER INSERT OR UPDATE OR DELETE ON messages
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_materialized_views();

CREATE TRIGGER refresh_conversation_stats_documents
AFTER INSERT OR UPDATE OR DELETE ON conversation_documents
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_materialized_views();

CREATE TRIGGER refresh_conversation_stats_conversations
AFTER INSERT OR UPDATE OR DELETE ON conversations
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_materialized_views();

-- Initial refresh of materialized view
REFRESH MATERIALIZED VIEW CONCURRENTLY conversation_stats;