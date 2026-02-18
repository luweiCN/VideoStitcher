/**
 * 确认对话框组件
 */

import React from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import { Button } from './Button/Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'info' | 'warning' | 'success';
  onConfirm: () => void;
  onCancel: () => void;
}

const typeConfig = {
  info: {
    icon: Info,
    iconColor: 'text-cyan-400',
    borderColor: 'border-cyan-500/30',
  },
  warning: {
    icon: AlertCircle,
    iconColor: 'text-amber-400',
    borderColor: 'border-amber-500/30',
  },
  success: {
    icon: CheckCircle,
    iconColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
  },
};

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  type = 'info',
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* 对话框 */}
      <div
        className={`relative bg-slate-900 border ${config.borderColor} rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl`}
      >
        {/* 关闭按钮 */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1 text-slate-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* 图标和标题 */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-lg bg-slate-800 ${config.iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
        </div>

        {/* 消息 */}
        <p className="text-sm text-slate-300 mb-6 leading-relaxed">{message}</p>

        {/* 按钮 */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel} className="flex-1">
            {cancelText}
          </Button>
          <Button variant="primary" size="sm" onClick={onConfirm} className="flex-1">
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
