import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import * as Toast from '@radix-ui/react-toast';
import { X, CheckCircle, XCircle, Info } from 'lucide-react';

/**
 * Toast 组件 - 基于 Radix UI
 *
 * 用于显示临时通知消息
 */

// ============================================================================
// 类型定义
// ============================================================================

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface ToastData {
  title?: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  showToast: (toast: ToastData) => void;
  dismiss: () => void;
}

const toastLimit = 3; // 同时显示的 toast 数量限制

// ============================================================================
// Toast Context
// ============================================================================

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

// ============================================================================
// Toast Provider
// ============================================================================

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Array<{ id: string; data: ToastData }>>([]);

  const showToast = useCallback((data: ToastData) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { id, data };

    setToasts(prev => {
      const filtered = prev.slice(-toastLimit + 1); // 限制数量
      return [...filtered, newToast];
    });

    // 自动关闭
    const duration = data.duration ?? 3000;
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, []);

  const dismiss = useCallback(() => {
    setToasts([]);
  }, []);

  // 创建 context 值
  const contextValue: ToastContextType = useMemo(() => ({
    showToast,
    dismiss
  }), [showToast, dismiss]);

  return (
    <ToastContext.Provider value={contextValue}>
      <Toast.Provider swipeDirection="right">
        {children}
        {toasts.map(({ id, data }) => (
          <ToastItem key={id} data={data} onDismiss={() => setToasts(prev => prev.filter(t => t.id !== id))} />
        ))}
        <Toast.Viewport className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[380px] max-w-[100vw] m-0 list-none" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
};

// ============================================================================
// Toast Item 组件
// ============================================================================

interface ToastItemProps {
  data: ToastData;
  onDismiss: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ data, onDismiss }) => {
  const { title, message, variant = 'info', action } = data;

  const variants = {
    success: {
      bg: 'bg-emerald-900/90',
      border: 'border-emerald-500/30',
      icon: <CheckCircle className="w-5 h-5 text-emerald-400" />,
      titleColor: 'text-emerald-400'
    },
    error: {
      bg: 'bg-rose-900/90',
      border: 'border-rose-500/30',
      icon: <XCircle className="w-5 h-5 text-rose-400" />,
      titleColor: 'text-rose-400'
    },
    info: {
      bg: 'bg-cyan-900/90',
      border: 'border-cyan-500/30',
      icon: <Info className="w-5 h-5 text-cyan-400" />,
      titleColor: 'text-cyan-400'
    },
    warning: {
      bg: 'bg-amber-900/90',
      border: 'border-amber-500/30',
      icon: <Info className="w-5 h-5 text-amber-400" />,
      titleColor: 'text-amber-400'
    }
  };

  const style = variants[variant];

  return (
    <Toast.Root
      duration={data.duration ?? 3000}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
      className={`
        ${style.bg} ${style.border}
        border rounded-lg shadow-2xl shadow-black/50
        flex items-start gap-3
        p-4
        data-[swipe=move]:translate-x-full
        data-[state=open]:animate-in
        data-[state=closed]:animate-out
      `}
    >
      {/* 图标 */}
      <div className={`shrink-0 mt-0.5`}>
        {style.icon}
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        {title && (
          <Toast.Title className={`text-sm font-semibold ${style.titleColor} mb-1`}>
            {title}
          </Toast.Title>
        )}
        <Toast.Description className="text-sm text-slate-300 leading-snug">
          {message}
        </Toast.Description>
      </div>

      {/* 关闭按钮 */}
      <Toast.Action
        asChild
        altText="关闭"
        className="shrink-0 p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-black/20 transition-colors"
      >
        <X className="w-4 h-4" />
      </Toast.Action>
    </Toast.Root>
  );
};

// ============================================================================
// 便捷 Hooks
// ============================================================================

export const useToastMessages = () => {
  const { showToast } = useToast();

  return {
    success: (message: string, title?: string) => {
      showToast({ title, message, variant: 'success' });
    },
    error: (message: string, title?: string) => {
      showToast({ title, message, variant: 'error', duration: 5000 });
    },
    info: (message: string, title?: string) => {
      showToast({ title, message, variant: 'info' });
    },
    warning: (message: string, title?: string) => {
      showToast({ title, message, variant: 'warning', duration: 4000 });
    }
  };
};
