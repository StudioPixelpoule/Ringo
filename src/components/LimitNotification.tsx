import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LimitNotificationProps {
  isOpen: boolean;
  onClose: () => void;
  maxSelectable: number;
  totalLimit: number;
}

export const LimitNotification: React.FC<LimitNotificationProps> = ({
  isOpen,
  onClose,
  maxSelectable,
  totalLimit
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
        >
          <div className="bg-[#f15922] px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <AlertTriangle size={24} />
              Limite de Documents
            </h2>
            <button
              onClick={onClose}
              className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                <AlertTriangle className="text-[#f15922]" size={24} />
              </div>
              <div>
                <p className="text-gray-700 mb-2">
                  {maxSelectable === 0 ? (
                    <>
                      Vous avez atteint la limite de <strong className="text-[#f15922]">{totalLimit} documents</strong> par conversation.
                    </>
                  ) : (
                    <>
                      Vous ne pouvez sélectionner que <strong className="text-[#f15922]">{maxSelectable} document{maxSelectable > 1 ? 's' : ''}</strong> supplémentaire{maxSelectable > 1 ? 's' : ''}.
                    </>
                  )}
                </p>
                <p className="text-sm text-gray-600">
                  Cette limite permet d'optimiser les performances et la qualité des réponses de RINGO.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-[#f15922] text-white rounded-lg hover:bg-[#d94d1a] transition-colors font-medium"
              >
                Compris
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}; 