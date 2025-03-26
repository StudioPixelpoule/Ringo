import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { modalVariants, transition } from '../lib/animations';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showClose?: boolean;
  headerClassName?: string;
  contentClassName?: string;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-7xl',
  full: 'w-[90vw] h-[90vh]'
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showClose = true,
  headerClassName = 'bg-[#f15922]',
  contentClassName = ''
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={transition}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      >
        <motion.div
          variants={modalVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className={`bg-white rounded-xl shadow-xl mx-4 overflow-hidden ${sizeClasses[size]}`}
        >
          <div className={`px-6 py-4 flex items-center justify-between ${headerClassName}`}>
            <h2 className="text-xl font-semibold text-white">
              {title}
            </h2>
            {showClose && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
              >
                <X size={20} />
              </motion.button>
            )}
          </div>

          <div className={`overflow-y-auto ${contentClassName}`}>
            {children}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}