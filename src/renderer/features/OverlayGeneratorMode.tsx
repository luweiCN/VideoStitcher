import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownUp,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  FolderOpen,
  ImagePlus,
  Layers3,
  Link,
  ListFilter,
  Lock,
  Maximize2,
  Play,
  RotateCcw,
  Trash2,
  Unlock,
  Upload,
} from 'lucide-react';
import {
  DEFAULT_OVERLAY_EXPORT_OPTIONS,
  OVERLAY_CENTER_Y,
  OVERLAY_VIDEO_HEIGHT,
  clampOverlayVideoY,
  type OverlayCropTransform,
  type OverlayExportOptions,
} from '@shared/overlay';
import PageHeader from '@/components/PageHeader';
import OutputDirSelector from '@/components/OutputDirSelector';
import OperationLogPanel from '@/components/OperationLogPanel';
import ConfirmDialog from '@/components/ConfirmDialog';
import PageThemeToggle from '@/components/PageThemeToggle';
import { Button } from '@/components/Button/Button';
import { useOutputDirCache } from '@/hooks/useOutputDirCache';
import { useOperationLogs } from '@/hooks/useOperationLogs';
import { useTaskContext } from '@/contexts/TaskContext';
import { usePageTheme } from '@/hooks/usePageTheme';
import { useHomeSkin } from '@/hooks/useHomeSkin';
import ImageWorkshopModeSwitcher from '@/features/ImageWorkshopModeSwitcher';
import { useImageWorkshopMode } from '@/features/ImageWorkshopModeContext';
import OverlayCanvas from '@/features/OverlayGeneratorMode/OverlayCanvas';
import AssetSlot from '@/features/OverlayGeneratorMode/AssetSlot';
import {
  EMPTY_OVERLAY_TRANSFORM,
  centerTransform,
  createContainTransform,
  createCoverTransform,
  denormalizeTransform,
  getOverlayRegionHeight,
  getRegionCoverageGaps,
  isRegionCovered,
  normalizeTransform,
  toOverlayGeneratorTaskConfig,
  validateOverlayTask,
} from '@/features/OverlayGeneratorMode/geometry';
import type {
  OverlayAsset,
  OverlayConfirmAction,
  OverlayEditingTarget,
  OverlayEditorTask,
  OverlayTaskStatus,
} from '@/features/OverlayGeneratorMode/types';

const IMAGE_FILTERS = [{
  name: '图片文件',
  extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'avif'],
}];

const STATUS_LABELS: Record<OverlayTaskStatus, string> = {
  pending: '待处理',
  editing: '编辑中',
  ready: '已完成',
  exporting: '导出中',
  success: '导出成功',
  failed: '导出失败',
  cancelled: '已取消',
};

const STATUS_STYLES: Record<OverlayTaskStatus, string> = {
  pending: 'border-slate-700 bg-slate-800/50 text-slate-400',
  editing: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  ready: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
  exporting: 'border-violet-500/30 bg-violet-500/10 text-violet-400',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  failed: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
  cancelled: 'border-slate-700 bg-slate-800/50 text-slate-500',
};

