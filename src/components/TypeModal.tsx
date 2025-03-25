import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { ReportType } from '../lib/reportTypeService';

interface TypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (type: Omit<ReportType, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  title: string;
  type?: ReportType;
}

export function TypeModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  type
}: TypeModalProps) {
  const [name, setName] = useState(type?.name || '');
  const [description, setDescription] = useState(type?.description || '');
  const [isActive, setIsActive] = useState(type?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(type?.name || '');
      setDescription(type?.description || '');
      setIsActive(type?.is_active ?? true);
      setError(null);
    }
  }, [isOpen, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = name.trim();
    
    if (!trimmedName) {
      setError('Le nom du type est requis');
      return;
    }

    if (trimmedName.length > 50) {
      setError('Le nom ne doit pas dépasser 50 caractères');
      return;
    }

    if (!/^[a-z0-9_]+$/.test(trimmedName)) {
      setError('Le nom ne peut contenir que des lettres minuscules, chiffres et underscores');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit({
        name: trimmedName,
        description: description.trim(),
        is_active: isActive,
        order: type?.order || 999 // High number for new types
      });
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="bg-[#f15922] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">
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
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Nom*
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value.toLowerCase());
                  setError(null);
                }}
                className={`
                  w-full px-4 py-2 rounded-lg border
                  ${error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-[#f15922]'}
                  focus:outline-none focus:ring-2 focus:border-transparent
                  transition-colors
                `}
                placeholder="ex: summary"
                autoFocus
                disabled={isSubmitting}
              />
              <p className="mt-1 text-xs text-gray-500">
                Lettres minuscules, chiffres et underscores uniquement
              </p>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-[#f15922] focus:outline-none focus:ring-2 focus:border-transparent"
                placeholder="Description du type de rapport"
                disabled={isSubmitting}
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 text-[#f15922] focus:ring-[#f15922] rounded"
                disabled={isSubmitting}
              />
              <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
                Type actif
              </label>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3">
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
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-2 bg-[#f15922] text-white rounded-lg hover:bg-[#f15922]/90 focus:outline-none focus:ring-2 focus:ring-[#f15922] disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>En cours...</span>
                </>
              ) : (
                <>
                  <Save size={18} />
                  <span>Enregistrer</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}