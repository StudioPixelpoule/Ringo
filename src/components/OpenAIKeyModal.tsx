import React, { useState } from 'react';
import { X } from 'lucide-react';
import { OpenAIKeyForm } from './OpenAIKeyForm';

interface OpenAIKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (apiKey: string) => void;
}

export const OpenAIKeyModal: React.FC<OpenAIKeyModalProps> = ({ isOpen, onClose, onSave }) => {
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (apiKey: string) => {
    setIsSaving(true);
    try {
      await onSave(apiKey);
      onClose();
    } catch (error) {
      console.error('[OPENAI_MODAL] Error saving API key:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="relative">
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 p-2 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors"
          disabled={isSaving}
        >
          <X size={20} className="text-gray-500" />
        </button>
        <OpenAIKeyForm onSave={handleSave} onCancel={onClose} isSaving={isSaving} />
      </div>
    </div>
  );
};