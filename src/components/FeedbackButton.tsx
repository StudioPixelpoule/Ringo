import React, { useState } from 'react';
import { MessageSquarePlus, X, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!feedback.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    
    try {
      // First get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Not authenticated');

      // Then submit feedback
      const { error: submitError } = await supabase
        .from('user_feedback')
        .insert([{ 
          user_id: user.id,
          content: feedback.trim() 
        }]);

      if (submitError) throw submitError;

      setFeedback('');
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setIsOpen(false);
      }, 2000);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed bottom-8 left-8 z-10">
      {/* Feedback button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white p-3 rounded-full shadow-md hover:shadow-lg transition-all"
        style={{ backgroundColor: isOpen ? '#f15922' : 'white' }}
      >
        <MessageSquarePlus size={20} color={isOpen ? 'white' : '#f15922'} />
        {isOpen ? (
          <X size={20} color="white" />
        ) : (
          <span className="text-[#f15922] font-medium">Feedback</span>
        )}
      </button>

      {/* Feedback form */}
      {isOpen && (
        <div className="absolute bottom-16 left-0 w-80 bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold text-gray-800">Votre avis compte !</h3>
            <p className="text-sm text-gray-600">
              Partagez vos commentaires pour nous aider à améliorer RINGO
            </p>
          </div>

          <div className="p-4">
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Vos suggestions, remarques..."
              className="w-full h-32 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent resize-none"
              maxLength={2000}
            />

            {error && (
              <div className="mt-2 p-2 bg-red-50 text-red-700 text-sm rounded-md">
                {error}
              </div>
            )}

            {showSuccess ? (
              <div className="mt-4 p-2 bg-green-50 text-green-700 text-sm rounded-md text-center">
                Merci pour votre retour !
              </div>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!feedback.trim() || isSubmitting}
                className={`mt-4 w-full py-2 px-4 rounded-md flex items-center justify-center gap-2 ${
                  !feedback.trim() || isSubmitting
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-[#f15922] text-white hover:bg-[#f15922]/90'
                }`}
              >
                <Send size={18} />
                {isSubmitting ? 'Envoi...' : 'Envoyer'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}