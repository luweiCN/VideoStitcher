/**
 * 运行中任务项组件 - 带日志显示
 */

import React, { useState, useEffect } from 'react';
import {
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  Terminal,
} from 'lucide-react';
import type { Task } from '@shared/types/task';
import { TASK_TYPE_LABELS } from '@shared/types/task';
import TaskStatusBadge from './TaskStatusBadge';
import { useOperationLogs } from '@renderer/hooks/useOperationLogs';
import { OperationLogPanel } from '@renderer/components/OperationLogPanel';

interface RunningTaskItemProps {
  task: Task;
  onCancel?: (taskId: number) => void;
}

const RunningTaskItem: React.FC<RunningTaskItemProps> = ({
  task,
  onCancel,
}) => {
  const [logsExpanded, setLogsExpanded] = useState(true);
  const progress = task.progress || 0;
  const taskTypeLabel = task.type ? TASK_TYPE_LABELS[task.type] : '未知类型';

  const {
    logs,
    addLog,
    clearLogs,
    copyLogs,
    downloadLogs,
    logsContainerRef,
    logsEndRef,
    autoScrollEnabled,
    setAutoScrollEnabled,
    autoScrollPaused,
    resumeAutoScroll,
    scrollToBottom,
    scrollToTop,
    onUserInteractStart,
  } = useOperationLogs({
    moduleNameCN: taskTypeLabel,
    moduleNameEN: 'TaskCenter',
  });

  // 监听当前任务的日志
  useEffect(() => {
    const handleTaskLog = (data: { taskId: number; log: { message: string; level?: string } }) => {
      if (data.taskId === task.id) {
        const logType = data.log.level === 'error' ? 'error' 
          : data.log.level === 'warning' ? 'warning'
          : data.log.level === 'success' ? 'success'
          : 'info';
        addLog(data.log.message, logType);
      }
    };

    const cleanup = window.api.onTaskLog?.(handleTaskLog);
    return () => cleanup?.();
  }, [task.id, addLog]);

  // 监听任务进度更新，显示当前步骤
  useEffect(() => {
    const handleTaskProgress = (data: { taskId: number; progress: number; step?: string }) => {
      if (data.taskId === task.id && data.step) {
        addLog(data.step, 'info');
      }
    };

    const cleanup = window.api.onTaskProgress?.(handleTaskProgress);
    return () => cleanup?.();
  }, [task.id, addLog]);

  return (
    <div className="bg-black/50 border border-slate-800 rounded-xl overflow-hidden">
      {/* 主信息区 */}
      <div className="p-4">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
            <div>
              <h3 className="text-sm font-medium text-white">
                {task.name || `任务 #${task.id}`}
              </h3>
              <p className="text-xs text-slate-500">{taskTypeLabel}</p>
            </div>
          </div>
          <TaskStatusBadge status={task.status} />
        </div>

        {/* 进度条 */}
        <div className="mb-3">
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
        <div className="flex items-center gap-2">
          {/* 取消按钮 */}
          {onCancel && (
            <button
              onClick={() => onCancel(task.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 text-rose-400 text-xs rounded-lg hover:bg-rose-500/30 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              取消
            </button>
          )}

          {/* 日志展开/收起 */}
          <button
            onClick={() => setLogsExpanded(!logsExpanded)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 text-slate-400 text-xs rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5" />
            {logsExpanded ? '收起日志' : '查看日志'}
            {logsExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* 日志面板 */}
      {logsExpanded && (
        <div className="border-t border-slate-800">
          <OperationLogPanel
            logs={logs}
            addLog={addLog}
            clearLogs={clearLogs}
            copyLogs={copyLogs}
            downloadLogs={downloadLogs}
            logsContainerRef={logsContainerRef}
            logsEndRef={logsEndRef}
            autoScrollEnabled={autoScrollEnabled}
            setAutoScrollEnabled={setAutoScrollEnabled}
            autoScrollPaused={autoScrollPaused}
            resumeAutoScroll={resumeAutoScroll}
            scrollToBottom={scrollToBottom}
            scrollToTop={scrollToTop}
            onUserInteractStart={onUserInteractStart}
            height="200px"
            themeColor="violet"
          />
        </div>
      )}
    </div>
  );
};

export default RunningTaskItem;
