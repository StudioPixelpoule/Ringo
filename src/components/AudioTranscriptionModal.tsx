import React, { useState, useEffect } from 'react';
import { X, BookAudioIcon as AudioIcon, RefreshCw, Save, Info } from 'lucide-react';
import { TranscriptionProgress } from './TranscriptionProgress';
import { supabase } from '../lib/supabase';
import type { Document } from '../lib/types';
import { processAudioForTranscription } from '../lib/audioProcessor';
import { logger } from '../lib/logger';

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
  const [fileSize, setFileSize] = useState<number>(0);
  const [isLargeFile, setIsLargeFile] = useState<boolean>(false);
  const [transcriptionAttempts, setTranscriptionAttempts] = useState<number>(0);
  const [showTips, setShowTips] = useState<boolean>(false);

  // Charger le contenu actuel
  useEffect(() => {
    if (isOpen && document) {
      loadTranscription();
      checkFileSize();
    }
  }, [isOpen, document]);

  const checkFileSize = async () => {
    try {
      // Utiliser la taille du document si disponible
      if (document.size) {
        setFileSize(document.size);
        setIsLargeFile(document.size > 25 * 1024 * 1024); // 25MB
        return;
      }
      
      // Sinon, essayer de récupérer la taille via une requête HEAD
      try {
        const response = await fetch(document.url, { method: 'HEAD' });
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          const size = parseInt(contentLength, 10);
          setFileSize(size);
          setIsLargeFile(size > 25 * 1024 * 1024); // 25MB
        }
      } catch (fetchError) {
        console.error('[AUDIO_MODAL] Erreur lors de la requête HEAD:', fetchError);
        // Si la requête HEAD échoue, on suppose que c'est un fichier volumineux
        setIsLargeFile(true);
      }
    } catch (error) {
      console.error('[AUDIO_MODAL] Erreur lors de la vérification de la taille du fichier:', error);
      logger.error('Erreur lors de la vérification de la taille du fichier audio', 
        { documentId: document.id, documentName: document.name, error }, 
        'AudioTranscriptionModal');
    }
  };

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
        if (data.content.includes("Transcription en cours")) {
          setIsTranscribing(true);
        } else if (data.content.includes("transcription automatique a échoué") || 
                  data.content.includes("erreur s'est produite") ||
                  data.extraction_status === 'failed' ||
                  data.extraction_status === 'manual') {
          setIsManualInput(true);
          setManualTranscription('');
        } else if (data.extraction_status === 'success') {
          setIsTranscribing(false);
          setIsManualInput(false);
        } else {
          setIsTranscribing(true);
        }
      }
    } catch (err) {
      console.error('Erreur lors du chargement de la transcription:', err);
      logger.error('Erreur lors du chargement de la transcription', 
        { documentId: document.id, documentName: document.name, error: err }, 
        'AudioTranscriptionModal');
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
      setTranscriptionAttempts(prev => prev + 1);
      setIsTranscribing(true);
      setIsManualInput(false);
      setError(null);

      // Mettre à jour le statut
      const { error: updateError } = await supabase
        .from('document_contents')
        .update({
          content: "Transcription en cours: Préparation du fichier audio... (0%)",
          extraction_status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('document_id', document.id);

      if (updateError) throw updateError;

      // Lancer la transcription avec le nouveau processeur audio
      try {
        logger.info('Lancement de la transcription audio', 
          { documentId: document.id, documentName: document.name, attempt: transcriptionAttempts + 1 }, 
          'AudioTranscriptionModal');
        
        const transcription = await processAudioForTranscription(document.url, document.id);
        
        // La mise à jour du contenu est déjà gérée par processAudioForTranscription
        setTranscription(transcription);
        setIsTranscribing(false);
        onTranscriptionComplete(transcription);
        
        logger.info('Transcription audio réussie', 
          { documentId: document.id, documentName: document.name, transcriptionLength: transcription.length }, 
          'AudioTranscriptionModal');
      } catch (transcriptionError) {
        console.error('[AUDIO_MODAL] Erreur lors de la transcription:', transcriptionError);
        logger.error('Erreur lors de la transcription audio', 
          { documentId: document.id, documentName: document.name, error: transcriptionError, attempt: transcriptionAttempts + 1 }, 
          'AudioTranscriptionModal');
        throw transcriptionError;
      }
    } catch (error) {
      console.error('[AUDIO_MODAL] Erreur lors de la relance de la transcription:', error);
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
        console.error('[AUDIO_MODAL] Erreur lors de la mise à jour du statut:', updateError);
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
          extraction_status: 'success', // Marquer comme succès pour qu'il apparaisse dans la mindmap
          updated_at: new Date().toISOString()
        })
        .eq('document_id', document.id);

      if (error) throw error;
      
      setTranscription(manualTranscription);
      setIsManualInput(false);
      onTranscriptionComplete(manualTranscription);
      
      logger.info('Transcription manuelle enregistrée', 
        { documentId: document.id, documentName: document.name, transcriptionLength: manualTranscription.length }, 
        'AudioTranscriptionModal');
    } catch (err) {
      console.error('Erreur lors de l\'enregistrement de la transcription manuelle:', err);
      logger.error('Erreur lors de l\'enregistrement de la transcription manuelle', 
        { documentId: document.id, documentName: document.name, error: err }, 
        'AudioTranscriptionModal');
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
                    Taille: {(fileSize / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <p className="text-sm text-gray-600">
                    Date: {new Date(document.created_at).toLocaleString()}
                  </p>
                  
                  {isLargeFile && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg text-blue-700 text-sm">
                      <p className="font-medium">Fichier volumineux détecté</p>
                      <p className="mt-1">
                        Ce fichier audio est volumineux ({(fileSize / 1024 / 1024).toFixed(2)} MB). 
                        La transcription sera effectuée par segments pour optimiser le traitement.
                      </p>
                    </div>
                  )}
                  
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
              
              {/* Conseils pour améliorer la transcription */}
              <div className="mt-8">
                <button 
                  onClick={() => setShowTips(!showTips)}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <Info size={16} />
                  <span>{showTips ? "Masquer les conseils" : "Conseils pour améliorer la transcription"}</span>
                </button>
                
                {showTips && (
                  <div className="mt-3 p-4 bg-blue-50 rounded-lg text-blue-700 text-sm">
                    <h4 className="font-medium mb-2">Conseils pour une meilleure transcription</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Assurez-vous que le fichier audio est de bonne qualité, sans bruits de fond excessifs</li>
                      <li>Les fichiers plus courts (moins de 10 minutes) sont généralement transcrits plus rapidement</li>
                      <li>Si la transcription échoue, essayez de découper le fichier audio en segments plus courts</li>
                      <li>Les formats MP3 et WAV sont généralement mieux pris en charge</li>
                      <li>Si la transcription automatique échoue après plusieurs tentatives, la saisie manuelle reste une option fiable</li>
                    </ul>
                  </div>
                )}
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
              
              {/* Conseils pour la saisie manuelle */}
              <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-700 mb-2">Conseils pour la saisie manuelle</h4>
                <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                  <li>Utilisez la ponctuation pour améliorer la lisibilité</li>
                  <li>Séparez les paragraphes pour structurer le texte</li>
                  <li>Indiquez les changements de locuteurs si nécessaire (ex: "Interviewer:", "Répondant:")</li>
                  <li>Vous pouvez écouter le fichier audio en parallèle en l'ouvrant dans un nouvel onglet</li>
                </ul>
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
                    Taille: {(fileSize / 1024 / 1024).toFixed(2)} MB
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
              
              <div className="mt-8 flex justify-center">
                <button
                  onClick={handleRetryTranscription}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                  <RefreshCw size={16} />
                  Relancer la transcription
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};