import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Loader2, Settings, Link2,
  Eye, Play, Monitor, Smartphone, Layers, ArrowLeft, CheckCircle, XCircle, FileVideo
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import OutputDirSelector from '../components/OutputDirSelector';
import ConcurrencySelector from '../components/ConcurrencySelector';
import OperationLogPanel from '../components/OperationLogPanel';
import FilePreviewModal from '../components/FilePreviewModal';
import { FileSelector, FileSelectorGroup, type FileSelectorRef, formatFileSize } from '../components/FileSelector';
import { Button } from '../components/Button/Button';
import TaskCountSlider, { type TaskSource } from '../components/TaskCountSlider';
import VideoPlayer from '../components/VideoPlayer/VideoPlayer';
import { useOutputDirCache } from '../hooks/useOutputDirCache';
import { useConcurrencyCache } from '../hooks/useConcurrencyCache';
import { useOperationLogs } from '../hooks/useOperationLogs';
import { useVideoProcessingEvents } from '../hooks/useVideoProcessingEvents';
import useVideoMaterials, { type VideoMaterial } from '../hooks/useVideoMaterials';
import useStitchPreview from '../hooks/useStitchPreview';
import { generateTasks as generateBalancedTasks } from '../utils/balancedCombinations';

interface VideoStitcherModeProps {
  onBack: () => void;
}

type Orientation = 'landscape' | 'portrait';

/**
 * 合成任务数据结构
 */
interface StitchTask {
  id: string;
  status: 'pending' | 'waiting' | 'processing' | 'completed' | 'error';
  aVideo: VideoMaterial;
  bVideo: VideoMaterial;
  aIndex: number;  // A 面视频序号（1开始）
  bIndex: number;  // B 面视频序号（1开始）
  outputFileName: string;
  error?: string;
}

