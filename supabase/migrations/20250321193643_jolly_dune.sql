/*
  # Add user deletion function and trigger

  1. Changes
    - Add function to delete all user data
    - Add trigger for user deletion
    - Add cleanup for related data
  
  2. Security
    - Function runs with security definer
    - Only accessible to super admins
    - Maintains referential integrity
*/

-- Create function to delete all user data
CREATE OR REPLACE FUNCTION delete_user_data(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is super admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
    AND status = true
  ) THEN
    RAISE EXCEPTION 'Only super admins can delete users';
  END IF;

  -- Don't allow deleting the last super admin
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id_param
    AND role = 'super_admin'
  ) THEN
    IF (
      SELECT COUNT(*)
      FROM profiles
      WHERE role = 'super_admin'
      AND status = true
    ) <= 1 THEN
      RAISE EXCEPTION 'Cannot delete the last super admin';
    END IF;
  END IF;

  -- Delete user feedback
  DELETE FROM user_feedback
  WHERE user_id = user_id_param;

  -- Delete user conversations and related data
  DELETE FROM conversations
  WHERE user_id = user_id_param;

  -- Delete user sessions
  DELETE FROM active_sessions
  WHERE user_id = user_id_param;

  -- Delete security notifications
  DELETE FROM security_notifications
  WHERE user_id = user_id_param;

  -- Delete user invitations
  DELETE FROM user_invitations
  WHERE invited_by = user_id_param;

  -- Delete user profile
  DELETE FROM profiles
  WHERE id = user_id_param;
END;
$$;