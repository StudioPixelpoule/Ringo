import React, { useState } from 'react';
import { Tag, Users, FileText, Upload } from 'lucide-react';

interface DocumentMetadataProps {
  onMetadataChange: (metadata: {
    type: string;
    group: string;
    description: string;
  }) => void;
  onUpload: () => void;
  isEnabled: boolean;
  selectedFile: File | null;
  selectedFolder: string;
}

const DOCUMENT_TYPES = [
  { value: 'CR', label: 'Compte-rendu' },
  { value: 'SOND', label: 'Résultat de sondage' },
  { value: 'RAPPORT', label: 'Rapport d\'analyse' },
  { value: 'TABLEAU', label: 'Données tabulaires' },
  { value: 'TRANS', label: 'Transcription' },
  { value: 'AUDIO', label: 'Enregistrement sonore' }
];

const GROUP_TYPES = [
  { value: 'CA', label: 'Conseil d\'administration' },
  { value: 'CS', label: 'Conseil scientifique' },
  { value: 'IRSST', label: 'Personnel interne' },
  { value: 'CNESST', label: 'Partenaire institutionnel' },
  { value: 'EXT', label: 'Recherche externe' }
];

export const DocumentMetadata: React.FC<DocumentMetadataProps> = ({ 
  onMetadataChange, 
  onUpload,
  isEnabled,
  selectedFile,
  selectedFolder
}) => {
  const [metadata, setMetadata] = useState({
    type: '',
    group: '',
    description: ''
  });

  const handleChange = (field: string, value: string) => {
    const newMetadata = { ...metadata, [field]: value };
    setMetadata(newMetadata);
    onMetadataChange(newMetadata);
  };

  const isValid = metadata.type && metadata.group && metadata.description;

  if (!isEnabled) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-sm">
          <FileText className="mx-auto text-gray-300 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            En attente d'un document
          </h3>
          <p className="text-gray-500 text-sm">
            Sélectionnez un fichier et un dossier de destination pour commencer l'indexation
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-6 flex flex-col">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[#2F4F4F] mb-2">
          Indexation du document
        </h2>
        <div className="text-sm text-gray-500">
          <p>Fichier : <span className="font-medium text-gray-700">{selectedFile?.name}</span></p>
          <p>Dossier : <span className="font-medium text-gray-700">{selectedFolder}</span></p>
        </div>
      </div>

      <div className="flex-1 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <FileText size={16} className="text-[#f15922]" />
            Type de document
          </label>
          <select
            value={metadata.type}
            onChange={(e) => handleChange('type', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#f15922] focus:border-transparent transition-all"
          >
            <option value="">Sélectionner un type</option>
            {DOCUMENT_TYPES.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Users size={16} className="text-[#f15922]" />
            Groupe concerné
          </label>
          <select
            value={metadata.group}
            onChange={(e) => handleChange('group', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#f15922] focus:border-transparent transition-all"
          >
            <option value="">Sélectionner un groupe</option>
            {GROUP_TYPES.map(group => (
              <option key={group.value} value={group.value}>
                {group.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Tag size={16} className="text-[#f15922]" />
            Description
          </label>
          <textarea
            value={metadata.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Description du document (utilisez _ au lieu des espaces)"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#f15922] focus:border-transparent transition-all resize-none h-32"
          />
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-100">
        <button
          onClick={onUpload}
          disabled={!isValid}
          className={`
            w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2
            transition-all duration-300
            ${isValid
              ? 'bg-[#f15922] text-white hover:bg-[#d14811]'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          <Upload size={20} />
          <span className="font-medium">Téléverser le document</span>
        </button>
      </div>
    </div>
  );
};