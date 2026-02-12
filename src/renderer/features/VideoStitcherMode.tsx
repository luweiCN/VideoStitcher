import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Loader2, Settings, Link2,
  Eye, Play, Monitor, Smartphone, Trash2, Layers, ArrowLeft, CheckCircle, XCircle, FileVideo
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import OutputDirSelector from '../components/OutputDirSelector';
import ConcurrencySelector from '../components/ConcurrencySelector';
import OperationLogPanel from '../components/OperationLogPanel';
import FilePreviewModal from '../components/FilePreviewModal';
import { FileSelector, FileSelectorGroup, type FileSelectorRef, formatFileSize } from '../components/FileSelector';
import { Button } from '../components/Button/Button';
import { useOutputDirCache } from '../hooks/useOutputDirCache';
import { useConcurrencyCache } from '../hooks/useConcurrencyCache';
import { useOperationLogs } from '../hooks/useOperationLogs';
import { useVideoProcessingEvents } from '../hooks/useVideoProcessingEvents';

interface VideoStitcherModeProps {
  onBack: () => void;
}

type Orientation = 'landscape' | 'portrait';

/**
 * 视频素材信息
 */
interface VideoMaterial {
  path: string;
  name: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
  fileSize?: number;
  orientation?: 'landscape' | 'portrait' | 'square';
}

/**
 * 合成任务数据结构
 */
interface StitchTask {
  id: string;
  status: 'pending' | 'waiting' | 'processing' | 'completed' | 'error';
  aVideo: VideoMaterial;
  bVideo: VideoMaterial;
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

  // 拼接预览相关状态
  const [previewVideoPath, setPreviewVideoPath] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // 记录当前正在生成的预览标识
  const currentPreviewKeyRef = useRef<string>('');
  const isPreviewCancelledRef = useRef(false);

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
   * 加载视频素材信息
   */
  const loadVideoMaterialInfo = useCallback(async (filePath: string): Promise<VideoMaterial> => {
    const fileName = filePath.split(/[/\\]/).pop() || filePath;

    const material: VideoMaterial = {
      path: filePath,
      name: fileName,
    };

    try {
      // 获取预览 URL
      const previewResult = await window.api.getPreviewUrl(filePath);
      if (previewResult.success && previewResult.url) {
        material.previewUrl = previewResult.url;

        // 获取缩略图
        const thumbnailResult = await window.api.getVideoThumbnail(filePath, { maxSize: 64, timeOffset: 0 });
        if (thumbnailResult.success) {
          material.thumbnailUrl = thumbnailResult.thumbnail;
        }

        // 获取文件信息
        const fileInfoResult = await window.api.getFileInfo(filePath);
        if (fileInfoResult?.info?.size) {
          material.fileSize = fileInfoResult.info.size;
        }

        // 使用 video 元素获取视频元数据
        const tempVideo = document.createElement('video');
        tempVideo.src = previewResult.url;
        tempVideo.muted = true;
        tempVideo.playsInline = true;

        const videoMeta = await new Promise<{ width: number; height: number; duration: number }>((resolve, reject) => {
          tempVideo.onloadedmetadata = () => {
            resolve({
              width: tempVideo.videoWidth,
              height: tempVideo.videoHeight,
              duration: tempVideo.duration || 0,
            });
          };
          tempVideo.onerror = () => reject(new Error('视频元数据加载失败'));
          tempVideo.load();
        });

        material.width = videoMeta.width;
        material.height = videoMeta.height;
        material.duration = videoMeta.duration;

        // 判断方向
        if (videoMeta.width > videoMeta.height) {
          material.orientation = 'landscape';
        } else if (videoMeta.height > videoMeta.width) {
          material.orientation = 'portrait';
        } else {
          material.orientation = 'square';
        }
      }
    } catch (err) {
      addLog(`加载视频信息失败: ${fileName}`, 'error');
    }

    return material;
  }, [addLog]);

