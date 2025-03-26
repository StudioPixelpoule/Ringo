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
      // Check initial session
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      this.updateState({
        session,
        loading: false,
        error: null
      });

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        try {
          if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
            this.handleSignOut();
          } else if (event === 'SIGNED_IN') {
            await this.validateSession(session);
          } else if (event === 'TOKEN_REFRESHED') {
            this.updateState({
              session,
              loading: false,
              error: null
            });
          }
        } catch (error) {
          await this.handleError(error);
        }
      });

      // Add focus listener for session refresh
      window.addEventListener('focus', this.handleFocus);
    } catch (error) {
      await this.handleError(error);
    }
  }

  private async validateSession(session: Session | null) {
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
      .select('status')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.status) {
      throw new Error('Profile inactive or not found');
    }

    this.updateState({
      session,
      loading: false,
      error: null
    });
  }

  private handleFocus = () => {
    let timeoutId: NodeJS.Timeout;
    clearTimeout(timeoutId);

    timeoutId = setTimeout(async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!session) throw new Error('No valid session');

        await this.validateSession(session);
      } catch (error) {
        await this.handleError(error);
      }
    }, 1000);
  };

  private async handleError(error: unknown) {
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
    localStorage.clear();
    this.updateState({
      session: null,
      loading: false,
      error: null
    });
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
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      this.handleSignOut();
    } catch (error) {
      await this.handleError(error);
      // Force sign out on error
      this.handleSignOut();
    }
  }
}

export const sessionManager = SessionManager.getInstance();