-- Update Edge Function configuration
UPDATE edge_function_configs
SET 
  version = '1.2.1',
  verify_jwt = true,
  import_map = jsonb_build_object(
    'imports', jsonb_build_object(
      '@supabase/supabase-js', 'https://esm.sh/@supabase/supabase-js@2.39.7',
      'openai', 'npm:openai@4.28.0'
    )
  )
WHERE function_name IN ('process-chat', 'process-chat-stream');

-- Add comment
COMMENT ON TABLE edge_function_configs IS 'Stores configuration for Edge Functions with proper CORS and security settings';