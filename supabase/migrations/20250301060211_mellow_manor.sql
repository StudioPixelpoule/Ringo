-- Create a function to check if a user exists
CREATE OR REPLACE FUNCTION user_exists(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id
  );
$$;

-- Grant usage permissions
GRANT EXECUTE ON FUNCTION user_exists(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION user_exists(uuid) TO service_role;

-- Update the admin_create_user function to properly handle user creation and confirmation
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
  
  -- Create the user in auth.users with an explicit ID
  INSERT INTO auth.users (
    id,
    email,
    raw_user_meta_data,
    created_at,
    email_confirmed_at,  -- Set email as confirmed immediately
    confirmation_token,  -- Clear confirmation token
    is_sso_user,        -- Not an SSO user
    encrypted_password  -- Set password directly
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
    '',                 -- No confirmation token needed
    false,             -- Not an SSO user
    crypt(v_temp_password, gen_salt('bf'))  -- Set password directly
  );
  
  -- Update the profile (the handle_new_user trigger should have already created the entry)
  UPDATE profiles
  SET 
    first_name = p_first_name,
    last_name = p_last_name,
    role = p_role,
    status = 'active'
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

-- Update existing users to ensure they are properly confirmed and active
UPDATE auth.users
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  confirmation_token = '',
  is_sso_user = false,
  raw_app_meta_data = raw_app_meta_data - 'disabled'
WHERE email_confirmed_at IS NULL 
   OR confirmation_token IS NOT NULL 
   OR is_sso_user = true;

-- Update profiles to ensure all users are active
UPDATE profiles
SET status = 'active'
WHERE status IS NULL OR status != 'active';