/*
  # Drop Help Requests System

  1. Changes
    - Drop help_requests table
    - Drop help_requests_with_users view
    - Remove related RLS policies
  
  2. Security
    - Maintain existing security model
    - Clean up properly to avoid orphaned policies
*/

-- Drop view first (depends on the table)
DROP VIEW IF EXISTS help_requests_with_users;

-- Drop RLS policies
DROP POLICY IF EXISTS "Users can create help requests" ON help_requests;
DROP POLICY IF EXISTS "Users can view own help requests" ON help_requests;
DROP POLICY IF EXISTS "Admins can manage all help requests" ON help_requests;

-- Drop trigger
DROP TRIGGER IF EXISTS update_help_requests_updated_at ON help_requests;

-- Drop table
DROP TABLE IF EXISTS help_requests;