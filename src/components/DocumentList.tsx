import React, { useState } from 'react';
import { FileText, X, ChevronDown, ChevronUp, FileSpreadsheet, FileAudio, Globe, FileCode, FileImage } from 'lucide-react';
import { ConversationDocument } from '../lib/conversationStore';
import { MAX_DOCUMENTS_PER_CONVERSATION } from '../lib/constants';

interface DocumentListProps {
  documents: ConversationDocument[];
  onRemove: (documentId: string) => void;
}

const getDocumentIcon = (type: string) => {
  switch (type) {
    case 'pdf':
      return <FileText size={16} className="text-red-500" />;
    case 'doc':
      return <FileText size={16} className="text-blue-500" />;
    case 'data':
      return <FileSpreadsheet size={16} className="text-green-500" />;
    case 'audio':
      return <FileAudio size={16} className="text-purple-500" />;
    case 'presentation':
      return <FileImage size={16} className="text-orange-500" />;
    case 'web':
      return <Globe size={16} className="text-cyan-500" />;
    default:
      return <FileCode size={16} className="text-gray-500" />;
  }
};

export function DocumentList({ documents, onRemove }: DocumentListProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (documents.length === 0) return null;

  // Grouper les documents par type
  const documentsByType = documents.reduce((acc, doc) => {
    const type = doc.documents.type || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(doc);
    return acc;
  }, {} as Record<string, ConversationDocument[]>);

  return (
    <div className="flex-shrink-0 bg-gradient-to-b from-gray-50 to-white border-b border-gray-200 shadow-sm">
      <div className="px-4 py-3">
        <div 
          className="flex items-center justify-between cursor-pointer group"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <FileText size={18} className="text-[#f15922]" />
              <span>Documents actifs</span>
              <span className={`px-2 py-0.5 ${documents.length >= MAX_DOCUMENTS_PER_CONVERSATION ? 'bg-orange-500' : 'bg-[#f15922]'} text-white text-xs rounded-full font-semibold`}>
                {documents.length}/{MAX_DOCUMENTS_PER_CONVERSATION}
              </span>
            </div>
            {documents.length > 1 && (
              <span className="text-xs text-gray-500 ml-2">
                (Analyse croisée activée)
              </span>
            )}
          </div>
          <div className="text-gray-400 group-hover:text-gray-600 transition-colors">
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
        
        {isExpanded && (
          <div className="mt-3 space-y-2">
            {documents.length >= MAX_DOCUMENTS_PER_CONVERSATION && (
              <div className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mb-3">
                <strong>Limite atteinte :</strong> Maximum {MAX_DOCUMENTS_PER_CONVERSATION} documents par conversation.
              </div>
            )}
            
            {documents.length > 6 && documents.length < MAX_DOCUMENTS_PER_CONVERSATION && (
              <div className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3">
                <strong>Mode avancé activé :</strong> Avec {documents.length} documents, j'utilise mes capacités étendues pour une analyse approfondie sans compression.
              </div>
            )}
            
            {documents.length > 1 && documents.length <= 6 && (
              <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-3">
                <strong>Astuce :</strong> Demandez-moi de comparer, synthétiser ou croiser les informations entre ces documents.
              </div>
            )}
            
            {Object.entries(documentsByType).map(([type, docs]) => (
              <div key={type} className="space-y-1">
                {docs.map((doc) => (
              <div
                key={doc.document_id}
                    className="group/item flex items-start gap-2 p-2 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-all"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {getDocumentIcon(doc.documents.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {doc.documents.name}
                      </p>
                      {doc.documents.processed && (
                        <p className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                          Prêt pour l'analyse
                        </p>
                      )}
                    </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(doc.document_id);
                  }}
                      className="opacity-0 group-hover/item:opacity-100 p-1 hover:bg-gray-100 rounded transition-all"
                      title="Retirer ce document de la conversation"
                >
                      <X size={14} className="text-gray-400 hover:text-gray-600" />
                </button>
                  </div>
                ))}
              </div>
            ))}
            
            {documents.length > 3 && (
              <div className="text-xs text-gray-500 text-center pt-2">
                Tous les documents sont chargés et prêts pour l'analyse
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}