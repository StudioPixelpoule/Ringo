import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { handleError } from './errorHandler';
import { AuthErrorType } from './errorTypes';

interface SessionState {
  session: Session | null;
  loading: boolean;
  error: Error | null;
}

class SessionManager {
  private static instance: SessionManager;
  private state: SessionState = {
    session: null,
    loading: true,
    error: null
  };
  private listeners: Set<(state: SessionState) => void> = new Set();
  private refreshTimeout: NodeJS.Timeout | null = null;
  private retryCount = 0;
  private maxRetries = 3;
  private retryDelay = 2000;
  private networkQuality: string = 'unknown';

  private constructor() {
    this.initialize();
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  private async initialize() {
    try {
      console.debug('🔐 Initializing session manager...');

      // Setup network quality monitoring
      if ('connection' in navigator) {
        (navigator as any).connection.addEventListener('change', this.handleNetworkChange);
        this.networkQuality = (navigator as any).connection.effectiveType;
      }

      // Check initial session
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      await this.validateSession(session);

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        console.debug('🔄 Auth state change:', event);
        
        try {
          if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
            this.handleSignOut();
          } else if (event === 'SIGNED_IN') {
            await this.validateSession(session);
          } else if (event === 'TOKEN_REFRESHED') {
            await this.validateSession(session);
          }
        } catch (error) {
          await this.handleError(error);
        }
      });

      // Add focus listener for session refresh
      window.addEventListener('focus', this.handleFocus);
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);

      console.debug('✅ Session manager initialized');
    } catch (error) {
      await this.handleError(error);
    }
  }

  private handleNetworkChange = () => {
    if ('connection' in navigator) {
      this.networkQuality = (navigator as any).connection.effectiveType;
      console.debug('🌐 Network quality changed:', this.networkQuality);
    }
  };

  private handleOnline = () => {
    console.debug('🌐 Device online');
    this.retryCount = 0;
    this.refreshSession();
  };

  private handleOffline = () => {
    console.debug('🌐 Device offline');
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
  };

  private async validateSession(session: Session | null) {
    console.debug('🔍 Validating session...');
    
    if (!session) {
      throw new Error('Invalid session');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Invalid user');
    }

    // Check profile status
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('status, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.status) {
      throw new Error('Profile inactive or not found');
    }

    // Store role in localStorage
    localStorage.setItem('userRole', profile.role);

    this.updateState({
      session,
      loading: false,
      error: null
    });
    
    console.debug('✅ Session validated');
  }

  private handleFocus = () => {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    // Skip refresh if offline or poor connection
    if (!navigator.onLine) {
      console.debug('🌐 Device offline, skipping session refresh');
      return;
    }

    if (this.networkQuality === 'slow-2g' || this.networkQuality === '2g') {
      console.debug('🌐 Poor network quality, delaying session refresh');
      return;
    }

    this.refreshSession();
  };

  private async refreshSession() {
    this.refreshTimeout = setTimeout(async () => {
      try {
        console.debug('🔄 Refreshing session...');
        
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          // Check if it's a network error
          if (error.message?.includes('network') || !navigator.onLine) {
            console.warn('Network issue during session refresh, will retry later');
            return;
          }
          throw error;
        }

        await this.validateSession(session);
      } catch (error) {
        await this.handleError(error);
      }
    }, 1000);
  }

  private async handleError(error: unknown) {
    console.error('❌ Session error:', error);
    
    const appError = await handleError(error, {
      component: 'SessionManager',
      action: 'sessionManagement',
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
      networkStatus: {
        online: navigator.onLine,
        quality: this.networkQuality
      }
    });

    if (appError.type === AuthErrorType.SESSION_EXPIRED) {
      this.handleSignOut();
    } else if (this.retryCount < this.maxRetries && navigator.onLine) {
      this.retryCount++;
      const delay = this.retryDelay * Math.pow(2, this.retryCount - 1);
      console.debug(`🔄 Retrying in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`);
      setTimeout(() => {
        this.refreshSession();
      }, delay);
    } else {
      this.updateState({
        session: null,
        loading: false,
        error: appError
      });
    }
  }

  private handleSignOut() {
    console.debug('👋 Handling sign out...');
    localStorage.clear();
    this.updateState({
      session: null,
      loading: false,
      error: null
    });
    window.location.href = '/login';
  }

  private updateState(newState: Partial<SessionState>) {
    this.state = { ...this.state, ...newState };
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }

  subscribe(listener: (state: SessionState) => void) {
    this.listeners.add(listener);
    listener(this.state);

    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): SessionState {
    return this.state;
  }

  async signOut() {
    try {
      console.debug('🚪 Signing out...');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      this.handleSignOut();
    } catch (error) {
      await this.handleError(error);
      // Force sign out on error
      this.handleSignOut();
    }
  }

  cleanup() {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    window.removeEventListener('focus', this.handleFocus);
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    if ('connection' in navigator) {
      (navigator as any).connection.removeEventListener('change', this.handleNetworkChange);
    }
    this.listeners.clear();
  }
}

export const sessionManager = SessionManager.getInstance();