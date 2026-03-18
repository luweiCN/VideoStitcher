/**
 * ConfirmDialogProvider
 * 全局确认对话框上下文提供者
 *
 * 在应用根组件使用：
 * <ConfirmDialogProvider>
 *   <App />
 * </ConfirmDialogProvider>
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

interface ConfirmDialogContextValue {
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

/**
 * 确认对话框上下文 Hook
 * 仅供 useConfirm 内部使用
 */
export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error('useConfirmDialog must be used within ConfirmDialogProvider');
  }
  return context;
}

interface ConfirmDialogProviderProps {
  children: ReactNode;
}

/**
 * 确认对话框提供者组件
 */
export function ConfirmDialogProvider({ children }: ConfirmDialogProviderProps) {
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
  });

  const showConfirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        ...options,
        isOpen: true,
        onConfirm: () => {
          resolve(true);
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        },
        onCancel: () => {
          resolve(false);
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        },
      });
    });
  }, []);

  const value = {
    showConfirm,
  };

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        onClose={confirmState.onCancel}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        variant={confirmState.variant}
      />
    </ConfirmDialogContext.Provider>
  );
}
