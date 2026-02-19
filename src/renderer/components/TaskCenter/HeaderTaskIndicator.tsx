import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Loader2,
  Play,
  Pause,
  ExternalLink,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { useTaskContext } from "@renderer/contexts/TaskContext";
import { TASK_TYPE_LABELS } from "@shared/types/task";
import { cn } from "@renderer/lib/utils";

// 格式化运行时间
const formatElapsedTime = (startedAt: number | undefined): string => {
  if (!startedAt) return "0s";
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  if (elapsed < 60) return `${elapsed}s`;
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const HeaderTaskIndicator: React.FC = () => {
  const navigate = useNavigate();
  const { runningTasks, queueStatus, isPaused, pauseAllTasks, resumeAllTasks } =
    useTaskContext();
  const [, setTick] = useState(0);

  // 每秒更新运行时间显示
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const hasRunningTasks = runningTasks.length > 0;
  const runningCount = runningTasks.length;
  const pendingCount = queueStatus?.pending || 0;
  const completedCount = queueStatus?.completed || 0;

  if (!hasRunningTasks && pendingCount === 0 && completedCount === 0) {
    return null;
  }

  const handleOpenTaskCenter = () => {
    navigate("/taskCenter");
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 bg-black/50 border rounded-lg transition-all duration-200",
            hasRunningTasks
              ? "border-violet-500/40 hover:border-violet-400/60"
              : "border-slate-700/50 hover:border-slate-600/50",
          )}
        >
          <div
            className={cn(
              "w-5 h-5 rounded flex items-center justify-center",
              hasRunningTasks
                ? "bg-gradient-to-br from-violet-500 to-purple-600"
                : "bg-slate-700/80",
            )}
          >
            {hasRunningTasks ? (
              <Loader2 className="w-3 h-3 text-white animate-spin" />
            ) : (
              <ClipboardList className="w-3 h-3 text-slate-400" />
            )}
          </div>

          <span className="text-xs font-medium text-slate-300">任务中心</span>

          {hasRunningTasks && (
            <span className="text-xs text-violet-400 font-medium">
              {runningCount} 运行中
            </span>
          )}

          {!hasRunningTasks && pendingCount > 0 && (
            <span className="text-[10px] text-amber-400">
              {pendingCount} 待执行
            </span>
          )}

          <Popover.Anchor>
            <svg
              className="w-3 h-3 text-slate-500"
              viewBox="0 0 12 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 4.5L6 7.5L9 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Popover.Anchor>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="w-72 bg-black/95 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl z-50 overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          side="bottom"
          align="end"
          alignOffset={-12}
          sideOffset={20}
        >
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-200">
                运行中任务
              </span>
              {isPaused && (
                <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                  已暂停
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-500">
              {runningCount} 个
            </span>
          </div>

          {hasRunningTasks ? (
            <div className="max-h-48 overflow-y-auto py-1">
              {runningTasks.slice(0, 4).map((task) => {
                const taskTypeLabel = task.type ? TASK_TYPE_LABELS[task.type] : "未知类型";
                return (
                  <div
                    key={task.id}
                    className="px-4 py-2.5 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-slate-500 font-mono shrink-0">
                          #{task.id}
                        </span>
                        <span className="text-xs text-slate-300 truncate">
                          {taskTypeLabel}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-violet-400 shrink-0 ml-2">
                        {formatElapsedTime(task.startedAt)}
                      </span>
                    </div>
                    {task.currentStep && (
                      <p className="text-[10px] text-slate-500 truncate">
                        {task.currentStep}
                      </p>
                    )}
                  </div>
                );
              })}
              {runningTasks.length > 4 && (
                <div className="px-4 py-2 text-center text-[10px] text-slate-500">
                  还有 {runningTasks.length - 4} 个任务...
                </div>
              )}
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <ClipboardList className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">暂无运行中任务</p>
              {pendingCount > 0 && (
                <p className="text-[10px] text-amber-400 mt-1">
                  {pendingCount} 个任务待执行
                </p>
              )}
            </div>
          )}

          <div className="p-3 border-t border-slate-800 flex gap-2">
            <Popover.Close asChild>
              <button
                onClick={handleOpenTaskCenter}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-violet-600/20 text-violet-400 rounded-lg hover:bg-violet-600/30 transition-colors border-0 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>打开任务中心</span>
              </button>
            </Popover.Close>
            <button
              onClick={() => {
                if (isPaused) {
                  resumeAllTasks();
                } else {
                  pauseAllTasks();
                }
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors border-0 cursor-pointer"
            >
              {isPaused ? (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>恢复运行</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>暂停运行</span>
                </>
              )}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

export default HeaderTaskIndicator;
