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

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        setSession(session);
        if (session) {
          fetchUserRole(session.user.id);
        }
      } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setSession(null);
        setUserRole('user');
        localStorage.clear();
        window.location.href = '/login';
      } else {
        setSession(session);
        if (session) {
          fetchUserRole(session.user.id);
        }
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserRole = async (userId: string) => {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    const retryFetch = async (attempt: number = 1): Promise<void> => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role, status, password_changed')
          .eq('id', userId)
          .single();

        if (error) {
          if (error.code === 'PGRST301' || error.code === '401') {
            localStorage.clear();
            window.location.href = '/login';
            return;
          }
          throw error;
        }

        if (!data) {
          console.warn('No profile found for user');
          return;
        }

        if (!data.status) {
          console.warn('User profile is inactive');
          await supabase.auth.signOut();
          return;
        }

        setUserRole(data.role);
        setPasswordChanged(data.password_changed);
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error);

        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.warn(`Network error occurred. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return retryFetch(attempt + 1);
        }

        if (error instanceof Error) {
          if (error.message.includes('JWT expired') || 
              error.message.includes('Invalid JWT') ||
              error.message.includes('Failed to fetch')) {
            console.error('Authentication error:', error);
            window.location.href = '/login';
            return;
          }
          throw error;
        }
        throw new Error('Failed to fetch user role');
      }
    };

    try {
      await retryFetch();
    } catch (error) {
      console.error('All retries failed:', error);
      logError(error);
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
                <Chat session={session} />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;