const VideoStitcherMode: React.FC<VideoStitcherModeProps> = ({ onBack }) => {
  // 配置状态
  const { outputDir, setOutputDir } = useOutputDirCache('VideoStitcherMode');
  const { concurrency, setConcurrency } = useConcurrencyCache('VideoStitcherMode');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, failed: 0, total: 0 });

  // 任务列表状态
  const [tasks, setTasks] = useState<StitchTask[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 原始素材池（用于任务生成）
  const [aFiles, setAFiles] = useState<string[]>([]);
  const [bFiles, setBFiles] = useState<string[]>([]);

  // 使用 hook 加载视频素材（带全局缓存）
  const { materials: aMaterials, isLoading: isLoadingA } = useVideoMaterials(aFiles, true, {
    onLog: (message, type) => addLog(`[A面] ${message}`, type),
  });
  const { materials: bMaterials, isLoading: isLoadingB } = useVideoMaterials(bFiles, true, {
    onLog: (message, type) => addLog(`[B面] ${message}`, type),
  });
  const isLoadingMaterials = isLoadingA || isLoadingB;

  // 稳定的路径字符串，用于依赖检查（避免数组引用变化导致无限循环）
  const aPathsKey = useMemo(() => aFiles.join(','), [aFiles]);
  const bPathsKey = useMemo(() => bFiles.join(','), [bFiles]);

  // 任务数量控制
  const [taskCount, setTaskCount] = useState(1);

  // 计算最大组合数
  const maxCombinations = useMemo(() => {
    return aFiles.length * bFiles.length;
  }, [aFiles.length, bFiles.length]);

  // 任务数量源配置（用于 TaskCountSlider）
  const taskSources: TaskSource[] = useMemo(() => [
    { name: 'A', count: aFiles.length, color: 'violet', required: true },
    { name: 'B', count: bFiles.length, color: 'indigo', required: true },
  ], [aFiles.length, bFiles.length]);

  // FileSelector ref
  const fileSelectorRef = useRef<FileSelectorRef>(null);

  // 横竖屏配置
  const [orientation, setOrientation] = useState<Orientation>('landscape');

  // 画布配置
  const canvasConfig = useMemo(() => {
    return orientation === 'landscape'
      ? { width: 1920, height: 1080, label: '1920×1080', aspectRatio: '16/9' }
      : { width: 1080, height: 1920, label: '1080×1920', aspectRatio: '9/16' };
  }, [orientation]);

  // 日志管理
  const {
    logs,
    addLog,
    clearLogs,
    copyLogs,
    downloadLogs,
    logsEndRef,
    logsContainerRef,
    autoScrollEnabled,
    setAutoScrollEnabled,
    autoScrollPaused,
    resumeAutoScroll,
    scrollToBottom,
    scrollToTop,
    onUserInteractStart,
  } = useOperationLogs({
    moduleNameCN: 'A+B前后拼接',
    moduleNameEN: 'VideoStitcher',
  });

  // 当前选中的任务
  const currentTask = tasks[currentIndex];

  // 预览弹窗状态
  const [showPreview, setShowPreview] = useState(false);
  const [previewType, setPreviewType] = useState<'a' | 'b'>('a');

  // 使用 hook 管理预览视频（只截取 A 最后 5 秒 + B 前 5 秒）
  const previewConfig = currentTask ? {
    aPath: currentTask.aVideo.path,
    bPath: currentTask.bVideo.path,
    orientation,
    aDuration: currentTask.aVideo.duration,
    bDuration: currentTask.bVideo.duration,
  } : null;

  const {
    previewPath,
    isGenerating,
    error: previewError,
    volume,
    setVolume,
    muted,
    setMuted,
    isPlaying,
    setIsPlaying,
  } = useStitchPreview(previewConfig, !!currentTask, {
    onLog: (message, type) => addLog(message, type),
  });

  // 加载全局默认配置
  useEffect(() => {
    const loadGlobalSettings = async () => {
      try {
        const result = await window.api.getGlobalSettings();
        if (result?.defaultConcurrency) {
          setConcurrency(result.defaultConcurrency);
        }
      } catch (err) {
        console.error('加载全局配置失败:', err);
      }
    };
    loadGlobalSettings();
  }, [setConcurrency]);

  /**
   * 生成任务列表
   * 使用均匀组合算法，确保每个素材尽量被均匀使用
   * 排序优先级：A > B（先按A索引排序，再按B索引排序）
   */
  const generateTasks = useCallback((
    aMatList: VideoMaterial[],
    bMatList: VideoMaterial[],
    count: number
  ) => {
    if (aMatList.length === 0 || bMatList.length === 0 || count <= 0) {
      setTasks([]);
      setCurrentIndex(0);
      return;
    }

    // 使用均匀组合算法生成任务，排序优先级 A > B
    const newTasks = generateBalancedTasks(
      [aMatList, bMatList],
      count,
      (elements, indices, taskIndex) => {
        const aMaterial = elements[0] as VideoMaterial;
        const bMaterial = elements[1] as VideoMaterial;
        const outputFileName = `${aMaterial.name.split('.')[0]}_${bMaterial.name.split('.')[0]}.mp4`;

        return {
          id: `stitch-${Date.now()}-${taskIndex}`,
          status: 'pending' as const,
          aVideo: aMaterial,
          bVideo: bMaterial,
          aIndex: indices[0] + 1,  // 1 开始
          bIndex: indices[1] + 1,
          outputFileName,
        };
      },
      { priority: [0, 1] }  // 优先按A(0)排序，其次按B(1)排序
    );

    setTasks(newTasks);
    setCurrentIndex(0);
  }, []);

  /**
   * A 面文件变化处理
   */
  const handleAFilesChange = useCallback((files: string[]) => {
    setAFiles(files);
    if (files.length > 0) {
      addLog(`已选择 ${files.length} 个 A 面视频`, 'info');
    }
    // 文件变化时重置 taskCount 为最大值
    const newMax = files.length * bFiles.length;
    if (newMax > 0) {
      setTaskCount(newMax);
    }
  }, [addLog, bFiles.length]);

  /**
   * B 面文件变化处理
   */
  const handleBFilesChange = useCallback((files: string[]) => {
    setBFiles(files);
    if (files.length > 0) {
      addLog(`已选择 ${files.length} 个 B 面视频`, 'info');
    }
    // 文件变化时重置 taskCount 为最大值
    const newMax = aFiles.length * files.length;
    if (newMax > 0) {
      setTaskCount(newMax);
    }
  }, [addLog, aFiles.length]);

  /**
   * 处理任务数量变化
   */
  const handleTaskCountChange = useCallback((count: number) => {
    setTaskCount(count);
  }, []);

  // 当素材数据或 taskCount 变化时，重新生成任务
  useEffect(() => {
    // 只有当素材已加载完成时才生成任务
    if (aMaterials.length > 0 && bMaterials.length > 0 && taskCount > 0 && !isLoadingMaterials) {
      generateTasks(aMaterials, bMaterials, taskCount);
    } else if (aMaterials.length === 0 || bMaterials.length === 0) {
      setTasks([]);
      setCurrentIndex(0);
    }
  }, [aPathsKey, bPathsKey, aMaterials.length, bMaterials.length, taskCount, isLoadingMaterials, generateTasks]);

  // 监听 A+B 前后拼接任务事件
  useVideoProcessingEvents({
    onStart: (data) => {
      setProgress({ done: 0, failed: 0, total: data.total });
      addLog(`开始处理 ${data.total} 个合成任务...`, 'info');
      setTasks(prev => prev.map(t => ({ ...t, status: 'waiting' as const })));
    },
    onTaskStart: (data) => {
      addLog(`开始处理第 ${data.index + 1} 个任务`, 'info');
      setTasks(prev => prev.map((t, idx) =>
        idx === data.index ? { ...t, status: 'processing' as const } : t
      ));
    },
    onLog: (data) => {
      addLog(data.message, 'info');
    },
    onProgress: (data) => {
      setProgress({ done: data.done, failed: data.failed, total: data.total });
      setTasks(prev => prev.map((t, idx) =>
        idx === data.index ? { ...t, status: 'completed' as const } : t
      ));
      addLog(`进度: ${data.done}/${data.total} (失败 ${data.failed})`, 'info');
    },
    onFailed: (data) => {
      setTasks(prev => prev.map((t, idx) =>
        idx === data.index ? { ...t, status: 'error' as const, error: data.error } : t
      ));
      addLog(`❌ 任务 ${data.index + 1} 失败: ${data.error}`, 'error');
    },
    onFinish: (data) => {
      addLog(`✅ 完成! 成功 ${data.done}, 失败 ${data.failed}`, 'success');
      setIsProcessing(false);
    },
  });

  // 当组合变化时，确保选中的索引有效
  useEffect(() => {
    if (tasks.length > 0 && currentIndex >= tasks.length) {
      setCurrentIndex(0);
    }
  }, [tasks, currentIndex]);

  /**
   * 格式化时长显示
   */
  const formatDuration = (seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * 切换任务
   */
  const switchToTask = (index: number) => {
    if (index < 0 || index >= tasks.length) return;
    setCurrentIndex(index);
  };

  /**
   * 上一条任务
   */
  const goToPrevious = () => {
    if (currentIndex > 0) {
      switchToTask(currentIndex - 1);
    }
  };

  /**
   * 下一条任务
   */
  const goToNext = () => {
    if (currentIndex < tasks.length - 1) {
      switchToTask(currentIndex + 1);
    }
  };

  /**
   * 打开 A 面视频预览
   */
  const handleOpenAPreview = useCallback(() => {
    if (currentTask?.aVideo) {
      setPreviewType('a');
      setShowPreview(true);
    }
  }, [currentTask]);

  /**
   * 打开 B 面视频预览
   */
  const handleOpenBPreview = useCallback(() => {
    if (currentTask?.bVideo) {
      setPreviewType('b');
      setShowPreview(true);
    }
  }, [currentTask]);

  /**
   * 关闭预览弹窗
   */
  const handleClosePreview = useCallback(() => {
    setShowPreview(false);
  }, []);

  /**
   * 开始合成
   */
  const startMerge = async () => {
    if (tasks.length === 0) {
      addLog('⚠️ 请先选择视频', 'warning');
      return;
    }
    if (!outputDir) {
      const dir = await window.api.pickOutDir();
      if (dir) {
        setOutputDir(dir);
      } else {
        return;
      }
    }
    if (isProcessing) return;

    setIsProcessing(true);
    // 不再自动清空日志，保留历史记录

    addLog(`开始 A+B 前后拼接处理...`, 'info');
    addLog(`视频: ${tasks.length} 个`, 'info');
    addLog(`方向: ${orientation === 'landscape' ? '横屏' : '竖屏'}`, 'info');

    try {
      await window.api.videoStitchAB({
        aFiles: tasks.map(t => t.aVideo.path),
        bFiles: tasks.map(t => t.bVideo.path),
        outputDir,
        orientation,
        concurrency: concurrency === 0 ? undefined : concurrency
      });
    } catch (err: any) {
      console.error('合成失败:', err);
      setIsProcessing(false);
      addLog(`❌ 合成失败: ${err.message || err}`, 'error');
    }
  };

  // 预览弹窗使用的文件信息
  const previewFile = previewType === 'a' ? currentTask?.aVideo : currentTask?.bVideo;

  return (
    <div className="h-screen flex flex-col bg-black text-slate-100">
      {/* Header */}
      <PageHeader
        onBack={onBack}
        title="A+B 前后拼接"
        icon={Link2}
        iconColor="text-pink-500"
        description="将两个视频前后拼接成一个完整视频"
        featureInfo={{
          title: 'A+B 前后拼接',
          description: '将两个视频素材库按顺序前后拼接，A 面在前、B 面在后，自动生成完整的拼接视频。',
          details: [
            '分别上传 A 面和 B 面视频作为素材库',
            '智能任务分配：贪心算法优先选择使用次数最少的素材',
            '确保每个素材均匀使用，避免重复和遗漏',
            'A 面在前，B 面在后，顺序拼接成一个完整视频',
            '自动调整帧率为 30fps，统一输出分辨率',
          ],
          themeColor: 'pink',
        }}
        rightContent={
          <div className="flex items-center bg-black rounded-lg p-0.5 border border-slate-800">
            <button
              onClick={() => setOrientation('landscape')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                orientation === 'landscape'
                  ? 'bg-pink-600 text-white shadow-lg shadow-pink-900/20'
                  : 'text-slate-400 hover:text-white'
              }`}
              type="button"
            >
              <Monitor className="w-3.5 h-3.5" />
              横版
            </button>
            <button
              onClick={() => setOrientation('portrait')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                orientation === 'portrait'
                  ? 'bg-pink-600 text-white shadow-lg shadow-pink-900/20'
                  : 'text-slate-400 hover:text-white'
              }`}
              type="button"
            >
              <Smartphone className="w-3.5 h-3.5" />
              竖版
            </button>
          </div>
        }
      />

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - File Selectors */}
        <div className="w-80 border-r border-slate-800 bg-black flex flex-col shrink-0">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            {/* 任务数量选择器 */}
            <TaskCountSlider
              value={taskCount}
              max={maxCombinations}
              onChange={handleTaskCountChange}
              sources={taskSources}
              themeColor="pink"
              disabled={isProcessing}
            />

            {/* 文件选择器组 */}
            <FileSelectorGroup>
              <div className="space-y-4">
                {/* A 面视频选择器 */}
                <FileSelector
                  ref={fileSelectorRef}
                  id="videoStitcherA"
                  name="A 面视频（前段）"
                  accept="video"
                  multiple
                  showList
                  maxHeight={200}
                  themeColor="pink"
                  directoryCache
                  onChange={handleAFilesChange}
                  disabled={isProcessing}
                />

                {/* B 面视频选择器 */}
                <FileSelector
                  id="videoStitcherB"
                  name="B 面视频（后段）"
                  accept="video"
                  multiple
                  showList
                  maxHeight={200}
                  themeColor="pink"
                  directoryCache
                  onChange={handleBFilesChange}
                  disabled={isProcessing}
                />
              </div>
            </FileSelectorGroup>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-black">
          {/* 任务列表区域 */}
          <div className="flex-shrink-0 overflow-hidden flex flex-col">
            {/* 任务列表 Header */}
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-black/50 shrink-0">
              <h2 className="font-bold text-sm text-slate-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-pink-400" />
                任务列表
              </h2>
              <div className="flex items-center gap-3">
                <span className="bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded-full">
                  {tasks.length > 0 ? `${currentIndex + 1} / ${tasks.length}` : tasks.length}
                </span>
              </div>
            </div>

            {/* 横向滚动任务栏 */}
            <div className="h-20 overflow-x-auto overflow-y-hidden border-b border-slate-800 shrink-0">
              <div className="flex items-center h-full px-4 gap-2">
                {tasks.map((task, index) => (
                  <div
                    key={task.id}
                    className={`relative shrink-0 w-14 h-14 rounded-lg border cursor-pointer ${
                      index === currentIndex
                        ? 'border-pink-500/60 ring-2 ring-pink-500/20 bg-pink-500/5'
                        : task.status === 'error'
                        ? 'border-red-500/50 bg-red-500/5'
                        : task.status === 'completed'
                        ? 'border-emerald-500/50 bg-emerald-500/5'
                        : task.status === 'waiting'
                        ? 'border-pink-500/30 bg-pink-500/5'
                        : task.status === 'processing'
                        ? 'border-pink-500/30 bg-pink-500/5'
                        : 'border-slate-700 bg-black/50'
                    }`}
                    onClick={() => switchToTask(index)}
                  >
                    {/* 缩略图 - 使用 A 面视频缩略图 */}
                    <div className="absolute inset-0 rounded-lg overflow-hidden">
                      {task.aVideo.thumbnailUrl ? (
                        <img src={task.aVideo.thumbnailUrl} alt={task.aVideo.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-black">
                          <FileVideo className="w-5 h-5 text-slate-600" />
                        </div>
                      )}
                    </div>

                    {/* processing 状态 */}
                    {task.status === 'processing' && (
                      <div className="absolute inset-0 rounded-lg bg-black/50 flex items-center justify-center pointer-events-none">
                        <Loader2 className="w-5 h-5 text-pink-500 animate-spin" />
                      </div>
                    )}
                    {/* waiting 状态 */}
                    {task.status === 'waiting' && (
                      <div className="absolute inset-0 rounded-lg bg-black/30 flex items-center justify-center pointer-events-none">
                        <div className="w-4 h-4 rounded-full bg-pink-500/70" />
                      </div>
                    )}
                    {/* completed 状态 */}
                    {task.status === 'completed' && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
                        <CheckCircle className="w-2.5 h-2.5 text-black" />
                      </div>
                    )}
                    {/* error 状态 */}
                    {task.status === 'error' && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
                        <span className="text-black text-[8px] font-bold">!</span>
                      </div>
                    )}

                    {/* 当前预览指示器 */}
                    {index === currentIndex && (
                      <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-pink-500 rounded text-[8px] font-medium text-black whitespace-nowrap z-10">
                        预览
                      </div>
                    )}
                  </div>
                ))}
                {tasks.length === 0 && (
                  <div className="flex items-center justify-center w-full h-full text-slate-500">
                    <p className="text-xs">暂无任务</p>
                  </div>
                )}
              </div>
            </div>

            {/* 合成详情区域 */}
            {currentTask && (
              <div className="bg-black/30 border-b border-slate-800 shrink-0">
                {/* 第一行：合成配置 + 导航/操作 */}
                <div className="px-3 py-2 flex items-center gap-2 border-b border-slate-800/50">
                  {/* 左侧导航 */}
                  <button
                    onClick={goToPrevious}
                    disabled={currentIndex === 0}
                    className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  {/* 合成配置信息 */}
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="text-slate-500">输出</span>
                    <span className="text-pink-400 font-medium">{canvasConfig.label}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-500">帧率</span>
                    <span className="text-slate-200">30fps</span>
                  </div>

                  {/* 弹性空间 */}
                  <div className="flex-1" />

                  {/* 状态指示 */}
                  {currentTask.status === 'processing' && (
                    <Loader2 className="w-4 h-4 text-pink-500 animate-spin" />
                  )}
                  {currentTask.status === 'completed' && (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  )}
                  {currentTask.status === 'error' && (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}

                  {/* 右侧导航 */}
                  <button
                    onClick={goToNext}
                    disabled={currentIndex >= tasks.length - 1}
                    className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 rotate-180" />
                  </button>
                </div>

                {/* 第二行：A 面视频 */}
                <div className="px-3 py-2 flex items-center gap-2 border-b border-slate-800/30">
                  {/* A 面标签 */}
                  <div className="flex items-center gap-1.5 shrink-0 w-14">
                    <div className="w-5 h-5 rounded bg-violet-500/20 flex items-center justify-center">
                      <Monitor className="w-3 h-3 text-violet-400" />
                    </div>
                    <span className="text-[10px] font-medium text-violet-400">A{currentTask.aIndex}</span>
                  </div>
                  {/* A 面缩略图 */}
                  <div className="w-10 h-10 rounded bg-slate-800 overflow-hidden shrink-0">
                    {currentTask.aVideo.thumbnailUrl ? (
                      <img src={currentTask.aVideo.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileVideo className="w-5 h-5 text-slate-600" />
                      </div>
                    )}
                  </div>
                  {/* A 面文件信息 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{currentTask.aVideo.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {currentTask.aVideo.fileSize && (
                        <span className="text-[10px] text-slate-500">{formatFileSize(currentTask.aVideo.fileSize)}</span>
                      )}
                      {currentTask.aVideo.width && currentTask.aVideo.height && (
                        <>
                          <span className="text-[10px] text-slate-500">{currentTask.aVideo.width}×{currentTask.aVideo.height}</span>
                          <span className="text-[10px] text-slate-500">
                            ({(currentTask.aVideo.width / currentTask.aVideo.height).toFixed(2)})
                          </span>
                        </>
                      )}
                      {currentTask.aVideo.duration && (
                        <span className="text-[10px] text-slate-500">{formatDuration(currentTask.aVideo.duration)}</span>
                      )}
                      {currentTask.aVideo.orientation && (
                        <span className="text-[10px] text-slate-500 px-1.5 py-0.5 bg-slate-800 rounded">
                          {currentTask.aVideo.orientation === 'landscape' ? '横版' : currentTask.aVideo.orientation === 'portrait' ? '竖版' : '方形'}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* A 面预览按钮 */}
                  <button
                    onClick={handleOpenAPreview}
                    className="p-1.5 hover:bg-slate-800 text-slate-500 hover:text-slate-300 rounded transition-colors shrink-0"
                    title="预览 A 面"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>

                {/* 第三行：B 面视频 */}
                <div className="px-3 py-2 flex items-center gap-2">
                  {/* B 面标签 */}
                  <div className="flex items-center gap-1.5 shrink-0 w-14">
                    <div className="w-5 h-5 rounded bg-indigo-500/20 flex items-center justify-center">
                      <Smartphone className="w-3 h-3 text-indigo-400" />
                    </div>
                    <span className="text-[10px] font-medium text-indigo-400">B{currentTask.bIndex}</span>
                  </div>
                  {/* B 面缩略图 */}
                  <div className="w-10 h-10 rounded bg-slate-800 overflow-hidden shrink-0">
                    {currentTask.bVideo.thumbnailUrl ? (
                      <img src={currentTask.bVideo.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileVideo className="w-5 h-5 text-slate-600" />
                      </div>
                    )}
                  </div>
                  {/* B 面文件信息 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{currentTask.bVideo.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {currentTask.bVideo.fileSize && (
                        <span className="text-[10px] text-slate-500">{formatFileSize(currentTask.bVideo.fileSize)}</span>
                      )}
                      {currentTask.bVideo.width && currentTask.bVideo.height && (
                        <>
                          <span className="text-[10px] text-slate-500">{currentTask.bVideo.width}×{currentTask.bVideo.height}</span>
                          <span className="text-[10px] text-slate-500">
                            ({(currentTask.bVideo.width / currentTask.bVideo.height).toFixed(2)})
                          </span>
                        </>
                      )}
                      {currentTask.bVideo.duration && (
                        <span className="text-[10px] text-slate-500">{formatDuration(currentTask.bVideo.duration)}</span>
                      )}
                      {currentTask.bVideo.orientation && (
                        <span className="text-[10px] text-slate-500 px-1.5 py-0.5 bg-slate-800 rounded">
                          {currentTask.bVideo.orientation === 'landscape' ? '横版' : currentTask.bVideo.orientation === 'portrait' ? '竖版' : '方形'}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* B 面预览按钮 */}
                  <button
                    onClick={handleOpenBPreview}
                    className="p-1.5 hover:bg-slate-800 text-slate-500 hover:text-slate-300 rounded transition-colors shrink-0"
                    title="预览 B 面"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 预览区域 */}
          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* 视频预览 */}
            <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
              {tasks.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-slate-500">
                    <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">选择视频后显示预览</p>
                  </div>
                </div>
              ) : isGenerating ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 mx-auto mb-3 text-pink-400 animate-spin" />
                    <p className="text-sm text-slate-400">正在生成预览视频...</p>
                  </div>
                </div>
              ) : previewError ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <XCircle className="w-8 h-8 mx-auto mb-3 text-red-400" />
                    <p className="text-sm text-slate-400">预览生成失败</p>
                    <p className="text-xs text-slate-500 mt-1">{previewError}</p>
                  </div>
                </div>
              ) : previewPath ? (
                <div className="relative w-full h-full flex flex-col items-center justify-center">
                  <p className="text-xs text-slate-500 mb-2">截取 A 最后 5 秒 + B 前 5 秒</p>
                  <div
                    className="bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800"
                    style={orientation === 'landscape'
                      ? { width: '640px', maxHeight: '100%', aspectRatio: '16/9' }
                      : { height: '640px', maxWidth: '100%', aspectRatio: '9/16' }
                    }
                  >
                    <VideoPlayer
                      src={`preview://${encodeURIComponent(previewPath)}`}
                      autoPlay
                      loop
                      muted={muted}
                      paused={!isPlaying}
                      themeColor="rose"
                      minimal
                      onPlayStateChange={(playing) => {
                        setIsPlaying(playing);
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Eye className="w-8 h-8 mx-auto mb-3 text-slate-500" />
                    <p className="text-sm text-slate-400">准备生成预览...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Settings + Logs + Start Button */}
        <div className="w-80 border-l border-slate-800 bg-black flex flex-col shrink-0 overflow-y-hidden">
          <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            {/* Settings */}
            <div className="bg-black/50 border border-slate-800 rounded-xl p-4 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Settings className="w-3.5 h-3.5" />
                设置
              </h3>

              <OutputDirSelector
                value={outputDir}
                onChange={setOutputDir}
                disabled={isProcessing}
                themeColor="pink"
              />

              <ConcurrencySelector
                value={concurrency}
                onChange={setConcurrency}
                disabled={isProcessing}
                themeColor="pink"
              />
            </div>

            {/* Progress Display */}
            {progress.total > 0 && (
              <div className="bg-black/50 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">处理进度</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">已完成</span>
                  <span className="text-pink-400 font-bold">{progress.done}/{progress.total}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-violet-500 to-pink-500 h-2 rounded-full transition-all"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                  />
                </div>
                {progress.failed > 0 && (
                  <div className="text-xs text-rose-400">失败: {progress.failed}</div>
                )}
              </div>
            )}

            {/* Logs */}
            <div className="flex-1 min-h-[300px]">
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
                themeColor="pink"
              />
            </div>

            {/* Start Button */}
            <Button
              onClick={startMerge}
              disabled={isProcessing || tasks.length === 0}
              variant="primary"
              size="md"
              fullWidth
              loading={isProcessing}
              leftIcon={!isProcessing && <Play className="w-4 h-4" />}
            >
              {isProcessing ? '处理中...' : '开始合成'}
            </Button>
          </div>
        </div>
      </main>

      {/* 视频预览弹窗 */}
      {showPreview && previewFile && (
        <FilePreviewModal
          file={{
            path: previewFile.path,
            name: previewFile.name,
            type: 'video',
          }}
          visible={showPreview}
          onClose={handleClosePreview}
          allFiles={(previewType === 'a' ? tasks.map(t => t.aVideo) : tasks.map(t => t.bVideo)).map(v => ({
            path: v.path,
            name: v.name,
            type: 'video' as const,
          }))}
          currentIndex={previewType === 'a'
            ? tasks.slice(0, currentIndex + 1).filter(t => t.aVideo).length - 1
            : currentIndex
          }
          onPrevious={previewType === 'b' ? goToPrevious : undefined}
          onNext={previewType === 'b' ? goToNext : undefined}
          themeColor={previewType === 'a' ? 'violet' : 'fuchsia'}
        />
      )}
    </div>
  );
};

export default VideoStitcherMode;
