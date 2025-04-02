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
supabase.auth.getSession().catch(error => {
  console.error('Error getting initial session:', error);
  handleAuthError(error);
});

// Set up auth state change listener
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state change event:', event);
  
  if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
    // Clear any cached data and redirect to login
    localStorage.clear();
    // Redirect to login
    window.location.href = '/login';
  } else if (event === 'TOKEN_REFRESHED') {
    console.log('Session token refreshed');
  }
});

// Helper function to handle auth errors
function handleAuthError(error: any) {
  if (error?.message?.includes('refresh_token_not_found') || 
      error?.message?.includes('JWT expired') || 
      error?.message?.includes('Invalid JWT') ||
      error?.message?.includes('Invalid Refresh Token')) {
    console.log('Authentication error detected, clearing storage and redirecting to login');
    // Clear all local storage to remove any invalid tokens
    localStorage.clear();
    
    // Only redirect if we're not already on the login page
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }
}

// Add session refresh on focus with debounce
let refreshTimeout: NodeJS.Timeout;
let lastRefreshTime = 0;
const REFRESH_COOLDOWN = 5000; // 5 seconds cooldown between refreshes

window.addEventListener('focus', () => {
  const now = Date.now();
  if (now - lastRefreshTime < REFRESH_COOLDOWN) {
    return; // Skip if within cooldown period
  }
  
  clearTimeout(refreshTimeout);
  refreshTimeout = setTimeout(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!session) {
          // No valid session, redirect to login
          handleAuthError(new Error('No valid session'));
        }
        lastRefreshTime = Date.now();
      })
      .catch((error) => {
        console.error('Session refresh error:', error);
        handleAuthError(error);
      });
  }, 1000);
});

// Add unhandled rejection listener for auth errors
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.name === 'AuthApiError' || 
      event.reason?.message?.includes('JWT expired') ||
      event.reason?.message?.includes('Invalid JWT') ||
      event.reason?.message?.includes('Invalid Refresh Token')) {
    console.error('Auth API Error:', event.reason);
    handleAuthError(event.reason);
  }
});

// Helper function to check if user is authenticated
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  } catch (error) {
    console.error('Auth check error:', error);
    handleAuthError(error);
    return false;
  }
};

// Helper function to get current user role with retries
export const getUserRole = async (): Promise<string | null> => {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second
  const retryBackoff = 1.5; // Exponential backoff multiplier

  const retryFetch = async (attempt: number = 1): Promise<string | null> => {
    try {
      console.log(`getUserRole attempt ${attempt}...`);
      
      // Check and refresh session if needed
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        handleAuthError(sessionError);
        throw sessionError;
      }
      if (!session) {
        console.warn('No session found, redirecting to login');
        window.location.href = '/login';
        return null;
      }

      // Get user profile with role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        if (profileError.code === 'PGRST301' || profileError.code === '401') {
          console.warn('Authentication error:', profileError);
          handleAuthError(profileError);
          return null;
        }
        throw profileError;
      }

      if (!profile) {
        console.warn('No profile found for user');
        return null;
      }

      if (!profile.status) {
        console.warn('User profile is inactive');
        await supabase.auth.signOut();
        return null;
      }

      console.log('User role retrieved:', profile.role);
      return profile.role;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(retryBackoff, attempt - 1);
        console.warn(`Network error occurred. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return retryFetch(attempt + 1);
      }

      if (error instanceof Error && (
        error.message.includes('JWT expired') ||
        error.message.includes('Invalid JWT') ||
        error.message.includes('Invalid Refresh Token') ||
        error.message.includes('refresh_token_not_found')
      )) {
        console.error('Authentication error:', error);
        handleAuthError(error);
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