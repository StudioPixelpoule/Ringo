import React, { useState, useEffect } from 'react';
import { X, Folder, FolderPlus } from 'lucide-react';
import { motion } from 'framer-motion';

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
  title: string;
  initialValue?: string;
  mode: 'create' | 'rename';
  parentFolder?: string;
}

export function FolderModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  initialValue = '',
  mode,
  parentFolder
}: FolderModalProps) {
  const [folderName, setFolderName] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFolderName(initialValue);
      setError(null);
    }
  }, [isOpen, initialValue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = folderName.trim();
    
    if (!trimmedName) {
      setError('Le nom du dossier est requis');
      return;
    }

    if (trimmedName.length > 50) {
      setError('Le nom du dossier ne doit pas dépasser 50 caractères');
      return;
    }

    if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmedName)) {
      setError('Le nom du dossier ne peut contenir que des lettres, chiffres, espaces, tirets et underscores');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit(trimmedName);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden"
      >
        <div className="bg-[#f15922] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            {mode === 'create' ? <FolderPlus size={24} /> : <Folder size={24} />}
            {title}
          </h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {parentFolder && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
              <span className="text-gray-600">Dossier parent :</span>
              <span className="ml-2 font-medium text-gray-900">{parentFolder}</span>
            </div>
          )}

          <div className="mb-6">
            <label htmlFor="folderName" className="block text-sm font-medium text-gray-700 mb-1">
              Nom du dossier
            </label>
            <input
              type="text"
              id="folderName"
              value={folderName}
              onChange={(e) => {
                setFolderName(e.target.value);
                setError(null);
              }}
              className={`
                w-full px-4 py-2 rounded-lg border
                ${error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-[#f15922]'}
                focus:outline-none focus:ring-2 focus:border-transparent
                transition-colors
              `}
              placeholder="Entrez le nom du dossier"
              autoFocus
              disabled={isSubmitting}
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !folderName.trim()}
              className="px-4 py-2 bg-[#f15922] text-white rounded-lg hover:bg-[#f15922]/90 focus:outline-none focus:ring-2 focus:ring-[#f15922] disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>En cours...</span>
                </>
              ) : mode === 'create' ? (
                'Créer le dossier'
              ) : (
                'Renommer'
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}