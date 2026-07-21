/**
 * 首页任务指示器组件
 */

import React from 'react';
import { ClipboardList, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { useTaskContext } from '@renderer/contexts/TaskContext';
import { cn } from '@renderer/lib/utils';

interface HomeTaskIndicatorProps {
  onClick: () => void;
  theme?: 'light' | 'dark';
}

const HomeTaskIndicator: React.FC<HomeTaskIndicatorProps> = ({ onClick, theme = 'light' }) => {
  const { runningTasks, queueStatus, formatRunTime } = useTaskContext();
  const isDarkTheme = theme === 'dark';

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
        'group relative flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5',
        hasRunningTasks
          ? isDarkTheme
            ? 'border-[#FF385C]/30 bg-[#FF385C]/10 text-slate-100 hover:border-[#FF385C]/45 hover:bg-[#FF385C]/15'
            : 'border-[#FF385C]/20 bg-white text-slate-700 shadow-[0_6px_18px_rgba(15,23,42,0.06)] hover:border-[#FF385C]/30 hover:shadow-[0_12px_26px_rgba(15,23,42,0.10)]'
          : isDarkTheme
            ? 'border-white/10 bg-white/[0.06] text-slate-200 hover:border-white/20 hover:bg-white/[0.10]'
            : 'border-slate-200 bg-white text-slate-700 shadow-[0_6px_18px_rgba(15,23,42,0.06)] hover:border-slate-300 hover:shadow-[0_12px_26px_rgba(15,23,42,0.10)]'
      )}
    >
      <div
        className={cn(
          'flex h-4 w-4 items-center justify-center transition-all',
          hasRunningTasks
            ? 'text-[#FF385C]'
            : isDarkTheme ? 'text-violet-400' : 'text-violet-500'
        )}
      >
        {hasRunningTasks ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ClipboardList className="h-4 w-4" />
        )}
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <span className={cn(
          'text-sm font-semibold transition-colors whitespace-nowrap',
          isDarkTheme ? 'text-slate-200' : 'text-slate-700'
        )}>
          任务中心
        </span>

        {hasRunningTasks ? (
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-[#FF385C]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#FF385C]">
              {runningCount} 运行中
            </span>
            <span className="text-[10px] font-mono text-slate-400">{formatRunTime()}</span>
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
        <div className={cn(
          'absolute bottom-1 left-4 right-4 h-0.5 overflow-hidden rounded-full',
          isDarkTheme ? 'bg-white/10' : 'bg-slate-100'
        )}>
          <div
            className="h-full bg-[#FF385C] transition-all duration-300"
            style={{ width: `${avgProgress}%` }}
          />
        </div>
      )}

    </button>
  );
};

export default HomeTaskIndicator;
