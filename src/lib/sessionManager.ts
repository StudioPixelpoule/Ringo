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
  private initialized = false;

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
    if (this.initialized) {
      console.debug('✅ Session manager already initialized');
      return;
    }

    try {
      console.debug('🔐 Initializing session manager...');
      
      // Check initial session
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (session) {
        await this.validateSession(session);
      } else {
        this.updateState({
          session: null,
          loading: false,
          error: null
        });
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        console.debug('🔄 Auth state change:', event);
        
        try {
          if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
            this.handleSignOut();
          } else if (event === 'SIGNED_IN' && session) {
            await this.validateSession(session);
          } else if (event === 'TOKEN_REFRESHED' && session) {
            await this.validateSession(session);
          }
        } catch (error) {
          await this.handleError(error);
        }
      });

      this.initialized = true;
      console.debug('✅ Session manager initialized');
    } catch (error) {
      await this.handleError(error);
    }
  }

  private async validateSession(session: Session) {
    console.debug('🔍 Validating session...');
    
    try {
      // Verify user exists
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('User not found');

      // Check profile status
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('status, role')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      if (!profile?.status) throw new Error('Profile inactive');

      // Store role in sessionStorage
      sessionStorage.setItem('userRole', profile.role);

      this.updateState({
        session,
        loading: false,
        error: null
      });
      
      console.debug('✅ Session validated:', { email: user.email, role: profile.role });
    } catch (error) {
      throw await handleError(error, {
        component: 'SessionManager',
        action: 'validateSession'
      });
    }
  }

  private async handleError(error: unknown) {
    console.error('❌ Session error:', error);
    
    const appError = await handleError(error, {
      component: 'SessionManager',
      action: 'sessionManagement'
    });

    if (appError.type === AuthErrorType.SESSION_EXPIRED) {
      this.handleSignOut();
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
    sessionStorage.clear();
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
    return () => this.listeners.delete(listener);
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
      this.handleSignOut(); // Force sign out on error
    }
  }

  cleanup() {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
    this.listeners.clear();
    this.initialized = false;
  }
}

export const sessionManager = SessionManager.getInstance();