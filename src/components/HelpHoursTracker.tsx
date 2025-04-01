import React, { useState, useEffect } from 'react';
import { Clock, HelpCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logError } from '../lib/errorLogger';

interface HelpHoursTrackerProps {
  userId?: string;
  totalHours?: number;
}

export function HelpHoursTracker({ userId, totalHours = 40 }: HelpHoursTrackerProps) {
  const [remainingHours, setRemainingHours] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRemainingHours();
  }, [userId]);

  const fetchRemainingHours = async () => {
    setLoading(true);
    try {
      // Get current user if not provided
      let currentUserId = userId;
      if (!currentUserId) {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error('Not authenticated');
        currentUserId = user.id;
      }

      // Get total hours spent
      const { data, error: hoursError } = await supabase
        .from('help_requests')
        .select('hours_spent')
        .eq('user_id', currentUserId)
        .eq('status', 'completed');

      if (hoursError) throw hoursError;

      // Calculate total hours spent
      const hoursSpent = data?.reduce((sum, request) => {
        return sum + (request.hours_spent || 0);
      }, 0) || 0;

      // Calculate remaining hours
      const remaining = Math.max(0, totalHours - hoursSpent);
      setRemainingHours(remaining);
    } catch (error) {
      console.error('Error fetching remaining hours:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch remaining hours');
      logError(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full"></div>
        <span>Chargement...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-1 text-sm text-red-600">
        <AlertTriangle size={14} />
        <span>Erreur de chargement</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <Clock size={14} className="text-[#dba747]" />
      <span>
        <strong className="text-[#dba747]">{remainingHours}</strong> heures d'assistance disponibles
      </span>
      <HelpCircle 
        size={14} 
        className="text-gray-400 cursor-help"
        title={`Vous disposez de ${totalHours} heures d'assistance incluses dans votre forfait.`}
      />
    </div>
  );
}