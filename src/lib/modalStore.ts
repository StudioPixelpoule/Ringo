import { create } from 'zustand';

export type ModalType = 
  | 'userManagement'
  | 'documentImport'
  | 'fileManagement'
  | 'fileExplorer'
  | 'templateManager'
  | 'websiteImport'
  | 'errorLog'
  | 'createUser'
  | 'addUser'
  | 'deleteConfirmation'
  | 'reportPreview'
  | 'folder';

interface ModalData {
  [key: string]: any;
}

interface ModalState {
  activeModals: Set<ModalType>;
  modalData: Record<ModalType, ModalData | null>;
  isOpen: (modal: ModalType) => boolean;
  openModal: (modal: ModalType, data?: ModalData) => void;
  closeModal: (modal: ModalType) => void;
  closeAll: () => void;
  getModalData: (modal: ModalType) => ModalData | null;
  setModalData: (modal: ModalType, data: ModalData) => void;
}

export const useModalStore = create<ModalState>((set, get) => ({
  activeModals: new Set(),
  modalData: {
    userManagement: null,
    documentImport: null,
    fileManagement: null,
    fileExplorer: null,
    templateManager: null,
    websiteImport: null,
    errorLog: null,
    createUser: null,
    addUser: null,
    deleteConfirmation: null,
    reportPreview: null,
    folder: null
  },

  isOpen: (modal) => get().activeModals.has(modal),

  openModal: (modal, data = null) => {
    set(state => ({
      activeModals: new Set(state.activeModals).add(modal),
      modalData: {
        ...state.modalData,
        [modal]: data
      }
    }));
  },

  closeModal: (modal) => {
    set(state => {
      const newModals = new Set(state.activeModals);
      newModals.delete(modal);
      return {
        activeModals: newModals,
        modalData: {
          ...state.modalData,
          [modal]: null
        }
      };
    });
  },

  closeAll: () => {
    set(state => ({
      activeModals: new Set(),
      modalData: Object.keys(state.modalData).reduce((acc, key) => ({
        ...acc,
        [key]: null
      }), {} as Record<ModalType, ModalData | null>)
    }));
  },

  getModalData: (modal) => get().modalData[modal],

  setModalData: (modal, data) => {
    set(state => ({
      modalData: {
        ...state.modalData,
        [modal]: data
      }
    }));
  }
}));

// Hook for modal management
export function useModal(modalType: ModalType) {
  const store = useModalStore();
  
  return {
    isOpen: store.isOpen(modalType),
    open: (data?: ModalData) => store.openModal(modalType, data),
    close: () => store.closeModal(modalType),
    data: store.getModalData(modalType),
    setData: (data: ModalData) => store.setModalData(modalType, data)
  };
}