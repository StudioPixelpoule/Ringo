import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, CheckCircle, Clock, RefreshCw, XCircle, Play, Pause, Download } from 'lucide-react';
import { AudioIcon } from './AudioIcon';
import type { Document } from '../lib/types';

interface TranscriptionStatus {
  id: string;
  document_id: string;
  document_name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  created_at: string;
  updated_at: string;
  error_message?: string;
}

interface TranscriptionDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export const TranscriptionDashboard: React.FC<TranscriptionDashboardProps> = ({ 
  isOpen, 
  onClose,
  userId
}) => {
  const [transcriptions, setTranscriptions] = useState<TranscriptionStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(5000); // 5 secondes par défaut
  const [refreshTimer, setRefreshTimer] = useState<NodeJS.Timeout | null>(null);

  // Charger les transcriptions
  const loadTranscriptions = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Récupérer tous les documents audio
      const { data: documents, error: documentsError } = await supabase
        .from('documents')
        .select('*')
        .or('name.ilike.%.mp3,name.ilike.%.wav,name.ilike.%.ogg,name.ilike.%.m4a')
        .order('created_at', { ascending: false });

      if (documentsError) throw documentsError;

      if (!documents || documents.length === 0) {
        setTranscriptions([]);
        setIsLoading(false);
        return;
      }

      // Récupérer le statut d'extraction pour chaque document
      const documentIds = documents.map(doc => doc.id);
      const { data: contents, error: contentsError } = await supabase
        .from('document_contents')
        .select('*')
        .in('document_id', documentIds);

      if (contentsError) throw contentsError;

      // Combiner les données
      const transcriptionData: TranscriptionStatus[] = documents.map(doc => {
        const content = contents?.find(c => c.document_id === doc.id);
        
        // Déterminer le statut et le progrès
        let status: 'pending' | 'processing' | 'completed' | 'failed' = 'pending';
        let progress = 0;
        let errorMessage = undefined;

        if (content) {
          if (content.extraction_status === 'processing') {
            status = 'processing';
            progress = 50; // Estimation
          } else if (content.extraction_status === 'success') {
            status = 'completed';
            progress = 100;
          } else if (content.extraction_status === 'failed' || content.extraction_status === 'manual') {
            status = 'failed';
            progress = 100;
            
            // Extraire le message d'erreur du contenu
            if (content.content && (
              content.content.includes("transcription automatique a échoué") ||
              content.content.includes("erreur s'est produite") ||
              content.content.includes("trop volumineux")
            )) {
              errorMessage = content.content.split('.')[0] + '.';
            }
          }
        }

        return {
          id: content?.id || `temp-${doc.id}`,
          document_id: doc.id,
          document_name: doc.name,
          status,
          progress,
          created_at: doc.created_at,
          updated_at: content?.updated_at || doc.created_at,
          error_message: errorMessage
        };
      });

      setTranscriptions(transcriptionData);
    } catch (err) {
      console.error('Erreur lors du chargement des transcriptions:', err);
      setError('Erreur lors du chargement des transcriptions. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  // Charger les transcriptions au chargement et configurer l'intervalle de rafraîchissement
  useEffect(() => {
    if (isOpen) {
      loadTranscriptions();

      // Configurer l'intervalle de rafraîchissement
      if (refreshInterval) {
        const timer = setInterval(() => {
          loadTranscriptions();
        }, refreshInterval);
        
        setRefreshTimer(timer);
        
        return () => {
          clearInterval(timer);
          setRefreshTimer(null);
        };
      }
    }
  }, [isOpen, refreshInterval]);

  // Nettoyer l'intervalle à la fermeture
  useEffect(() => {
    return () => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
    };
  }, [refreshTimer]);

  // Formater la date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculer le temps écoulé
  const getElapsedTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return `${seconds} s`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    
    const hours = Math.floor(minutes / 60);
    return `${hours} h ${minutes % 60} min`;
  };

  // Télécharger le fichier audio
  const downloadAudio = async (document: Document) => {
    try {
      window.open(document.url, '_blank');
    } catch (error) {
      console.error('Erreur lors du téléchargement du fichier audio:', error);
    }
  };

  // Relancer une transcription
  const retryTranscription = async (documentId: string) => {
    try {
      // Récupérer le document
      const { data: document, error: documentError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (documentError) throw documentError;

      // Mettre à jour le statut
      const { error: updateError } = await supabase
        .from('document_contents')
        .update({
          content: "Pour les fichiers audio, une transcription est en cours. Veuillez patienter...",
          extraction_status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('document_id', documentId);

      if (updateError) throw updateError;

      // Rafraîchir les données
      loadTranscriptions();

      // Lancer la transcription via l'API
      const response = await fetch('/api/transcribe-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ audioUrl: document.url })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors de la transcription');
      }

      const result = await response.json();
      
      if (result.success && result.transcription) {
        // Mettre à jour le contenu avec la transcription
        const { error: contentError } = await supabase
          .from('document_contents')
          .update({
            content: result.transcription,
            extraction_status: 'success',
            updated_at: new Date().toISOString()
          })
          .eq('document_id', documentId);

        if (contentError) throw contentError;
      } else {
        throw new Error('Aucune transcription retournée');
      }

      // Rafraîchir les données
      loadTranscriptions();
    } catch (error) {
      console.error('Erreur lors de la relance de la transcription:', error);
      
      // Mettre à jour le statut en échec
      try {
        await supabase
          .from('document_contents')
          .update({
            content: "Ce document est un fichier audio. La transcription automatique a échoué. Veuillez saisir manuellement la transcription.",
            extraction_status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('document_id', documentId);
      } catch (updateError) {
        console.error('Erreur lors de la mise à jour du statut:', updateError);
      }
      
      // Rafraîchir les données
      loadTranscriptions();
    }
  };

  // Gérer le rafraîchissement automatique
  const toggleAutoRefresh = () => {
    if (refreshInterval) {
      // Désactiver le rafraîchissement automatique
      if (refreshTimer) {
        clearInterval(refreshTimer);
        setRefreshTimer(null);
      }
      setRefreshInterval(null);
    } else {
      // Activer le rafraîchissement automatique
      setRefreshInterval(5000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl w-[95vw] h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <AudioIcon className="text-[#f15922]" size={24} />
            <h2 className="text-xl font-semibold text-[#2F4F4F]">Tableau de bord des transcriptions audio</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadTranscriptions}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600"
              title="Rafraîchir"
            >
              <RefreshCw size={20} />
            </button>
            <button
              onClick={toggleAutoRefresh}
              className={`p-2 rounded-full transition-colors ${
                refreshInterval ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={refreshInterval ? "Désactiver le rafraîchissement automatique" : "Activer le rafraîchissement automatique"}
            >
              {refreshInterval ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500"
            >
              <XCircle size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f15922]"></div>
                <p className="mt-4 text-gray-600">Chargement des transcriptions...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="bg-red-50 p-6 rounded-lg max-w-md text-center">
                <AlertCircle className="mx-auto text-red-500 mb-3" size={32} />
                <p className="text-red-700 font-medium">{error}</p>
                <button
                  onClick={loadTranscriptions}
                  className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Réessayer
                </button>
              </div>
            </div>
          ) : transcriptions.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="bg-gray-50 p-6 rounded-lg max-w-md text-center">
                <AudioIcon className="mx-auto text-gray-400 mb-3" size={32} />
                <p className="text-gray-700 font-medium">Aucune transcription audio trouvée</p>
                <p className="text-gray-500 mt-2">
                  Téléversez des fichiers audio pour les voir apparaître ici.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Fichier</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Statut</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Progression</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Créé le</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Mis à jour</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Temps écoulé</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transcriptions.map((transcription) => (
                    <tr key={transcription.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 border-b">
                        <div className="flex items-center gap-2">
                          <AudioIcon className="text-[#f15922]" size={16} />
                          <span className="text-sm font-medium text-gray-700">{transcription.document_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 border-b">
                        <div className="flex items-center gap-1.5">
                          {transcription.status === 'pending' && (
                            <>
                              <Clock className="text-gray-400" size={16} />
                              <span className="text-sm text-gray-600">En attente</span>
                            </>
                          )}
                          {transcription.status === 'processing' && (
                            <>
                              <RefreshCw className="text-blue-500 animate-spin" size={16} />
                              <span className="text-sm text-blue-600">En cours</span>
                            </>
                          )}
                          {transcription.status === 'completed' && (
                            <>
                              <CheckCircle className="text-green-500" size={16} />
                              <span className="text-sm text-green-600">Terminé</span>
                            </>
                          )}
                          {transcription.status === 'failed' && (
                            <>
                              <AlertCircle className="text-red-500" size={16} />
                              <span className="text-sm text-red-600">Échec</span>
                            </>
                          )}
                        </div>
                        {transcription.error_message && (
                          <p className="text-xs text-red-500 mt-1">{transcription.error_message}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 border-b">
                        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 max-w-[150px]">
                          <div 
                            className={`h-2.5 rounded-full ${
                              transcription.status === 'completed' ? 'bg-green-600' :
                              transcription.status === 'failed' ? 'bg-red-600' :
                              transcription.status === 'processing' ? 'bg-blue-600' : 'bg-gray-400'
                            }`}
                            style={{ width: `${transcription.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500 mt-1">{transcription.progress}%</span>
                      </td>
                      <td className="px-4 py-3 border-b">
                        <span className="text-sm text-gray-600">{formatDate(transcription.created_at)}</span>
                      </td>
                      <td className="px-4 py-3 border-b">
                        <span className="text-sm text-gray-600">{formatDate(transcription.updated_at)}</span>
                      </td>
                      <td className="px-4 py-3 border-b">
                        <span className="text-sm text-gray-600">{getElapsedTime(transcription.created_at)}</span>
                      </td>
                      <td className="px-4 py-3 border-b">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => downloadAudio({ id: transcription.document_id, url: '', name: transcription.document_name } as Document)}
                            className="p-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                            title="Télécharger le fichier audio"
                          >
                            <Download size={16} />
                          </button>
                          {(transcription.status === 'failed' || transcription.status === 'pending') && (
                            <button
                              onClick={() => retryTranscription(transcription.document_id)}
                              className="p-1.5 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                              title="Relancer la transcription"
                            >
                              <RefreshCw size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {transcriptions.length} transcription{transcriptions.length !== 1 ? 's' : ''} au total
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                Rafraîchissement automatique: 
                <span className={refreshInterval ? 'text-green-600 font-medium ml-1' : 'text-gray-600 ml-1'}>
                  {refreshInterval ? 'Activé' : 'Désactivé'}
                </span>
              </div>
              <button
                onClick={loadTranscriptions}
                className="px-4 py-2 bg-[#f15922] text-white rounded-lg hover:bg-[#d14811] transition-colors"
              >
                Rafraîchir
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};