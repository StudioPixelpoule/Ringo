import { supabase } from './supabase';

export interface ErrorLog {
  id: string;
  error: string;
  stack?: string;
  context?: Record<string, any>;
  user_id?: string;
  created_at: string;
  status: 'new' | 'investigating' | 'resolved';
  resolution?: string;
  archived?: boolean;
}

export async function logError(
  error: Error | string,
  context?: Record<string, any>
) {
  try {
    // First check if user is super admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // Only log errors if user is super admin
    if (profile?.role === 'super_admin') {
      const { error: dbError } = await supabase
        .from('error_logs')
        .insert([{
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
          context: context || {},
          user_id: user.id,
          status: 'new'
        }]);

      if (dbError) {
        console.error('Failed to log error:', dbError);
      }
    }
  } catch (e) {
    console.error('Error logging failed:', e);
  }
}