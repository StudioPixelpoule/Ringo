import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';
import { Login } from './pages/Login';
import { Chat } from './pages/Chat';
import { AcceptInvitation } from './pages/AcceptInvitation';
import { supabase } from './lib/supabase';
import { useModalStore } from './lib/modalStore';
import { useUserStore } from './lib/store';
import { Loader2 } from 'lucide-react';
import { Logo } from './components/Logo';
import { SmallLogo } from './components/SmallLogo';
import { IrsstLogo } from './components/IrsstLogo';
import { handleError } from './lib/errorHandler';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const closeAllModals = useModalStore(state => state.closeAll);
  const setUserRole = useUserStore(state => state.setUserRole);
  
  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        // First check if we have a session in storage
        const storedSession = sessionStorage.getItem('sb-auth-token');
        if (!storedSession) {
          const path = window.location.pathname;
          if (path !== '/login' && !path.startsWith('/accept-invitation')) {
            throw new Error('No session found');
          }
          if (mounted) {
            setSession(null);
            setIsAuthenticated(false);
            setLoading(false);
          }
          return;
        }

        // Get current session from Supabase
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        // Handle no session case
        if (!currentSession) {
          // Clear invalid stored session
          sessionStorage.removeItem('sb-auth-token');
          
          const path = window.location.pathname;
          if (path !== '/login' && !path.startsWith('/accept-invitation')) {
            throw new Error('No session found');
          }
          if (mounted) {
            setSession(null);
            setIsAuthenticated(false);
            setLoading(false);
          }
          return;
        }

        // Get user profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('status, role')
          .eq('id', currentSession.user.id)
          .single();

        if (profileError) {
          // Handle specific error cases
          if (profileError.code === 'PGRST301' || profileError.code === '401') {
            await supabase.auth.signOut();
            sessionStorage.removeItem('sb-auth-token');
            throw new Error('Invalid session');
          }
          throw profileError;
        }

        // Validate profile status
        if (!profile?.status) {
          await supabase.auth.signOut();
          sessionStorage.removeItem('sb-auth-token');
          throw new Error('Profile inactive or not found');
        }

        if (mounted) {
          setUserRole(profile.role);
          setSession(currentSession);
          setIsAuthenticated(true);
          // Store session
          sessionStorage.setItem('sb-auth-token', currentSession.access_token);
        }
      } catch (error) {
        if (!mounted) return;

        // Log error with context
        await handleError(error, {
          component: 'App',
          action: 'checkAuth',
          sessionId: session?.user?.id,
          location: window.location.pathname
        });

        // Clear auth state on critical errors
        if (error instanceof Error && 
            (error.message.includes('No session found') ||
             error.message.includes('Invalid session') ||
             error.message.includes('Profile inactive'))) {
          await supabase.auth.signOut();
          localStorage.clear();
          sessionStorage.clear();
          closeAllModals();
        }

        if (mounted) {
          setSession(null);
          setIsAuthenticated(false);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Initial auth check
    checkAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.debug('Auth state change:', event);

      switch (event) {
        case 'SIGNED_OUT':
        case 'USER_DELETED':
          setSession(null);
          setIsAuthenticated(false);
          localStorage.clear();
          sessionStorage.clear();
          closeAllModals();
          break;

        case 'SIGNED_IN':
          if (session) {
            sessionStorage.setItem('sb-auth-token', session.access_token);
            await checkAuth();
          }
          break;

        case 'TOKEN_REFRESHED':
          if (session) {
            sessionStorage.setItem('sb-auth-token', session.access_token);
            await checkAuth();
          }
          break;

        default:
          // Ignore other events
          break;
      }
    });

    // Cleanup
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [closeAllModals, setUserRole, session?.user?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f15922] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md flex flex-col items-center">
          <div className="flex flex-col items-center mb-8 animate-pulse">
            <div className="w-24 h-24 flex items-center justify-center">
              <Logo />
            </div>
            <h1 className="text-white text-4xl font-bold flex items-center">
              RINGO
              <sup className="ml-1 flex items-center gap-0.5 text-sm text-white">
                <span>par</span>
                <SmallLogo />
              </sup>
            </h1>
            <div className="mt-4">
              <IrsstLogo />
            </div>
          </div>
          <div className="flex items-center justify-center text-white gap-2">
            <Loader2 className="animate-spin" size={20} />
            <span>Vérification de l'authentification...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route
          path="/login"
          element={session ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/accept-invitation"
          element={<AcceptInvitation />}
        />
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Chat session={session!} />
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