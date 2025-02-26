import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'default' | 'large';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, size = 'default' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div 
        className={`
          relative z-50 bg-white rounded-2xl shadow-xl w-full mx-4
          ${size === 'large' ? 'max-w-7xl max-h-[90vh]' : 'max-w-md'}
          flex flex-col overflow-hidden
        `}
      >
        {children}
      </div>
    </div>
  );
};