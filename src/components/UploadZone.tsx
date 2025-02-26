import React, { useState } from 'react';
import { Upload, Check, AlertCircle } from 'lucide-react';

interface UploadZoneProps {
  isUploading: boolean;
  uploadError: string | null;
  onFileSelect: (file: File) => void;
  selectedFolder: string;
  selectedFile: File | null;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  isUploading,
  uploadError,
  onFileSelect,
  selectedFolder,
  selectedFile
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  // Si un fichier est sélectionné, afficher l'état de sélection
  if (selectedFile) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-[#2F4F4F]">
            Document sélectionné
          </h2>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-[#f15922] rounded-full flex items-center justify-center mb-4">
            <Check className="text-white" size={32} />
          </div>
          
          <h3 className="text-xl font-medium text-gray-800 mb-2">
            {selectedFile.name}
          </h3>
          
          <p className="text-gray-500 mb-8">
            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
          </p>

          {!selectedFolder ? (
            <div className="bg-blue-50 p-4 rounded-lg text-blue-700 max-w-md">
              <AlertCircle className="mx-auto mb-2" size={24} />
              <p className="font-medium">Choisissez un dossier</p>
              <p className="text-sm opacity-75">
                Sélectionnez un dossier de destination dans la colonne centrale
              </p>
            </div>
          ) : (
            <div className="bg-green-50 p-4 rounded-lg text-green-700 max-w-md">
              <Check className="mx-auto mb-2" size={24} />
              <p className="font-medium">Dossier sélectionné :</p>
              <p className="text-sm opacity-75">{selectedFolder}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-[#2F4F4F]">
          Téléverser un document
        </h2>
      </div>

      {uploadError && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
          <p className="font-medium">Une erreur est survenue</p>
          <p className="text-sm mt-1">{uploadError}</p>
        </div>
      )}

      <div
        className={`
          flex-1 border-2 border-dashed rounded-xl transition-all duration-300
          flex flex-col items-center justify-center
          ${isDragging 
            ? 'border-[#f15922] bg-[#fff5f2]' 
            : isUploading 
              ? 'border-[#f15922] bg-[#fff5f2]' 
              : 'border-gray-200 hover:border-[#f15922] hover:bg-[#fff5f2]'
          }
        `}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div className="text-center p-8">
          <div className="mb-4">
            <Upload 
              className={`mx-auto ${isUploading || isDragging ? 'text-[#f15922]' : 'text-gray-400'}`}
              size={64}
            />
          </div>
          
          <div className="space-y-2 mb-6">
            <p className="text-xl font-medium text-gray-700">
              {isUploading ? 'Upload en cours...' : isDragging ? 'Déposez ici' : 'Déposez votre fichier ici'}
            </p>
            <p className="text-gray-500">
              ou
            </p>
          </div>

          <label className={`
            inline-flex items-center px-8 py-4 rounded-xl
            transition-all duration-300 cursor-pointer
            ${isUploading
              ? 'bg-[#f15922]/50 text-white cursor-not-allowed'
              : 'bg-[#f15922] text-white hover:bg-[#d14811] active:transform active:scale-95'
            }
          `}>
            <input
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              disabled={isUploading}
            />
            <span className="text-lg font-medium">
              {isUploading ? 'Upload en cours...' : 'Parcourir'}
            </span>
          </label>
        </div>
      </div>

      {isUploading && (
        <div className="mt-6">
          <div className="w-full bg-[#f15922]/20 rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-[#f15922] transition-all duration-300"
              style={{ width: '50%' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};