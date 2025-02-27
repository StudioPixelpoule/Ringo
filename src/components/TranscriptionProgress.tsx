import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AudioIcon } from './AudioIcon';
import { RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

interface TranscriptionProgressProps {
  documentId: string;
  onComplete?: (success: boolean) => void;
}

export const TranscriptionProgress: React.FC<TranscriptionProgressProps> = ({ 
  documentId,
  onComplete
}) => {
  const [status, setStatus] = useState<'pending' | 'processing' | 'completed' | 'failed'>('processing');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Vérifier le statut de la transcription
  const checkTranscriptionStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('document_contents')
        .select('extraction_status, content')
        .eq('document_id', documentId)
        .single();

      if (error) throw error;

      if (data) {
        if (data.extraction_status === 'processing') {
          setStatus('processing');
          // Simuler une progression
          setProgress(prev => Math.min(prev + 5, 95));
        } else if (data.extraction_status === 'success') {
          setStatus('completed');
          setProgress(100);
          if (onComplete) onComplete(true);
          
          // Arrêter le rafraîchissement
          if (refreshInterval) {
            clearInterval(refreshInterval);
            setRefreshInterval(null);
          }
        } else if (data.extraction_status === 'failed' || data.extraction_status === 'manual') {
          setStatus('failed');
          setProgress(100);
          
          // Extraire le message d'erreur
          if (data.content && (
            data.content.includes("transcription automatique a échoué") ||
            data.content.includes("erreur s'est produite") ||
            data.content.includes("trop volumineux")
          )) {
            setError(data.content.split('.')[0] + '.');
          } else {
            setError("La transcription a échoué.");
          }
          
          if (onComplete) onComplete(false);
          
          // Arrêter le rafraîchissement
          if (refreshInterval) {
            clearInterval(refreshInterval);
            setRefreshInterval(null);
          }
        }
      }
    } catch (err) {
      console.error('Erreur lors de la vérification du statut de transcription:', err);
    }
  };

  // Vérifier le statut au chargement et configurer l'intervalle de rafraîchissement
  useEffect(() => {
    checkTranscriptionStatus();
    
    // Configurer l'intervalle de rafraîchissement
    const interval = setInterval(() => {
      checkTranscriptionStatus();
    }, 3000);
    
    setRefreshInterval(interval);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [documentId]);

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <div className="flex items-center gap-3 mb-3">
        <AudioIcon className="text-[#f15922]" size={24} />
        <h3 className="text-lg font-medium text-gray-800">Transcription audio</h3>
      </div>
      
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            {status === 'processing' && (
              <>
                <RefreshCw className="text-blue-500 animate-spin" size={16} />
                <span className="text-sm font-medium text-blue-600">Transcription en cours...</span>
              </>
            )}
            {status === 'completed' && (
              <>
                <CheckCircle className="text-green-500" size={16} />
                <span className="text-sm font-medium text-green-600">Transcription terminée</span>
              </>
            )}
            {status === 'failed' && (
              <>
                <AlertCircle className="text-red-500" size={16} />
                <span className="text-sm font-medium text-red-600">Échec de la transcription</span>
              </>
            )}
          </div>
          <span className="text-sm text-gray-500">{progress}%</span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className={`h-2.5 rounded-full transition-all duration-300 ${
              status === 'completed' ? 'bg-green-600' :
              status === 'failed' ? 'bg-red-600' : 'bg-blue-600'
            }`}
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
      
      {error && (
        <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded">
          {error}
        </div>
      )}
      
      <p className="text-sm text-gray-600">
        {status === 'processing' && "La transcription peut prendre plusieurs minutes selon la taille du fichier audio."}
        {status === 'completed' && "Le fichier audio a été transcrit avec succès."}
        {status === 'failed' && "Veuillez saisir manuellement la transcription ou réessayer plus tard."}
      </p>
    </div>
  );
};