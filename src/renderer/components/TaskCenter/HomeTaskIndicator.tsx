/**
 * 首页任务指示器组件
 */

import React from 'react';
import { ClipboardList, Loader2, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
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
        'group relative flex h-14 items-center gap-3 rounded-md px-7 backdrop-blur-xl transition-all duration-300',
        isDarkTheme
          ? 'shadow-[0_8px_24px_rgba(0,0,0,0.24)]'
          : 'shadow-[0_8px_20px_rgba(15,23,42,0.22)]',
        hasRunningTasks
          ? isDarkTheme
            ? 'bg-slate-900/90 border border-blue-500/40 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(14,165,233,0.14)]'
            : 'bg-slate-200/40 border border-white/40 hover:-translate-y-0.5 hover:bg-slate-100/50 hover:border-white/70 hover:shadow-[0_16px_28px_rgba(15,23,42,0.25)]'
          : isDarkTheme
            ? 'bg-slate-900/80 border border-slate-700/70 hover:-translate-y-0.5 hover:border-blue-400/50 hover:shadow-[0_16px_36px_rgba(14,165,233,0.12)]'
            : 'bg-slate-200/40 border border-white/40 hover:-translate-y-0.5 hover:bg-slate-100/50 hover:border-white/70 hover:shadow-[0_16px_28px_rgba(15,23,42,0.25)]'
      )}
    >
      {/* 图标容器 - 与系统管理保持一致 */}
      <div
        className={cn(
          'w-7 h-7 rounded-lg flex items-center justify-center transition-all',
          hasRunningTasks
            ? isDarkTheme ? 'text-blue-300' : 'text-blue-500'
            : isDarkTheme ? 'text-sky-300' : 'text-sky-500'
        )}
      >
        {hasRunningTasks ? (
          <Loader2 className="w-7 h-7 animate-spin" />
        ) : (
          <ClipboardList className="w-7 h-7" />
        )}
      </div>

      {/* 文字区域 */}
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn(
          'text-base font-semibold transition-colors whitespace-nowrap',
          isDarkTheme ? 'text-slate-200 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-950'
        )}>
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
        <div className={cn(
          'absolute bottom-0 left-3 right-3 h-0.5 rounded-b-xl overflow-hidden',
          isDarkTheme ? 'bg-slate-800' : 'bg-slate-100'
        )}>
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-sky-500 transition-all duration-300"
            style={{ width: `${avgProgress}%` }}
          />
        </div>
      )}

      {/* 箭头 */}
      <ChevronRight className={cn(
        'w-4 h-4 transition-colors ml-auto flex-shrink-0',
        isDarkTheme ? 'text-slate-500 group-hover:text-white' : 'text-slate-400 group-hover:text-slate-700'
      )} />
    </button>
  );
};

export default HomeTaskIndicator;