const createLocalTaskId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `overlay-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const getBaseName = (fileName: string) => fileName.replace(/\.[^.]+$/, '');

const getTaskName = (top: OverlayAsset | null, bottom: OverlayAsset | null, sameSource: boolean) => {
  if (!top && !bottom) return '未命名贴片';
  if (sameSource || !top || !bottom || top.path === bottom.path) {
    return `${getBaseName((top || bottom)!.name)}_贴片`;
  }
  return `${getBaseName(top.name)}_${getBaseName(bottom.name)}_贴片`;
};

const getDisplayStatus = (task: OverlayEditorTask): OverlayTaskStatus => {
  if (['exporting', 'success', 'failed', 'cancelled'].includes(task.status)) return task.status;
  return validateOverlayTask(task) ? task.status : 'ready';
};

/** 图片素材工坊中的贴片生成器。 */
const OverlayGeneratorMode: React.FC = () => {
  const navigate = useNavigate();
  const workshopMode = useImageWorkshopMode();
  const metalRootRef = useRef<HTMLDivElement>(null);
  const taskCenterMapRef = useRef(new Map<number, string>());
  const tasksRef = useRef<OverlayEditorTask[]>([]);
  const cancelRequestedRef = useRef(false);
  const { outputDir, setOutputDir } = useOutputDirCache('OverlayGeneratorMode');
  const { isLightTheme, togglePageTheme } = usePageTheme();
  const { isMetalSkin, workspaceSkinClassName } = useHomeSkin();
  const {
    createTask,
    startTask,
    cancelTask,
    isPaused,
  } = useTaskContext();

  const [tasks, setTasks] = useState<OverlayEditorTask[]>([]);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState<OverlayEditingTarget>('top');
  const [isImporting, setIsImporting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [taskFilter, setTaskFilter] = useState<'all' | 'incomplete' | 'failed'>('all');
  const [confirmAction, setConfirmAction] = useState<OverlayConfirmAction | null>(null);
  const [exportSessionIds, setExportSessionIds] = useState<string[]>([]);
  tasksRef.current = tasks;

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
    moduleNameCN: '贴片生成器',
    moduleNameEN: 'OverlayGenerator',
  });

  const currentTask = useMemo(
    () => tasks.find((task) => task.id === currentTaskId) || null,
    [tasks, currentTaskId],
  );

  const updateTask = useCallback((
    taskId: string,
    updater: (task: OverlayEditorTask) => OverlayEditorTask,
  ) => {
    setTasks((current) => current.map((task) => task.id === taskId ? updater(task) : task));
  }, []);

  const updateCurrentTask = useCallback((updater: (task: OverlayEditorTask) => OverlayEditorTask) => {
    if (!currentTaskId) return;
    updateTask(currentTaskId, updater);
  }, [currentTaskId, updateTask]);

  /** 读取图片元数据和小尺寸缩略图，不把原图放进页面状态。 */
  const loadAsset = useCallback(async (filePath: string): Promise<OverlayAsset | null> => {
    const result = await window.api.getImageFullInfo(filePath, { thumbnailMaxSize: 160 });
    if (!result.success || !result.width || !result.height) {
      addLog(`图片读取失败: ${result.error || filePath}`, 'error');
      return null;
    }
    return {
      path: filePath,
      name: result.name,
      width: result.width,
      height: result.height,
      thumbnail: result.thumbnail,
      previewUrl: result.previewUrl,
    };
  }, [addLog]);

  const createEditorTask = useCallback((asset: OverlayAsset): OverlayEditorTask => {
    const topHeight = OVERLAY_CENTER_Y;
    const bottomHeight = OVERLAY_CENTER_Y;
    return {
      id: createLocalTaskId(),
      name: `${getBaseName(asset.name)}_贴片`,
      topAsset: asset,
      bottomAsset: asset,
      sameSource: true,
      videoY: OVERLAY_CENTER_Y,
      topTransform: createCoverTransform(asset, topHeight),
      bottomTransform: createCoverTransform(asset, bottomHeight),
      topLocked: false,
      bottomLocked: false,
      selected: true,
      status: 'pending',
      error: null,
      exportOptions: { ...DEFAULT_OVERLAY_EXPORT_OPTIONS },
      progress: 0,
      outputs: [],
    };
  }, []);

  const importPaths = useCallback(async (paths: string[]) => {
    if (paths.length === 0) return;
    setIsImporting(true);
    addLog(`正在读取 ${paths.length} 张图片...`, 'info');
    const existingPaths = new Set(tasks.filter((task) => task.sameSource).map((task) => task.topAsset?.path));
    const created: OverlayEditorTask[] = [];

    // 逐张读取，避免批量导入时同时解码所有原图。
    for (const filePath of paths) {
      if (existingPaths.has(filePath)) {
        addLog(`已跳过重复任务: ${filePath}`, 'warning');
        continue;
      }
      const asset = await loadAsset(filePath);
      if (!asset) continue;
      created.push(createEditorTask(asset));
      existingPaths.add(filePath);
    }

    if (created.length > 0) {
      setTasks((current) => [...current, ...created]);
      setCurrentTaskId((current) => current || created[0].id);
      addLog(`已创建 ${created.length} 个贴片任务，请逐张检查后导出`, 'success');
    }
    setIsImporting(false);
  }, [tasks, loadAsset, createEditorTask, addLog]);

  const pickAndImport = useCallback(async (multiple: boolean) => {
    const paths = await window.api.pickFiles(
      multiple ? '批量导入贴片素材' : '导入贴片素材',
      IMAGE_FILTERS,
      multiple,
    );
    await importPaths(paths);
  }, [importPaths]);

  const replaceRegionAsset = useCallback(async (
    region: 'top' | 'bottom',
    filePath?: string,
    fromDrop = false,
  ) => {
    if (!currentTask) return;
    const paths = filePath
      ? [filePath]
      : await window.api.pickFiles(`替换${region === 'top' ? '上' : '下'}半部分素材`, IMAGE_FILTERS, false);
    if (!paths[0]) return;
    const asset = await loadAsset(paths[0]);
    if (!asset) return;

    updateCurrentTask((task) => {
      const topHeight = getOverlayRegionHeight(task.videoY, 'top');
      const bottomHeight = getOverlayRegionHeight(task.videoY, 'bottom');
      if (task.sameSource && !fromDrop) {
        return {
          ...task,
          topAsset: asset,
          bottomAsset: asset,
          topTransform: createCoverTransform(asset, topHeight),
          bottomTransform: createCoverTransform(asset, bottomHeight),
          name: getTaskName(asset, asset, true),
          status: 'editing',
          error: null,
          progress: 0,
          outputs: [],
        };
      }

      const next = region === 'top'
        ? {
            ...task,
            topAsset: asset,
            topTransform: createCoverTransform(asset, topHeight),
            sameSource: false,
          }
        : {
            ...task,
            bottomAsset: asset,
            bottomTransform: createCoverTransform(asset, bottomHeight),
            sameSource: false,
          };
      return {
        ...next,
        name: getTaskName(next.topAsset, next.bottomAsset, next.sameSource),
        status: 'editing',
        error: null,
        progress: 0,
        outputs: [],
      };
    });
    addLog(`${region === 'top' ? '上' : '下'}半部分素材已替换为 ${asset.name}`, 'info');
  }, [currentTask, loadAsset, updateCurrentTask, addLog]);

  const clearRegionAsset = useCallback((region: 'top' | 'bottom') => {
    updateCurrentTask((task) => {
      const next = region === 'top'
        ? { ...task, topAsset: null, topTransform: EMPTY_OVERLAY_TRANSFORM, sameSource: false }
        : { ...task, bottomAsset: null, bottomTransform: EMPTY_OVERLAY_TRANSFORM, sameSource: false };
      return {
        ...next,
        name: getTaskName(next.topAsset, next.bottomAsset, false),
        status: 'editing',
        error: null,
        progress: 0,
        outputs: [],
      };
    });
  }, [updateCurrentTask]);

  const toggleSameSource = useCallback((sameSource: boolean) => {
    updateCurrentTask((task) => {
      if (!sameSource) return { ...task, sameSource: false, status: 'editing', progress: 0, outputs: [] };
      const asset = task.topAsset || task.bottomAsset;
      if (!asset) return task;
      const topTransform = task.topAsset?.path === asset.path
        ? task.topTransform
        : createCoverTransform(asset, getOverlayRegionHeight(task.videoY, 'top'));
      const bottomTransform = task.bottomAsset?.path === asset.path
        ? task.bottomTransform
        : createCoverTransform(asset, getOverlayRegionHeight(task.videoY, 'bottom'));
      return {
        ...task,
        topAsset: asset,
        bottomAsset: asset,
        topTransform,
        bottomTransform,
        sameSource: true,
        name: getTaskName(asset, asset, true),
        status: 'editing',
        error: null,
        progress: 0,
        outputs: [],
      };
    });
  }, [updateCurrentTask]);

  const swapAssets = useCallback(() => {
    updateCurrentTask((task) => {
      const topHeight = getOverlayRegionHeight(task.videoY, 'top');
      const bottomHeight = getOverlayRegionHeight(task.videoY, 'bottom');
      const nextTopTransform = task.bottomAsset
        ? denormalizeTransform(
            task.bottomAsset,
            topHeight,
            normalizeTransform(task.bottomAsset, bottomHeight, task.bottomTransform),
          )
        : EMPTY_OVERLAY_TRANSFORM;
      const nextBottomTransform = task.topAsset
        ? denormalizeTransform(
            task.topAsset,
            bottomHeight,
            normalizeTransform(task.topAsset, topHeight, task.topTransform),
          )
        : EMPTY_OVERLAY_TRANSFORM;
      return {
        ...task,
        topAsset: task.bottomAsset,
        bottomAsset: task.topAsset,
        topTransform: nextTopTransform,
        bottomTransform: nextBottomTransform,
        topLocked: task.bottomLocked,
        bottomLocked: task.topLocked,
        sameSource: false,
        name: getTaskName(task.bottomAsset, task.topAsset, false),
        status: 'editing',
        error: null,
        progress: 0,
        outputs: [],
      };
    });
  }, [updateCurrentTask]);

  const removeTask = useCallback((taskId: string) => {
    setTasks((current) => {
      const index = current.findIndex((task) => task.id === taskId);
      const next = current.filter((task) => task.id !== taskId);
      if (currentTaskId === taskId) {
        setCurrentTaskId(next[Math.min(index, Math.max(0, next.length - 1))]?.id || null);
      }
      return next;
    });
  }, [currentTaskId]);

  const requestRemoveTask = useCallback((taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.status === 'exporting') return;
    setConfirmAction({
      title: '删除贴片任务',
      message: `确认删除「${task.name}」吗？此操作不会删除原图片。`,
      confirmText: '确认删除',
      onConfirm: () => removeTask(taskId),
    });
  }, [tasks, removeTask]);

  const duplicateCurrentTask = useCallback(() => {
    if (!currentTask) return;
    const duplicate: OverlayEditorTask = {
      ...currentTask,
      id: createLocalTaskId(),
      name: `${currentTask.name}_副本`,
      topTransform: { ...currentTask.topTransform },
      bottomTransform: { ...currentTask.bottomTransform },
      exportOptions: { ...currentTask.exportOptions },
      status: 'editing',
      error: null,
      taskCenterId: undefined,
      progress: 0,
      outputs: [],
    };
    setTasks((current) => [...current, duplicate]);
    setCurrentTaskId(duplicate.id);
  }, [currentTask]);

  const clearAllTasks = useCallback(() => {
    if (tasks.some((task) => task.status === 'exporting')) return;
    setConfirmAction({
      title: '清空全部任务',
      message: `确认清空当前 ${tasks.length} 个贴片任务吗？原始图片不会被删除。`,
      confirmText: '确认清空',
      onConfirm: () => {
        setTasks([]);
        setCurrentTaskId(null);
        setExportSessionIds([]);
        addLog('已清空全部贴片任务', 'info');
      },
    });
  }, [tasks, addLog]);

  const moveCurrent = useCallback((delta: number) => {
    if (!currentTaskId || tasks.length === 0) return;
    const index = tasks.findIndex((task) => task.id === currentTaskId);
    const nextIndex = Math.min(tasks.length - 1, Math.max(0, index + delta));
    setCurrentTaskId(tasks[nextIndex]?.id || currentTaskId);
  }, [currentTaskId, tasks]);

  const mutateActiveTransform = useCallback((
    updater: (transform: OverlayCropTransform, asset: OverlayAsset, regionHeight: number) => OverlayCropTransform,
  ) => {
    if (!currentTask || editingTarget === 'video') return;
    const asset = editingTarget === 'top' ? currentTask.topAsset : currentTask.bottomAsset;
    const locked = editingTarget === 'top' ? currentTask.topLocked : currentTask.bottomLocked;
    if (!asset || locked) return;
    const key = editingTarget === 'top' ? 'topTransform' : 'bottomTransform';
    const regionHeight = getOverlayRegionHeight(currentTask.videoY, editingTarget);
    updateCurrentTask((task) => ({
      ...task,
      [key]: updater(task[key], asset, regionHeight),
      status: 'editing',
      error: null,
      progress: 0,
      outputs: [],
    }));
  }, [currentTask, editingTarget, updateCurrentTask]);

  const applyVideoY = useCallback((target: 'all' | 'selected') => {
    if (!currentTask) return;
    const targetTasks = tasks.filter((task) =>
      task.id !== currentTask.id && (target === 'all' || task.selected),
    );
    if (targetTasks.length === 0) {
      addLog(target === 'all' ? '没有其他任务可应用' : '没有选中的其他任务', 'warning');
      return;
    }
    setConfirmAction({
      title: '批量应用横版区域位置',
      message: `确认将 Y=${currentTask.videoY} 应用到 ${targetTasks.length} 个任务吗？`,
      confirmText: '确认应用',
      onConfirm: () => {
        setTasks((current) => current.map((task) => {
          if (!targetTasks.some((targetTask) => targetTask.id === task.id)) return task;
          const oldTopHeight = getOverlayRegionHeight(task.videoY, 'top');
          const oldBottomHeight = getOverlayRegionHeight(task.videoY, 'bottom');
          const newTopHeight = getOverlayRegionHeight(currentTask.videoY, 'top');
          const newBottomHeight = getOverlayRegionHeight(currentTask.videoY, 'bottom');
          return {
            ...task,
            videoY: currentTask.videoY,
            topTransform: task.topAsset
              ? denormalizeTransform(task.topAsset, newTopHeight, normalizeTransform(task.topAsset, oldTopHeight, task.topTransform))
              : task.topTransform,
            bottomTransform: task.bottomAsset
              ? denormalizeTransform(task.bottomAsset, newBottomHeight, normalizeTransform(task.bottomAsset, oldBottomHeight, task.bottomTransform))
              : task.bottomTransform,
            status: 'editing',
            error: null,
            progress: 0,
            outputs: [],
          };
        }));
        addLog(`已将横版区域位置应用到 ${targetTasks.length} 个任务`, 'success');
      },
    });
  }, [currentTask, tasks, addLog]);

  const applyActiveRegion = useCallback((target: 'all' | 'selected') => {
    if (!currentTask || editingTarget === 'video') return;
    const sourceAsset = editingTarget === 'top' ? currentTask.topAsset : currentTask.bottomAsset;
    const sourceTransform = editingTarget === 'top' ? currentTask.topTransform : currentTask.bottomTransform;
    if (!sourceAsset) return;
    const sourceHeight = getOverlayRegionHeight(currentTask.videoY, editingTarget);
    const normalized = normalizeTransform(sourceAsset, sourceHeight, sourceTransform);
    const targetTasks = tasks.filter((task) => task.id !== currentTask.id && (target === 'all' || task.selected));
    if (targetTasks.length === 0) return;
    setConfirmAction({
      title: `批量应用${editingTarget === 'top' ? '上' : '下'}半部分参数`,
      message: `将按标准化缩放和构图位置应用到 ${targetTasks.length} 个任务，确认继续吗？`,
      confirmText: '确认应用',
      onConfirm: () => {
        setTasks((current) => current.map((task) => {
          if (!targetTasks.some((item) => item.id === task.id)) return task;
          const asset = editingTarget === 'top' ? task.topAsset : task.bottomAsset;
          if (!asset) return task;
          const regionHeight = getOverlayRegionHeight(task.videoY, editingTarget);
          const key = editingTarget === 'top' ? 'topTransform' : 'bottomTransform';
          return {
            ...task,
            [key]: denormalizeTransform(asset, regionHeight, normalized),
            status: 'editing',
            error: null,
            progress: 0,
            outputs: [],
          };
        }));
        addLog(`已应用${editingTarget === 'top' ? '上' : '下'}半部分参数`, 'success');
      },
    });
  }, [currentTask, editingTarget, tasks, addLog]);

  const startExport = useCallback(async (requestedTasks: OverlayEditorTask[]) => {
    if (isPaused) {
      addLog('任务中心当前已暂停，请先在任务中心恢复后再导出', 'warning');
      return;
    }
    if (!outputDir) {
      addLog('请先选择导出目录', 'warning');
      return;
    }

    const validTasks: OverlayEditorTask[] = [];
    for (const task of requestedTasks) {
      const error = validateOverlayTask(task);
      if (error) {
        updateTask(task.id, (current) => ({ ...current, status: 'failed', error, progress: 0 }));
        addLog(`「${task.name}」无法导出: ${error}`, 'error');
      } else {
        validTasks.push(task);
      }
    }
    if (validTasks.length === 0) return;

    setIsSubmitting(true);
    cancelRequestedRef.current = false;
    setExportSessionIds(validTasks.map((task) => task.id));
    setTasks((current) => current.map((task) => validTasks.some((item) => item.id === task.id)
      ? { ...task, status: 'exporting', error: null, progress: 0, outputs: [] }
      : task));
    addLog(`正在将 ${validTasks.length} 个贴片任务加入任务中心...`, 'info');

    for (const task of validTasks) {
      if (cancelRequestedRef.current) {
        updateTask(task.id, (current) => ({
          ...current,
          status: 'cancelled',
          error: '用户已取消',
          progress: 0,
        }));
        continue;
      }
      try {
        const result = await createTask({
          type: 'overlay_generator',
          name: task.name,
          outputDir,
          params: { ...toOverlayGeneratorTaskConfig(task) },
          files: [
            { path: task.topAsset!.path, category: 'top', categoryLabel: '上半部分素材' },
            { path: task.bottomAsset!.path, category: 'bottom', categoryLabel: '下半部分素材' },
          ],
          maxRetry: 1,
        });
        if (!result.success || !result.task) {
          throw new Error(result.error || '创建任务中心任务失败');
        }
        taskCenterMapRef.current.set(result.task.id, task.id);
        updateTask(task.id, (current) => ({ ...current, taskCenterId: result.task!.id }));
        if (cancelRequestedRef.current) {
          await cancelTask(result.task.id);
        } else {
          // 显式请求启动；若任务中心已自动启动，此调用会被安全忽略。
          await startTask(result.task.id);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        updateTask(task.id, (current) => ({ ...current, status: 'failed', error: message, progress: 0 }));
        addLog(`「${task.name}」加入任务中心失败: ${message}`, 'error');
      }
    }
    setIsSubmitting(false);
  }, [isPaused, outputDir, createTask, startTask, cancelTask, updateTask, addLog]);

  // 将任务中心事件映射回页面内的独立贴片任务。
  useEffect(() => {
    const cleanups = [
      window.api.onTaskProgress(({ taskId, progress }) => {
        const localId = taskCenterMapRef.current.get(taskId);
        if (!localId) return;
        updateTask(localId, (task) => ({ ...task, status: 'exporting', progress }));
      }),
      window.api.onTaskLog(({ taskId, log }) => {
        const localId = taskCenterMapRef.current.get(taskId);
        if (!localId) return;
        const taskName = tasksRef.current.find((task) => task.id === localId)?.name || '贴片任务';
        const type = log.level === 'error' ? 'error' : log.level === 'warning' ? 'warning' : 'info';
        addLog(`「${taskName}」${log.message}`, type, log.timestamp);
      }),
      window.api.onTaskCompleted(({ taskId, outputs }) => {
        const localId = taskCenterMapRef.current.get(taskId);
        if (!localId) return;
        taskCenterMapRef.current.delete(taskId);
        updateTask(localId, (task) => ({
          ...task,
          status: 'success',
          progress: 100,
          error: null,
          outputs: outputs.map((output: { path: string }) => output.path),
        }));
        addLog('贴片任务导出成功', 'success');
      }),
      window.api.onTaskFailed(({ taskId, error }) => {
        const localId = taskCenterMapRef.current.get(taskId);
        if (!localId) return;
        taskCenterMapRef.current.delete(taskId);
        const message = error?.message || String(error || '未知错误');
        updateTask(localId, (task) => ({ ...task, status: 'failed', progress: 0, error: message }));
        addLog(`贴片任务导出失败: ${message}`, 'error');
      }),
      window.api.onTaskCancelled(({ taskId }) => {
        const localId = taskCenterMapRef.current.get(taskId);
        if (!localId) return;
        taskCenterMapRef.current.delete(taskId);
        updateTask(localId, (task) => ({ ...task, status: 'cancelled', progress: 0, error: '用户已取消' }));
        addLog('贴片任务已取消', 'warning');
      }),
    ];
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [updateTask, addLog]);

  const exportSessionTasks = useMemo(
    () => exportSessionIds.map((id) => tasks.find((task) => task.id === id)).filter(Boolean) as OverlayEditorTask[],
    [exportSessionIds, tasks],
  );
  const exportingTasks = exportSessionTasks.filter((task) => task.status === 'exporting');
  const successfulCount = exportSessionTasks.filter((task) => task.status === 'success').length;
  const failedCount = exportSessionTasks.filter((task) => task.status === 'failed').length;
  const cancelledCount = exportSessionTasks.filter((task) => task.status === 'cancelled').length;
  const completedCount = successfulCount + failedCount + cancelledCount;
  const sessionProgress = exportSessionTasks.length > 0
    ? Math.round(exportSessionTasks.reduce((sum, task) => (
        sum + (['success', 'failed', 'cancelled'].includes(task.status) ? 100 : task.progress)
      ), 0) / exportSessionTasks.length)
    : 0;
  const isExporting = exportingTasks.length > 0 || isSubmitting;

  const cancelExports = useCallback(async () => {
    cancelRequestedRef.current = true;
    const taskCenterIds = exportingTasks.map((task) => task.taskCenterId).filter((id): id is number => !!id);
    setTasks((current) => current.map((task) => (
      exportSessionIds.includes(task.id) && task.status === 'exporting' && !task.taskCenterId
        ? { ...task, status: 'cancelled', error: '用户已取消', progress: 0 }
        : task
    )));
    await Promise.all(taskCenterIds.map((id) => cancelTask(id)));
  }, [exportingTasks, exportSessionIds, cancelTask]);

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    if (taskFilter === 'failed') return task.status === 'failed';
    if (taskFilter === 'incomplete') return task.status !== 'success';
    return true;
  }), [tasks, taskFilter]);

  const selectedTasks = tasks.filter((task) => task.selected);
  const activeAsset = currentTask && editingTarget !== 'video'
    ? (editingTarget === 'top' ? currentTask.topAsset : currentTask.bottomAsset)
    : null;
  const activeTransform = currentTask && editingTarget !== 'video'
    ? (editingTarget === 'top' ? currentTask.topTransform : currentTask.bottomTransform)
    : null;
  const activeLocked = currentTask && editingTarget !== 'video'
    ? (editingTarget === 'top' ? currentTask.topLocked : currentTask.bottomLocked)
    : false;
  const activeRegionHeight = currentTask && editingTarget !== 'video'
    ? getOverlayRegionHeight(currentTask.videoY, editingTarget)
    : 0;
  const activeCoverScale = activeAsset
    ? createCoverTransform(activeAsset, activeRegionHeight).scale
    : 1;
  const activeZoomPercent = activeTransform && activeCoverScale > 0
    ? Math.round((activeTransform.scale / activeCoverScale) * 100)
    : 100;
  const activeCovered = editingTarget === 'video'
    ? true
    : isRegionCovered(activeAsset, activeTransform || EMPTY_OVERLAY_TRANSFORM, activeRegionHeight);
  const activeCoverageGaps = editingTarget === 'video'
    ? { left: 0, right: 0, top: 0, bottom: 0 }
    : getRegionCoverageGaps(activeAsset, activeTransform || EMPTY_OVERLAY_TRANSFORM, activeRegionHeight);
  const activeCoverageMessage = [
    activeCoverageGaps.top > 0 ? `顶部缺少 ${activeCoverageGaps.top}px` : '',
    activeCoverageGaps.bottom > 0 ? `底部缺少 ${activeCoverageGaps.bottom}px` : '',
    activeCoverageGaps.left > 0 ? `左侧缺少 ${activeCoverageGaps.left}px` : '',
    activeCoverageGaps.right > 0 ? `右侧缺少 ${activeCoverageGaps.right}px` : '',
  ].filter(Boolean).join('、');

  const updateExportOptions = useCallback((key: keyof OverlayExportOptions, checked: boolean) => {
    setTasks((current) => current.map((task) => ({
      ...task,
      exportOptions: { ...task.exportOptions, [key]: checked },
      status: task.status === 'exporting' ? task.status : 'editing',
      progress: task.status === 'exporting' ? task.progress : 0,
      outputs: task.status === 'exporting' ? task.outputs : [],
    })));
  }, []);

  const hasUnexportedTasks = tasks.some((task) => task.status !== 'success');
  const canLeave = useCallback(() => {
    if (isExporting) {
      window.alert('贴片任务正在处理中，请先取消处理后再离开。');
      return false;
    }
    if (hasUnexportedTasks) {
      return window.confirm('当前还有未导出的贴片任务，确认离开吗？');
    }
    return true;
  }, [isExporting, hasUnexportedTasks]);

  useEffect(() => workshopMode?.registerModeChangeGuard(() => canLeave()), [workshopMode, canLeave]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isExporting && !hasUnexportedTasks) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isExporting, hasUnexportedTasks]);

  const handleBack = useCallback(() => {
    if (canLeave()) navigate('/', { replace: true });
  }, [canLeave, navigate]);

  const handleMetalMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const root = metalRootRef.current;
    if (!root) return;
    root.style.setProperty('--metal-glint-x', `${event.clientX}px`);
    root.style.setProperty('--metal-glint-y', `${event.clientY}px`);
  }, []);

  return (
    <div
      ref={metalRootRef}
      onMouseMove={handleMetalMouseMove}
      className={`${workspaceSkinClassName} h-screen flex flex-col overflow-hidden font-sans transition-colors duration-300 ${
        isLightTheme ? 'theme-light-page bg-[#F8F8F5] text-[#222222]' : 'bg-[#181818] text-[#D1D1D1]'
      }`}
    >
      <PageHeader
        title="图片素材工坊 · 贴片生成器"
        icon={Layers3}
        iconColor={isLightTheme ? 'text-amber-600' : 'text-amber-400'}
        description="批量制作 1080×1920 中间透明的竖版视频贴片"
        onBack={handleBack}
        featureInfo={{
          title: '贴片生成器',
          description: '从上下原始图片高清裁切，中间保留固定 1080×608 Alpha 透明区域。',
          details: [
            '每个任务拥有独立的上、下素材槽和裁切参数',
            '横版透明区域只能上下移动，并支持 Y 坐标输入',
            '预览使用 Canvas，最终导出由 Sharp 从原图重新渲染',
            '批量导出接入任务中心，可取消并保留失败原因',
          ],
          themeColor: 'amber',
        }}
        rightContent={
          <div className="flex items-center gap-2">
            <ImageWorkshopModeSwitcher mode="overlay" />
            {!isMetalSkin && <PageThemeToggle isLightTheme={isLightTheme} onToggle={togglePageTheme} />}
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 gap-2 overflow-hidden p-2">
        <aside
          className="metal-panel metal-sidebar flex w-[370px] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-800"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const paths = Array.from(event.dataTransfer.files)
              .map((file) => window.api.getPathForFile(file))
              .filter(Boolean);
            void importPaths(paths);
          }}
        >
          <div className="border-b border-slate-800 p-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                size="sm"
                themeColor="amber"
                disabled={isImporting || isExporting}
                loading={isImporting}
                leftIcon={<ImagePlus className="h-3.5 w-3.5" />}
                onClick={() => void pickAndImport(false)}
              >
                导入单张
              </Button>
              <Button
                variant="secondary"
                size="sm"
                themeColor="amber"
                disabled={isImporting || isExporting}
                leftIcon={<Upload className="h-3.5 w-3.5" />}
                onClick={() => void pickAndImport(true)}
              >
                批量导入
              </Button>
            </div>
            <p className="mt-2 text-center text-[10px] text-slate-600">也可将多张图片拖入此栏，每张图创建一个任务</p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col border-b border-slate-800">
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                <ListFilter className="h-3.5 w-3.5" />
                任务列表 <span className="text-slate-600">{filteredTasks.length}/{tasks.length}</span>
              </div>
              <select
                value={taskFilter}
                onChange={(event) => setTaskFilter(event.target.value as typeof taskFilter)}
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-400 outline-none"
              >
                <option value="all">全部任务</option>
                <option value="incomplete">仅未完成</option>
                <option value="failed">仅失败</option>
              </select>
            </div>
            <div className="flex-1 space-y-1.5 overflow-y-auto px-2 pb-2 custom-scrollbar">
              {filteredTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 px-4 py-8 text-center text-xs text-slate-600">
                  暂无贴片任务
                </div>
              ) : filteredTasks.map((task, index) => {
                const status = getDisplayStatus(task);
                return (
                  <button
                    type="button"
                    key={task.id}
                    onClick={() => setCurrentTaskId(task.id)}
                    className={`w-full rounded-xl border p-2 text-left transition-colors ${
                      currentTaskId === task.id
                        ? 'border-amber-500/60 bg-amber-500/10'
                        : 'border-slate-800 bg-black/30 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={task.selected}
                        onChange={(event) => {
                          event.stopPropagation();
                          updateTask(task.id, (current) => ({ ...current, selected: event.target.checked }));
                        }}
                        onClick={(event) => event.stopPropagation()}
                        className="accent-amber-500"
                      />
                      <span className="w-5 shrink-0 text-center text-[10px] font-bold text-slate-500">{index + 1}</span>
                      <div className="flex -space-x-2">
                        {[task.topAsset, task.bottomAsset].map((asset, assetIndex) => (
                          <div key={assetIndex} className="h-8 w-8 overflow-hidden rounded-md border-2 border-slate-900 bg-slate-800">
                            {asset?.thumbnail && <img src={asset.thumbnail} alt="" className="h-full w-full object-cover" />}
                          </div>
                        ))}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-medium text-slate-200">{task.name}</p>
                        <div className="mt-1 flex items-center gap-1">
                          <span className={`rounded border px-1.5 py-0.5 text-[9px] ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>
                          <span className="text-[9px] text-slate-600">{task.sameSource ? '同素材' : '双素材'}</span>
                          {task.topLocked && <Lock className="h-2.5 w-2.5 text-amber-500" />}
                          {task.bottomLocked && <Lock className="h-2.5 w-2.5 text-amber-500" />}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          requestRemoveTask(task.id);
                        }}
                        disabled={isExporting}
                        className="rounded-md p-1 text-slate-600 hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-30"
                        aria-label="删除任务"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {task.status === 'exporting' && (
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full bg-amber-500 transition-all" style={{ width: `${task.progress}%` }} />
                      </div>
                    )}
                    {task.error && <p className="mt-1.5 truncate text-[9px] text-rose-400">{task.error}</p>}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-4 gap-1.5 border-t border-slate-800 p-2">
              <button type="button" onClick={() => setTasks((current) => current.map((task) => ({ ...task, selected: true })))} className="rounded-md border border-slate-800 px-1 py-1.5 text-[9px] text-slate-400 hover:text-white">全选</button>
              <button type="button" onClick={() => setTasks((current) => current.map((task) => ({ ...task, selected: false })))} className="rounded-md border border-slate-800 px-1 py-1.5 text-[9px] text-slate-400 hover:text-white">取消全选</button>
              <button type="button" onClick={duplicateCurrentTask} disabled={!currentTask || isExporting} className="rounded-md border border-slate-800 px-1 py-1.5 text-[9px] text-slate-400 hover:text-white disabled:opacity-30">复制任务</button>
              <button type="button" onClick={clearAllTasks} disabled={tasks.length === 0 || isExporting} className="rounded-md border border-rose-500/20 px-1 py-1.5 text-[9px] text-rose-400 hover:bg-rose-500/10 disabled:opacity-30">清空任务</button>
            </div>
          </div>

          {currentTask && (
            <div className="max-h-[43%] space-y-2 overflow-y-auto p-3 custom-scrollbar">
              <label className="flex items-center justify-between rounded-lg border border-slate-800 bg-black/30 px-3 py-2 text-xs text-slate-300">
                <span>上下使用同一素材</span>
                <input
                  type="checkbox"
                  checked={currentTask.sameSource}
                  disabled={isExporting}
                  onChange={(event) => toggleSameSource(event.target.checked)}
                  className="h-4 w-4 accent-amber-500"
                />
              </label>
              <AssetSlot
                label="上半部分素材"
                asset={currentTask.topAsset}
                active={editingTarget === 'top'}
                locked={currentTask.topLocked}
                disabled={isExporting}
                onSelect={() => setEditingTarget('top')}
                onReplace={() => void replaceRegionAsset('top')}
                onClear={() => clearRegionAsset('top')}
              />
              <AssetSlot
                label="下半部分素材"
                asset={currentTask.bottomAsset}
                active={editingTarget === 'bottom'}
                locked={currentTask.bottomLocked}
                disabled={isExporting}
                onSelect={() => setEditingTarget('bottom')}
                onReplace={() => void replaceRegionAsset('bottom')}
                onClear={() => clearRegionAsset('bottom')}
              />
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" size="sm" disabled={isExporting} leftIcon={<ArrowDownUp className="h-3.5 w-3.5" />} onClick={swapAssets}>上下互换</Button>
                <Button variant="ghost" size="sm" disabled={isExporting || currentTask.sameSource} leftIcon={<Link className="h-3.5 w-3.5" />} onClick={() => toggleSameSource(true)}>重新关联</Button>
              </div>
            </div>
          )}
        </aside>

        <main className="metal-panel metal-workspace flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-800">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 px-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-200">{currentTask?.name || '贴片预览区'}</p>
              <p className="mt-0.5 text-[10px] text-slate-600">
                {currentTask ? `当前编辑：${editingTarget === 'top' ? '上半部分' : editingTarget === 'bottom' ? '下半部分' : '横版透明区域'}` : '固定画布 1080×1920'}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => moveCurrent(-1)} disabled={!currentTask || tasks.findIndex((task) => task.id === currentTaskId) <= 0} className="rounded-lg border border-slate-800 p-1.5 text-slate-400 hover:text-white disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
              <span className="min-w-12 text-center text-[10px] text-slate-500">{currentTask ? `${tasks.findIndex((task) => task.id === currentTask.id) + 1} / ${tasks.length}` : '0 / 0'}</span>
              <button type="button" onClick={() => moveCurrent(1)} disabled={!currentTask || tasks.findIndex((task) => task.id === currentTaskId) >= tasks.length - 1} className="rounded-lg border border-slate-800 p-1.5 text-slate-400 hover:text-white disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <OverlayCanvas
              task={currentTask}
              editingTarget={editingTarget}
              onEditingTargetChange={setEditingTarget}
              onTaskChange={updateCurrentTask}
              onDropAsset={(region, path) => void replaceRegionAsset(region, path, true)}
              disabled={isExporting}
            />
          </div>
          <div className="grid h-12 shrink-0 grid-cols-3 border-t border-slate-800 bg-black/20 text-center text-[10px] text-slate-500">
            <div className="flex items-center justify-center">上半部分：{currentTask?.videoY ?? OVERLAY_CENTER_Y}px</div>
            <div className="flex items-center justify-center border-x border-slate-800 text-cyan-400">透明区域：1080×608</div>
            <div className="flex items-center justify-center">下半部分：{currentTask ? getOverlayRegionHeight(currentTask.videoY, 'bottom') : OVERLAY_CENTER_Y}px</div>
          </div>
        </main>

        <aside className="metal-panel metal-sidebar flex w-[350px] shrink-0 flex-col overflow-y-auto rounded-2xl border border-slate-800 p-3 custom-scrollbar">
          <div className="space-y-3">
            <section className="rounded-xl border border-slate-800 bg-black/30 p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">编辑目标</p>
              <div className="grid grid-cols-3 gap-1.5">
                {(['top', 'video', 'bottom'] as OverlayEditingTarget[]).map((target) => (
                  <button
                    type="button"
                    key={target}
                    onClick={() => setEditingTarget(target)}
                    className={`rounded-lg border px-2 py-1.5 text-[10px] transition-colors ${
                      editingTarget === target
                        ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                        : 'border-slate-800 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {target === 'top' ? '上半部分' : target === 'bottom' ? '下半部分' : '透明区域'}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-black/30 p-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-400">横版区域 Y 坐标</label>
                <span className="text-[10px] text-slate-600">范围 0–1312</span>
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  min={0}
                  max={1312}
                  value={currentTask?.videoY ?? OVERLAY_CENTER_Y}
                  disabled={!currentTask || isExporting}
                  onChange={(event) => updateCurrentTask((task) => ({
                    ...task,
                    videoY: clampOverlayVideoY(Number(event.target.value)),
                    status: 'editing',
                    error: null,
                    progress: 0,
                    outputs: [],
                  }))}
                  className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-amber-500 disabled:opacity-40"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  themeColor="amber"
                  disabled={!currentTask || isExporting}
                  onClick={() => updateCurrentTask((task) => ({ ...task, videoY: OVERLAY_CENTER_Y, status: 'editing', progress: 0, outputs: [] }))}
                >
                  垂直居中
                </Button>
              </div>
              <p className="mt-2 text-[10px] text-slate-600">画布内拖动透明区域，或聚焦画布后用 ↑ / ↓ 微调（Shift 为 10px）</p>
            </section>

            {currentTask && editingTarget !== 'video' && activeTransform && (
              <section className="rounded-xl border border-slate-800 bg-black/30 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-slate-400">{editingTarget === 'top' ? '上' : '下'}半部分裁切参数</p>
                  <span className={`rounded border px-1.5 py-0.5 text-[9px] ${activeCovered ? 'border-emerald-500/30 text-emerald-400' : 'border-rose-500/30 text-rose-400'}`}>
                    {activeCovered ? '覆盖完整' : '覆盖不完整'}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
                  <label>缩放比例 {activeZoomPercent}%</label>
                  <span className="text-[9px] text-slate-600">100% = 自动填充</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={300}
                  step={1}
                  value={Math.min(300, Math.max(50, activeZoomPercent))}
                  disabled={activeLocked || isExporting}
                  onChange={(event) => mutateActiveTransform((transform, asset, height) => ({
                    ...transform,
                    scale: createCoverTransform(asset, height).scale * (Number(event.target.value) / 100),
                  }))}
                  className="mt-1 w-full accent-amber-500 disabled:opacity-40"
                />
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    ['缩放%', activeZoomPercent, 'scale'],
                    ['X', Math.round(activeTransform.x), 'x'],
                    ['Y', Math.round(activeTransform.y), 'y'],
                  ].map(([label, value, key]) => (
                    <label key={String(key)} className="text-[9px] text-slate-600">
                      {label}
                      <input
                        type="number"
                        value={Number(value)}
                        min={key === 'scale' ? 50 : undefined}
                        max={key === 'scale' ? 300 : undefined}
                        step={1}
                        disabled={activeLocked || isExporting}
                        onChange={(event) => mutateActiveTransform((transform, asset, height) => {
                          const nextValue = Number(event.target.value);
                          if (key === 'scale') {
                            const nextPercent = Math.min(300, Math.max(50, nextValue));
                            return {
                              ...transform,
                              scale: createCoverTransform(asset, height).scale * (nextPercent / 100),
                            };
                          }
                          return { ...transform, [key as 'x' | 'y']: nextValue };
                        })}
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] text-slate-300 outline-none focus:border-amber-500 disabled:opacity-40"
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  <button type="button" disabled={!activeAsset || activeLocked || isExporting} onClick={() => mutateActiveTransform((_transform, asset, height) => createCoverTransform(asset, height))} className="rounded-lg border border-slate-700 px-2 py-1.5 text-[9px] text-slate-300 hover:border-amber-500/40 disabled:opacity-30"><Maximize2 className="mr-1 inline h-3 w-3" />填充区域</button>
                  <button type="button" disabled={!activeAsset || activeLocked || isExporting} onClick={() => mutateActiveTransform((_transform, asset, height) => createContainTransform(asset, height))} className="rounded-lg border border-slate-700 px-2 py-1.5 text-[9px] text-slate-300 hover:border-amber-500/40 disabled:opacity-30">适应区域</button>
                  <button type="button" disabled={!activeAsset || activeLocked || isExporting} onClick={() => mutateActiveTransform((transform, asset, height) => centerTransform(asset, height, transform))} className="rounded-lg border border-slate-700 px-2 py-1.5 text-[9px] text-slate-300 hover:border-amber-500/40 disabled:opacity-30">图片居中</button>
                </div>
                {!activeCovered && (
                  <div className="mt-2 rounded-lg border border-rose-500/20 bg-rose-500/5 p-2 text-[10px] leading-4 text-rose-400">
                    当前图片未完全覆盖：{activeAsset ? activeCoverageMessage : '当前区域没有素材'}。
                    画布对应边缘已用红线标出；可点击“填充区域”自动修复。
                  </div>
                )}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button variant="ghost" size="sm" disabled={!activeAsset || isExporting} leftIcon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => mutateActiveTransform((_transform, asset, height) => createCoverTransform(asset, height))}>恢复默认</Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    themeColor={activeLocked ? 'rose' : 'amber'}
                    disabled={isExporting}
                    leftIcon={activeLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    onClick={() => updateCurrentTask((task) => editingTarget === 'top'
                      ? { ...task, topLocked: !task.topLocked }
                      : { ...task, bottomLocked: !task.bottomLocked })}
                  >
                    {activeLocked ? '解锁区域' : '锁定区域'}
                  </Button>
                </div>
              </section>
            )}

            <section className="rounded-xl border border-slate-800 bg-black/30 p-3">
              <p className="mb-2 text-[11px] font-bold text-slate-400">应用到其他任务</p>
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" disabled={!currentTask || isExporting} onClick={() => applyVideoY('all')} className="rounded-lg border border-slate-700 px-2 py-1.5 text-[9px] text-slate-300 hover:border-amber-500/40 disabled:opacity-30">Y 坐标 → 全部</button>
                <button type="button" disabled={!currentTask || selectedTasks.length === 0 || isExporting} onClick={() => applyVideoY('selected')} className="rounded-lg border border-slate-700 px-2 py-1.5 text-[9px] text-slate-300 hover:border-amber-500/40 disabled:opacity-30">Y 坐标 → 选中</button>
                <button type="button" disabled={!currentTask || editingTarget === 'video' || isExporting} onClick={() => applyActiveRegion('all')} className="rounded-lg border border-slate-700 px-2 py-1.5 text-[9px] text-slate-300 hover:border-amber-500/40 disabled:opacity-30">当前区域 → 全部</button>
                <button type="button" disabled={!currentTask || editingTarget === 'video' || selectedTasks.length === 0 || isExporting} onClick={() => applyActiveRegion('selected')} className="rounded-lg border border-slate-700 px-2 py-1.5 text-[9px] text-slate-300 hover:border-amber-500/40 disabled:opacity-30">当前区域 → 选中</button>
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-black/30 p-3">
              <p className="mb-2 text-[11px] font-bold text-slate-400">导出选项</p>
              <div className="space-y-1.5">
                {([
                  ['transparentPng', '完整透明贴片 PNG'],
                  ['solidPreview', '带纯色背景的预览图'],
                  ['checkerPreview', '带棋盘格的预览图'],
                  ['topOnly', '仅导出上半部分'],
                  ['bottomOnly', '仅导出下半部分'],
                ] as Array<[keyof OverlayExportOptions, string]>).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-[10px] text-slate-400">
                    <input
                      type="checkbox"
                      checked={currentTask?.exportOptions[key] ?? DEFAULT_OVERLAY_EXPORT_OPTIONS[key]}
                      disabled={!currentTask || isExporting}
                      onChange={(event) => updateExportOptions(key, event.target.checked)}
                      className="accent-amber-500"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </section>

            <OutputDirSelector value={outputDir} onChange={setOutputDir} disabled={isExporting} themeColor="amber" />

            {exportSessionTasks.length > 0 && (
              <section className="rounded-xl border border-slate-800 bg-black/30 p-3">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>{isExporting ? `正在处理 ${Math.min(completedCount + 1, exportSessionTasks.length)} / ${exportSessionTasks.length}` : '处理完成'}</span>
                  <span>{sessionProgress}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all" style={{ width: `${sessionProgress}%` }} />
                </div>
                <p className="mt-2 truncate text-[10px] text-slate-500">当前：{exportingTasks[0]?.name || '无'}</p>
                <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[9px]">
                  <span className="rounded bg-emerald-500/10 px-1 py-1 text-emerald-400">成功 {successfulCount}</span>
                  <span className="rounded bg-rose-500/10 px-1 py-1 text-rose-400">失败 {failedCount}</span>
                  <span className="rounded bg-slate-800 px-1 py-1 text-slate-400">取消 {cancelledCount}</span>
                </div>
                {failedCount > 0 && !isExporting && (
                  <Button variant="secondary" size="sm" themeColor="rose" fullWidth className="mt-2" onClick={() => void startExport(exportSessionTasks.filter((task) => task.status === 'failed'))}>重新处理失败任务</Button>
                )}
              </section>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                size="sm"
                themeColor="amber"
                disabled={!currentTask || isExporting || !outputDir}
                leftIcon={<Play className="h-3.5 w-3.5" />}
                onClick={() => currentTask && void startExport([currentTask])}
              >
                导出当前
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={tasks.length === 0 || isExporting || !outputDir}
                loading={isSubmitting}
                leftIcon={<Check className="h-3.5 w-3.5" />}
                onClick={() => void startExport(selectedTasks.length > 0 ? selectedTasks : tasks)}
              >
                批量导出
              </Button>
            </div>
            {isExporting ? (
              <Button variant="danger" size="sm" fullWidth leftIcon={<CircleStop className="h-3.5 w-3.5" />} onClick={() => void cancelExports()}>取消处理</Button>
            ) : outputDir ? (
              <Button variant="ghost" size="sm" fullWidth leftIcon={<FolderOpen className="h-3.5 w-3.5" />} onClick={() => void window.api.openPath(outputDir)}>打开输出目录</Button>
            ) : null}

            <div className="min-h-[260px]">
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
                themeColor="amber"
              />
            </div>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        confirmText={confirmAction?.confirmText}
        type="warning"
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          const action = confirmAction;
          setConfirmAction(null);
          action?.onConfirm();
        }}
      />
    </div>
  );
};

export default OverlayGeneratorMode;