  /**
   * 生成任务列表
   */
  const generateTasks = useCallback(async (aPaths: string[], bPaths: string[]) => {
    if (aPaths.length === 0 || bPaths.length === 0) {
      setTasks([]);
      setCurrentIndex(0);
      return;
    }

    const totalCount = Math.max(aPaths.length, bPaths.length);
    addLog(`正在生成 ${totalCount} 个合成任务...`, 'info');

    // 创建初始任务
    const newTasks: StitchTask[] = [];
    for (let i = 0; i < totalCount; i++) {
      const aPath = aPaths[i % aPaths.length];
      const bPath = bPaths[i % bPaths.length];
      const aName = aPath.split(/[/\\]/).pop() || aPath;
      const bName = bPath.split(/[/\\]/).pop() || bPath;
      const outputFileName = `${aName.split('.')[0]}_${bName.split('.')[0]}.mp4`;

      newTasks.push({
        id: `stitch-${Date.now()}-${i}`,
        status: 'pending' as const,
        aVideo: {
          path: aPath,
          name: aName,
        },
        bVideo: {
          path: bPath,
          name: bName,
        },
        outputFileName,
      });
    }

    setTasks(newTasks);
    setCurrentIndex(0);

    // 异步加载任务详情
    for (let i = 0; i < newTasks.length; i++) {
      const task = newTasks[i];

      // 加载 A 面视频信息
      const aMaterial = await loadVideoMaterialInfo(task.aVideo.path);

      // 加载 B 面视频信息
      const bMaterial = await loadVideoMaterialInfo(task.bVideo.path);

      setTasks(prev => prev.map((t, idx) =>
        idx === i ? { ...t, aVideo: aMaterial, bVideo: bMaterial } : t
      ));

      addLog(`[${i + 1}/${totalCount}] 任务信息加载完成`, 'success');
    }

    addLog(`已生成 ${totalCount} 个合成任务`, 'success');
  }, [addLog, loadVideoMaterialInfo]);

  /**
   * A 面文件变化处理
   */
  const handleAFilesChange = useCallback(async (files: string[]) => {
    setAFiles(files);
    if (files.length > 0) {
      addLog(`已选择 ${files.length} 个 A 面视频`, 'info');
    }
    await generateTasks(files, bFiles);
  }, [addLog, bFiles, generateTasks]);

  /**
   * B 面文件变化处理
   */
  const handleBFilesChange = useCallback(async (files: string[]) => {
    setBFiles(files);
    if (files.length > 0) {
      addLog(`已选择 ${files.length} 个 B 面视频`, 'info');
    }
    await generateTasks(aFiles, files);
  }, [addLog, aFiles, generateTasks]);

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

