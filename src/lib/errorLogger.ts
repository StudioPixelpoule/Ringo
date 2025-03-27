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
}

export async function logError(
  error: Error | string,
  context?: Record<string, any>
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const { error: dbError } = await supabase
      .from('error_logs')
      .insert([{
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        context: {
          ...context,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          url: window.location.href
        },
        user_id: user?.id,
        status: 'new'
      }]);

    if (dbError) {
      console.error('Failed to log error:', dbError);
    }
  } catch (e) {
    console.error('Error logging failed:', e);
  }
}