import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useModalStore, ModalType } from '../lib/modalStore';

interface ModalContextValue {
  openModal: (type: ModalType, data?: any) => void;
  closeModal: (type: ModalType) => void;
  isModalOpen: (type: ModalType) => boolean;
  getModalData: (type: ModalType) => any;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const store = useModalStore();

  const value = useMemo(() => ({
    openModal: store.openModal,
    closeModal: store.closeModal,
    isModalOpen: store.isOpen,
    getModalData: store.getModalData
  }), [store]);

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModalContext() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModalContext must be used within a ModalProvider');
  }
  return context;
}