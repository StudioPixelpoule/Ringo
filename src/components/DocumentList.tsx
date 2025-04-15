import React, { useState } from 'react';
import { FileText, X, ChevronDown, ChevronUp } from 'lucide-react';
import { ConversationDocument } from '../lib/conversationStore';

interface DocumentListProps {
  documents: ConversationDocument[];
  onRemove: (documentId: string) => void;
}

export function DocumentList({ documents, onRemove }: DocumentListProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (documents.length === 0) return null;

  return (
    <div className="flex-shrink-0 bg-gray-50/50 border-b border-gray-200">
      <div className="px-4 py-2">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FileText size={16} />
            <span>Documents de la conversation :</span>
          </div>
          <div className="text-gray-500">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
        
        {isExpanded && (
          <div className="mt-2 flex flex-wrap gap-2">
            {documents.map((doc) => (
              <div
                key={doc.document_id}
                className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-gray-200 rounded-full text-sm shadow-sm"
              >
                <span className="truncate max-w-[200px]">{doc.documents.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(doc.document_id);
                  }}
                  className="p-0.5 hover:bg-gray-100 rounded-full"
                  title="Retirer le document"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}