import React, { useState, useEffect } from 'react';
import { X, BookAudioIcon as AudioIcon, RefreshCw, Save } from 'lucide-react';
import { TranscriptionProgress } from './TranscriptionProgress';
import { supabase } from '../lib/supabase';
import type { Document } from '../lib/types';

interface AudioTranscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document;
  onTranscriptionComplete: (transcription: string) => void;
}

export const AudioTranscriptionModal: React.FC<AudioTranscriptionModalProps> = ({
  isOpen,
  onClose,
  document,
  onTranscriptionComplete
}) => {
  const [transcription, setTranscription] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isManualInput, setIsManualInput] = useState(false);
  const [manualTranscription, setManualTranscription] = useState('');

  // Charger le contenu actuel
  useEffect(() => {
    if (isOpen && document) {
      loadTranscription();
    }
  }, [isOpen, document]);

  const loadTranscription = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('document_contents')
        .select('content, extraction_status')
        .eq('document_id', document.id)
        .single();

      if (error) throw error;

      if (data) {
        setTranscription(data.content);
        
        // Vérifier si c'est un message d'attente ou d'erreur
        if (data.content.includes("Pour les fichiers audio, une transcription est en cours")) {
          setIsTranscribing(true);
        } else if (data.content.includes("transcription automatique a échoué") || 
                  data.content.includes("erreur s'est produite") ||
                  data.extraction_status === 'failed' ||
                  data.extraction_status === 'manual') {
          setIsManualInput(true);
          setManualTranscription('');
        } else {
          setIsTranscribing(false);
          setIsManualInput(false);
        }
      }
    } catch (err) {
      console.error('Erreur lors du chargement de la transcription:', err);
      setError('Erreur lors du chargement de la transcription');
      setIsManualInput(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranscriptionComplete = (success: boolean) => {
    if (success) {
      loadTranscription();
    } else {
      setIsManualInput(true);
      setIsTranscribing(false);
    }
  };

  const handleRetryTranscription = async () => {
    try {
      setIsTranscribing(true);
      setIsManualInput(false);
      setError(null);

      // Mettre à jour le statut
      const { error: updateError } = await supabase
        .from('document_contents')
        .update({
          content: "Pour les fichiers audio, une transcription est en cours. Veuillez patienter...",
          extraction_status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('document_id', document.id);

      if (updateError) throw updateError;

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
          .eq('document_id', document.id);

        if (contentError) throw contentError;
        
        setTranscription(result.transcription);
        setIsTranscribing(false);
        onTranscriptionComplete(result.transcription);
      } else {
        throw new Error('Aucune transcription retournée');
      }
    } catch (error) {
      console.error('Erreur lors de la relance de la transcription:', error);
      setError('Erreur lors de la transcription. Veuillez réessayer ou saisir manuellement la transcription.');
      setIsTranscribing(false);
      setIsManualInput(true);
      
      // Mettre à jour le statut en échec
      try {
        await supabase
          .from('document_contents')
          .update({
            content: "Ce document est un fichier audio. La transcription automatique a échoué. Veuillez saisir manuellement la transcription.",
            extraction_status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('document_id', document.id);
      } catch (updateError) {
        console.error('Erreur lors de la mise à jour du statut:', updateError);
      }
    }
  };

  const handleSaveManualTranscription = async () => {
    if (!manualTranscription.trim()) return;
    
    try {
      setIsLoading(true);
      setError(null);

      // Mettre à jour le contenu avec la transcription manuelle
      const { error } = await supabase
        .from('document_contents')
        .update({
          content: manualTranscription,
          extraction_status: 'manual',
          updated_at: new Date().toISOString()
        })
        .eq('document_id', document.id);

      if (error) throw error;
      
      setTranscription(manualTranscription);
      setIsManualInput(false);
      onTranscriptionComplete(manualTranscription);
    } catch (err) {
      console.error('Erreur lors de l\'enregistrement de la transcription manuelle:', err);
      setError('Erreur lors de l\'enregistrement de la transcription');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl w-[95vw] max-w-4xl h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <AudioIcon className="text-[#f15922]" size={24} />
            <h2 className="text-xl font-semibold text-[#2F4F4F]">Transcription audio</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f15922]"></div>
                <p className="mt-4 text-gray-600">Chargement de la transcription...</p>
              </div>
            </div>
          ) : isTranscribing ? (
            <div className="max-w-3xl mx-auto">
              <TranscriptionProgress 
                documentId={document.id} 
                onComplete={handleTranscriptionComplete}
              />
              
              <div className="mt-8">
                <h3 className="text-lg font-medium text-gray-800 mb-3">Informations sur le fichier</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AudioIcon className="text-[#f15922]" size={16} />
                    <span className="text-sm font-medium text-gray-700">{document.name}</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Taille: {(document.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <p className="text-sm text-gray-600">
                    Date: {new Date(document.created_at).toLocaleString()}
                  </p>
                  
                  <div className="mt-4">
                    <a 
                      href={document.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Écouter le fichier audio
                    </a>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 text-center">
                <p className="text-gray-600 mb-4">
                  Vous pouvez également saisir manuellement la transcription si vous le souhaitez.
                </p>
                <button
                  onClick={() => setIsManualInput(true)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Saisir manuellement
                </button>
              </div>
            </div>
          ) : isManualInput ? (
            <div className="max-w-3xl mx-auto">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-800 mb-2">Saisie manuelle de la transcription</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Veuillez saisir ou coller la transcription du fichier audio ci-dessous.
                </p>
                
                {error && (
                  <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded mb-4">
                    {error}
                  </div>
                )}
                
                <textarea
                  value={manualTranscription}
                  onChange={(e) => setManualTranscription(e.target.value)}
                  placeholder="Saisissez la transcription ici..."
                  className="w-full h-64 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f15922] focus:border-transparent resize-none"
                  disabled={isLoading}
                ></textarea>
              </div>
              
              <div className="flex items-center justify-between">
                <button
                  onClick={handleRetryTranscription}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                  disabled={isLoading}
                >
                  <RefreshCw size={16} />
                  Réessayer la transcription automatique
                </button>
                
                <button
                  onClick={handleSaveManualTranscription}
                  className="px-4 py-2 bg-[#f15922] text-white rounded-lg hover:bg-[#d14811] transition-colors flex items-center gap-2"
                  disabled={isLoading || !manualTranscription.trim()}
                >
                  <Save size={16} />
                  Enregistrer la transcription
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-800 mb-2">Transcription</h3>
                <div className="p-4 bg-gray-50 rounded-lg whitespace-pre-wrap text-gray-700">
                  {transcription || "Aucune transcription disponible."}
                </div>
              </div>
              
              <div className="mt-8">
                <h3 className="text-lg font-medium text-gray-800 mb-3">Informations sur le fichier</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AudioIcon className="text-[#f15922]" size={16} />
                    <span className="text-sm font-medium text-gray-700">{document.name}</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Taille: {(document.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <p className="text-sm text-gray-600">
                    Date: {new Date(document.created_at).toLocaleString()}
                  </p>
                  
                  <div className="mt-4">
                    <a 
                      href={document.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Écouter le fichier audio
                    </a>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 flex items-center justify-between">
                <button
                  onClick={() => setIsManualInput(true)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Modifier la transcription
                </button>
                
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-[#f15922] text-white rounded-lg hover:bg-[#d14811] transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};