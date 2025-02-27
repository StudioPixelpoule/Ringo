import React from 'react';
import { DocumentBadge } from './DocumentBadge';
import type { Document } from '../lib/types';

interface DocumentsPanelProps {
  documents: Array<{
    document: Document;
    content: string;
  }>;
  currentDocument: Document | null;
  onSelectDocument: (document: Document) => void;
  onRemoveDocument?: (document: Document) => void;
}

export const DocumentsPanel: React.FC<DocumentsPanelProps> = ({
  documents,
  currentDocument,
  onSelectDocument,
  onRemoveDocument
}) => {
  if (documents.length === 0) {
    return null;
  }

  return (
    <div className="bg-[#f8f7f2] p-2 border-t border-gray-200">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center">
          <span className="text-sm text-gray-600 mr-2">Documents partagés:</span>
          <div className="flex flex-wrap gap-2">
            {documents.map((doc) => (
              <DocumentBadge
                key={doc.document.id}
                document={doc.document}
                isActive={currentDocument?.id === doc.document.id}
                onClick={() => onSelectDocument(doc.document)}
                showRemove={!!onRemoveDocument}
                onRemove={onRemoveDocument ? () => onRemoveDocument(doc.document) : undefined}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};