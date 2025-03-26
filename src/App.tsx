import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';
import { Login } from './pages/Login';
import { Chat } from './pages/Chat';
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
    const retryFetch = async (attempt: number = 1): Promise<any> => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role, status')
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

        return data;
      } catch (error) {
        if (attempt < 3 && error instanceof TypeError && error.message === 'Failed to fetch') {
          console.warn(`Attempt ${attempt}: Network error occurred. Retrying in 1 second...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return retryFetch(attempt + 1);
        }
        throw error;
      }
    };

    try {
      const data = await retryFetch();
      
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
    } catch (error) {
      console.error('Error in fetchUserRole:', error);
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.error('Network error occurred while fetching user role. Please check your internet connection and Supabase URL.');
      }
      // Don't throw here to prevent the unhandled promise rejection
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
      </Routes>
    </BrowserRouter>
  );
}

export default App;