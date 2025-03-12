import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';
import { Login } from './pages/Login';
import { Chat } from './pages/Chat';
import { ReportTemplateManager } from './components/ReportTemplateManager';
import { supabase } from './lib/supabase';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('user');

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
        window.location.href = '/login';
      } else {
        setSession(session);
        if (session) {
          fetchUserRole(session.user.id);
        }
      }
      setLoading(false);
    });

    // Handle auth errors
    const handleAuthError = (error: any) => {
      if (error?.message?.includes('refresh_token_not_found') || 
          error?.message?.includes('Invalid Refresh Token')) {
        console.warn('Session expired, redirecting to login');
        setSession(null);
        window.location.href = '/login';
      }
    };

    // Add error listener
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason?.name === 'AuthApiError') {
        handleAuthError(event.reason);
      }
    });

    // Cleanup subscriptions
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('unhandledrejection', handleAuthError);
    };
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (error) throw error;
      if (data?.role) {
        setUserRole(data.role);
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
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