/**
 * 首页任务指示器组件
 */

import React from 'react';
import { Layers, Loader2, ChevronRight } from 'lucide-react';
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
        'group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 shadow-lg',
        hasRunningTasks
          ? 'bg-slate-900/90 backdrop-blur-xl border border-violet-500/30 hover:border-violet-500/50'
          : 'bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 hover:border-slate-600/50'
      )}
    >
      {/* 图标 */}
      <div
        className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
          hasRunningTasks
            ? 'bg-gradient-to-br from-violet-600 to-purple-600'
            : 'bg-slate-800'
        )}
      >
        {hasRunningTasks ? (
          <Loader2 className="w-5 h-5 text-white animate-spin" />
        ) : (
          <Layers className="w-5 h-5 text-slate-400" />
        )}
      </div>

      {/* 信息区 */}
      <div className="text-left min-w-[140px]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">任务中心</span>
          {hasRunningTasks && (
            <span className="text-xs text-violet-400">{runningCount} 运行中</span>
          )}
        </div>

        {hasRunningTasks ? (
          <>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-400">运行时间</span>
              <span className="text-xs font-mono text-emerald-400">{formatRunTime()}</span>
            </div>
            <div className="w-32 h-1.5 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-300"
                style={{ width: `${avgProgress}%` }}
              />
            </div>
          </>
        ) : (
          <div className="text-xs text-slate-500 mt-0.5">
            {completedCount} 已完成 · {pendingCount} 待执行
          </div>
        )}
      </div>

      {/* 箭头 */}
      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
    </button>
  );
};

export default HomeTaskIndicator;
