import React from 'react';
import { File, FileText, FileSpreadsheet, File as FilePdf } from 'lucide-react';
import type { Document } from '../lib/types';

interface DocumentBadgeProps {
  document: Document;
  onClick?: () => void;
  isActive?: boolean;
  showRemove?: boolean;
  onRemove?: () => void;
}

export const DocumentBadge: React.FC<DocumentBadgeProps> = ({ 
  document, 
  onClick, 
  isActive = false,
  showRemove = false,
  onRemove
}) => {
  // Fonction pour obtenir l'icône appropriée en fonction du type de fichier
  const getFileIcon = () => {
    const extension = document.name.split('.').pop()?.toLowerCase();
    
    if (['doc', 'docx', 'txt', 'rtf'].includes(extension || '')) {
      return <FileText className="flex-shrink-0" size={14} />;
    } else if (['xls', 'xlsx', 'csv'].includes(extension || '')) {
      return <FileSpreadsheet className="flex-shrink-0" size={14} />;
    } else if (extension === 'pdf') {
      return <FilePdf className="flex-shrink-0" size={14} />;
    } else {
      return <File className="flex-shrink-0" size={14} />;
    }
  };

  return (
    <div 
      className={`
        px-2 py-1 rounded-full flex items-center gap-1.5 text-xs transition-colors
        ${isActive 
          ? 'bg-[#f15922] text-white' 
          : 'bg-[#dba747] text-white hover:bg-[#c99735] cursor-pointer'
        }
        ${onClick ? 'cursor-pointer' : ''}
      `}
      onClick={onClick}
    >
      {getFileIcon()}
      <span className="truncate max-w-[150px]">{document.name}</span>
      
      {showRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          className="ml-1 p-0.5 rounded-full hover:bg-white/20 text-white"
          title="Retirer de la conversation"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
    </div>
  );
};