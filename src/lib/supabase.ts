import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: window.localStorage,
    storageKey: 'sb-auth-token'
  },
  global: {
    headers: {
      'x-application-name': 'ringo'
    }
  }
});

// Initialize auth state
supabase.auth.getSession().catch(console.error);

// Set up auth state change listener
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
    // Clear any cached data
    localStorage.clear();
    // Redirect to login
    window.location.href = '/login';
  } else if (event === 'TOKEN_REFRESHED') {
    console.log('Session token refreshed');
  }
});

// Add session refresh on focus
let refreshTimeout: NodeJS.Timeout;
window.addEventListener('focus', () => {
  clearTimeout(refreshTimeout);
  refreshTimeout = setTimeout(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!session) {
          // No valid session, redirect to login
          window.location.href = '/login';
        }
      })
      .catch((error) => {
        console.error('Session refresh error:', error);
        if (error?.message?.includes('refresh_token_not_found') || 
            error?.message?.includes('JWT expired') || 
            error?.message?.includes('Invalid Refresh Token')) {
          localStorage.clear();
          window.location.href = '/login';
        }
      });
  }, 1000);
});

// Add unhandled rejection listener for auth errors
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.name === 'AuthApiError' || 
      event.reason?.message?.includes('JWT expired') ||
      event.reason?.message?.includes('Invalid JWT')) {
    console.error('Auth API Error:', event.reason);
    localStorage.clear();
    window.location.href = '/login';
  }
});

// Helper function to check if user is authenticated
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  } catch (error) {
    console.error('Auth check error:', error);
    return false;
  }
};

// Helper function to get current user role with retries
export const getUserRole = async (): Promise<string | null> => {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second

  const retryFetch = async (attempt: number = 1): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('No authenticated user found');
        window.location.href = '/login';
        return null;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST301' || error.code === '401') {
          console.warn('Authentication error:', error);
          window.location.href = '/login';
          return null;
        }
        throw error;
      }

      if (!data) {
        console.warn('No profile found for user');
        return null;
      }

      if (!data.status) {
        console.warn('User profile is inactive');
        await supabase.auth.signOut();
        return null;
      }

      return data.role;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);

      if (attempt < maxRetries && error instanceof TypeError && error.message === 'Failed to fetch') {
        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.warn(`Network error occurred. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return retryFetch(attempt + 1);
      }

      if (error instanceof Error && (
        error.message.includes('JWT expired') ||
        error.message.includes('Invalid JWT') ||
        error.message.includes('Invalid Refresh Token')
      )) {
        console.error('Authentication error:', error);
        window.location.href = '/login';
        return null;
      }

      throw error;
    }
  };

  try {
    return await retryFetch();
  } catch (error) {
    console.error('All retries failed:', error);
    return null;
  }
};

// Helper function to check if user has admin privileges
export const isAdmin = async (): Promise<boolean> => {
  const role = await getUserRole();
  return role === 'admin' || role === 'super_admin';
};

// Helper function to check if user is super admin
export const isSuperAdmin = async (): Promise<boolean> => {
  const role = await getUserRole();
  return role === 'super_admin';
};