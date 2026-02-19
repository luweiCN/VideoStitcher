/**
 * 确认对话框组件
 * 
 * 设计风格：深色玻璃拟态 + 微妙动画
 */

import React from 'react';
import { AlertCircle, CheckCircle, Info, X, ArrowRight } from 'lucide-react';
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
  /** 任务中心按钮回调 */
  onTaskCenter?: () => void;
  /** 任务中心按钮文字 */
  taskCenterText?: string;
}

const typeConfig = {
  info: {
    icon: Info,
    iconColor: 'text-cyan-400',
    iconBg: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/30',
    glowColor: 'shadow-cyan-500/20',
    ringColor: 'ring-cyan-500/30',
  },
  warning: {
    icon: AlertCircle,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/20',
    borderColor: 'border-amber-500/30',
    glowColor: 'shadow-amber-500/20',
    ringColor: 'ring-amber-500/30',
  },
  success: {
    icon: CheckCircle,
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500/30',
    glowColor: 'shadow-emerald-500/20',
    ringColor: 'ring-emerald-500/30',
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
  onTaskCenter,
  taskCenterText = '去任务中心查看',
}) => {
  if (!open) return null;

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md animate-in fade-in-0 duration-200"
        onClick={onCancel}
      />

      {/* 对话框 */}
      <div
        className={`relative bg-slate-900/95 backdrop-blur-xl border ${config.borderColor} rounded-2xl max-w-md w-full shadow-2xl ${config.glowColor} animate-in zoom-in-95 fade-in-0 duration-200`}
      >
        {/* 顶部装饰线 */}
        <div className={`absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent`} />
        
        {/* 关闭按钮 */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          {/* 图标和标题 */}
          <div className="flex items-start gap-4 mb-4">
            <div className={`p-3 rounded-xl ${config.iconBg} ring-1 ${config.ringColor}`}>
              <Icon className={`w-6 h-6 ${config.iconColor}`} />
            </div>
            <div className="flex-1 pt-1">
              <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{message}</p>
            </div>
          </div>

          {/* 任务中心快捷入口 */}
          {onTaskCenter && type === 'success' && (
            <button
              onClick={onTaskCenter}
              className="w-full group flex items-center justify-between px-4 py-3 mb-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-violet-500/50 rounded-xl transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                  {taskCenterText}
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all" />
            </button>
          )}

          {/* 按钮组 */}
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onCancel} 
              className="flex-1 border border-slate-700/50 hover:border-slate-600"
            >
              {cancelText}
            </Button>
            <Button 
              variant="primary" 
              size="sm" 
              onClick={onConfirm} 
              className="flex-1"
            >
              {confirmText}
            </Button>
          </div>
        </div>

        {/* 底部装饰线 */}
        <div className={`absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent`} />
      </div>
    </div>
  );
};

export default ConfirmDialog;
