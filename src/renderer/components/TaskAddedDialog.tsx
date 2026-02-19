/**
 * 任务添加成功弹窗
 * 
 * 专门用于任务添加成功后的提示和操作
 */

import React from 'react';
import { CheckCircle, X, ArrowRight, Layers } from 'lucide-react';
import { Button } from './Button';

interface TaskAddedDialogProps {
  open: boolean;
  /** 添加成功的任务数量 */
  taskCount?: number;
  /** 清空编辑区回调 */
  onClear: () => void;
  /** 关闭弹窗/保留编辑区回调 */
  onKeep: () => void;
  /** 跳转任务中心回调 */
  onTaskCenter: () => void;
}

const TaskAddedDialog: React.FC<TaskAddedDialogProps> = ({
  open,
  taskCount = 0,
  onClear,
  onKeep,
  onTaskCenter,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md animate-in fade-in-0 duration-200"
        onClick={onKeep}
      />

      {/* 对话框 */}
      <div className="relative bg-slate-900/95 backdrop-blur-xl border border-emerald-500/30 rounded-2xl max-w-md w-full shadow-2xl shadow-emerald-500/10 animate-in zoom-in-95 fade-in-0 duration-200">
        {/* 顶部装饰 */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500/0 via-emerald-500 to-emerald-500/0 rounded-t-2xl" />
        
        {/* 关闭按钮 */}
        <button
          onClick={onKeep}
          className="absolute top-4 right-4 p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          {/* 成功图标 */}
          <div className="flex justify-center mb-5">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl" />
              <div className="relative w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
            </div>
          </div>

          {/* 标题 */}
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-white mb-2">任务已添加</h3>
            <p className="text-sm text-slate-400">
              {taskCount > 0 ? `${taskCount} 个任务已加入队列` : '任务已加入队列'}
            </p>
          </div>

          {/* 任务中心快捷入口 */}
          <button
            onClick={onTaskCenter}
            className="w-full group flex items-center justify-between px-4 py-3.5 mb-5 bg-gradient-to-r from-violet-500/10 to-purple-500/10 hover:from-violet-500/20 hover:to-purple-500/20 border border-violet-500/30 hover:border-violet-500/50 rounded-xl transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center group-hover:bg-violet-500/30 transition-colors">
                <Layers className="w-5 h-5 text-violet-400" />
              </div>
              <div className="text-left">
                <span className="text-sm font-medium text-white block">去任务中心查看</span>
                <span className="text-xs text-slate-500">查看任务执行进度</span>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-violet-400 group-hover:text-violet-300 group-hover:translate-x-1 transition-all" />
          </button>

          {/* 操作按钮 */}
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onKeep} 
              className="flex-1 border border-slate-700/50 hover:border-slate-600"
            >
              关闭
            </Button>
            <Button 
              variant="primary" 
              size="sm" 
              onClick={onClear} 
              className="flex-1 bg-rose-500/80 hover:bg-rose-500 border-rose-500/50"
            >
              清空已选素材
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskAddedDialog;
