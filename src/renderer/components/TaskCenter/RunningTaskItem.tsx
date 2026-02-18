/**
 * 运行中任务项组件
 */

import React from 'react';
import { Loader2, Pause, X } from 'lucide-react';
import type { Task } from '@shared/types/task';
import TaskStatusBadge from './TaskStatusBadge';

interface RunningTaskItemProps {
  task: Task;
  onPause?: (taskId: string) => void;
  onCancel?: (taskId: string) => void;
  onClick?: (taskId: string) => void;
  compact?: boolean;
}

const taskTypeLabels: Record<string, string> = {
  videoMerge: '横竖屏合成',
  resize: '智能改尺寸',
  imageMaterial: '图片素材处理',
  coverFormat: '封面格式转换',
  coverCompress: '封面压缩',
  losslessGrid: '无损九宫格',
  videoStitcher: 'A+B拼接',
};

const RunningTaskItem: React.FC<RunningTaskItemProps> = ({
  task,
  onPause,
  onCancel,
  onClick,
  compact = false,
}) => {
  const progress = task.progress || 0;
  const taskTypeLabel = taskTypeLabels[task.type] || task.type;

  if (compact) {
    return (
      <div
        className="flex items-center gap-3 p-2 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-colors cursor-pointer"
        onClick={() => onClick?.(task.id)}
      >
        <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-300 truncate">{task.name}</span>
            <span className="text-xs text-violet-400 flex-shrink-0">{progress}%</span>
          </div>
          <div className="w-full h-1 bg-slate-700 rounded-full mt-1 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-slate-800/30 border border-slate-700/50 rounded-xl">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
          <span className="text-sm font-medium text-white">{task.name}</span>
        </div>
        <TaskStatusBadge status={task.status} />
      </div>

      {/* 任务类型 */}
      <p className="text-xs text-slate-500 mb-3">{taskTypeLabel}</p>

      {/* 进度条 */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span>{task.currentStep || '处理中...'}</span>
          <span className="text-violet-400 font-medium">{progress}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2 mt-3">
        {task.status === 'running' && onPause && (
          <button
            onClick={() => onPause(task.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-400 text-xs rounded-lg hover:bg-amber-500/30 transition-colors"
          >
            <Pause className="w-3.5 h-3.5" />
            暂停
          </button>
        )}
        {onCancel && (
          <button
            onClick={() => onCancel(task.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-500/20 text-rose-400 text-xs rounded-lg hover:bg-rose-500/30 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            取消
          </button>
        )}
      </div>
    </div>
  );
};

export default RunningTaskItem;
