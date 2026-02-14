import { useState, useCallback } from 'react';
import type { ModalType } from '@/types';

export function useModal(initialModal: ModalType = null) {
  const [activeModal, setActiveModal] = useState<ModalType>(initialModal);
  const [modalData, setModalData] = useState<Record<string, unknown>>({});

  const openModal = useCallback((modal: ModalType, data?: Record<string, unknown>) => {
    setActiveModal(modal);
    if (data) {
      setModalData(data);
    }
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setModalData({});
  }, []);

  const isOpen = useCallback((modal: ModalType) => {
    return activeModal === modal;
  }, [activeModal]);

  return {
    activeModal,
    modalData,
    openModal,
    closeModal,
    isOpen,
  };
}
