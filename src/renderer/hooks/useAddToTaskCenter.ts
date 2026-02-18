/**
 * 添加任务到任务中心的通用 hook
 */

import { useState, useCallback } from 'react';
import { useTaskContext } from '@renderer/contexts/TaskContext';
import type { TaskType } from '@shared/types/task';

interface UseAddToTaskCenterOptions {
  taskType: TaskType;
  moduleName: string;
  onLog?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onSuccess?: () => void;
}

interface UseAddToTaskCenterReturn {
  isAdding: boolean;
  addTask: (options: {
    name: string;
    outputDir: string;
    params: Record<string, unknown>;
    files: { path: string; category: string; categoryLabel: string }[];
    priority?: number;
    maxRetry?: number;
    threads?: number;
  }) => Promise<boolean>;
  showConfirmDialog: boolean;
  confirmMessage: string;
  handleConfirmClear: () => void;
  handleCancelClear: () => void;
}

export function useAddToTaskCenter(options: UseAddToTaskCenterOptions): UseAddToTaskCenterReturn {
  const { taskType, moduleName, onLog, onSuccess } = options;
  const { createTask } = useTaskContext();
  const [isAdding, setIsAdding] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [pendingClearCallback, setPendingClearCallback] = useState<(() => void) | null>(null);

  const addTask = useCallback(async (taskOptions: {
    name: string;
    outputDir: string;
    params: Record<string, unknown>;
    files: { path: string; category: string; categoryLabel: string }[];
    priority?: number;
    maxRetry?: number;
    threads?: number;
  }) => {
    const { name, outputDir, params, files, priority, maxRetry, threads } = taskOptions;

    if (files.length === 0) {
      onLog?.('请先选择素材文件', 'warning');
      return false;
    }

    if (!outputDir) {
      onLog?.('请先选择输出目录', 'warning');
      return false;
    }

    setIsAdding(true);
    onLog?.(`正在添加任务到任务中心...`, 'info');

    try {
      const result = await createTask({
        type: taskType,
        name,
        outputDir,
        params,
        files,
        priority,
        maxRetry,
        threads,
      });

      if (result.success) {
        onLog?.(`任务「${name}」已添加到任务中心`, 'success');
        
        // 显示确认对话框
        setConfirmMessage(`任务已添加到任务中心，是否清空${moduleName}编辑区域？`);
        setShowConfirmDialog(true);
        
        // 设置待执行的清空回调
        setPendingClearCallback(() => onSuccess || null);
        
        return true;
      } else {
        onLog?.(`添加任务失败: ${result.error}`, 'error');
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      onLog?.(`添加任务失败: ${errorMessage}`, 'error');
      return false;
    } finally {
      setIsAdding(false);
    }
  }, [createTask, taskType, moduleName, onLog, onSuccess]);

  const handleConfirmClear = useCallback(() => {
    setShowConfirmDialog(false);
    if (pendingClearCallback) {
      pendingClearCallback();
      setPendingClearCallback(null);
    }
  }, [pendingClearCallback]);

  const handleCancelClear = useCallback(() => {
    setShowConfirmDialog(false);
    setPendingClearCallback(null);
  }, []);

  return {
    isAdding,
    addTask,
    showConfirmDialog,
    confirmMessage,
    handleConfirmClear,
    handleCancelClear,
  };
}
