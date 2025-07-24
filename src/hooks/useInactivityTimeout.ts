import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes en millisecondes
const WARNING_TIME = 60 * 1000; // Avertir 1 minute avant la déconnexion

export function useInactivityTimeout() {
  const navigate = useNavigate();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(60); // secondes restantes

  // Fonction pour déconnecter l'utilisateur
  const handleLogout = async () => {
    try {
      logger.info('[Inactivity] Déconnexion automatique pour inactivité');
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      logger.error('[Inactivity] Erreur lors de la déconnexion automatique:', error);
    }
  };

  // Fonction pour réinitialiser le timer
  const resetTimer = () => {
    // Annuler les timers existants
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    // Masquer l'avertissement
    setShowWarning(false);
    setRemainingTime(60);

    // Définir le timer d'avertissement
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(true);
      
      // Décompte du temps restant
      let seconds = 60;
      const countdownInterval = setInterval(() => {
        seconds--;
        setRemainingTime(seconds);
        
        if (seconds <= 0) {
          clearInterval(countdownInterval);
        }
      }, 1000);

      // Nettoyer l'interval lors du reset
      timeoutRef.current = setTimeout(() => {
        clearInterval(countdownInterval);
      }, WARNING_TIME) as any;
    }, INACTIVITY_TIMEOUT - WARNING_TIME);

    // Définir le timer de déconnexion
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, INACTIVITY_TIMEOUT);
  };

  // Fonction pour continuer la session
  const continueSession = () => {
    logger.info('[Inactivity] Session prolongée par l\'utilisateur');
    resetTimer();
  };

  useEffect(() => {
    // Liste des événements qui indiquent une activité
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
      'keydown',
      'focus'
    ];

    // Fonction pour gérer l'activité avec throttle
    let lastActivity = Date.now();
    const handleActivity = () => {
      const now = Date.now();
      // Throttle : ne pas réinitialiser plus d'une fois par seconde
      if (now - lastActivity > 1000) {
        lastActivity = now;
        resetTimer();
      }
    };

    // Ajouter les écouteurs d'événements
    events.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    // Initialiser le timer
    resetTimer();

    // Nettoyer lors du démontage
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, []);

  return {
    showWarning,
    remainingTime,
    continueSession,
    resetTimer
  };
} 