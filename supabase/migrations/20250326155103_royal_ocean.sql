-- Create function to handle user deletion
CREATE OR REPLACE FUNCTION delete_user_data(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_id_param) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Check if user is the last super admin
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

  -- Delete user data from all tables
  DELETE FROM conversation_documents WHERE conversation_id IN (
    SELECT id FROM conversations WHERE user_id = user_id_param
  );
  
  DELETE FROM messages WHERE conversation_id IN (
    SELECT id FROM conversations WHERE user_id = user_id_param
  );
  
  DELETE FROM conversations WHERE user_id = user_id_param;
  DELETE FROM user_feedback WHERE user_id = user_id_param;
  DELETE FROM error_logs WHERE user_id = user_id_param;
  DELETE FROM security_notifications WHERE user_id = user_id_param;
  DELETE FROM active_sessions WHERE user_id = user_id_param;
  DELETE FROM auth_attempts WHERE email = (
    SELECT email FROM profiles WHERE id = user_id_param
  );
  
  -- Delete profile last
  DELETE FROM profiles WHERE id = user_id_param;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_user_data TO authenticated;

-- Add comment
COMMENT ON FUNCTION delete_user_data IS 'Safely deletes all data associated with a user while preserving system integrity.';