  // 自动生成预览视频
  useEffect(() => {
    if (!currentTask) return;

    const previewKey = `${currentTask.aVideo.path}-${currentTask.bVideo.path}-${orientation}`;

    if (currentPreviewKeyRef.current === previewKey) {
      return;
    }

    currentPreviewKeyRef.current = previewKey;
    isPreviewCancelledRef.current = false;

    setPreviewVideoPath(null);
    setIsGeneratingPreview(true);

    const debounceTimer = setTimeout(async () => {
      addLog(`[预览] 正在生成 ${currentTask.outputFileName} 的预览视频 (${orientation === 'landscape' ? '横屏' : '竖屏'})`, 'info');

      try {
        const result = await window.api.generateStitchPreview({
          aPath: currentTask.aVideo.path,
          bPath: currentTask.bVideo.path,
          orientation
        });

        if (isPreviewCancelledRef.current || currentPreviewKeyRef.current !== previewKey) {
          if (result.tempPath) {
            window.api.deleteTempPreview(result.tempPath);
          }
          return;
        }

        if (result.success && result.tempPath) {
          setPreviewVideoPath(result.tempPath);
          addLog(`[预览] ${currentTask.outputFileName} 预览视频生成完成`, 'success');
        } else {
          addLog(`[错误] 预览生成失败: ${result.error}`, 'error');
        }
      } catch (err: any) {
        addLog(`[错误] 预览生成异常: ${err.message}`, 'error');
      } finally {
        if (!isPreviewCancelledRef.current) {
          setIsGeneratingPreview(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(debounceTimer);
      isPreviewCancelledRef.current = true;
    };
  }, [currentTask, orientation, addLog]);

  // 预览视频加载完成后自动播放
  useEffect(() => {
    const video = previewVideoRef.current;
    if (video && previewVideoPath) {
      video.volume = 0.1;
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => {});
      });
    }
  }, [previewVideoPath]);

  // 清理预览视频
  useEffect(() => {
    return () => {
      if (previewVideoPath) {
        window.api.deleteTempPreview(previewVideoPath);
      }
    };
  }, [previewVideoPath]);

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
   * 删除当前任务
   */
  const removeCurrentTask = () => {
    if (!currentTask) return;
    setTasks(prev => {
      const filtered = prev.filter(t => t.id !== currentTask.id);
      const newIndex = Math.min(currentIndex, filtered.length - 1);
      setCurrentIndex(newIndex >= 0 ? newIndex : 0);
      return filtered;
    });
    addLog(`已删除任务: ${currentTask.outputFileName}`, 'info');
  };

  /**
   * 清空所有任务
   */
  const clearAllTasks = () => {
    setTasks([]);
    setCurrentIndex(0);
    setAFiles([]);
    setBFiles([]);
    fileSelectorRef.current?.clearFiles();
    addLog('已清空所有任务', 'info');
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
            '系统自动将两个库的视频按顺序组合',
            '较大的库会循环使用，确保每个素材都被处理',
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
            {/* Stats Card */}
            {tasks.length > 0 && (
              <div className="bg-gradient-to-br from-pink-500/10 to-violet-500/10 border border-pink-500/20 rounded-xl p-4">
                <div className="text-2xl font-bold text-pink-400">{tasks.length}</div>
                <div className="text-xs text-slate-400">个合成视频</div>
              </div>
            )}

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
                {tasks.length > 0 && !isProcessing && (
                  <button
                    onClick={clearAllTasks}
                    className="text-xs text-slate-400 hover:text-pink-400 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-pink-500/50 hover:bg-pink-500/10 transition-all"
                  >
                    清除全部
                  </button>
                )}
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
                {/* 头部：标题居左 + 导航/删除居右 */}
                <div className="px-3 py-2 flex items-center justify-between border-b border-slate-800/50">
                  {/* 左侧：上一个按钮 + 标题 + 分辨率/帧率 */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={goToPrevious}
                      disabled={currentIndex === 0}
                      className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">合成详情</h3>
                    <div className="flex items-center gap-3 text-[10px]">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">分辨率</span>
                        <span className="text-pink-400 font-medium">{canvasConfig.label}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">帧率</span>
                        <span className="text-white">30fps</span>
                      </div>
                    </div>
                  </div>

                  {/* 右侧：删除按钮 + 下一个按钮 */}
                  <div className="flex items-center gap-1">
                    {currentTask.status === 'pending' && !isProcessing && (
                      <button
                        onClick={removeCurrentTask}
                        className="p-1.5 hover:bg-pink-500/10 text-slate-500 hover:text-pink-400 rounded transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {currentTask.status === 'processing' && (
                      <Loader2 className="w-4 h-4 text-pink-500 animate-spin" />
                    )}
                    {currentTask.status === 'completed' && (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    )}
                    {currentTask.status === 'error' && (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <button
                      onClick={goToNext}
                      disabled={currentIndex >= tasks.length - 1}
                      className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4 rotate-180" />
                    </button>
                  </div>
                </div>

                {/* 下方：A面和 B面视频 - 上下布局 */}
                <div className="px-3 py-2 space-y-2">
                  {/* A 面视频 */}
                  <div className="flex items-center gap-2">
                    {/* 标题 */}
                    <div className="flex items-center gap-2 shrink-0 w-20">
                      <div className="w-5 h-5 rounded bg-violet-500/20 flex items-center justify-center">
                        <Monitor className="w-3 h-3 text-violet-400" />
                      </div>
                      <span className="text-[10px] font-medium text-violet-400 uppercase">A 面</span>
                    </div>
                    {/* 缩略图 */}
                    <div className="w-10 h-10 rounded bg-violet-500/10 border border-violet-500/20 overflow-hidden shrink-0">
                      {currentTask.aVideo.thumbnailUrl ? (
                        <img src={currentTask.aVideo.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileVideo className="w-4 h-4 text-violet-400/50" />
                        </div>
                      )}
                    </div>
                    {/* 文件名 + 信息 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-200 truncate">{currentTask.aVideo.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {currentTask.aVideo.fileSize && (
                          <span className="text-[9px] text-slate-500">{formatFileSize(currentTask.aVideo.fileSize)}</span>
                        )}
                        {currentTask.aVideo.width && currentTask.aVideo.height && (
                          <span className="text-[9px] text-slate-500">{currentTask.aVideo.width}×{currentTask.aVideo.height}</span>
                        )}
                        {currentTask.aVideo.duration && (
                          <span className="text-[9px] text-slate-500">{formatDuration(currentTask.aVideo.duration)}</span>
                        )}
                      </div>
                    </div>
                    {/* 预览按钮 */}
                    <button
                      onClick={handleOpenAPreview}
                      className="p-1.5 hover:bg-violet-500/10 text-slate-500 hover:text-violet-400 rounded transition-colors shrink-0"
                      title="预览 A 面"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>

                  {/* B 面视频 */}
                  <div className="flex items-center gap-2">
                    {/* 标题 */}
                    <div className="flex items-center gap-2 shrink-0 w-20">
                      <div className="w-5 h-5 rounded bg-indigo-500/20 flex items-center justify-center">
                        <Smartphone className="w-3 h-3 text-indigo-400" />
                      </div>
                      <span className="text-[10px] font-medium text-indigo-400 uppercase">B 面</span>
                    </div>
                    {/* 缩略图 */}
                    <div className="w-10 h-10 rounded bg-indigo-500/10 border border-indigo-500/20 overflow-hidden shrink-0">
                      {currentTask.bVideo.thumbnailUrl ? (
                        <img src={currentTask.bVideo.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileVideo className="w-4 h-4 text-indigo-400/50" />
                        </div>
                      )}
                    </div>
                    {/* 文件名 + 信息 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-200 truncate">{currentTask.bVideo.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {currentTask.bVideo.fileSize && (
                          <span className="text-[9px] text-slate-500">{formatFileSize(currentTask.bVideo.fileSize)}</span>
                        )}
                        {currentTask.bVideo.width && currentTask.bVideo.height && (
                          <span className="text-[9px] text-slate-500">{currentTask.bVideo.width}×{currentTask.bVideo.height}</span>
                        )}
                        {currentTask.bVideo.duration && (
                          <span className="text-[9px] text-slate-500">{formatDuration(currentTask.bVideo.duration)}</span>
                        )}
                      </div>
                    </div>
                    {/* 预览按钮 */}
                    <button
                      onClick={handleOpenBPreview}
                      className="p-1.5 hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-400 rounded transition-colors shrink-0"
                      title="预览 B 面"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
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
              ) : !previewVideoPath ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 mx-auto mb-3 text-pink-400 animate-spin" />
                    <p className="text-sm text-slate-400">{isGeneratingPreview ? '正在生成预览视频...' : '准备生成预览...'}</p>
                  </div>
                </div>
              ) : (
                <div className="relative w-full h-full flex items-center justify-center">
                  <div
                    className="bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800"
                    style={orientation === 'landscape'
                      ? { width: '640px', maxHeight: '100%', aspectRatio: '16/9' }
                      : { height: '640px', maxWidth: '100%', aspectRatio: '9/16' }
                    }
                  >
                    <video
                      ref={previewVideoRef}
                      src={`preview://${encodeURIComponent(previewVideoPath)}`}
                      className="w-full h-full object-cover"
                      controls
                      autoPlay
                      loop
                      playsInline
                    />
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
