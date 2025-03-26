import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the request body
    const { user_id } = await req.json()

    if (!user_id) {
      throw new Error('user_id is required')
    }

    // Create headers with service role key
    const headers = {
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
      'Content-Type': 'application/json'
    }

    // First check if user exists and get their role
    const profileResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/rest/v1/profiles?id=eq.${user_id}&select=role`,
      { headers }
    )

    if (!profileResponse.ok) {
      throw new Error('Failed to fetch user profile')
    }

    const [profile] = await profileResponse.json()
    if (!profile) {
      throw new Error('User profile not found')
    }

    // Don't allow deleting the last super admin
    if (profile.role === 'super_admin') {
      const countResponse = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/rest/v1/profiles?role=eq.super_admin&status=eq.true&select=id`,
        { headers }
      )

      if (!countResponse.ok) {
        throw new Error('Failed to check super admin count')
      }

      const superAdmins = await countResponse.json()
      if (superAdmins.length <= 1) {
        throw new Error('Cannot delete the last super admin')
      }
    }

    // Delete all user data using RPC function
    const rpcResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/delete_user_data`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_id_param: user_id })
      }
    )

    if (!rpcResponse.ok) {
      throw new Error('Failed to delete user data')
    }

    // Delete the user from auth.users
    const authResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/auth/v1/admin/users/${user_id}`,
      {
        method: 'DELETE',
        headers
      }
    )

    if (!authResponse.ok) {
      throw new Error('Failed to delete user account')
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})