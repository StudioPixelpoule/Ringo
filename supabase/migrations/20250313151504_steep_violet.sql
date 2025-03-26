/*
  # Fix Materialized View Permissions

  1. Changes
    - Grant permissions on materialized view
    - Add RLS policies for conversations
    - Fix trigger permissions
    - Add owner permissions

  2. Security
    - Maintain data isolation
    - Keep admin access
    - Preserve user permissions
*/

-- Grant permissions on materialized view
GRANT SELECT ON conversation_stats TO authenticated;
GRANT SELECT ON conversation_stats TO anon;

-- Grant permissions on functions
GRANT EXECUTE ON FUNCTION refresh_materialized_views TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_materialized_views TO anon;

-- Drop existing policies
DROP POLICY IF EXISTS "Chaque utilisateur voit uniquement ses propres conversations" ON conversations;
DROP POLICY IF EXISTS "Chaque utilisateur peut insérer ses propres conversations" ON conversations;
DROP POLICY IF EXISTS "Chaque utilisateur peut modifier uniquement ses conversations" ON conversations;
DROP POLICY IF EXISTS "Chaque utilisateur peut supprimer uniquement ses conversations" ON conversations;

-- Create new policies for conversations
CREATE POLICY "Chaque utilisateur voit uniquement ses propres conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND status = true
    )
  );

CREATE POLICY "Chaque utilisateur peut insérer ses propres conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND status = true
    )
  );

CREATE POLICY "Chaque utilisateur peut modifier uniquement ses conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND status = true
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND status = true
    )
  );

CREATE POLICY "Chaque utilisateur peut supprimer uniquement ses conversations"
  ON conversations FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND status = true
    )
  );

-- Add admin policies
CREATE POLICY "Les admins peuvent tout faire"
  ON conversations FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

-- Refresh materialized view
REFRESH MATERIALIZED VIEW CONCURRENTLY conversation_stats;

-- Add simple indexes without subqueries
CREATE INDEX IF NOT EXISTS idx_conversations_user_check 
ON conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_conversations_admin_check 
ON conversations(id, user_id);

-- Grant ownership of materialized view to postgres
ALTER MATERIALIZED VIEW conversation_stats OWNER TO postgres;