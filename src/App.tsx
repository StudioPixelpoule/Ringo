import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';
import { Login } from './pages/Login';
import { Chat } from './pages/Chat';
import { ResetPassword } from './pages/ResetPassword';
import { ChangePassword } from './pages/ChangePassword';
import { AcceptInvitation } from './pages/AcceptInvitation';
import { supabase } from './lib/supabase';
import { logError } from './lib/errorLogger';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('user');
  const [passwordChanged, setPasswordChanged] = useState<boolean>(true);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
        setAuthInitialized(true);
      }
    }).catch(error => {
      console.error('Error getting session:', error);
      handleAuthError(error);
      setLoading(false);
      setAuthInitialized(true);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change event:', event);
      
      if (event === 'TOKEN_REFRESHED') {
        setSession(session);
        if (session) {
          fetchUserRole(session.user.id);
        }
      } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setSession(null);
        setUserRole('user');
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/login';
      } else if (event === 'SIGNED_IN') {
        setSession(session);
        if (session) {
          fetchUserRole(session.user.id);
        }
      } else if (event === 'PASSWORD_RECOVERY') {
        // Handle password recovery event
        console.log('Password recovery event detected');
        if (session) {
          // User is authenticated, redirect to reset password page
          navigate('/reset-password');
        }
      } else {
        setSession(session);
        if (session) {
          fetchUserRole(session.user.id);
        } else {
          setLoading(false);
          setAuthInitialized(true);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const navigate = (path: string) => {
    window.location.href = path;
  };

  const handleAuthError = (error: any) => {
    if (error?.message?.includes('refresh_token_not_found') || 
        error?.message?.includes('JWT expired') || 
        error?.message?.includes('Invalid JWT') ||
        error?.message?.includes('Invalid Refresh Token') ||
        error?.message?.includes('Invalid API key')) {
      console.log('Authentication error detected, clearing storage and redirecting to login');
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
    }
  };

  const fetchUserRole = async (userId: string) => {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    const retryFetch = async (attempt: number = 1): Promise<void> => {
      try {
        console.log(`Fetching user role (attempt ${attempt})...`);
        
        const { data, error } = await supabase
          .from('profiles')
          .select('role, status, password_changed')
          .eq('id', userId)
          .single();

        if (error) {
          if (error.code === 'PGRST301' || error.code === '401') {
            console.error('Authentication error:', error);
            handleAuthError(error);
            return;
          }
          throw error;
        }

        if (!data) {
          console.warn('No profile found for user');
          setLoading(false);
          setAuthInitialized(true);
          return;
        }

        if (!data.status) {
          console.warn('User profile is inactive');
          await supabase.auth.signOut();
          setLoading(false);
          setAuthInitialized(true);
          return;
        }

        console.log('User role fetched:', data.role);
        setUserRole(data.role);
        setPasswordChanged(data.password_changed);
        setLoading(false);
        setAuthInitialized(true);
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error);

        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.warn(`Network error occurred. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return retryFetch(attempt + 1);
        }

        if (error instanceof Error && (
          error.message.includes('JWT expired') || 
          error.message.includes('Invalid JWT') ||
          error.message.includes('Invalid Refresh Token') ||
          error.message.includes('Failed to fetch') ||
          error.message.includes('Invalid API key'))) {
          console.error('Authentication error:', error);
          handleAuthError(error);
          return;
        }
        throw error;
      }
    };

    try {
      await retryFetch();
    } catch (error) {
      console.error('All retries failed:', error);
      logError(error);
      setLoading(false);
      setAuthInitialized(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Chargement...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={session ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/reset-password"
          element={<ResetPassword />}
        />
        <Route
          path="/accept-invitation"
          element={<AcceptInvitation />}
        />
        <Route
          path="/change-password"
          element={
            session && !passwordChanged ? (
              <ChangePassword />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/"
          element={
            session ? (
              !passwordChanged ? (
                <Navigate to="/change-password" replace />
              ) : (
                <Chat session={session} userRole={userRole} authInitialized={authInitialized} />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;