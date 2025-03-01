-- Fix the admin_create_user function to properly handle user creation
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
  -- Générer un mot de passe temporaire aléatoire
  v_temp_password := encode(gen_random_bytes(8), 'hex');
  v_user_id := gen_random_uuid();
  
  -- Créer l'utilisateur dans auth.users avec un ID explicite
  INSERT INTO auth.users (
    id,
    email,
    raw_user_meta_data,
    created_at
  )
  VALUES (
    v_user_id,
    p_email,
    jsonb_build_object(
      'first_name', p_first_name,
      'last_name', p_last_name
    ),
    now()
  );
  
  -- Définir le mot de passe
  UPDATE auth.users
  SET encrypted_password = crypt(v_temp_password, gen_salt('bf'))
  WHERE id = v_user_id;
  
  -- Mettre à jour le profil (le trigger handle_new_user devrait déjà avoir créé l'entrée)
  UPDATE profiles
  SET 
    first_name = p_first_name,
    last_name = p_last_name,
    role = p_role
  WHERE id = v_user_id;
  
  -- Retourner les informations
  v_result := json_build_object(
    'user_id', v_user_id,
    'email', p_email,
    'temp_password', v_temp_password
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if an email is already in use
CREATE OR REPLACE FUNCTION check_email_exists(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE email = p_email
  );
$$;

-- Grant usage permissions
GRANT EXECUTE ON FUNCTION check_email_exists(text) TO authenticated;
GRANT EXECUTE ON FUNCTION check_email_exists(text) TO service_role;