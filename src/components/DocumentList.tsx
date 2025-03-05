import React from 'react';
import { FileText, X } from 'lucide-react';
import { ConversationDocument } from '../lib/conversationStore';

interface DocumentListProps {
  documents: ConversationDocument[];
  onRemove: (documentId: string) => void;
}

export function DocumentList({ documents, onRemove }: DocumentListProps) {
  if (documents.length === 0) return null;

  return (
    <div className="flex-shrink-0 bg-gray-50/50 border-b border-gray-200">
      <div className="px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
          <FileText size={16} />
          <span>Documents de la conversation :</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {documents.map((doc) => (
            <div
              key={doc.document_id}
              className="document-tag"
            >
              <span className="truncate max-w-[200px]">{doc.documents.name}</span>
              <button
                onClick={() => onRemove(doc.document_id)}
                className="p-0.5 hover:bg-[#f15922]/20 rounded-full"
                title="Retirer le document"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}