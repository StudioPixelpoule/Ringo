import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

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
  const [statusMessage, setStatusMessage] = useState<string>('Initialisation de la transcription...');
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [stalled, setStalled] = useState<boolean>(false);
  const [lastProgress, setLastProgress] = useState<number>(0);
  const [noProgressCount, setNoProgressCount] = useState<number>(0);

  // Vérifier le statut de la transcription
  const checkTranscriptionStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('document_contents')
        .select('extraction_status, content, updated_at')
        .eq('document_id', documentId)
        .single();

      if (error) throw error;

      if (data) {
        // Extraire le pourcentage de progression du message de statut
        let extractedProgress = 0;
        let extractedMessage = '';
        
        if (data.content) {
          const progressMatch = data.content.match(/\((\d+)%\)/);
          if (progressMatch && progressMatch[1]) {
            extractedProgress = parseInt(progressMatch[1], 10);
          }
          
          // Extraire le message de statut
          const messageMatch = data.content.match(/Transcription en cours: (.*?) \(\d+%\)/);
          if (messageMatch && messageMatch[1]) {
            extractedMessage = messageMatch[1];
          } else {
            extractedMessage = data.content;
          }
        }
        
        // Vérifier si la transcription est bloquée (pas de mise à jour depuis plus de 2 minutes)
        const updatedAt = new Date(data.updated_at);
        const now = new Date();
        const timeDiff = now.getTime() - updatedAt.getTime();
        
        // Vérifier si la progression est bloquée (même pourcentage pendant plusieurs vérifications)
        if (extractedProgress === lastProgress) {
          setNoProgressCount(prev => prev + 1);
        } else {
          setNoProgressCount(0);
          setLastProgress(extractedProgress);
        }
        
        // Considérer comme bloqué si pas de mise à jour depuis 2 minutes ou pas de progression après 5 vérifications
        const isStalled = (timeDiff > 120000 && data.extraction_status === 'processing') || 
                          (noProgressCount > 5 && extractedProgress > 0 && extractedProgress < 100);
        
        if (isStalled && !stalled) {
          setStalled(true);
          logger.warning('La transcription semble bloquée', 
            { documentId, lastUpdate: updatedAt.toISOString(), timeDiff, noProgressCount }, 
            'TranscriptionProgress');
        } else if (!isStalled && stalled) {
          setStalled(false);
        }
        
        // Mettre à jour le dernier timestamp de mise à jour
        setLastUpdate(updatedAt);
        
        if (data.extraction_status === 'processing') {
          setStatus('processing');
          setProgress(extractedProgress || Math.min(progress + 2, 95)); // Simuler une progression si non spécifiée
          setStatusMessage(extractedMessage || 'Transcription en cours...');
        } else if (data.extraction_status === 'success') {
          setStatus('completed');
          setProgress(100);
          setStatusMessage('Transcription terminée avec succès');
          if (onComplete) onComplete(true);
          
          // Arrêter le rafraîchissement
          if (refreshInterval) {
            clearInterval(refreshInterval);
            setRefreshInterval(null);
          }
          
          logger.info('Transcription terminée avec succès', 
            { documentId, progress: 100 }, 
            'TranscriptionProgress');
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
          
          logger.warning('Échec de la transcription', 
            { documentId, error: data.content }, 
            'TranscriptionProgress');
        }
      }
    } catch (err) {
      console.error('Erreur lors de la vérification du statut de transcription:', err);
      logger.error('Erreur lors de la vérification du statut de transcription', 
        { documentId, error: err }, 
        'TranscriptionProgress');
    }
  }, [documentId, onComplete, progress, refreshInterval, stalled, lastProgress, noProgressCount]);

  // Vérifier le statut au chargement et configurer l'intervalle de rafraîchissement
  useEffect(() => {
    checkTranscriptionStatus();
    
    // Configurer l'intervalle de rafraîchissement
    const interval = setInterval(() => {
      checkTranscriptionStatus();
    }, 2000);
    
    setRefreshInterval(interval);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [documentId, checkTranscriptionStatus]);

  // Fonction pour forcer une nouvelle vérification
  const forceRefresh = () => {
    checkTranscriptionStatus();
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-medium text-gray-800">Transcription audio</h3>
        {stalled && (
          <button 
            onClick={forceRefresh}
            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
          >
            Actualiser
          </button>
        )}
      </div>
      
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            {status === 'processing' && (
              <>
                <div className={`animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500 ${stalled ? 'opacity-50' : ''}`}></div>
                <span className={`text-sm font-medium text-blue-600 ${stalled ? 'opacity-50' : ''}`}>{statusMessage}</span>
              </>
            )}
            {status === 'completed' && (
              <>
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span className="text-sm font-medium text-green-600">Transcription terminée</span>
              </>
            )}
            {status === 'failed' && (
              <>
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
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
              status === 'failed' ? 'bg-red-600' : 
              stalled ? 'bg-yellow-500' : 'bg-blue-600'
            }`}
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
      
      {error && (
        <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded mb-4">
          {error}
        </div>
      )}
      
      {stalled && (
        <div className="p-3 bg-yellow-50 border-l-4 border-yellow-500 text-yellow-700 text-sm rounded mb-4">
          La transcription semble prendre plus de temps que prévu. Vous pouvez attendre ou essayer la saisie manuelle.
        </div>
      )}
      
      <p className="text-sm text-gray-600">
        {status === 'processing' && "La transcription peut prendre plusieurs minutes selon la taille du fichier audio."}
        {status === 'completed' && "Le fichier audio a été transcrit avec succès."}
        {status === 'failed' && "Veuillez saisir manuellement la transcription ou réessayer plus tard."}
      </p>
    </div>
  );
}