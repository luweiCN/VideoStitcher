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
  clampOverlayPosition,
  getOverlayModeConfig,
  type OverlayCropTransform,
  type OverlayExportOptions,
  type OverlayRegionKey,
  type OverlayTemplateMode,
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
  getOverlayRegionSize,
  getRegionCoverageGaps,
  isRegionCovered,
  normalizeTransform,
  repairCoverageTransform,
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

interface OverlayModeEditorState {
  tasks: OverlayEditorTask[];
  currentTaskId: string | null;
  editingTarget: OverlayEditingTarget;
  taskFilter: 'all' | 'incomplete' | 'failed';
}

const createEmptyModeState = (): OverlayModeEditorState => ({
  tasks: [],
  currentTaskId: null,
  editingTarget: 'first',
  taskFilter: 'all',
});

const createLocalTaskId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `overlay-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const getBaseName = (fileName: string) => fileName.replace(/\.[^.]+$/, '');

const getTaskName = (
  first: OverlayAsset | null,
  second: OverlayAsset | null,
  sameSource: boolean,
  mode: OverlayTemplateMode,
) => {
  const suffix = getOverlayModeConfig(mode).outputSuffix;
  if (!first && !second) return `未命名_${suffix}`;
  if (sameSource || !first || !second || first.path === second.path) {
    return `${getBaseName((first || second)!.name)}_${suffix}`;
  }
  return `${getBaseName(first.name)}_${getBaseName(second.name)}_${suffix}`;
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
  const { createTask, startTask, cancelTask, isPaused } = useTaskContext();

  const [activeMode, setActiveMode] = useState<OverlayTemplateMode>('portrait');
  const [modeStates, setModeStates] = useState<Record<OverlayTemplateMode, OverlayModeEditorState>>({
    portrait: createEmptyModeState(),
    landscape: createEmptyModeState(),
  });
  const [isImporting, setIsImporting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<OverlayConfirmAction | null>(null);
  const [exportSessionIds, setExportSessionIds] = useState<string[]>([]);

  const modeState = modeStates[activeMode];
  const { tasks, currentTaskId, editingTarget, taskFilter } = modeState;
  const modeConfig = getOverlayModeConfig(activeMode);
  const allTasks = useMemo(
    () => [...modeStates.portrait.tasks, ...modeStates.landscape.tasks],
    [modeStates],
  );
  tasksRef.current = allTasks;

  const updateActiveModeState = useCallback((
    updater: (state: OverlayModeEditorState) => OverlayModeEditorState,
  ) => {
    setModeStates((current) => ({
      ...current,
      [activeMode]: updater(current[activeMode]),
    }));
  }, [activeMode]);

  const setTasks = useCallback((action: React.SetStateAction<OverlayEditorTask[]>) => {
    updateActiveModeState((state) => ({
      ...state,
      tasks: typeof action === 'function' ? action(state.tasks) : action,
    }));
  }, [updateActiveModeState]);

  const setCurrentTaskId = useCallback((action: React.SetStateAction<string | null>) => {
    updateActiveModeState((state) => ({
      ...state,
      currentTaskId: typeof action === 'function' ? action(state.currentTaskId) : action,
    }));
  }, [updateActiveModeState]);

  const setEditingTarget = useCallback((target: OverlayEditingTarget) => {
    updateActiveModeState((state) => ({ ...state, editingTarget: target }));
  }, [updateActiveModeState]);

  const setTaskFilter = useCallback((filter: OverlayModeEditorState['taskFilter']) => {
    updateActiveModeState((state) => ({ ...state, taskFilter: filter }));
  }, [updateActiveModeState]);

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

  /** 按任务 ID 跨模式更新，确保切换模式后任务中心事件仍能正确回写。 */
  const updateTask = useCallback((
    taskId: string,
    updater: (task: OverlayEditorTask) => OverlayEditorTask,
  ) => {
    setModeStates((current) => {
      let changed = false;
      const next = { ...current };
      (['portrait', 'landscape'] as OverlayTemplateMode[]).forEach((mode) => {
        const tasksInMode = current[mode].tasks;
        if (!tasksInMode.some((task) => task.id === taskId)) return;
        changed = true;
        next[mode] = {
          ...current[mode],
          tasks: tasksInMode.map((task) => task.id === taskId ? updater(task) : task),
        };
      });
      return changed ? next : current;
    });
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

  const createEditorTask = useCallback((
    asset: OverlayAsset,
    mode: OverlayTemplateMode,
  ): OverlayEditorTask => {
    const config = getOverlayModeConfig(mode);
    const firstSize = getOverlayRegionSize(config.centerPosition, 'first', mode);
    const secondSize = getOverlayRegionSize(config.centerPosition, 'second', mode);
    return {
      id: createLocalTaskId(),
      name: getTaskName(asset, asset, true, mode),
      mode,
      firstAsset: asset,
      secondAsset: asset,
      sameSource: true,
      position: config.centerPosition,
      firstTransform: createCoverTransform(asset, firstSize),
      secondTransform: createCoverTransform(asset, secondSize),
      firstLocked: false,
      secondLocked: false,
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
    const importMode = activeMode;
    setIsImporting(true);
    addLog(`正在为${getOverlayModeConfig(importMode).label}读取 ${paths.length} 张图片...`, 'info');
    const existingPaths = new Set(
      modeStates[importMode].tasks
        .filter((task) => task.sameSource)
        .map((task) => task.firstAsset?.path),
    );
    const created: OverlayEditorTask[] = [];

    // 逐张读取，避免批量导入时同时解码所有原图。
    for (const filePath of paths) {
      if (existingPaths.has(filePath)) {
        addLog(`已跳过当前模式的重复任务: ${filePath}`, 'warning');
        continue;
      }
      const asset = await loadAsset(filePath);
      if (!asset) continue;
      created.push(createEditorTask(asset, importMode));
      existingPaths.add(filePath);
    }

    if (created.length > 0) {
      setModeStates((current) => ({
        ...current,
        [importMode]: {
          ...current[importMode],
          tasks: [...current[importMode].tasks, ...created],
          currentTaskId: current[importMode].currentTaskId || created[0].id,
        },
      }));
      addLog(`已创建 ${created.length} 个${getOverlayModeConfig(importMode).label}任务，请逐张检查后导出`, 'success');
    }
    setIsImporting(false);
  }, [activeMode, modeStates, loadAsset, createEditorTask, addLog]);

  const pickAndImport = useCallback(async (multiple: boolean) => {
    const paths = await window.api.pickFiles(
      multiple ? `批量导入${modeConfig.label}素材` : `导入${modeConfig.label}素材`,
      IMAGE_FILTERS,
      multiple,
    );
    await importPaths(paths);
  }, [importPaths, modeConfig.label]);

  const replaceRegionAsset = useCallback(async (
    region: OverlayRegionKey,
    filePath?: string,
    fromDrop = false,
  ) => {
    if (!currentTask) return;
    const regionLabel = region === 'first' ? modeConfig.firstLabel : modeConfig.secondLabel;
    const paths = filePath
      ? [filePath]
      : await window.api.pickFiles(`替换${regionLabel}素材`, IMAGE_FILTERS, false);
    if (!paths[0]) return;
    const asset = await loadAsset(paths[0]);
    if (!asset) return;

    updateCurrentTask((task) => {
      const firstSize = getOverlayRegionSize(task.position, 'first', task.mode);
      const secondSize = getOverlayRegionSize(task.position, 'second', task.mode);
      if (task.sameSource && !fromDrop) {
        return {
          ...task,
          firstAsset: asset,
          secondAsset: asset,
          firstTransform: createCoverTransform(asset, firstSize),
          secondTransform: createCoverTransform(asset, secondSize),
          name: getTaskName(asset, asset, true, task.mode),
          status: 'editing',
          error: null,
          progress: 0,
          outputs: [],
        };
      }

      const next = region === 'first'
        ? {
            ...task,
            firstAsset: asset,
            firstTransform: createCoverTransform(asset, firstSize),
            sameSource: false,
          }
        : {
            ...task,
            secondAsset: asset,
            secondTransform: createCoverTransform(asset, secondSize),
            sameSource: false,
          };
      return {
        ...next,
        name: getTaskName(next.firstAsset, next.secondAsset, next.sameSource, task.mode),
        status: 'editing',
        error: null,
        progress: 0,
        outputs: [],
      };
    });
    addLog(`${regionLabel}素材已替换为 ${asset.name}`, 'info');
  }, [currentTask, modeConfig.firstLabel, modeConfig.secondLabel, loadAsset, updateCurrentTask, addLog]);

  const clearRegionAsset = useCallback((region: OverlayRegionKey) => {
    updateCurrentTask((task) => {
      const next = region === 'first'
        ? { ...task, firstAsset: null, firstTransform: EMPTY_OVERLAY_TRANSFORM, sameSource: false }
        : { ...task, secondAsset: null, secondTransform: EMPTY_OVERLAY_TRANSFORM, sameSource: false };
      return {
        ...next,
        name: getTaskName(next.firstAsset, next.secondAsset, false, task.mode),
        status: 'editing',
        error: null,
        progress: 0,
        outputs: [],
      };
    });
  }, [updateCurrentTask]);

  const toggleSameSource = useCallback((sameSource: boolean) => {
    updateCurrentTask((task) => {
      if (!sameSource) {
        return { ...task, sameSource: false, status: 'editing', progress: 0, outputs: [] };
      }
      const asset = task.firstAsset || task.secondAsset;
      if (!asset) return task;
      const firstTransform = task.firstAsset?.path === asset.path
        ? task.firstTransform
        : createCoverTransform(asset, getOverlayRegionSize(task.position, 'first', task.mode));
      const secondTransform = task.secondAsset?.path === asset.path
        ? task.secondTransform
        : createCoverTransform(asset, getOverlayRegionSize(task.position, 'second', task.mode));
      return {
        ...task,
        firstAsset: asset,
        secondAsset: asset,
        firstTransform,
        secondTransform,
        sameSource: true,
        name: getTaskName(asset, asset, true, task.mode),
        status: 'editing',
        error: null,
        progress: 0,
        outputs: [],
      };
    });
  }, [updateCurrentTask]);

  const swapAssets = useCallback(() => {
    updateCurrentTask((task) => {
      const firstSize = getOverlayRegionSize(task.position, 'first', task.mode);
      const secondSize = getOverlayRegionSize(task.position, 'second', task.mode);
      const nextFirstTransform = task.secondAsset
        ? denormalizeTransform(
            task.secondAsset,
            firstSize,
            normalizeTransform(task.secondAsset, secondSize, task.secondTransform),
          )
        : EMPTY_OVERLAY_TRANSFORM;
      const nextSecondTransform = task.firstAsset
        ? denormalizeTransform(
            task.firstAsset,
            secondSize,
            normalizeTransform(task.firstAsset, firstSize, task.firstTransform),
          )
        : EMPTY_OVERLAY_TRANSFORM;
      return {
        ...task,
        firstAsset: task.secondAsset,
        secondAsset: task.firstAsset,
        firstTransform: nextFirstTransform,
        secondTransform: nextSecondTransform,
        firstLocked: task.secondLocked,
        secondLocked: task.firstLocked,
        sameSource: false,
        name: getTaskName(task.secondAsset, task.firstAsset, false, task.mode),
        status: 'editing',
        error: null,
        progress: 0,
        outputs: [],
      };
    });
  }, [updateCurrentTask]);

  const removeTask = useCallback((taskId: string) => {
    updateActiveModeState((state) => {
      const index = state.tasks.findIndex((task) => task.id === taskId);
      const nextTasks = state.tasks.filter((task) => task.id !== taskId);
      return {
        ...state,
        tasks: nextTasks,
        currentTaskId: state.currentTaskId === taskId
          ? nextTasks[Math.min(index, Math.max(0, nextTasks.length - 1))]?.id || null
          : state.currentTaskId,
      };
    });
  }, [updateActiveModeState]);

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
      firstTransform: { ...currentTask.firstTransform },
      secondTransform: { ...currentTask.secondTransform },
      exportOptions: { ...currentTask.exportOptions },
      status: 'editing',
      error: null,
      taskCenterId: undefined,
      progress: 0,
      outputs: [],
    };
    setTasks((current) => [...current, duplicate]);
    setCurrentTaskId(duplicate.id);
  }, [currentTask, setCurrentTaskId, setTasks]);

  const clearAllTasks = useCallback(() => {
    if (tasks.some((task) => task.status === 'exporting')) return;
    setConfirmAction({
      title: `清空${modeConfig.label}任务`,
      message: `确认清空当前 ${tasks.length} 个${modeConfig.label}任务吗？原始图片不会被删除。`,
      confirmText: '确认清空',
      onConfirm: () => {
        setTasks([]);
        setCurrentTaskId(null);
        addLog(`已清空${modeConfig.label}任务`, 'info');
      },
    });
  }, [tasks, modeConfig.label, setTasks, setCurrentTaskId, addLog]);

  const moveCurrent = useCallback((delta: number) => {
    if (!currentTaskId || tasks.length === 0) return;
    const index = tasks.findIndex((task) => task.id === currentTaskId);
    const nextIndex = Math.min(tasks.length - 1, Math.max(0, index + delta));
    setCurrentTaskId(tasks[nextIndex]?.id || currentTaskId);
  }, [currentTaskId, tasks, setCurrentTaskId]);

  const mutateActiveTransform = useCallback((
    updater: (
      transform: OverlayCropTransform,
      asset: OverlayAsset,
      regionSize: { width: number; height: number },
    ) => OverlayCropTransform,
  ) => {
    if (!currentTask || editingTarget === 'video') return;
    const asset = editingTarget === 'first' ? currentTask.firstAsset : currentTask.secondAsset;
    const locked = editingTarget === 'first' ? currentTask.firstLocked : currentTask.secondLocked;
    if (!asset || locked) return;
    const key = editingTarget === 'first' ? 'firstTransform' : 'secondTransform';
    const regionSize = getOverlayRegionSize(currentTask.position, editingTarget, currentTask.mode);
    updateCurrentTask((task) => ({
      ...task,
      [key]: updater(task[key], asset, regionSize),
      status: 'editing',
      error: null,
      progress: 0,
      outputs: [],
    }));
  }, [currentTask, editingTarget, updateCurrentTask]);

  const applyPosition = useCallback((target: 'all' | 'selected') => {
    if (!currentTask) return;
    const targetTasks = tasks.filter((task) =>
      task.id !== currentTask.id && (target === 'all' || task.selected),
    );
    if (targetTasks.length === 0) {
      addLog(target === 'all' ? '没有其他任务可应用' : '没有选中的其他任务', 'warning');
      return;
    }
    setConfirmAction({
      title: `批量应用${modeConfig.transparentLabel}位置`,
      message: `确认将 ${modeConfig.axisLabel}=${currentTask.position} 应用到 ${targetTasks.length} 个任务吗？`,
      confirmText: '确认应用',
      onConfirm: () => {
        setTasks((current) => current.map((task) => {
          if (!targetTasks.some((targetTask) => targetTask.id === task.id)) return task;
          const oldFirstSize = getOverlayRegionSize(task.position, 'first', task.mode);
          const oldSecondSize = getOverlayRegionSize(task.position, 'second', task.mode);
          const newFirstSize = getOverlayRegionSize(currentTask.position, 'first', task.mode);
          const newSecondSize = getOverlayRegionSize(currentTask.position, 'second', task.mode);
          return {
            ...task,
            position: currentTask.position,
            firstTransform: task.firstAsset
              ? denormalizeTransform(
                  task.firstAsset,
                  newFirstSize,
                  normalizeTransform(task.firstAsset, oldFirstSize, task.firstTransform),
                )
              : task.firstTransform,
            secondTransform: task.secondAsset
              ? denormalizeTransform(
                  task.secondAsset,
                  newSecondSize,
                  normalizeTransform(task.secondAsset, oldSecondSize, task.secondTransform),
                )
              : task.secondTransform,
            status: 'editing',
            error: null,
            progress: 0,
            outputs: [],
          };
        }));
        addLog(`已将${modeConfig.transparentLabel}位置应用到 ${targetTasks.length} 个任务`, 'success');
      },
    });
  }, [currentTask, tasks, modeConfig, setTasks, addLog]);

  const applyActiveRegion = useCallback((target: 'all' | 'selected') => {
    if (!currentTask || editingTarget === 'video') return;
    const first = editingTarget === 'first';
    const sourceAsset = first ? currentTask.firstAsset : currentTask.secondAsset;
    const sourceTransform = first ? currentTask.firstTransform : currentTask.secondTransform;
    if (!sourceAsset) return;
    const sourceSize = getOverlayRegionSize(currentTask.position, editingTarget, currentTask.mode);
    const normalized = normalizeTransform(sourceAsset, sourceSize, sourceTransform);
    const targetTasks = tasks.filter((task) =>
      task.id !== currentTask.id && (target === 'all' || task.selected),
    );
    if (targetTasks.length === 0) return;
    const regionLabel = first ? modeConfig.firstLabel : modeConfig.secondLabel;
    setConfirmAction({
      title: `批量应用${regionLabel}参数`,
      message: `将按标准化缩放和构图位置应用到 ${targetTasks.length} 个任务，确认继续吗？`,
      confirmText: '确认应用',
      onConfirm: () => {
        setTasks((current) => current.map((task) => {
          if (!targetTasks.some((item) => item.id === task.id)) return task;
          const asset = first ? task.firstAsset : task.secondAsset;
          if (!asset) return task;
          const regionSize = getOverlayRegionSize(task.position, editingTarget, task.mode);
          const key = first ? 'firstTransform' : 'secondTransform';
          return {
            ...task,
            [key]: denormalizeTransform(asset, regionSize, normalized),
            status: 'editing',
            error: null,
            progress: 0,
            outputs: [],
          };
        }));
        addLog(`已应用${regionLabel}参数`, 'success');
      },
    });
  }, [currentTask, editingTarget, tasks, modeConfig, setTasks, addLog]);

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
    validTasks.forEach((task) => {
      updateTask(task.id, (current) => ({
        ...current,
        status: 'exporting',
        error: null,
        progress: 0,
        outputs: [],
      }));
    });
    addLog(`正在将 ${validTasks.length} 个${getOverlayModeConfig(validTasks[0].mode).label}任务加入任务中心...`, 'info');

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
        const taskModeConfig = getOverlayModeConfig(task.mode);
        const result = await createTask({
          type: 'overlay_generator',
          name: task.name,
          outputDir,
          params: { ...toOverlayGeneratorTaskConfig(task) },
          files: [
            {
              path: task.firstAsset!.path,
              category: task.mode === 'landscape' ? 'left' : 'top',
              categoryLabel: `${taskModeConfig.firstLabel}素材`,
            },
            {
              path: task.secondAsset!.path,
              category: task.mode === 'landscape' ? 'right' : 'bottom',
              categoryLabel: `${taskModeConfig.secondLabel}素材`,
            },
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
    () => exportSessionIds
      .map((id) => allTasks.find((task) => task.id === id))
      .filter(Boolean) as OverlayEditorTask[],
    [exportSessionIds, allTasks],
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
    const taskCenterIds = exportingTasks
      .map((task) => task.taskCenterId)
      .filter((id): id is number => !!id);
    exportSessionTasks.forEach((task) => {
      if (task.status === 'exporting' && !task.taskCenterId) {
        updateTask(task.id, (current) => ({
          ...current,
          status: 'cancelled',
          error: '用户已取消',
          progress: 0,
        }));
      }
    });
    await Promise.all(taskCenterIds.map((id) => cancelTask(id)));
  }, [exportingTasks, exportSessionTasks, cancelTask, updateTask]);

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    if (taskFilter === 'failed') return task.status === 'failed';
    if (taskFilter === 'incomplete') return task.status !== 'success';
    return true;
  }), [tasks, taskFilter]);

  const selectedTasks = tasks.filter((task) => task.selected);
  const activeAsset = currentTask && editingTarget !== 'video'
    ? (editingTarget === 'first' ? currentTask.firstAsset : currentTask.secondAsset)
    : null;
  const activeTransform = currentTask && editingTarget !== 'video'
    ? (editingTarget === 'first' ? currentTask.firstTransform : currentTask.secondTransform)
    : null;
  const activeLocked = currentTask && editingTarget !== 'video'
    ? (editingTarget === 'first' ? currentTask.firstLocked : currentTask.secondLocked)
    : false;
  const activeRegionSize = currentTask && editingTarget !== 'video'
    ? getOverlayRegionSize(currentTask.position, editingTarget, currentTask.mode)
    : { width: 0, height: 0 };
  const activeCoverScale = activeAsset
    ? createCoverTransform(activeAsset, activeRegionSize).scale
    : 1;
  const activeZoomPercent = activeTransform && activeCoverScale > 0
    ? Math.round((activeTransform.scale / activeCoverScale) * 100)
    : 100;
  const activeCovered = editingTarget === 'video'
    ? true
    : isRegionCovered(activeAsset, activeTransform || EMPTY_OVERLAY_TRANSFORM, activeRegionSize);
  const activeCoverageGaps = editingTarget === 'video'
    ? { left: 0, right: 0, top: 0, bottom: 0 }
    : getRegionCoverageGaps(activeAsset, activeTransform || EMPTY_OVERLAY_TRANSFORM, activeRegionSize);
  const activeCoverageMessage = [
    activeCoverageGaps.top > 0 ? `顶部缺少 ${activeCoverageGaps.top}px` : '',
    activeCoverageGaps.bottom > 0 ? `底部缺少 ${activeCoverageGaps.bottom}px` : '',
    activeCoverageGaps.left > 0 ? `左侧缺少 ${activeCoverageGaps.left}px` : '',
    activeCoverageGaps.right > 0 ? `右侧缺少 ${activeCoverageGaps.right}px` : '',
  ].filter(Boolean).join('、');

  const updateExportOptions = useCallback((key: keyof OverlayExportOptions, checked: boolean) => {
    updateCurrentTask((task) => ({
      ...task,
      exportOptions: { ...task.exportOptions, [key]: checked },
      status: task.status === 'exporting' ? task.status : 'editing',
      progress: task.status === 'exporting' ? task.progress : 0,
      outputs: task.status === 'exporting' ? task.outputs : [],
    }));
  }, [updateCurrentTask]);

  const hasUnexportedTasks = allTasks.some((task) => task.status !== 'success');
  const canLeave = useCallback(() => {
    if (isExporting) {
      window.alert('贴片任务正在处理中，请先取消处理后再离开。');
      return false;
    }
    if (hasUnexportedTasks) {
      return window.confirm('竖版或横版中还有未导出的贴片任务，确认离开吗？');
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

  const firstRegionSize = currentTask
    ? getOverlayRegionSize(currentTask.position, 'first', currentTask.mode)
    : getOverlayRegionSize(modeConfig.centerPosition, 'first', activeMode);
  const secondRegionSize = currentTask
    ? getOverlayRegionSize(currentTask.position, 'second', currentTask.mode)
    : getOverlayRegionSize(modeConfig.centerPosition, 'second', activeMode);
  const activeRegionLabel = editingTarget === 'first'
    ? modeConfig.firstLabel
    : editingTarget === 'second'
      ? modeConfig.secondLabel
      : modeConfig.transparentLabel;
  const activeRegionShortLabel = editingTarget === 'first'
    ? (activeMode === 'portrait' ? '上半部分' : '左侧')
    : (activeMode === 'portrait' ? '下半部分' : '右侧');

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
        description={`批量制作 ${modeConfig.canvasWidth}×${modeConfig.canvasHeight} 中间透明的${modeConfig.label}`}
        onBack={handleBack}
        featureInfo={{
          title: '贴片生成器',
          description: '竖版和横版使用同一套高清裁切、Canvas 预览与任务中心导出流程。',
          details: [
            '竖版与横版任务、当前编辑项和筛选状态相互隔离',
            '透明窗口支持画布拖动、坐标输入和方向键微调',
            '每个任务都可使用同一素材或两张不同素材',
            '最终导出由 Sharp 从原图重新渲染，不使用 Canvas 截图',
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

      <div className="flex shrink-0 items-center justify-center border-b border-slate-800 bg-black/20 px-3 py-2">
        <div className="grid w-[360px] grid-cols-2 rounded-xl border border-slate-700 bg-slate-950/80 p-1" aria-label="贴片方向模式">
          {(['portrait', 'landscape'] as OverlayTemplateMode[]).map((mode) => {
            const config = getOverlayModeConfig(mode);
            const count = modeStates[mode].tasks.length;
            return (
              <button
                type="button"
                key={mode}
                disabled={isExporting || isImporting}
                onClick={() => setActiveMode(mode)}
                className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors disabled:opacity-40 ${
                  activeMode === mode
                    ? 'bg-[#FF385C] text-white shadow-[0_4px_12px_rgba(255,56,92,0.28)]'
                    : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'
                }`}
                style={activeMode === mode ? { backgroundColor: '#FF385C', color: '#FFFFFF' } : undefined}
              >
                {config.label}
                {count > 0 && <span className="ml-1 text-[9px] opacity-70">({count})</span>}
              </button>
            );
          })}
        </div>
      </div>

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
            <p className="mt-2 text-center text-[10px] text-slate-600">也可拖入多张图片，每张图创建一个{modeConfig.label}任务</p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col border-b border-slate-800">
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                <ListFilter className="h-3.5 w-3.5" />
                {modeConfig.label}任务 <span className="text-slate-600">{filteredTasks.length}/{tasks.length}</span>
              </div>
              <select
                value={taskFilter}
                onChange={(event) => setTaskFilter(event.target.value as OverlayModeEditorState['taskFilter'])}
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
                  暂无{modeConfig.label}任务
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
                        {[task.firstAsset, task.secondAsset].map((asset, assetIndex) => (
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
                          {task.firstLocked && <Lock className="h-2.5 w-2.5 text-amber-500" />}
                          {task.secondLocked && <Lock className="h-2.5 w-2.5 text-amber-500" />}
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
                <span>{modeConfig.firstLabel}与{modeConfig.secondLabel}使用同一素材</span>
                <input
                  type="checkbox"
                  checked={currentTask.sameSource}
                  disabled={isExporting}
                  onChange={(event) => toggleSameSource(event.target.checked)}
                  className="h-4 w-4 accent-amber-500"
                />
              </label>
              <AssetSlot
                label={`${modeConfig.firstLabel}素材`}
                asset={currentTask.firstAsset}
                active={editingTarget === 'first'}
                locked={currentTask.firstLocked}
                disabled={isExporting}
                onSelect={() => setEditingTarget('first')}
                onReplace={() => void replaceRegionAsset('first')}
                onClear={() => clearRegionAsset('first')}
              />
              <AssetSlot
                label={`${modeConfig.secondLabel}素材`}
                asset={currentTask.secondAsset}
                active={editingTarget === 'second'}
                locked={currentTask.secondLocked}
                disabled={isExporting}
                onSelect={() => setEditingTarget('second')}
                onReplace={() => void replaceRegionAsset('second')}
                onClear={() => clearRegionAsset('second')}
              />
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" size="sm" disabled={isExporting} leftIcon={<ArrowDownUp className={`h-3.5 w-3.5 ${activeMode === 'landscape' ? 'rotate-90' : ''}`} />} onClick={swapAssets}>{activeMode === 'portrait' ? '上下互换' : '左右互换'}</Button>
                <Button variant="ghost" size="sm" disabled={isExporting || currentTask.sameSource} leftIcon={<Link className="h-3.5 w-3.5" />} onClick={() => toggleSameSource(true)}>重新关联</Button>
              </div>
            </div>
          )}
        </aside>

        <main className="metal-panel metal-workspace flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-800">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 px-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-200">{currentTask?.name || `${modeConfig.label}预览区`}</p>
              <p className="mt-0.5 text-[10px] text-slate-600">
                {currentTask
                  ? `当前正在编辑：${activeRegionLabel}`
                  : `固定画布 ${modeConfig.canvasWidth}×${modeConfig.canvasHeight}`}
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
              mode={activeMode}
              editingTarget={editingTarget}
              onEditingTargetChange={setEditingTarget}
              onTaskChange={updateCurrentTask}
              onDropAsset={(region, path) => void replaceRegionAsset(region, path, true)}
              disabled={isExporting}
            />
          </div>
          <div className="grid h-12 shrink-0 grid-cols-3 border-t border-slate-800 bg-black/20 text-center text-[10px] text-slate-500">
            <div className="flex items-center justify-center">{modeConfig.firstLabel}：{modeConfig.movementAxis === 'y' ? firstRegionSize.height : firstRegionSize.width}px</div>
            <div className="flex items-center justify-center border-x border-slate-800 text-cyan-400">透明区域：{modeConfig.windowWidth}×{modeConfig.windowHeight}</div>
            <div className="flex items-center justify-center">{modeConfig.secondLabel}：{modeConfig.movementAxis === 'y' ? secondRegionSize.height : secondRegionSize.width}px</div>
          </div>
        </main>

        <aside className="metal-panel metal-sidebar flex w-[350px] shrink-0 flex-col overflow-y-auto rounded-2xl border border-slate-800 p-3 custom-scrollbar">
          <div className="space-y-3">
            <section className="rounded-xl border border-slate-800 bg-black/30 p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">编辑目标</p>
              <div className="grid grid-cols-3 gap-1.5">
                {(['first', 'video', 'second'] as OverlayEditingTarget[]).map((target) => (
                  <button
                    type="button"
                    key={target}
                    onClick={() => setEditingTarget(target)}
                    data-selected={editingTarget === target}
                    className={`overlay-editing-target-button rounded-lg border px-2 py-1.5 text-[10px] transition-colors ${
                      editingTarget === target
                        ? 'border-[#FF385C] bg-[#FF385C] text-white shadow-[0_3px_10px_rgba(255,56,92,0.24)]'
                        : 'border-slate-800 text-slate-500 hover:text-slate-300'
                    }`}
                    style={editingTarget === target ? {
                      backgroundColor: '#FF385C',
                      borderColor: '#FF385C',
                      color: '#FFFFFF',
                    } : undefined}
                  >
                    {target === 'first' ? modeConfig.firstLabel : target === 'second' ? modeConfig.secondLabel : '透明区域'}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-black/30 p-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-400">{modeConfig.transparentLabel} {modeConfig.axisLabel} 坐标</label>
                <span className="text-[10px] text-slate-600">范围 0–{modeConfig.maxPosition}</span>
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  min={0}
                  max={modeConfig.maxPosition}
                  step={1}
                  value={currentTask?.position ?? modeConfig.centerPosition}
                  disabled={!currentTask || isExporting}
                  onChange={(event) => updateCurrentTask((task) => ({
                    ...task,
                    position: clampOverlayPosition(Number(event.target.value), task.mode),
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
                  onClick={() => updateCurrentTask((task) => ({ ...task, position: modeConfig.centerPosition, status: 'editing', progress: 0, outputs: [] }))}
                >
                  {modeConfig.movementAxis === 'y' ? '垂直居中' : '水平居中'}
                </Button>
              </div>
              <p className="mt-2 text-[10px] text-slate-600">画布内拖动透明区域，或聚焦画布后用 {modeConfig.movementAxis === 'y' ? '↑ / ↓' : '← / →'} 微调（Shift 为 10px）</p>
            </section>

            {currentTask && editingTarget !== 'video' && activeTransform && (
              <section className="rounded-xl border border-slate-800 bg-black/30 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-slate-400">{activeRegionLabel}裁切参数</p>
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
                  onChange={(event) => mutateActiveTransform((transform, asset, regionSize) => ({
                    ...transform,
                    scale: createCoverTransform(asset, regionSize).scale * (Number(event.target.value) / 100),
                  }))}
                  className="mt-1 w-full accent-amber-500 disabled:opacity-40"
                />
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {([
                    ['缩放%', activeZoomPercent, 'scale'],
                    ['X', Math.round(activeTransform.x), 'x'],
                    ['Y', Math.round(activeTransform.y), 'y'],
                  ] as Array<[string, number, 'scale' | 'x' | 'y']>).map(([label, value, key]) => (
                    <label key={key} className="text-[9px] text-slate-600">
                      {label}
                      <input
                        type="number"
                        value={value}
                        min={key === 'scale' ? 50 : undefined}
                        max={key === 'scale' ? 300 : undefined}
                        step={1}
                        disabled={activeLocked || isExporting}
                        onChange={(event) => mutateActiveTransform((transform, asset, regionSize) => {
                          const nextValue = Number(event.target.value);
                          if (key === 'scale') {
                            const nextPercent = Math.min(300, Math.max(50, nextValue));
                            return {
                              ...transform,
                              scale: createCoverTransform(asset, regionSize).scale * (nextPercent / 100),
                            };
                          }
                          return { ...transform, [key]: nextValue };
                        })}
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] text-slate-300 outline-none focus:border-amber-500 disabled:opacity-40"
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    disabled={!activeAsset || activeLocked || isExporting}
                    onClick={() => mutateActiveTransform((transform, asset, regionSize) => repairCoverageTransform(asset, regionSize, transform))}
                    className="overlay-repair-button rounded-lg border border-[#BFE9BB] bg-[#D9F5D6] px-2 py-1.5 text-[9px] font-medium text-[#2F6B35] shadow-[0_3px_10px_rgba(126,190,122,0.14)] transition-colors disabled:opacity-30"
                    style={{ backgroundColor: '#D9F5D6', borderColor: '#BFE9BB', color: '#2F6B35' }}
                  >
                    <Maximize2 className="mr-1 inline h-3 w-3" />填充区域
                  </button>
                  <button type="button" disabled={!activeAsset || activeLocked || isExporting} onClick={() => mutateActiveTransform((_transform, asset, regionSize) => createContainTransform(asset, regionSize))} className="rounded-lg border border-slate-700 px-2 py-1.5 text-[9px] text-slate-300 hover:border-amber-500/40 disabled:opacity-30">适应区域</button>
                  <button type="button" disabled={!activeAsset || activeLocked || isExporting} onClick={() => mutateActiveTransform((transform, asset, regionSize) => centerTransform(asset, regionSize, transform))} className="rounded-lg border border-slate-700 px-2 py-1.5 text-[9px] text-slate-300 hover:border-amber-500/40 disabled:opacity-30">图片居中</button>
                </div>
                {!activeCovered && (
                  <div className="mt-2 rounded-lg border border-rose-500/20 bg-rose-500/5 p-2 text-[10px] leading-4 text-rose-400">
                    当前图片未完全覆盖：{activeAsset ? activeCoverageMessage : '当前区域没有素材'}。
                    画布对应边缘已用红线标出；可点击“填充区域”自动修复。
                  </div>
                )}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button variant="secondary" size="sm" themeColor="amber" disabled={!activeAsset || isExporting} leftIcon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => mutateActiveTransform((_transform, asset, regionSize) => createCoverTransform(asset, regionSize))}>恢复默认</Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    themeColor={activeLocked ? 'rose' : 'amber'}
                    disabled={isExporting}
                    leftIcon={activeLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    onClick={() => updateCurrentTask((task) => editingTarget === 'first'
                      ? { ...task, firstLocked: !task.firstLocked }
                      : { ...task, secondLocked: !task.secondLocked })}
                  >
                    {activeLocked ? `解锁${activeRegionShortLabel}` : `锁定${activeRegionShortLabel}`}
                  </Button>
                </div>
              </section>
            )}

            <section className="rounded-xl border border-slate-800 bg-black/30 p-3">
              <p className="mb-2 text-[11px] font-bold text-slate-400">应用到其他任务</p>
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" disabled={!currentTask || isExporting} onClick={() => applyPosition('all')} className="rounded-lg border border-slate-700 px-2 py-1.5 text-[9px] text-slate-300 hover:border-amber-500/40 disabled:opacity-30">{modeConfig.axisLabel} 坐标 → 全部</button>
                <button type="button" disabled={!currentTask || selectedTasks.length === 0 || isExporting} onClick={() => applyPosition('selected')} className="rounded-lg border border-slate-700 px-2 py-1.5 text-[9px] text-slate-300 hover:border-amber-500/40 disabled:opacity-30">{modeConfig.axisLabel} 坐标 → 选中</button>
                <button type="button" disabled={!currentTask || editingTarget === 'video' || isExporting} onClick={() => applyActiveRegion('all')} className="rounded-lg border border-slate-700 px-2 py-1.5 text-[9px] text-slate-300 hover:border-amber-500/40 disabled:opacity-30">当前区域 → 全部</button>
                <button type="button" disabled={!currentTask || editingTarget === 'video' || selectedTasks.length === 0 || isExporting} onClick={() => applyActiveRegion('selected')} className="rounded-lg border border-slate-700 px-2 py-1.5 text-[9px] text-slate-300 hover:border-amber-500/40 disabled:opacity-30">当前区域 → 选中</button>
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-black/30 p-3">
              <p className="mb-2 text-[11px] font-bold text-slate-400">导出选项</p>
              <div className="space-y-1.5">
                {([
                  ['transparentPng', `完整${modeConfig.label} PNG`],
                  ['solidPreview', '带纯色背景的预览图'],
                  ['checkerPreview', '带棋盘格的预览图'],
                  ['topOnly', `仅导出${modeConfig.firstLabel}`],
                  ['bottomOnly', `仅导出${modeConfig.secondLabel}`],
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
              <Button variant="secondary" size="sm" themeColor="amber" fullWidth leftIcon={<FolderOpen className="h-3.5 w-3.5" />} onClick={() => void window.api.openPath(outputDir)}>打开输出目录</Button>
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
