import React, { useState, useEffect, useRef } from 'react';
import { HelpCircle, X, Send, Clock, Calendar, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { logError } from '../lib/errorLogger';
import { HelpHoursTracker } from './HelpHoursTracker';

export function HelpRequestButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [availability, setAvailability] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<{email: string; name?: string} | null>(null);
  const [remainingHours, setRemainingHours] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Fetch user info when the form opens
  useEffect(() => {
    if (isOpen && !userInfo) {
      fetchUserInfo();
      fetchRemainingHours();
    }
  }, [isOpen, userInfo]);

  // Handle click outside to close modal
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const fetchUserInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      
      setUserInfo({
        email: profile.email,
        name: profile.email.split('@')[0] // Simple name extraction from email
      });
    } catch (error) {
      console.error('Error fetching user info:', error);
      logError(error);
    }
  };

  const fetchRemainingHours = async () => {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Not authenticated');

      // Get total hours spent
      const { data, error: hoursError } = await supabase
        .from('help_requests')
        .select('hours_spent')
        .eq('user_id', user.id)
        .eq('status', 'completed');

      if (hoursError) throw hoursError;

      // Calculate total hours spent
      const hoursSpent = data?.reduce((sum, request) => {
        return sum + (request.hours_spent || 0);
      }, 0) || 0;

      // Calculate remaining hours
      const totalHours = 40;
      const remaining = Math.max(0, totalHours - hoursSpent);
      setRemainingHours(remaining);
    } catch (error) {
      console.error('Error fetching remaining hours:', error);
      logError(error);
    }
  };

  const handleAvailabilityToggle = (value: string) => {
    setAvailability(prev => 
      prev.includes(value)
        ? prev.filter(item => item !== value)
        : [...prev, value]
    );
  };

  const handleSubmit = async () => {
    if (!message.trim() || availability.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    
    try {
      // First get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Not authenticated');

      // Then submit feedback
      const { error: submitError } = await supabase
        .from('help_requests')
        .insert([{ 
          user_id: user.id,
          message: message.trim(),
          availability: availability.join(', '),
          status: 'pending'
        }]);

      if (submitError) throw submitError;

      setMessage('');
      setAvailability([]);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setIsOpen(false);
      }, 3000);
    } catch (error) {
      console.error('Error submitting help request:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white hover:text-white/90 focus:outline-none"
        aria-label="Help"
        title="Assistance"
      >
        <Clock size={18} strokeWidth={2.5} />
      </button>

      {/* Help request modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div
              ref={modalRef}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
            >
              <div className="bg-[#f15922] px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <HelpCircle size={24} />
                  Demande d'Assistance
                </h2>
                <div className="flex items-center gap-2">
                  <div className="text-white text-sm px-2 py-1 flex items-center gap-1">
                    <Clock size={16} />
                    <span><strong>{remainingHours ?? 40}</strong> / 40 heures</span>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-6">
                {showSuccess ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle size={32} className="text-green-600" />
                    </div>
                    <h3 className="text-xl font-medium text-gray-800 mb-2">Demande envoyée !</h3>
                    <p className="text-gray-600 text-center">
                      Nous vous contacterons rapidement pour planifier l'assistance.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Comment puis-je vous aider ?
                        </label>
                        <textarea
                          value={message}
                          onChange={(e) => {
                            if (e.target.value.length <= 300) {
                              setMessage(e.target.value);
                            }
                          }}
                          placeholder="Décrivez brièvement votre besoin..."
                          className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent resize-none"
                          rows={4}
                          maxLength={300}
                        />
                        <div className="text-xs text-gray-500 text-right mt-1">
                          {message.length}/300 caractères
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Disponibilité préférée
                        </label>
                        <div className="space-y-2">
                          {['Aujourd\'hui', 'Demain', 'Cette semaine'].map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => handleAvailabilityToggle(option)}
                              className={`flex items-center gap-2 px-4 py-3 w-full text-sm rounded-lg transition-colors ${
                                availability.includes(option)
                                  ? 'bg-[#f15922]/10 text-[#f15922] border border-[#f15922]/30'
                                  : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                              }`}
                            >
                              <Calendar size={18} />
                              <span>{option}</span>
                              {availability.includes(option) && (
                                <CheckCircle size={18} className="ml-auto" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {userInfo && (
                        <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">Demandeur:</span>
                            <span>{userInfo.name}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Email:</span>
                            <span>{userInfo.email}</span>
                          </div>
                        </div>
                      )}

                      {error && (
                        <div className="p-4 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2">
                          <span>{error}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={!message.trim() || availability.length === 0 || isSubmitting}
                        className={`w-full py-3 px-4 rounded-lg flex items-center justify-center gap-2 ${
                          !message.trim() || availability.length === 0 || isSubmitting
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-[#f15922] text-white hover:bg-[#f15922]/90'
                        }`}
                      >
                        {isSubmitting ? (
                          <>
                            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                            <span>Envoi en cours...</span>
                          </>
                        ) : (
                          <>
                            <Send size={20} />
                            <span>Envoyer ma demande</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}