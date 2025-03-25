import { useState, useCallback } from 'react';

export interface ModalState<T = any> {
  isOpen: boolean;
  data: T | null;
}

export function useModalState<T = any>(initialState: boolean = false) {
  const [state, setState] = useState<ModalState<T>>({
    isOpen: initialState,
    data: null
  });

  const open = useCallback((data: T | null = null) => {
    setState({ isOpen: true, data });
  }, []);

  const close = useCallback(() => {
    setState({ isOpen: false, data: null });
  }, []);

  const setData = useCallback((data: T | null) => {
    setState(prev => ({ ...prev, data }));
  }, []);

  return {
    isOpen: state.isOpen,
    data: state.data,
    open,
    close,
    setData
  };
}