import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify request method
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    const body = await req.json();
    console.log("Request body:", body);

    const { email } = body;

    if (!email) {
      throw new Error('Email is required');
    }

    // Create authenticated Supabase client using the service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Check if user exists and is active
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('status')
      .eq('email', email.toLowerCase())
      .single();

    if (profileError) {
      throw new Error('Failed to check user status');
    }

    if (!profile) {
      throw new Error('User not found');
    }

    if (!profile.status) {
      throw new Error('User account is inactive');
    }

    // Send password reset email
    const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email.toLowerCase(),
      options: {
        redirectTo: `${Deno.env.get('SITE_URL')}/reset-password`
      }
    });

    if (resetError) {
      throw resetError;
    }

    // Log successful password reset request
    await supabaseAdmin
      .from('error_logs')
      .insert([{
        error: 'Password reset requested',
        context: {
          email: email.toLowerCase(),
          requested_at: new Date().toISOString()
        },
        status: 'resolved'
      }]);

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: corsHeaders,
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in send-password-reset function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An error occurred while sending password reset'
      }),
      {
        headers: corsHeaders,
        status: 400
      }
    );
  }
});