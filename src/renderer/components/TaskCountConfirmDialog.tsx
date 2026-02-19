/**
 * 任务数量确认弹窗
 * 
 * 当添加的任务数量超过100时，显示二次确认弹窗
 */

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';

interface TaskCountConfirmDialogProps {
  open: boolean;
  /** 任务数量 */
  taskCount: number;
  /** 确认添加回调 */
  onConfirm: () => void;
  /** 取消回调 */
  onCancel: () => void;
}

const TaskCountConfirmDialog: React.FC<TaskCountConfirmDialogProps> = ({
  open,
  taskCount,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md animate-in fade-in-0 duration-200"
        onClick={onCancel}
      />

      {/* 对话框 */}
      <div className="relative bg-slate-900/95 backdrop-blur-xl border border-amber-500/30 rounded-2xl max-w-md w-full shadow-2xl shadow-amber-500/10 animate-in zoom-in-95 fade-in-0 duration-200">
        {/* 顶部装饰 */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500/0 via-amber-500 to-amber-500/0 rounded-t-2xl" />
        
        {/* 关闭按钮 */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          {/* 警告图标 */}
          <div className="flex justify-center mb-5">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-xl" />
              <div className="relative w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-amber-400" />
              </div>
            </div>
          </div>

          {/* 标题 */}
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-white mb-2">任务数量较多</h3>
            <p className="text-sm text-slate-400">
              当前参数下将生成 <span className="text-amber-400 font-semibold">{taskCount}</span> 个任务
            </p>
            <p className="text-xs text-slate-500 mt-2">
              确认要将这些任务添加到任务中心吗？
            </p>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onCancel} 
              className="flex-1 border border-slate-700/50 hover:border-slate-600"
            >
              取消
            </Button>
            <Button 
              variant="primary" 
              size="sm" 
              onClick={onConfirm}
              className="flex-1 bg-amber-500/80 hover:bg-amber-500 border-amber-500/50"
            >
              确认添加
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskCountConfirmDialog;
