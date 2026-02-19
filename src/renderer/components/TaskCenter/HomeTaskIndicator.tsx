/**
 * 首页任务指示器组件
 */

import React from 'react';
import { ClipboardList, Loader2, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import { useTaskContext } from '@renderer/contexts/TaskContext';
import { cn } from '@renderer/lib/utils';

interface HomeTaskIndicatorProps {
  onClick: () => void;
}

const HomeTaskIndicator: React.FC<HomeTaskIndicatorProps> = ({ onClick }) => {
  const { runningTasks, queueStatus, formatRunTime } = useTaskContext();

  const hasRunningTasks = runningTasks.length > 0;
  const runningCount = runningTasks.length;
  const pendingCount = queueStatus?.pending || 0;
  const completedCount = queueStatus?.completed || 0;

  // 计算平均进度
  const avgProgress =
    runningTasks.length > 0
      ? Math.round(runningTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / runningTasks.length)
      : 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-3 px-4 py-2.5 backdrop-blur-xl rounded-xl transition-all duration-300 shadow-lg',
        hasRunningTasks
          ? 'bg-slate-900/90 border border-violet-500/40 hover:border-violet-400/60 hover:shadow-violet-500/20'
          : 'bg-slate-900/80 border border-slate-700/50 hover:border-purple-500/50 hover:bg-slate-800/80 hover:shadow-purple-500/10'
      )}
    >
      {/* 图标容器 - 与系统管理保持一致 */}
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shadow-md transition-all',
          hasRunningTasks
            ? 'bg-gradient-to-br from-blue-600 to-cyan-600 shadow-blue-600/20 group-hover:shadow-blue-600/30'
            : 'bg-gradient-to-br from-blue-600 to-cyan-600 shadow-blue-600/20 group-hover:shadow-blue-600/30'
        )}
      >
        {hasRunningTasks ? (
          <Loader2 className="w-4 h-4 text-white animate-spin" />
        ) : (
          <ClipboardList className="w-4 h-4 text-white" />
        )}
      </div>

      {/* 文字区域 */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors whitespace-nowrap">
          任务中心
        </span>

        {/* 状态徽章 */}
        {hasRunningTasks ? (
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-violet-500/20 text-violet-400 rounded-md">
              {runningCount} 运行中
            </span>
            <span className="text-[10px] font-mono text-emerald-400">{formatRunTime()}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            {completedCount > 0 && (
              <span className="flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                {completedCount}
              </span>
            )}
            {pendingCount > 0 && (
              <span className="flex items-center gap-0.5">
                <Clock className="w-3 h-3 text-amber-500" />
                {pendingCount}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 运行时显示进度条（覆盖在底部） */}
      {hasRunningTasks && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800 rounded-b-xl overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-300"
            style={{ width: `${avgProgress}%` }}
          />
        </div>
      )}

      {/* 箭头 */}
      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors ml-auto flex-shrink-0" />
    </button>
  );
};

export default HomeTaskIndicator;
