import { supabase } from './supabase';
import { handleError } from './errorHandler';
import { AuthErrorType } from './errorTypes';
import { supabaseWithRetry } from './supabaseWithRetry';

// Auth storage keys
const AUTH_STORAGE_KEYS = {
  AUTH_TOKEN: 'sb-auth-token',
  USER_ROLE: 'userRole',
  USER_PREFERENCES: 'userPreferences',
  LAST_ACTIVE: 'lastActive'
} as const;

// Auth state
let authInitialized = false;
let authCheckPromise: Promise<boolean> | null = null;
let authTimeout: NodeJS.Timeout | null = null;

/**
 * Clear auth state selectively
 */
export function clearAuthState() {
  console.debug('🧹 Cleaning auth state...');
  
  // Clear only auth-related items
  Object.values(AUTH_STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });

  // Reset state
  authInitialized = false;
  authCheckPromise = null;
  
  if (authTimeout) {
    clearTimeout(authTimeout);
    authTimeout = null;
  }

  console.debug('✅ Auth state cleaned');
}

/**
 * Check auth state with retries
 */
async function checkAuthState(retryCount = 0): Promise<boolean> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  try {
    console.debug(`🔍 Checking auth state (attempt ${retryCount + 1}/${MAX_RETRIES + 1})...`);

    // Use retry-enabled client for session check
    const { data: { session }, error: sessionError } = await supabaseWithRetry.auth.getSession();
    
    if (sessionError) {
      throw sessionError;
    }

    if (!session) {
      console.debug('⚠️ No session found');
      return false;
    }

    // Use retry-enabled client for profile check
    const { data: profile, error: profileError } = await supabaseWithRetry
      .from('profiles')
      .select('status, role')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      throw profileError;
    }

    if (!profile?.status) {
      console.debug('❌ Profile inactive');
      return false;
    }

    // Update role and last active
    localStorage.setItem(AUTH_STORAGE_KEYS.USER_ROLE, profile.role);
    localStorage.setItem(AUTH_STORAGE_KEYS.LAST_ACTIVE, new Date().toISOString());

    console.debug('✅ Auth state valid:', { role: profile.role });
    return true;
  } catch (error) {
    // Log error with retry context
    await handleError(error, {
      component: 'authManager',
      action: 'checkAuthState',
      attempt: retryCount + 1,
      maxRetries: MAX_RETRIES,
      networkStatus: {
        online: navigator.onLine,
        connectionType: ('connection' in navigator) 
          ? (navigator as any).connection?.effectiveType 
          : 'unknown'
      }
    });

    // Retry on network errors with exponential backoff
    if (retryCount < MAX_RETRIES && 
        (error.message?.includes('network') || !navigator.onLine)) {
      const delay = RETRY_DELAY * Math.pow(2, retryCount);
      console.debug(`🔄 Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return checkAuthState(retryCount + 1);
    }

    return false;
  }
}

/**
 * Initialize auth state with timeout and retries
 */
export async function initializeAuthState(): Promise<void> {
  if (authInitialized) {
    console.debug('✅ Auth already initialized');
    return;
  }

  // If a check is already in progress, wait for it
  if (authCheckPromise) {
    console.debug('🔄 Auth check in progress, waiting...');
    const isValid = await authCheckPromise;
    if (!isValid) {
      throw new Error('Auth check failed');
    }
    return;
  }

  console.debug('🔐 Initializing auth state...');

  try {
    // Set timeout for initialization
    const timeoutPromise = new Promise<never>((_, reject) => {
      authTimeout = setTimeout(() => {
        reject(new Error('Auth initialization timeout'));
      }, 15000); // Increased timeout to 15 seconds
    });

    // Create new check promise with retries
    authCheckPromise = checkAuthState();

    // Race between auth check and timeout
    const isValid = await Promise.race([
      authCheckPromise,
      timeoutPromise
    ]);
    
    if (!isValid) {
      throw new Error('Invalid auth state');
    }

    authInitialized = true;
    console.debug('✅ Auth state initialized');
  } catch (error) {
    // Handle error with proper context
    await handleError(error, {
      component: 'authManager',
      action: 'initializeAuthState',
      type: AuthErrorType.SESSION_EXPIRED,
      networkStatus: {
        online: navigator.onLine,
        connectionType: ('connection' in navigator) 
          ? (navigator as any).connection?.effectiveType 
          : 'unknown'
      }
    });

    // Clear auth state and rethrow
    clearAuthState();
    throw error;
  } finally {
    // Clean up
    if (authTimeout) {
      clearTimeout(authTimeout);
      authTimeout = null;
    }
    authCheckPromise = null;
  }
}

// Handle auth state changes
supabase.auth.onAuthStateChange(async (event, session) => {
  console.debug('🔄 Auth state change:', event);

  try {
    switch (event) {
      case 'SIGNED_IN':
        console.debug('🎉 User signed in');
        await initializeAuthState();
        break;

      case 'SIGNED_OUT':
      case 'USER_DELETED':
        console.debug('👋 User signed out or deleted');
        clearAuthState();
        window.location.href = '/login';
        break;

      case 'TOKEN_REFRESHED':
        console.debug('🔄 Token refreshed');
        await checkAuthState();
        break;

      default:
        console.debug('ℹ️ Unhandled auth event:', event);
        break;
    }
  } catch (error) {
    await handleError(error, {
      component: 'authManager',
      action: 'handleAuthStateChange',
      event
    });
    clearAuthState();
    window.location.href = '/login';
  }
});

// Check auth state on focus with debounce and network check
let refreshTimeout: NodeJS.Timeout;
window.addEventListener('focus', () => {
  clearTimeout(refreshTimeout);
  refreshTimeout = setTimeout(async () => {
    try {
      // Skip check if offline
      if (!navigator.onLine) {
        console.debug('🌐 Device offline, skipping auth check');
        return;
      }

      // Check connection quality
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        if (connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') {
          console.debug('🌐 Poor network connection, delaying auth check');
          return;
        }
      }

      console.debug('🔍 Checking auth state on focus...');
      await checkAuthState();
    } catch (error) {
      await handleError(error, {
        component: 'authManager',
        action: 'focusAuthCheck',
        isOnline: navigator.onLine,
        connectionType: ('connection' in navigator) 
          ? (navigator as any).connection?.effectiveType 
          : 'unknown'
      });
      clearAuthState();
      window.location.href = '/login';
    }
  }, 1000);
});