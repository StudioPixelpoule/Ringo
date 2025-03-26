import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';
import { Logo } from './Logo';
import { SmallLogo } from './SmallLogo';
import { IrsstLogo } from './IrsstLogo';
import { useUserStore } from '../lib/store';

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
    const checkAuth = async () => {
      try {
        // Check profile status
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('status, role')
          .eq('id', session?.user?.id)
          .single();

        if (profileError || !profile?.status) {
          throw new Error('Profile inactive or not found');
        }

        // Set user role in global store
        setUserRole(profile.role);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Auth check error:', error);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    if (session?.user) {
      checkAuth();
    } else {
      setLoading(false);
      setIsAuthenticated(false);
    }
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
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}