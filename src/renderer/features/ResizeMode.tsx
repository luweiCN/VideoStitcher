import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileVideo, Play, Trash2, Loader2, ArrowLeft, Settings, CheckCircle, Maximize2, Eye, ChevronLeft, ChevronRight, Pause, Volume2, VolumeX, FolderOpen } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import OutputDirSelector from '../components/OutputDirSelector';
import ConcurrencySelector from '../components/ConcurrencySelector';
import OperationLogPanel from '../components/OperationLogPanel';
import { FileSelector, FileSelectorGroup } from '../components/FileSelector';
import { useOutputDirCache } from '../hooks/useOutputDirCache';
import { useConcurrencyCache } from '../hooks/useConcurrencyCache';
import { useOperationLogs } from '../hooks/useOperationLogs';
import { useVideoProcessingEvents } from '../hooks/useVideoProcessingEvents';

interface ResizeModeProps {
  onBack: () => void;
}

type ResizeMode = 'siya' | 'fishing' | 'unify_h' | 'unify_v';

// 预览图片数据结构
interface PreviewImage {
  url: string;
  width: number;
  height: number;
  label: string;
}

const MODE_CONFIG = {
  siya: { name: 'Siya模式', desc: '竖屏转横屏/方形', outputs: [{ width: 1920, height: 1080, label: '1920x1080' }, { width: 1920, height: 1920, label: '1920x1920' }] },
  fishing: { name: '海外捕鱼', desc: '横屏转竖屏/方形', outputs: [{ width: 1080, height: 1920, label: '1080x1920' }, { width: 1920, height: 1920, label: '1920x1920' }] },
  unify_h: { name: '统一横屏', desc: '强制转为横屏比例', outputs: [{ width: 1920, height: 1080, label: '1920x1080' }] },
  unify_v: { name: '统一竖屏', desc: '强制转为竖屏比例', outputs: [{ width: 1080, height: 1920, label: '1080x1920' }] },
};

