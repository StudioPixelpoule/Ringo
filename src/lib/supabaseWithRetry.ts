import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './config';
import { withRetry } from './retryUtils';

// Create client with retry wrapper
function createRetryClient(): SupabaseClient {
  const client = createClient(config.supabase.url, config.supabase.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: localStorage,
      storageKey: 'sb-auth-token',
      flowType: 'pkce'
    },
    global: {
      headers: {
        'x-application-name': 'ringo',
        'x-client-info': `ringo/${config.app.version}`
      }
    }
  });

  // Wrap auth methods with retry
  const auth = {
    ...client.auth,
    signInWithPassword: async (credentials: { email: string; password: string }) => {
      return withRetry(
        () => client.auth.signInWithPassword(credentials),
        { component: 'supabaseWithRetry', action: 'signInWithPassword' }
      );
    },
    getSession: async () => {
      return withRetry(
        () => client.auth.getSession(),
        { component: 'supabaseWithRetry', action: 'getSession' }
      );
    }
  };

  // Wrap database methods with retry
  const from = (table: string) => {
    const builder = client.from(table);
    
    return {
      ...builder,
      select: (...args: Parameters<typeof builder.select>) => {
        return withRetry(
          () => builder.select(...args),
          { component: 'supabaseWithRetry', action: 'select', table }
        );
      },
      insert: (...args: Parameters<typeof builder.insert>) => {
        return withRetry(
          () => builder.insert(...args),
          { component: 'supabaseWithRetry', action: 'insert', table }
        );
      },
      update: (...args: Parameters<typeof builder.update>) => {
        return withRetry(
          () => builder.update(...args),
          { component: 'supabaseWithRetry', action: 'update', table }
        );
      },
      delete: () => {
        return withRetry(
          () => builder.delete(),
          { component: 'supabaseWithRetry', action: 'delete', table }
        );
      }
    };
  };

  return {
    ...client,
    auth,
    from
  };
}

export const supabaseWithRetry = createRetryClient();