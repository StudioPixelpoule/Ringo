import { createClient } from '@supabase/supabase-js';
import { createLogger } from './logger';

// Logger pour ce module
const logger = createLogger('Supabase');

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Network check utility
const checkNetworkConnection = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'apikey': supabaseAnonKey
      }
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.warn('Network connectivity check failed:', error);
    return false;
  }
};

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

// Helper function to handle auth errors
async function handleAuthError(error: any) {
  if (error?.message?.includes('Failed to fetch')) {
    const isConnected = await checkNetworkConnection();
    if (!isConnected) {
      logger.error('Network connectivity issue detected');
      // You could dispatch an event or update UI state here to show network error
      return;
    }
  }

  if (error?.message?.includes('refresh_token_not_found') || 
      error?.message?.includes('JWT expired') || 
      error?.message?.includes('Invalid JWT') ||
      error?.message?.includes('Invalid Refresh Token') ||
      error?.message?.includes('Invalid API key')) {
    logger.info('Authentication error detected, clearing storage and redirecting to login');
    // Clear all local storage to remove any invalid tokens
    localStorage.clear();
    sessionStorage.clear();
    
    // Only redirect if we're not already on the login page
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }
}

// Initialize auth state with retry mechanism
const initializeAuthState = async (retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data;
    } catch (error) {
      logger.error(`Auth initialization attempt ${i + 1} failed:`, error);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      } else {
        handleAuthError(error);
      }
    }
  }
};

initializeAuthState().catch(error => logger.error("Error:", error));

// Set up auth state change listener
supabase.auth.onAuthStateChange((event, session) => {
  logger.info('Auth state change event:', event);
  
  if (event === 'SIGNED_OUT') {
    // Clear any cached data and redirect to login
    localStorage.clear();
    sessionStorage.clear();
    // Redirect to login
    window.location.href = '/login';
  } else if (event === 'TOKEN_REFRESHED') {
    logger.info('Session token refreshed');
  }
});

// Add session refresh on focus with debounce and retry mechanism
let refreshTimeout: NodeJS.Timeout;
let lastRefreshTime = 0;
const REFRESH_COOLDOWN = 5000; // 5 seconds cooldown between refreshes
const MAX_RETRIES = 3;

const refreshSessionWithRetry = async () => {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const isConnected = await checkNetworkConnection();
      if (!isConnected) {
        console.warn('Network unavailable, retrying...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        handleAuthError(new Error('No valid session'));
      }
      lastRefreshTime = Date.now();
      return;
    } catch (error) {
      logger.error(`Session refresh attempt ${i + 1} failed:`, error);
      if (i < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      } else {
        handleAuthError(error);
      }
    }
  }
};

window.addEventListener('focus', () => {
  const now = Date.now();
  if (now - lastRefreshTime < REFRESH_COOLDOWN) {
    return; // Skip if within cooldown period
  }
  
  clearTimeout(refreshTimeout);
  refreshTimeout = setTimeout(refreshSessionWithRetry, 1000);
});

// Add unhandled rejection listener for auth errors
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.name === 'AuthApiError' || 
      event.reason?.message?.includes('JWT expired') ||
      event.reason?.message?.includes('Invalid JWT')) {
    logger.error('Auth API Error:', event.reason);
    handleAuthError(event.reason);
  }
});

// Helper function to check if user is authenticated
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  } catch (error) {
    logger.error('Auth check error:', error);
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
      const isConnected = await checkNetworkConnection();
      if (!isConnected) {
        console.warn('Network unavailable, retrying...');
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(retryBackoff, attempt - 1)));
          return retryFetch(attempt + 1);
        }
        throw new Error('Network unavailable');
      }

      logger.info(`getUserRole attempt ${attempt}...`);
      
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

      logger.info('User role retrieved:', profile.role);
      return profile.role;
    } catch (error) {
      logger.error(`Attempt ${attempt} failed:`, error);

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
        error.message.includes('Invalid API key')
      )) {
        logger.error('Authentication error:', error);
        handleAuthError(error);
        return null;
      }

      throw error;
    }
  };

  try {
    return await retryFetch();
  } catch (error) {
    logger.error('All retries failed:', error);
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

// Helper function to send password reset email
export const sendPasswordResetEmail = async (email: string): Promise<boolean> => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    
    if (error) throw error;
    return true;
  } catch (error) {
    logger.error('Error sending password reset email:', error);
    throw error;
  }
};