import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Slider from '@radix-ui/react-slider';
import {
  FileVideo, ArrowLeft, Settings, CheckCircle, Maximize2, Eye,
  XCircle, Loader2, Layers, FolderOpen
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import OutputDirSelector from '../components/OutputDirSelector';
import ConcurrencySelector from '../components/ConcurrencySelector';
import OperationLogPanel from '../components/OperationLogPanel';
import FilePreviewModal from '../components/FilePreviewModal';
import { FileSelector, FileSelectorGroup, type FileSelectorRef, formatFileSize } from '../components/FileSelector';
import { Button } from '../components/Button/Button';
import { PreviewArea } from './ResizeMode/components/PreviewArea';
import { useOutputDirCache } from '../hooks/useOutputDirCache';
import { useConcurrencyCache } from '../hooks/useConcurrencyCache';
import { useOperationLogs } from '../hooks/useOperationLogs';
import { useVideoProcessingEvents } from '../hooks/useVideoProcessingEvents';
import { useVideoVolumeCache } from '../hooks/useVideoVolumeCache';
import useVideoMaterials from '../hooks/useVideoMaterials';

interface ResizeModeProps {
  onBack: () => void;
}

type ResizeMode = 'siya' | 'fishing' | 'unify_h' | 'unify_v';

/**
 * 视频文件数据结构
 */
interface VideoFile {
  id: string;
  path: string;
  name: string;
  status: 'pending' | 'waiting' | 'processing' | 'completed' | 'error';
  thumbnailUrl?: string;      // 缩略图 URL（用于任务列表）
  previewUrl?: string;        // 预览 URL（用于视频播放）
  width?: number;             // 视频宽度
  height?: number;            // 视频高度
  fileSize?: number;          // 文件大小（字节）
  duration?: number;          // 时长（秒）
  orientation?: 'landscape' | 'portrait' | 'square';  // 方向
  error?: string;
}

const MODE_CONFIG = {
  siya: { name: 'Siya模式', desc: '竖屏转横屏/方形', outputs: [{ width: 1920, height: 1080, label: '1920x1080' }, { width: 1920, height: 1920, label: '1920x1920' }] },
  fishing: { name: '海外捕鱼', desc: '横屏转竖屏/方形', outputs: [{ width: 1080, height: 1920, label: '1080x1920' }, { width: 1920, height: 1920, label: '1920x1920' }] },
  unify_h: { name: '统一横屏', desc: '强制转为横屏比例', outputs: [{ width: 1920, height: 1080, label: '1920x1080' }] },
  unify_v: { name: '统一竖屏', desc: '强制转为竖屏比例', outputs: [{ width: 1080, height: 1920, label: '1080x1920' }] },
};

const ResizeMode: React.FC<ResizeModeProps> = ({ onBack }) => {
  // 视频文件路径列表
  const [videoPaths, setVideoPaths] = useState<string[]>([]);

  // 视频列表状态
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // FileSelector ref，用于清空选择器
  const fileSelectorRef = useRef<FileSelectorRef>(null);

  // 使用 hook 加载视频素材（带缓存）
  const { materials } = useVideoMaterials(videoPaths, true, {
    onLog: (message, type) => addLog(message, type),
  });

  const { outputDir, setOutputDir } = useOutputDirCache('ResizeMode');
  const { concurrency, setConcurrency } = useConcurrencyCache('ResizeMode');
  const [mode, setMode] = useState<ResizeMode>('siya');
  const [blurAmount, setBlurAmount] = useState(20);

  // 处理状态
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, failed: 0, total: 0 });

  // 使用音量缓存 Hook
  const { volume, isMuted, setVolume, setIsMuted } = useVideoVolumeCache('resize');

  // 使用日志 Hook
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
    moduleNameCN: '智能改尺寸',
    moduleNameEN: 'Resize',
  });

  // 当前选中的视频
  const currentVideo = videos[currentIndex];

  // 预览弹窗状态
  const [showPreview, setShowPreview] = useState(false);

  /**
   * 打开预览弹窗
   */
  const handleOpenPreview = useCallback(() => {
    if (currentVideo) {
      setShowPreview(true);
    }
  }, [currentVideo]);

  /**
   * 关闭预览弹窗
   */
  const handleClosePreview = useCallback(() => {
    setShowPreview(false);
  }, []);

  // 使用视频处理事件 Hook
  useVideoProcessingEvents({
    onStart: (data) => {
      addLog(`开始处理: 总任务 ${data.total}, 并发 ${data.concurrency}`, 'info');
      setProgress({ done: 0, failed: 0, total: data.total });
      // 所有任务设为等待状态
      setVideos(prev => prev.map(v => ({ ...v, status: 'waiting' as const })));
    },
    onTaskStart: (data) => {
      // 直接使用后端传来的 videoIndex
      if (data.videoIndex !== undefined) {
        setVideos(prev => prev.map((v, idx) =>
          idx === data.videoIndex ? { ...v, status: 'processing' as const } : v
        ));
      }
    },
    onProgress: (data) => {
      setProgress({ done: data.done, failed: data.failed, total: data.total });

      // 后端确保该视频的所有输出都完成时才发送 progress 事件
      // 使用 index 直接匹配视频数组
      setVideos(prev => prev.map((v, idx) =>
        idx === data.index ? { ...v, status: 'completed' as const } : v
      ));
      addLog(`进度: ${data.done}/${data.total} (失败 ${data.failed})`, 'info');
    },
    onFailed: (data) => {
      // 任务失败时，标记对应视频为错误
      setVideos(prev => prev.map((v, idx) =>
        idx === data.index ? { ...v, status: 'error' as const, error: data.error } : v
      ));
      addLog(`❌ 任务失败: ${data.error}`, 'error');
    },
    onFinish: (data) => {
      addLog(`✅ 完成! 成功 ${data.done}, 失败 ${data.failed}`, 'success');
      setIsProcessing(false);
    },
    onLog: (data) => {
      addLog(`[${data.videoId || data.index + 1}] ${data.message}`, 'info');
    },
  });

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
   * 处理视频选择
   */
  const handleVideosChange = useCallback((filePaths: string[]) => {
    setVideoPaths(filePaths);
    if (filePaths.length === 0) {
      setVideos([]);
      setCurrentIndex(0);
    }
  }, []);

  // 当素材数据变化时，同步到 videos 状态
  useEffect(() => {
    if (materials.length === 0 && videoPaths.length === 0) {
      return;
    }

    // 根据素材数据构建 videos 状态
    const newVideos: VideoFile[] = videoPaths.map((path, index) => {
      const material = materials[index];

      if (material && material.isLoaded) {
        return {
          id: Math.random().toString(36).substr(2, 9),
          path: material.path,
          name: material.name,
          status: 'pending' as const,
          thumbnailUrl: material.thumbnailUrl,
          previewUrl: material.previewUrl,
          width: material.width,
          height: material.height,
          fileSize: material.fileSize,
          duration: material.duration,
          orientation: material.orientation,
        };
      }

      // 未加载完成的占位
      return {
        id: Math.random().toString(36).substr(2, 9),
        path,
        name: path.split('/').pop() || path,
        status: 'pending' as const,
      };
    });

    setVideos(newVideos);
  }, [materials, videoPaths]);

  /**
   * 切换任务
   */
  const switchToTask = (index: number) => {
    if (index < 0 || index >= videos.length) return;
    setCurrentIndex(index);
  };

  /**
   * 上一条
   */
  const goToPrevious = () => {
    if (currentIndex > 0) {
      switchToTask(currentIndex - 1);
    }
  };

  /**
   * 下一条
   */
  const goToNext = () => {
    if (currentIndex < videos.length - 1) {
      switchToTask(currentIndex + 1);
    }
  };

  /**
   * 开始处理
   */
  const startProcessing = async () => {
    if (videos.length === 0) {
      addLog('⚠️ 请先选择视频', 'warning');
      return;
    }
    if (!outputDir) {
      addLog('⚠️ 请先选择输出目录', 'warning');
      return;
    }
    if (isProcessing) return;

    setIsProcessing(true);
    // 不再自动清空日志，保留历史记录
    setProgress({ done: 0, failed: 0, total: videos.length });

    // 所有任务设为等待状态
    setVideos(prev => prev.map(v => ({ ...v, status: 'waiting' as const })));

    addLog('开始智能改尺寸处理...', 'info');
    addLog(`视频: ${videos.length} 个`, 'info');
    addLog(`模式: ${MODE_CONFIG[mode].name}`, 'info');
    addLog(`输出: ${MODE_CONFIG[mode].outputs.map(o => o.label).join(', ')}`, 'info');
    addLog(`模糊程度: ${blurAmount}`, 'info');

    try {
      await window.api.videoResize({
        videos: videos.map(v => ({ id: v.id, path: v.path })),
        mode,
        blurAmount,
        outputDir,
        concurrency
      });
    } catch (err: any) {
      addLog(`❌ 处理失败: ${err.message || err}`, 'error');
      setIsProcessing(false);
    }
  };

  /**
   * 计算预览容器的宽高比和前景尺寸
   */
  const getPreviewStyle = (outputWidth: number, outputHeight: number, originalWidth: number, originalHeight: number) => {
    const originalAspect = originalWidth / originalHeight;
    const targetAspect = outputWidth / outputHeight;

    let displayWidth, displayHeight;

    if (originalAspect > targetAspect) {
      displayWidth = outputWidth;
      displayHeight = outputWidth / originalAspect;
    } else {
      displayHeight = outputHeight;
      displayWidth = outputHeight * originalAspect;
    }

    const offsetX = (outputWidth - displayWidth) / 2;
    const offsetY = (outputHeight - displayHeight) / 2;

    const widthPercent = (displayWidth / outputWidth) * 100;
    const heightPercent = (displayHeight / outputHeight) * 100;
    const leftPercent = (offsetX / outputWidth) * 100;
    const topPercent = (offsetY / outputHeight) * 100;

    return {
      containerAspectRatio: outputWidth / outputHeight,
      widthPercent,
      heightPercent,
      leftPercent,
      topPercent,
    };
  };

  return (
    <div className="h-screen bg-black text-slate-100 flex flex-col overflow-hidden">
      <PageHeader
        onBack={onBack}
        title="智能改尺寸"
        icon={Maximize2}
        iconColor="text-rose-400"
        description="Siya/海外捕鱼/尺寸统一，智能模糊背景填充"
        featureInfo={{
          title: '智能改尺寸',
          description: '支持四种视频尺寸转换模式，使用模糊背景填充适配目标尺寸。',
          details: [
            'Siya模式：竖屏视频转为横屏（1920×1080）或方形（1920×1920）',
            '海外捕鱼模式：横屏视频转为竖屏（1080×1920）或方形（1920×1920）',
            '统一横屏：强制所有视频转为横屏比例（1920×1080）',
            '统一竖屏：强制所有视频转为竖屏比例（1080×1920）',
            '可调整模糊程度，实时预览转换效果',
          ],
          themeColor: 'rose',
        }}
      />

      {/* Main Content - 三栏布局 */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - File Selection */}
        <div className="w-80 border-r border-slate-800 bg-black flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          <div className="p-4 space-y-4">
            {/* Mode Selection */}
            <div className="bg-black/50 border border-slate-800 rounded-xl p-3">
              <label className="font-medium flex items-center gap-2 mb-2 text-xs">
                <Maximize2 className="w-3 h-3 text-rose-400" />
                处理模式
              </label>
              <div className="space-y-2">
                {(Object.keys(MODE_CONFIG) as ResizeMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`w-full p-2 rounded-lg border text-left transition-all text-xs ${
                      mode === m
                        ? 'border-rose-500 bg-rose-500/20 text-rose-400'
                        : 'border-slate-700 bg-black/50 text-slate-400 hover:border-slate-600'
                    }`}
                    disabled={isProcessing}
                  >
                    <div className="font-medium">{MODE_CONFIG[m].name}</div>
                    <div className="text-[10px] opacity-80 mt-0.5">{MODE_CONFIG[m].desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Video Selection */}
            <FileSelectorGroup>
              <FileSelector
                ref={fileSelectorRef}
                id="resizeVideos"
                name="视频文件"
                accept="video"
                multiple
                showList={true}
                themeColor="rose"
                directoryCache
                onChange={handleVideosChange}
                disabled={isProcessing}
              />
            </FileSelectorGroup>


            {/* Blur Amount */}
            <div className="bg-black/50 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Settings className="w-3 h-3" />
                  模糊程度
                </label>
                <span className="px-3 py-1.5 rounded-lg font-mono font-bold text-lg bg-gradient-to-r from-rose-500 to-red-500 bg-clip-text text-transparent">
                  {blurAmount}
                </span>
              </div>
              {/* Radix UI Slider */}
              <Slider.Root
                className="relative flex items-center select-none touch-none h-5"
                value={[blurAmount]}
                onValueChange={(values) => setBlurAmount(values[0])}
                max={50}
                min={0}
                step={1}
                disabled={isProcessing}
              >
                <Slider.Track className="bg-neutral-900 relative grow rounded-full h-2 shadow-inner">
                  <Slider.Range className="absolute h-full rounded-full bg-gradient-to-r from-rose-500 to-red-500 relative">
                    {/* 光晕效果 */}
                    <div className="absolute inset-0 bg-gradient-to-r from-rose-500 to-red-500 blur-sm opacity-50" />
                  </Slider.Range>
                </Slider.Track>
                <Slider.Thumb
                  className="block w-3 h-3 rounded-full bg-rose-500 shadow-lg shadow-rose-500/30 hover:scale-125 focus:outline-none focus:scale-125 active:scale-110 transition-transform duration-150 cursor-grab active:cursor-grabbing"
                  aria-label="模糊程度"
                />
              </Slider.Root>
              <div className="relative text-[9px] font-mono">
                <span className="absolute left-0 text-slate-600">0</span>
                <span className="absolute left-[40%] -translate-x-1/2 text-rose-400 font-bold">20 推荐</span>
                <span className="absolute right-0 text-rose-400 font-medium">50</span>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Panel - flex-1 with vertical layout */}
        <div className="flex-1 bg-black flex flex-col overflow-hidden min-w-0">
          {/* Top: Task List Header + Horizontal Scroll + Selected Task Details */}
          <div className="flex-shrink-0 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-black/50 shrink-0">
              <h2 className="font-bold text-sm text-slate-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-rose-400" />
                任务列表
              </h2>
              <div className="flex items-center gap-3">
                <span className="bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded-full">
                  {videos.length > 0 ? `${currentIndex + 1} / ${videos.length}` : videos.length}
                </span>
              </div>
            </div>

            {/* 横向滚动任务栏 */}
            <div className="h-20 overflow-x-auto overflow-y-hidden border-b border-slate-800 shrink-0">
              <div className="flex items-center h-full px-4 gap-2">
                {videos.map((v, index) => (
                  <div
                    key={v.id}
                    className={`relative shrink-0 w-14 h-14 rounded-lg border cursor-pointer ${
                      index === currentIndex
                        ? 'border-rose-500/60 ring-2 ring-rose-500/20 bg-rose-500/5'
                        : v.status === 'error'
                        ? 'border-red-500/50 bg-red-500/5'
                        : v.status === 'completed'
                        ? 'border-emerald-500/50 bg-emerald-500/5'
                        : v.status === 'waiting'
                        ? 'border-rose-500/30 bg-rose-500/5'
                        : v.status === 'processing'
                        ? 'border-rose-500/30 bg-rose-500/5'
                        : 'border-slate-700 bg-black/50'
                    }`}
                    onClick={() => switchToTask(index)}
                  >
                    {/* 缩略图 */}
                    <div className="absolute inset-0 rounded-lg overflow-hidden">
                      {v.thumbnailUrl ? (
                        <img src={v.thumbnailUrl} alt={v.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-black">
                          <FileVideo className="w-5 h-5 text-slate-600" />
                        </div>
                      )}
                    </div>

                    {/* processing 状态 */}
                    {v.status === 'processing' && (
                      <div className="absolute inset-0 rounded-lg bg-black/50 flex items-center justify-center pointer-events-none">
                        <Loader2 className="w-5 h-5 text-rose-500 animate-spin" />
                      </div>
                    )}
                    {/* waiting 状态 */}
                    {v.status === 'waiting' && (
                      <div className="absolute inset-0 rounded-lg bg-black/30 flex items-center justify-center pointer-events-none">
                        <div className="w-4 h-4 rounded-full bg-rose-500/70" />
                      </div>
                    )}
                    {/* completed 状态 */}
                    {v.status === 'completed' && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
                        <CheckCircle className="w-2.5 h-2.5 text-black" />
                      </div>
                    )}
                    {/* error 状态 */}
                    {v.status === 'error' && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
                        <span className="text-black text-[8px] font-bold">!</span>
                      </div>
                    )}

                    {/* 当前预览指示器 */}
                    {index === currentIndex && (
                      <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-rose-500 rounded text-[8px] font-medium text-black whitespace-nowrap z-10">
                        预览
                      </div>
                    )}
                  </div>
                ))}
                {videos.length === 0 && (
                  <div className="flex items-center justify-center w-full h-full text-slate-500">
                    <p className="text-xs">暂无任务</p>
                  </div>
                )}
              </div>
            </div>

            {/* 选中任务详情 */}
            {currentVideo && (
              <div className="bg-black/30 border-b border-slate-800 shrink-0">
                <div className="px-3 py-2 flex items-center gap-2">
                  {/* 导航按钮 */}
                  <button
                    onClick={goToPrevious}
                    disabled={currentIndex === 0}
                    className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  {/* 缩略图 */}
                  <div className="w-10 h-10 rounded bg-slate-800 overflow-hidden shrink-0">
                    {currentVideo.thumbnailUrl ? (
                      <img src={currentVideo.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileVideo className="w-5 h-5 text-slate-600" />
                      </div>
                    )}
                  </div>

                  {/* 文件信息 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{currentVideo.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {currentVideo.fileSize && (
                        <span className="text-[10px] text-slate-500">{formatFileSize(currentVideo.fileSize)}</span>
                      )}
                      {currentVideo.width && currentVideo.height && (
                        <span className="text-[10px] text-slate-500">{currentVideo.width}×{currentVideo.height}</span>
                      )}
                      {currentVideo.duration && (
                        <span className="text-[10px] text-slate-500">{formatDuration(currentVideo.duration)}</span>
                      )}
                      {currentVideo.orientation && (
                        <span className="text-[10px] text-slate-500 px-1 py-0.5 bg-slate-800 rounded">
                          {currentVideo.orientation === 'landscape' ? '横版' : currentVideo.orientation === 'portrait' ? '竖版' : '方形'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* 预览按钮 */}
                    {currentVideo.previewUrl && (
                      <button
                        onClick={handleOpenPreview}
                        className="p-1.5 hover:bg-slate-800 text-slate-500 hover:text-slate-300 rounded transition-colors"
                        title="预览"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    {currentVideo.status === 'processing' && (
                      <Loader2 className="w-5 h-5 text-rose-500 animate-spin" />
                    )}
                    {currentVideo.status === 'completed' && (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    )}
                    {currentVideo.status === 'error' && (
                      <div className="flex items-center gap-1 text-red-400">
                        <XCircle className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  {/* 导航按钮 */}
                  <button
                    onClick={goToNext}
                    disabled={currentIndex >= videos.length - 1}
                    className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 rotate-180" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom: Preview Area */}
          <div className="flex-1 overflow-hidden p-4 min-h-0">
            {videos.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-slate-500">
                  <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">选择视频后显示预览</p>
                </div>
              </div>
            ) : !currentVideo?.previewUrl ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 mx-auto mb-3 text-rose-400 animate-spin" />
                  <p className="text-sm text-slate-400">加载视频中...</p>
                </div>
              </div>
            ) : !currentVideo?.width || !currentVideo?.height ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 mx-auto mb-3 text-rose-400 animate-spin" />
                  <p className="text-sm text-slate-400">获取视频信息...</p>
                </div>
              </div>
            ) : (
              <PreviewArea
                mode={mode}
                currentVideo={currentVideo}
                blurAmount={blurAmount}
                volume={volume}
                isMuted={isMuted}
                onVolumeChange={setVolume}
                onMuteChange={setIsMuted}
                isProcessing={isProcessing}
                getPreviewStyle={getPreviewStyle}
              />
            )}
          </div>
        </div>

        {/* Right Sidebar - Settings + Logs + Button */}
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
                themeColor="rose"
              />
              <ConcurrencySelector
                value={concurrency}
                onChange={setConcurrency}
                disabled={isProcessing}
                themeColor="rose"
                compact
              />
            </div>

            {/* Progress Display */}
            {progress.total > 0 && (
              <div className="bg-black/50 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">处理进度</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">已完成</span>
                  <span className="text-rose-400 font-bold">{progress.done}/{progress.total}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-rose-500 h-2 rounded-full transition-all"
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
                themeColor="rose"
              />
            </div>

            {/* Start Button */}
            <Button
              onClick={startProcessing}
              disabled={isProcessing || videos.length === 0 || !outputDir}
              variant="primary"
              size="md"
              fullWidth
              loading={isProcessing}
              leftIcon={!isProcessing && <FolderOpen className="w-4 h-4" />}
              themeColor="rose"
            >
              {isProcessing ? '处理中...' : '开始处理'}
            </Button>
          </div>
        </div>
      </div>

      {/* 视频预览弹窗 */}
      {showPreview && currentVideo && (
        <FilePreviewModal
          file={{
            path: currentVideo.path,
            name: currentVideo.name,
            type: 'video',
          }}
          visible={showPreview}
          onClose={handleClosePreview}
          allFiles={videos.map(v => ({
            path: v.path,
            name: v.name,
            type: 'video' as const,
          }))}
          currentIndex={currentIndex}
          onPrevious={goToPrevious}
          onNext={goToNext}
          themeColor="rose"
        />
      )}
    </div>
  );
};

export default ResizeMode;
