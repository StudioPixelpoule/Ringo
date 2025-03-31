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

    const { user_id } = body;

    if (!user_id) {
      throw new Error('user_id is required');
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

    // First check if user exists and get their role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, email')
      .eq('id', user_id)
      .single();

    if (profileError) {
      console.error("Profile error:", profileError);
      throw new Error('Failed to fetch user profile');
    }

    if (!profile) {
      throw new Error('User not found');
    }

    // Don't allow deleting the last super admin
    if (profile.role === 'super_admin') {
      const { count, error: countError } = await supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'super_admin')
        .eq('status', true);

      if (countError) {
        console.error("Count error:", countError);
        throw new Error('Failed to check super admin count');
      }

      if (count === 1) {
        throw new Error('Cannot delete the last super admin');
      }
    }

    // Delete user data using RPC function with retries
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { error: deleteDataError } = await supabaseAdmin
          .rpc('delete_user_data_v2', { user_id_param: user_id });

        if (!deleteDataError) {
          // If successful, delete the user from auth.users
          const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(
            user_id
          );

          if (deleteUserError) {
            console.error("Delete user error:", deleteUserError);
            throw new Error('Failed to delete user account');
          }

          console.log("User successfully deleted:", user_id);

          return new Response(
            JSON.stringify({ success: true }),
            {
              headers: corsHeaders,
              status: 200,
            }
          );
        }

        lastError = deleteDataError;
        console.error(`Attempt ${attempt} failed:`, deleteDataError);

        // Wait before retrying
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempt} failed:`, error);

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
    }

    // If we get here, all retries failed
    throw lastError || new Error('Failed to delete user data after multiple attempts');
  } catch (error) {
    console.error('Error in delete-user function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An error occurred while deleting the user'
      }),
      {
        headers: corsHeaders,
        status: 400
      }
    );
  }
});