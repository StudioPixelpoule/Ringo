import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';
import { Logo } from './Logo';
import { SmallLogo } from './SmallLogo';
import { IrsstLogo } from './IrsstLogo';
import { useUserStore } from '../lib/store';
import { handleError } from '../lib/errorHandler';
import { AuthErrorType } from '../lib/errorTypes';

interface AuthGuardProps {
  children: React.ReactNode;
  session: Session | null;
}

export function AuthGuard({ children, session }: AuthGuardProps) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();
  const setUserRole = useUserStore(state => state.setUserRole);

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const checkAuth = async () => {
      try {
        // Add timeout to prevent infinite loading
        timeoutId = setTimeout(() => {
          if (mounted) {
            setLoading(false);
            setIsAuthenticated(false);
          }
        }, 5000);

        // First validate session
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        
        if (!currentSession) {
          throw new Error('No session found');
        }

        // Then check profile status and role
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('status, role')
          .eq('id', currentSession.user.id)
          .single();

        if (profileError) {
          if (profileError.code === 'PGRST301' || profileError.code === '401') {
            throw new Error('Invalid session');
          }
          throw profileError;
        }

        if (!profile || !profile.status) {
          throw new Error('Profile inactive or not found');
        }

        // Clear timeout since auth succeeded
        clearTimeout(timeoutId);

        if (mounted) {
          // Set user role in global store
          setUserRole(profile.role);
          setIsAuthenticated(true);
          setLoading(false);
        }
      } catch (error) {
        if (!mounted) return;

        await handleError(error, {
          component: 'AuthGuard',
          action: 'checkAuth',
          sessionId: session?.user?.id
        });

        // Clear auth state on critical errors
        if (error instanceof Error && 
            (error.message.includes('No session found') ||
             error.message.includes('Invalid session') ||
             error.message.includes('Profile inactive'))) {
          await supabase.auth.signOut();
          localStorage.clear();
        }

        setIsAuthenticated(false);
        setLoading(false);
      }
    };

    checkAuth();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [session, setUserRole]);

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

  if (!isAuthenticated) {
    // Redirect to login while preserving the intended destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}