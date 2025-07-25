import React from 'react';
import { X, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

interface InactivityWarningProps {
  remainingTime: number;
  onContinue: () => void;
  onClose: () => void;
}

export const InactivityWarning: React.FC<InactivityWarningProps> = ({
  remainingTime,
  onContinue,
  onClose
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-4 right-4 max-w-sm bg-white rounded-xl shadow-xl overflow-hidden z-50"
    >
      <div className="bg-[#f15922] px-4 py-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Clock size={20} />
          Session inactive
        </h3>
        <button
          onClick={onClose}
          className="header-neumorphic-button w-7 h-7 rounded-full flex items-center justify-center text-white"
          aria-label="Fermer"
        >
          <X size={16} />
        </button>
      </div>
      
      <div className="p-4">
        <p className="text-gray-700 mb-4">
          Vous allez être déconnecté dans{' '}
          <span className="font-bold text-[#f15922]">
            {remainingTime} seconde{remainingTime > 1 ? 's' : ''}
          </span>{' '}
          pour inactivité.
        </p>
        
        <button
          onClick={onContinue}
          className="w-full px-4 py-2 bg-[#f15922] text-white rounded-lg hover:bg-[#d94d1a] transition-colors font-medium"
        >
          Continuer la session
        </button>
        
        {/* Barre de progression */}
        <div className="mt-3 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-[#f15922] transition-all duration-1000 ease-linear"
            style={{ width: `${(remainingTime / 60) * 100}%` }}
          />
        </div>
      </div>
    </motion.div>
  );
}; 