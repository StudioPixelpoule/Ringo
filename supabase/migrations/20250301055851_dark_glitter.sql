-- Disable email confirmation requirement for new users
-- This will make new users active immediately without email verification

-- Function to disable email confirmation for new users
CREATE OR REPLACE FUNCTION admin_create_user_without_confirmation(
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
  
  -- Create the user in auth.users with an explicit ID
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

-- Replace the old function with the new one
DROP FUNCTION IF EXISTS admin_create_user(text, text, text, text);

-- Rename the new function to the original name
ALTER FUNCTION admin_create_user_without_confirmation(text, text, text, text) 
RENAME TO admin_create_user;

-- Update existing users that are waiting for verification
-- Note: We can't update confirmed_at directly as it's a generated column
UPDATE auth.users
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  confirmation_token = ''
WHERE email_confirmed_at IS NULL;