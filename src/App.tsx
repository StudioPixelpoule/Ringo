import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';
import { Login } from './pages/Login';
import { Chat } from './pages/Chat';
import { ReportTemplateManager } from './components/ReportTemplateManager';
import { supabase, recoverAuth } from './lib/supabase';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('user');

  useEffect(() => {
    // Fonction de gestion améliorée des erreurs d'auth
    const handleAuthError = async (error: any) => {
      if (
        error?.message?.includes('refresh_token_not_found') || 
        error?.message?.includes('Invalid Refresh Token') ||
        error?.message?.includes('JWT expired') ||
        error?.message?.includes('Invalid JWT') ||
        error?.code === 'refresh_token_not_found' ||
        error?.status === 400
      ) {
        console.warn('Session expired, redirecting to login');
        setSession(null);
        setUserRole('user');
        await recoverAuth();
      }
    };

    // Écoute plus large des erreurs d'authentification
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason?.name === 'AuthApiError' || event.reason?.__isAuthError === true) {
        handleAuthError(event.reason);
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

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
        await recoverAuth();
      } else {
        setSession(session);
        if (session) {
          fetchUserRole(session.user.id);
        }
      }
      setLoading(false);
    });

    // Cleanup subscriptions
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      // First validate session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) {
        console.warn('No active session');
        await recoverAuth();
        return;
      }

      // Then fetch profile
      const { data, error } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        // Check if it's an auth error
        if (error.code === 'PGRST301' || error.code === '401') {
          setSession(null);
          await recoverAuth();
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
    } catch (error: any) {
      console.error('Error in fetchUserRole:', error);
      // Check if it's an auth error
      if (
        error?.message?.includes('JWT expired') || 
        error?.message?.includes('Invalid JWT') ||
        error?.message?.includes('refresh_token_not_found') ||
        error?.message?.includes('Invalid Refresh Token')
      ) {
        setSession(null);
        await recoverAuth();
        return;
      }
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
          path="/"
          element={session ? <Chat session={session} /> : <Navigate to="/login" replace />}
        />
        {userRole === 'admin' && (
          <Route
            path="/admin/report-templates"
            element={session ? <ReportTemplateManager /> : <Navigate to="/login" replace />}
          />
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;