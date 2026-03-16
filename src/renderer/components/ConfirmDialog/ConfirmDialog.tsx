/**
 * 确认对话框组件
 */

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'warning',
}) => {
  if (!isOpen) return null;

  const variants = {
    danger: {
      icon: 'text-red-500',
      iconBg: 'bg-red-500/20',
      confirmBtn: 'bg-red-500 hover:bg-red-600',
    },
    warning: {
      icon: 'text-amber-500',
      iconBg: 'bg-amber-500/20',
      confirmBtn: 'bg-amber-500 hover:bg-amber-600',
    },
    info: {
      icon: 'text-blue-500',
      iconBg: 'bg-blue-500/20',
      confirmBtn: 'bg-blue-500 hover:bg-blue-600',
    },
  };

  const style = variants[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 对话框 */}
      <div className="relative bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 内容 */}
        <div className="p-6">
          {/* 图标 */}
          <div className="flex justify-center mb-4">
            <div className={`w-16 h-16 ${style.iconBg} rounded-full flex items-center justify-center`}>
              <AlertTriangle className={`w-8 h-8 ${style.icon}`} />
            </div>
          </div>

          {/* 标题 */}
          <h3 className="text-lg font-bold text-white text-center mb-2">
            {title}
          </h3>

          {/* 消息 */}
          <p className="text-sm text-slate-400 text-center mb-6">
            {message}
          </p>

          {/* 按钮组 */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors font-medium"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 px-4 py-2.5 ${style.confirmBtn} text-white rounded-lg transition-colors font-medium`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
