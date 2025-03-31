-- Update Edge Function configuration
UPDATE edge_function_configs
SET 
  version = '1.2.0',
  verify_jwt = true,
  import_map = jsonb_build_object(
    'imports', jsonb_build_object(
      '@supabase/supabase-js', 'https://esm.sh/@supabase/supabase-js@2.39.7'
    )
  )
WHERE function_name = 'process-audio';

-- Add process-audio function config if not exists
INSERT INTO edge_function_configs (
  function_name,
  version,
  verify_jwt,
  import_map
) VALUES (
  'process-audio',
  '1.2.0',
  true,
  jsonb_build_object(
    'imports', jsonb_build_object(
      '@supabase/supabase-js', 'https://esm.sh/@supabase/supabase-js@2.39.7'
    )
  )
) ON CONFLICT (function_name) DO NOTHING;

-- Ensure proper permissions
DO $$ 
BEGIN
  GRANT EXECUTE ON FUNCTION is_super_admin TO authenticated;
  GRANT EXECUTE ON FUNCTION is_admin TO authenticated;
  GRANT SELECT ON edge_function_configs TO authenticated;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Add comment
COMMENT ON TABLE edge_function_configs IS 'Stores configuration for Edge Functions with proper CORS and security settings';