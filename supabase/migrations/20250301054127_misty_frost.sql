-- Fix for users stuck in "waiting for verification" status
-- This migration will mark existing users as confirmed and update the admin_create_user function

-- Update existing users that are waiting for verification
UPDATE auth.users
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  confirmation_token = ''
WHERE email_confirmed_at IS NULL;

-- Create a new version of the admin_create_user function that automatically confirms emails
CREATE OR REPLACE FUNCTION admin_create_user(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_role text DEFAULT 'user'
)
RETURNS json AS $$
DECLARE
  v_user_id uuid;
  v_temp_password text;
  v_result json;
BEGIN
  -- Generate a random temporary password
  v_temp_password := encode(gen_random_bytes(8), 'hex');
  v_user_id := gen_random_uuid();
  
  -- Create the user in auth.users with an explicit ID and confirmed email
  INSERT INTO auth.users (
    id,
    email,
    raw_user_meta_data,
    created_at,
    email_confirmed_at,  -- Set email as confirmed immediately
    confirmation_token   -- Clear confirmation token
  )
  VALUES (
    v_user_id,
    p_email,
    jsonb_build_object(
      'first_name', p_first_name,
      'last_name', p_last_name
    ),
    now(),
    now(),              -- Email confirmed now
    ''                  -- No confirmation token needed
  );
  
  -- Set the password
  UPDATE auth.users
  SET encrypted_password = crypt(v_temp_password, gen_salt('bf'))
  WHERE id = v_user_id;
  
  -- Update the profile (the handle_new_user trigger should have already created the entry)
  UPDATE profiles
  SET 
    first_name = p_first_name,
    last_name = p_last_name,
    role = p_role
  WHERE id = v_user_id;
  
  -- Return the information
  v_result := json_build_object(
    'user_id', v_user_id,
    'email', p_email,
    'temp_password', v_temp_password
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;