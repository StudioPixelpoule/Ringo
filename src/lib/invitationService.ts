import { supabase } from './supabase';

export interface UserInvitation {
  id: string;
  email: string;
  role: 'super_admin' | 'admin' | 'user';
  token: string;
  invited_by: string;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
}

export async function createInvitation(email: string, role: UserInvitation['role']): Promise<UserInvitation> {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('Not authenticated');

    // Generate token
    const { data: tokenData, error: tokenError } = await supabase
      .rpc('generate_invitation_token');

    if (tokenError) throw tokenError;
    if (!tokenData) throw new Error('Failed to generate invitation token');

    // Create invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('user_invitations')
      .insert([{
        email: email.toLowerCase(),
        role,
        token: tokenData,
        invited_by: user.id,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      }])
      .select()
      .single();

    if (inviteError) throw inviteError;
    if (!invitation) throw new Error('Failed to create invitation');

    // Send email notification through Supabase's built-in email service
    const redirectUrl = `${window.location.origin}/accept-invitation?token=${tokenData}`;
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase(),
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          invitation_token: tokenData,
          role: role
        },
        shouldCreateUser: false
      }
    });

    if (authError) {
      // If email fails, we should revoke the invitation
      await supabase
        .from('user_invitations')
        .update({ status: 'revoked' })
        .eq('id', invitation.id);
      
      throw authError;
    }

    return invitation;
  } catch (error) {
    console.error('Error creating invitation:', error);
    throw error instanceof Error ? error : new Error('Failed to create invitation');
  }
}

export async function fetchInvitations(): Promise<UserInvitation[]> {
  try {
    const { data, error } = await supabase
      .from('user_invitations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching invitations:', error);
    throw error instanceof Error ? error : new Error('Failed to fetch invitations');
  }
}

export async function revokeInvitation(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_invitations')
      .update({ status: 'revoked' })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error revoking invitation:', error);
    throw error instanceof Error ? error : new Error('Failed to revoke invitation');
  }
}

export async function validateInvitationToken(token: string): Promise<{
  isValid: boolean;
  email: string;
  role: UserInvitation['role'];
}> {
  try {
    const { data, error } = await supabase
      .rpc('validate_invitation_token', { token_to_check: token });

    if (error) throw error;
    if (!data?.length) return { isValid: false, email: '', role: 'user' };
    return data[0];
  } catch (error) {
    console.error('Error validating invitation:', error);
    throw error instanceof Error ? error : new Error('Failed to validate invitation');
  }
}

export async function acceptInvitation(token: string, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .rpc('accept_invitation', { 
        token_to_accept: token,
        user_id: userId
      });

    if (error) throw error;
    return !!data;
  } catch (error) {
    console.error('Error accepting invitation:', error);
    throw error instanceof Error ? error : new Error('Failed to accept invitation');
  }
}