// 格式化时间显示
const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const ResizeMode: React.FC<ResizeModeProps> = ({ onBack }) => {
  const [videos, setVideos] = useState<string[]>([]);
  const { outputDir, setOutputDir } = useOutputDirCache('ResizeMode');
  const { concurrency, setConcurrency } = useConcurrencyCache('ResizeMode');
  const [mode, setMode] = useState<ResizeMode>('siya');
  const [blurAmount, setBlurAmount] = useState(20);

  // 预览相关状态
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [originalVideoUrl, setOriginalVideoUrl] = useState<string | null>(null);
  const [originalVideoSize, setOriginalVideoSize] = useState({ width: 1920, height: 1080 });

  // 视频播放状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(30);
  const [isMuted, setIsMuted] = useState(true);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const backgroundVideoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, failed: 0, total: 0 });

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
    moduleNameCN: '视频缩放',
    moduleNameEN: 'Resize',
  });

  // 加载全局默认配置（已移至 useConcurrencyCache hook）

  // 获取视频预览 URL 和元数据
  const generatePreviews = useCallback(async () => {
    if (videos.length === 0 || currentVideoIndex >= videos.length) return;

    setIsGeneratingPreview(true);
    setPreviewError(null);

    try {
      const videoPath = videos[currentVideoIndex];
      addLog(`生成预览: ${videoPath.split('/').pop()}`);

      // 使用 Electron 的预览 URL API
      const previewResult = await window.api.getPreviewUrl(videoPath);
      if (!previewResult.success || !previewResult.url) {
        throw new Error(previewResult.error || '获取预览 URL 失败');
      }

      // 使用 video 元素获取视频尺寸（不需要 ffprobe）
      const video = document.createElement('video');
      video.src = previewResult.url;
      video.muted = true;
      video.playsInline = true;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('视频加载失败'));
        video.load();
      });

      // 存储原始视频 URL 和尺寸
      setOriginalVideoUrl(previewResult.url);
      setOriginalVideoSize({ width: video.videoWidth, height: video.videoHeight });

      // 为每个输出尺寸创建预览配置
      const outputs = MODE_CONFIG[mode].outputs;
      const previews: PreviewImage[] = [];

      for (const output of outputs) {
        previews.push({
          url: previewResult.url, // 所有预览使用同一视频源
          width: output.width,
          height: output.height,
          label: output.label,
        });
      }

      setPreviewImages(previews);
      addLog(`预览准备完成: ${previews.length} 个版本`);
    } catch (err: any) {
      setPreviewError(err.message || '生成预览失败');
      addLog(`预览生成异常: ${err.message}`);
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [videos, currentVideoIndex, mode, addLog]);

  // 使用视频处理事件 Hook
  useVideoProcessingEvents({
    onStart: (data) => {
      addLog(`开始处理: 总任务 ${data.total}, 并发 ${data.concurrency}`);
      setProgress({ done: 0, failed: 0, total: data.total });
    },
    onProgress: (data) => {
      setProgress({ done: data.done, failed: data.failed, total: data.total });
      addLog(`进度: ${data.done}/${data.total} (失败 ${data.failed})`);
    },
    onFailed: (data) => {
      addLog(`❌ 任务 ${data.index + 1} 失败: ${data.error}`, 'error');
    },
    onFinish: (data) => {
      addLog(`✅ 完成! 成功 ${data.done}, 失败 ${data.failed}`, 'success');
      setIsProcessing(false);
    },
    onLog: (data) => {
      addLog(`[任务 ${data.index + 1}] ${data.message}`);
    },
  });

  // 当视频列表或模式改变时，重新生成预览
  useEffect(() => {
    if (videos.length > 0 && currentVideoIndex < videos.length) {
      generatePreviews();
    } else {
      // 清空预览
      setPreviewImages([]);
      setPreviewError(null);
      setOriginalVideoUrl(null);
    }
  }, [videos, currentVideoIndex, mode, generatePreviews]);

  // 当视频切换时，重置播放状态并停止所有视频
  useEffect(() => {
    // 停止所有正在播放的前景视频
    videoRefs.current.forEach(video => {
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
    });

    // 停止所有正在播放的背景视频
    backgroundVideoRefs.current.forEach(video => {
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
    });

    // 重置播放状态
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    // 清空旧的 refs
    videoRefs.current = [];
    backgroundVideoRefs.current = [];
  }, [currentVideoIndex, videos.length]);

  // 当音量或静音状态改变时，更新所有视频
  useEffect(() => {
    videoRefs.current.forEach(video => {
      if (video) {
        video.volume = volume / 100;
        video.muted = isMuted;
      }
    });
  }, [volume, isMuted]);

  /**
   * 处理视频选择 - 使用 FileSelector
   */
  const handleVideosChange = useCallback(async (files: string[]) => {
    if (files.length > 0) {
      setVideos(files);
      setCurrentVideoIndex(0);
      addLog(`已选择 ${files.length} 个视频`);
      // 立即生成第一个视频的预览
      generatePreviews();
    }
  }, [addLog]);

  const handlePrevVideo = () => {
    if (currentVideoIndex > 0) {
      setCurrentVideoIndex(currentVideoIndex - 1);
    }
  };

  const handleNextVideo = () => {
    if (currentVideoIndex < videos.length - 1) {
      setCurrentVideoIndex(currentVideoIndex + 1);
    }
  };

  // 视频播放控制
  const togglePlayPause = () => {
    const newPlaying = !isPlaying;
    // 控制前景视频
    videoRefs.current.forEach(video => {
      if (video) {
        if (newPlaying) {
          video.play();
        } else {
          video.pause();
        }
      }
    });
    // 控制背景视频（跟随前景）
    backgroundVideoRefs.current.forEach(video => {
      if (video) {
        if (newPlaying) {
          video.play();
        } else {
          video.pause();
        }
      }
    });
    setIsPlaying(newPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    // 前景视频
    videoRefs.current.forEach(video => {
      if (video) {
        video.currentTime = time;
      }
    });
    // 背景视频也要同步
    backgroundVideoRefs.current.forEach(video => {
      if (video) {
        video.currentTime = time;
      }
    });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    videoRefs.current.forEach(video => {
      if (video) {
        video.volume = newVolume / 100;
        video.muted = newVolume === 0;
      }
    });
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    // 取消静音时，如果音量是0，恢复到30%
    if (!newMuted && volume === 0) {
      setVolume(30);
    }
    videoRefs.current.forEach(video => {
      if (video) {
        video.muted = newMuted;
        if (!newMuted && volume === 0) {
          video.volume = 0.3;
        }
      }
    });
  };

  const handleTimeUpdate = () => {
    const video = videoRefs.current[0];
    if (video) {
      setCurrentTime(video.currentTime);
      setDuration(video.duration || 0);
    }
  };

  const handleLoadedMetadata = () => {
    // 处理所有前景视频的音量和静音状态
    videoRefs.current.forEach(video => {
      if (video) {
        video.volume = volume / 100;
        video.muted = isMuted;
      }
    });
    // 设置时长（使用第一个视频）
    const firstVideo = videoRefs.current[0];
    if (firstVideo) {
      setDuration(firstVideo.duration || 0);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    // 暂停并重置所有背景视频
    backgroundVideoRefs.current.forEach(video => {
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
    });
  };

  const startProcessing = async () => {
    if (videos.length === 0) {
      addLog('⚠️ 请先选择视频');
      return;
    }
    if (!outputDir) {
      addLog('⚠️ 请先选择输出目录');
      return;
    }
    if (isProcessing) return;

    setIsProcessing(true);
    clearLogs();
    addLog('开始智能改尺寸处理...');
    addLog(`视频: ${videos.length} 个`);
    addLog(`模式: ${MODE_CONFIG[mode].name}`);
    addLog(`输出: ${MODE_CONFIG[mode].outputs.map(o => o.label).join(', ')}`);
    addLog(`模糊程度: ${blurAmount}`);

    try {
      await window.api.videoResize({
        videos,
        mode,
        blurAmount,
        outputDir,
        concurrency
      });
    } catch (err: any) {
      addLog(`❌ 处理失败: ${err.message || err}`);
      setIsProcessing(false);
    }
  };

  // 计算预览容器的宽高比和前景尺寸
  const getPreviewStyle = (outputWidth: number, outputHeight: number, originalWidth: number, originalHeight: number) => {
    // 计算原图在输出尺寸中的显示尺寸（保持比例）
    const originalAspect = originalWidth / originalHeight;
    const targetAspect = outputWidth / outputHeight;

    let displayWidth, displayHeight;

    if (originalAspect > targetAspect) {
      // 原图更宽：按宽度适配
      displayWidth = outputWidth;
      displayHeight = outputWidth / originalAspect;
    } else {
      // 原图更高：按高度适配
      displayHeight = outputHeight;
      displayWidth = outputHeight * originalAspect;
    }

    // 计算居中位置
    const offsetX = (outputWidth - displayWidth) / 2;
    const offsetY = (outputHeight - displayHeight) / 2;

    // 转换为百分比（相对于容器尺寸）
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
    <div className="h-screen bg-slate-950 text-white flex flex-col overflow-hidden">
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
        rightContent={
          videos.length > 0 && (
            <span className="text-sm text-gray-400">
              {currentVideoIndex + 1} / {videos.length}
            </span>
          )
        }
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Preview */}
        <div className="w-[400px] bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-800 shrink-0">
            <h2 className="font-medium flex items-center gap-2 text-sm text-slate-300">
              <Eye className="w-4 h-4 text-rose-400" />
              效果预览
            </h2>
            {previewImages.length > 0 && (
              <span className="text-xs text-slate-500 ml-auto">实时预览</span>
            )}
          </div>

          <div className="flex-1 p-4 overflow-y-auto">
            {videos.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>选择视频后生成预览</p>
              </div>
            ) : isGeneratingPreview ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 mx-auto mb-3 text-rose-400 animate-spin" />
                <p className="text-sm text-slate-400">生成预览中...</p>
              </div>
            ) : previewError ? (
              <div className="text-center py-12">
                <p className="text-sm text-red-400">{previewError}</p>
              </div>
            ) : previewImages.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                暂无预览
              </div>
            ) : (
              <div className="space-y-4">
                {previewImages.map((preview, index) => {
                  const style = getPreviewStyle(
                    preview.width,
                    preview.height,
                    originalVideoSize.width,
                    originalVideoSize.height
                  );

                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-slate-400">{preview.label}</span>
                        <span className="text-[10px] text-slate-500">实时预览</span>
                      </div>
                      <div
                        className="bg-black rounded-lg overflow-hidden border border-slate-800 relative"
                        style={{
                          aspectRatio: style.containerAspectRatio,
                        }}
                      >
                        {/* 背景层（模糊视频） */}
                        <video
                          ref={el => backgroundVideoRefs.current[index] = el}
                          src={preview.url}
                          className="absolute inset-0 w-full h-full object-cover"
                          style={{
                            filter: `blur(${blurAmount}px)`,
                            transform: 'scale(1.1)',
                          }}
                          muted={true}
                          playsInline
                        />
                        {/* 遮罩层 */}
                        <div className="absolute inset-0 bg-black/30" />
                        {/* 前景层（清晰视频，可播放） */}
                        <video
                          ref={el => videoRefs.current[index] = el}
                          src={preview.url}
                          className="absolute bg-transparent"
                          style={{
                            width: `${style.widthPercent}%`,
                            height: `${style.heightPercent}%`,
                            left: `${style.leftPercent}%`,
                            top: `${style.topPercent}%`,
                            objectFit: 'contain',
                          }}
                          muted={isMuted}
                          playsInline
                          onTimeUpdate={handleTimeUpdate}
                          onLoadedMetadata={handleLoadedMetadata}
                          onEnded={handleEnded}
                        />
                      </div>

                      {/* 自定义播放控件 */}
                      <div className="bg-slate-900 rounded-lg p-3 space-y-2">
                        {/* 进度条 */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={togglePlayPause}
                            className="p-1.5 hover:bg-slate-800 rounded transition-colors shrink-0"
                            title={isPlaying ? '暂停' : '播放'}
                          >
                            {isPlaying ? <Pause className="w-4 h-4 text-rose-400" /> : <Play className="w-4 h-4 text-rose-400" />}
                          </button>
                          <input
                            type="range"
                            min="0"
                            max={duration || 100}
                            value={currentTime}
                            onChange={handleSeek}
                            className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                          />
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">
                            {formatTime(currentTime)} / {formatTime(duration)}
                          </span>
                        </div>

                        {/* 音量控制 */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={toggleMute}
                            className="p-1 hover:bg-slate-800 rounded transition-colors shrink-0"
                            title={isMuted ? '取消静音' : '静音'}
                          >
                            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-slate-400" /> : <Volume2 className="w-3.5 h-3.5 text-slate-400" />}
                          </button>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={isMuted ? 0 : volume}
                            onChange={handleVolumeChange}
                            className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-slate-500"
                          />
                          <span className="text-[10px] text-slate-500 font-mono shrink-0 w-12 text-right">
                            {isMuted ? '静音' : `${volume}%`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Video Navigation */}
          {videos.length > 1 && (
            <div className="p-4 border-t border-slate-800 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={handlePrevVideo}
                  disabled={currentVideoIndex === 0 || isGeneratingPreview}
                  className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 rounded-lg text-sm transition-colors flex items-center justify-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  上一个
                </button>
                <button
                  onClick={handleNextVideo}
                  disabled={currentVideoIndex === videos.length - 1 || isGeneratingPreview}
                  className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 rounded-lg text-sm transition-colors flex items-center justify-center gap-1"
                >
                  下一个
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Middle Panel - Controls */}
        <div className="w-[320px] bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Mode Selection */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
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
                        : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                    }`}
                    disabled={isProcessing || isGeneratingPreview}
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
                id="resizeVideos"
                name="视频文件"
                accept="video"
                multiple
                showList={false}
                themeColor="rose"
                directoryCache
                onChange={handleVideosChange}
                disabled={isProcessing || isGeneratingPreview}
              />
            </FileSelectorGroup>

            {/* Output Directory */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <OutputDirSelector
                value={outputDir}
                onChange={setOutputDir}
                disabled={isProcessing || isGeneratingPreview}
                themeColor="rose"
              />
            </div>

            {/* Blur Amount */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="font-medium flex items-center gap-2 text-xs">
                  <Settings className="w-3 h-3 text-rose-400" />
                  模糊程度
                </label>
                <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                  {blurAmount}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={blurAmount}
                onChange={(e) => setBlurAmount(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500 hover:accent-rose-400 transition-all"
                disabled={isProcessing || isGeneratingPreview}
              />
              <p className="text-[10px] text-slate-500 mt-2">
                实时预览，值越大背景越模糊 (推荐: 20)
              </p>
            </div>

            {/* Concurrency */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <ConcurrencySelector
                value={concurrency}
                onChange={setConcurrency}
                disabled={isProcessing || isGeneratingPreview}
                themeColor="rose"
                compact
              />
            </div>

            {/* Start Button */}
            <button
              onClick={startProcessing}
              disabled={isProcessing || isGeneratingPreview || videos.length === 0 || !outputDir}
              className="w-full py-3 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  开始处理
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Panel - Video List & Logs */}
        <div className="flex-1 bg-slate-950 flex flex-col overflow-hidden">
          {/* Video List */}
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="font-medium mb-3 text-sm text-slate-300 flex items-center gap-2">
              <FileVideo className="w-4 h-4" />
              视频列表 ({videos.length})
            </h3>
            {videos.length === 0 ? (
              <div className="text-center py-12 text-slate-600 text-sm">
                暂无视频
              </div>
            ) : (
              <div className="space-y-2">
                {videos.map((video, index) => (
                  <div
                    key={video}
                    className={`p-3 rounded-lg border flex items-center gap-3 transition-colors ${
                      index === currentVideoIndex
                        ? 'border-rose-500 bg-rose-500/10'
                        : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center shrink-0">
                      <Play className="w-3 h-3 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate text-slate-300">{video.split('/').pop()}</p>
                      <p className="text-[10px] text-slate-500">{video}</p>
                    </div>
                    <button
                      onClick={() => setCurrentVideoIndex(index)}
                      disabled={isGeneratingPreview || isProcessing}
                      className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded transition-colors"
                      title="预览此视频"
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Logs */}
          <div className="border-t border-slate-800 p-4" style={{ height: 350 }}>
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
        </div>
      </div>
    </div>
  );
};

export default ResizeMode;
