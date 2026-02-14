import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Volume1 } from 'lucide-react';

// ============================================================================
// 类型定义
// ============================================================================

type ThemeColor = 'rose' | 'cyan' | 'violet' | 'emerald' | 'amber';
type ResizeMode = 'siya' | 'fishing' | 'unify_h' | 'unify_v';

interface VideoFile {
  id: string;
  path: string;
  name: string;
  status: 'pending' | 'waiting' | 'processing' | 'completed' | 'error';
  previewUrl?: string;
  width?: number;
  height?: number;
  [key: string]: unknown;
}

interface PreviewStyle {
  containerAspectRatio: number;
  widthPercent: number;
  heightPercent: number;
  leftPercent: number;
  topPercent: number;
}

interface PreviewAreaProps {
  mode: ResizeMode;
  currentVideo: VideoFile;
  blurAmount: number;
  volume: number;
  isMuted: boolean;
  onVolumeChange: (volume: number) => void;
  onMuteChange: (muted: boolean) => void;
  isProcessing: boolean;
  getPreviewStyle: (ow: number, oh: number, fw: number, fh: number) => PreviewStyle;
}

interface OutputConfig {
  width: number;
  height: number;
  label: string;
}

const MODE_CONFIG: Record<ResizeMode, { outputs: OutputConfig[] }> = {
  siya: { outputs: [{ width: 1920, height: 1080, label: '1920x1080' }, { width: 1920, height: 1920, label: '1920x1920' }] },
  fishing: { outputs: [{ width: 1080, height: 1920, label: '1080x1920' }, { width: 1920, height: 1920, label: '1920x1920' }] },
  unify_h: { outputs: [{ width: 1920, height: 1080, label: '1920x1080' }] },
  unify_v: { outputs: [{ width: 1080, height: 1920, label: '1080x1920' }] },
};

const THEME_COLORS: Record<ThemeColor, { gradient: string; glow: string }> = {
  rose: { gradient: 'from-rose-500 to-pink-500', glow: 'shadow-rose-500/50' },
  cyan: { gradient: 'from-cyan-500 to-teal-500', glow: 'shadow-cyan-500/50' },
  violet: { gradient: 'from-violet-500 to-purple-500', glow: 'shadow-violet-500/50' },
  emerald: { gradient: 'from-emerald-500 to-green-500', glow: 'shadow-emerald-500/50' },
  amber: { gradient: 'from-amber-500 to-yellow-500', glow: 'shadow-amber-500/50' },
};

// ============================================================================
// 工具函数
// ============================================================================

const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// ============================================================================
// 视频画布组件 - 背景层 + 前景层
// ============================================================================

interface VideoCanvasProps {
  src: string;
  blurAmount: number;
  widthPercent: number;
  heightPercent: number;
  leftPercent: number;
  topPercent: number;
  isMuted: boolean;
  onLoadedData?: () => void;
  foregroundRef: React.RefObject<HTMLVideoElement | null>;
  backgroundRef: React.RefObject<HTMLVideoElement | null>;
}

const VideoCanvas: React.FC<VideoCanvasProps> = ({
  src,
  blurAmount,
  widthPercent,
  heightPercent,
  leftPercent,
  topPercent,
  isMuted,
  onLoadedData,
  foregroundRef,
  backgroundRef,
}) => {
  return (
    <div className="w-full h-full bg-black rounded-lg overflow-hidden border border-slate-800 relative">
      {/* 背景层 - 模糊视频 */}
      <video
        ref={backgroundRef}
        src={src}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: `blur(${blurAmount}px)`, transform: 'scale(1.1)' }}
        muted
        playsInline
        loop
      />
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/30" />
      {/* 前景层 - 清晰视频 */}
      <video
        ref={foregroundRef}
        src={src}
        className="absolute"
        style={{
          width: `${widthPercent}%`,
          height: `${heightPercent}%`,
          left: `${leftPercent}%`,
          top: `${topPercent}%`,
          objectFit: 'contain',
        }}
        muted={isMuted}
        playsInline
        loop
        onLoadedData={onLoadedData}
      />
    </div>
  );
};

// ============================================================================
// 播放控件组件（带音量滑块）
// ============================================================================

interface VideoControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  disabled: boolean;
  themeColor: ThemeColor;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  progressRef: React.RefObject<HTMLDivElement | null>;
  onProgressHover: (e: React.MouseEvent) => void;
  hoverTime: number | null;
  hoverPosition: number;
}

const VideoControls: React.FC<VideoControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  disabled,
  themeColor,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  progressRef,
  onProgressHover,
  hoverTime,
  hoverPosition,
}) => {
  const theme = THEME_COLORS[themeColor];
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  // 音量面板状态
  const [showVolumePanel, setShowVolumePanel] = useState(false);
  const volumeSliderRef = useRef<HTMLDivElement>(null);
  const volumeHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 延迟隐藏音量面板
  const handleVolumeAreaEnter = useCallback(() => {
    if (volumeHideTimeoutRef.current) {
      clearTimeout(volumeHideTimeoutRef.current);
      volumeHideTimeoutRef.current = null;
    }
    setShowVolumePanel(true);
  }, []);

  const handleVolumeAreaLeave = useCallback(() => {
    volumeHideTimeoutRef.current = setTimeout(() => {
      setShowVolumePanel(false);
    }, 200);
  }, []);

  // 音量滑块处理
  const handleVolumeSliderClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!volumeSliderRef.current) return;
    const rect = volumeSliderRef.current.getBoundingClientRect();
    const percent = 1 - (e.clientY - rect.top) / rect.height;
    onVolumeChange(Math.round(Math.max(0, Math.min(100, percent * 100))));
  }, [onVolumeChange]);

  const handleVolumeSliderDrag = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // 可以在这里添加拖拽逻辑
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg">
      {/* 播放按钮 */}
      <button
        onClick={onPlayPause}
        disabled={disabled}
        className={`w-8 h-8 rounded-full flex items-center justify-center
          bg-gradient-to-br ${theme.gradient} shadow-lg ${theme.glow}
          hover:scale-110 active:scale-95 transition-transform`}
      >
        {isPlaying ? <Pause className="w-3.5 h-3.5 text-white" /> : <Play className="w-3.5 h-3.5 text-white ml-0.5" />}
      </button>

      {/* 当前时间 */}
      <span className="text-[11px] text-slate-300 font-mono min-w-[32px]">{formatTime(currentTime)}</span>

      {/* 进度条 */}
      <div
        ref={progressRef}
        className="flex-1 h-6 flex items-center cursor-pointer group relative"
        onClick={(e) => {
          if (!progressRef.current || duration === 0) return;
          const rect = progressRef.current.getBoundingClientRect();
          const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          onSeek(percent * duration);
        }}
        onMouseMove={onProgressHover}
        onMouseLeave={() => {}}
      >
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className={`h-full bg-gradient-to-r ${theme.gradient} rounded-full`} style={{ width: `${progressPercent}%` }} />
        </div>
        {/* 悬浮时间 */}
        {hoverTime !== null && (
          <div
            className="absolute bottom-full mb-2 -translate-x-1/2 px-2 py-1 rounded bg-black/90 border border-white/10 text-[10px] text-white font-mono whitespace-nowrap"
            style={{ left: `${hoverPosition}%` }}
          >
            {formatTime(hoverTime)}
          </div>
        )}
      </div>

      {/* 总时长 */}
      <span className="text-[11px] text-slate-500 font-mono min-w-[32px]">{formatTime(duration)}</span>

      {/* 音量控制 - 带弹出式滑块 */}
      <div
        className="relative"
        onMouseEnter={handleVolumeAreaEnter}
        onMouseLeave={handleVolumeAreaLeave}
      >
        <button
          onClick={onMuteToggle}
          disabled={disabled}
          className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center"
        >
          <VolumeIcon className="w-4 h-4" />
        </button>

        {/* 弹出式音量面板 */}
        {showVolumePanel && (
          <div
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-3 rounded-lg bg-black/95 backdrop-blur-md border border-white/10 shadow-2xl"
            onMouseEnter={handleVolumeAreaEnter}
            onMouseLeave={handleVolumeAreaLeave}
          >
            <div className="flex flex-col items-center gap-2">
              {/* 当前音量显示 */}
              <span className={`text-[11px] font-mono font-medium w-8 text-center whitespace-nowrap ${isMuted ? 'text-slate-500' : 'text-slate-300'}`}>
                {isMuted ? '静音' : `${volume}%`}
              </span>

              {/* 垂直滑块轨道 */}
              <div
                ref={volumeSliderRef}
                className="relative w-1.5 h-28 bg-white/10 rounded-full cursor-pointer"
                onClick={handleVolumeSliderClick}
                onMouseDown={(e) => {
                  const handleDrag = (moveEvent: MouseEvent) => {
                    const rect = volumeSliderRef.current?.getBoundingClientRect();
                    if (rect) {
                      const percent = 1 - (moveEvent.clientY - rect.top) / rect.height;
                      onVolumeChange(Math.round(Math.max(0, Math.min(100, percent * 100))));
                    }
                  };
                  const handleUp = () => {
                    document.removeEventListener('mousemove', handleDrag);
                    document.removeEventListener('mouseup', handleUp);
                  };
                  document.addEventListener('mousemove', handleDrag);
                  document.addEventListener('mouseup', handleUp);

                  // 立即处理当前点击
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = 1 - (e.clientY - rect.top) / rect.height;
                  onVolumeChange(Math.round(Math.max(0, Math.min(100, percent * 100))));
                }}
              >
                {/* 音量填充条 */}
                <div
                  className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${theme.gradient} rounded-full transition-all duration-75`}
                  style={{ height: `${isMuted ? 0 : volume}%` }}
                />
                {/* 滑块手柄 */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg border border-slate-300/20 hover:scale-110 transition-transform"
                  style={{ bottom: `calc(${isMuted ? 0 : volume}% - 7px)` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 单个预览组件
// ============================================================================

interface SinglePreviewProps {
  output: OutputConfig;
  videoFile: VideoFile;
  blurAmount: number;
  volume: number;
  isMuted: boolean;
  onVolumeChange: (volume: number) => void;
  onMuteChange: (muted: boolean) => void;
  isProcessing: boolean;
  themeColor: ThemeColor;
  getPreviewStyle: (ow: number, oh: number, fw: number, fh: number) => PreviewStyle;
}

const SinglePreview: React.FC<SinglePreviewProps> = ({
  output,
  videoFile,
  blurAmount,
  volume,
  isMuted,
  onVolumeChange,
  onMuteChange,
  isProcessing,
  themeColor,
  getPreviewStyle,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const foregroundRef = useRef<HTMLVideoElement>(null);
  const backgroundRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // 计算出的画布尺寸
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  // 播放状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState(0);

  const style = getPreviewStyle(output.width, output.height, videoFile.width!, videoFile.height!);
  const aspectRatio = style.containerAspectRatio;
  const isPortrait = output.height > output.width;

  // 组件内容和控件宽度（基于 canvasSize）
  // 横屏最小宽度 500，竖屏最小宽度 250
  const minWidth = isPortrait ? 250 : 500;
  const contentWidth = Math.max(minWidth, canvasSize.width);

  // 组件挂载时和视频/模式切换时：重置播放状态并应用音量
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    // 只在视频真正变化时重置 duration
    // setDuration(0);

    const fg = foregroundRef.current;
    const bg = backgroundRef.current;

    // 停止并重置视频元素
    if (fg) {
      fg.pause();
      fg.currentTime = 0;
      // 立即应用音量设置
      fg.volume = volume / 100;
      fg.muted = isMuted;
    }
    if (bg) {
      bg.pause();
      bg.currentTime = 0;
    }
  }, [videoFile.id, output.label, volume, isMuted]);

  // 视频变化时重置 duration
  useEffect(() => {
    setDuration(0);
  }, [videoFile.id]);

  // 计算画布尺寸
  useEffect(() => {
    const calculateSize = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      // 预留：标题行 28px + 控件 44px + 间距 8px = 80px
      const reservedHeight = 80;
      const availableHeight = containerHeight - reservedHeight;

      // 最小宽度：横屏 500，竖屏 250
      const minW = isPortrait ? 250 : 500;

      let canvasWidth: number;
      let canvasHeight: number;

      if (isPortrait) {
        canvasHeight = availableHeight;
        canvasWidth = canvasHeight * aspectRatio;

        if (canvasWidth > containerWidth) {
          canvasWidth = containerWidth;
          canvasHeight = canvasWidth / aspectRatio;
        }
      } else {
        canvasWidth = Math.min(containerWidth, 576);
        canvasHeight = canvasWidth / aspectRatio;
      }

      // 应用最小宽度限制
      if (canvasWidth < minW) {
        canvasWidth = minW;
        canvasHeight = canvasWidth / aspectRatio;
      }

      setCanvasSize({ width: Math.floor(canvasWidth), height: Math.floor(canvasHeight) });
    };

    const timer = setTimeout(calculateSize, 10);
    const handleResize = () => calculateSize();
    window.addEventListener('resize', handleResize);

    const observer = new ResizeObserver(calculateSize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [aspectRatio, isPortrait]);

  // 视频事件 - 当视频元素可用时绑定事件
  useEffect(() => {
    const video = foregroundRef.current;
    if (!video || canvasSize.width === 0) return;

    // 立即应用音量设置
    video.volume = volume / 100;
    video.muted = isMuted;

    // 如果视频已加载，直接获取 duration
    if (video.duration && isFinite(video.duration)) {
      setDuration(video.duration);
    }

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (backgroundRef.current) {
        backgroundRef.current.pause();
        backgroundRef.current.currentTime = 0;
      }
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [videoFile.id, output.label, canvasSize.width, volume, isMuted]);

  // 同步播放
  const syncPlayPause = useCallback((playing: boolean) => {
    const fg = foregroundRef.current;
    const bg = backgroundRef.current;

    if (fg) {
      if (playing) {
        fg.play().catch(() => setIsPlaying(false));
      } else {
        fg.pause();
      }
    }
    if (bg) {
      if (playing) {
        bg.play().catch(() => {});
      } else {
        bg.pause();
      }
    }
  }, []);

  const handlePlayPause = useCallback(() => {
    if (isProcessing) return;
    const newPlaying = !isPlaying;
    setIsPlaying(newPlaying);
    syncPlayPause(newPlaying);
  }, [isPlaying, isProcessing, syncPlayPause]);

  const handleSeek = useCallback((time: number) => {
    const fg = foregroundRef.current;
    const bg = backgroundRef.current;
    if (fg) fg.currentTime = time;
    if (bg) bg.currentTime = time;
    setCurrentTime(time);
  }, []);

  const handleProgressHover = useCallback((e: React.MouseEvent) => {
    if (!progressRef.current || duration === 0) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(percent * duration);
    setHoverPosition(percent * 100);
  }, [duration]);

  // 音量控制
  const handleVolumeChange = useCallback((newVolume: number) => {
    onVolumeChange(newVolume);
    if (foregroundRef.current) {
      foregroundRef.current.volume = newVolume / 100;
      foregroundRef.current.muted = newVolume === 0;
    }
  }, [onVolumeChange]);

  const handleMuteToggle = useCallback(() => {
    const newMuted = !isMuted;
    onMuteChange(newMuted);
    if (!newMuted && volume === 0) {
      onVolumeChange(30);
    }
    if (foregroundRef.current) {
      foregroundRef.current.muted = newMuted;
      if (!newMuted && volume === 0) {
        foregroundRef.current.volume = 0.3;
      }
    }
  }, [isMuted, volume, onMuteChange, onVolumeChange]);

  return (
    <div ref={containerRef} className="h-full w-full flex flex-col items-center">
      {/* 内容容器 - 标题、视频、控件都居中对齐，宽度一致 */}
      <div style={{ width: contentWidth }} className="flex flex-col items-center">
        {/* 标题行 */}
        <div className="w-full flex items-center justify-between mb-2 shrink-0">
          <span className="text-xs font-mono text-slate-400">{output.label}</span>
          <span className="text-[10px] text-slate-500">实时预览</span>
        </div>

        {/* 视频画布 */}
        {canvasSize.width > 0 && canvasSize.height > 0 && (
          <div style={{ width: canvasSize.width, height: canvasSize.height }} className="shrink-0">
            <VideoCanvas
              src={videoFile.previewUrl!}
              blurAmount={blurAmount}
              widthPercent={style.widthPercent}
              heightPercent={style.heightPercent}
              leftPercent={style.leftPercent}
              topPercent={style.topPercent}
              isMuted={isMuted}
              foregroundRef={foregroundRef}
              backgroundRef={backgroundRef}
            />
          </div>
        )}

        {/* 播放控件 */}
        <div className="mt-2 shrink-0 w-full">
          <VideoControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            isMuted={isMuted}
            disabled={isProcessing}
            themeColor={themeColor}
            onPlayPause={handlePlayPause}
            onSeek={handleSeek}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={handleMuteToggle}
            progressRef={progressRef}
            onProgressHover={handleProgressHover}
            hoverTime={hoverTime}
            hoverPosition={hoverPosition}
          />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 多预览中的单个预览项（带独立控件）
// ============================================================================

interface PreviewItemProps {
  output: OutputConfig;
  videoFile: VideoFile;
  blurAmount: number;
  volume: number;
  isMuted: boolean;
  onVolumeChange: (volume: number) => void;
  onMuteChange: (muted: boolean) => void;
  isProcessing: boolean;
  themeColor: ThemeColor;
  getPreviewStyle: (ow: number, oh: number, fw: number, fh: number) => PreviewStyle;
}

const PreviewItem: React.FC<PreviewItemProps> = ({
  output,
  videoFile,
  blurAmount,
  volume,
  isMuted,
  onVolumeChange,
  onMuteChange,
  isProcessing,
  themeColor,
  getPreviewStyle,
}) => {
  const foregroundRef = useRef<HTMLVideoElement>(null);
  const backgroundRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // 播放状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState(0);

  const style = getPreviewStyle(output.width, output.height, videoFile.width!, videoFile.height!);

  // 组件挂载时和视频切换时：重置播放状态并应用音量
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);

    const fg = foregroundRef.current;
    const bg = backgroundRef.current;

    if (fg) {
      fg.pause();
      fg.currentTime = 0;
      // 立即应用音量设置
      fg.volume = volume / 100;
      fg.muted = isMuted;
    }
    if (bg) {
      bg.pause();
      bg.currentTime = 0;
    }
  }, [videoFile.id, output.label, volume, isMuted]);

  // 视频变化时重置 duration
  useEffect(() => {
    setDuration(0);
  }, [videoFile.id]);

  // 视频事件 - 当视频或输出配置变化时重新绑定
  useEffect(() => {
    const video = foregroundRef.current;
    if (!video) return;

    // 立即应用音量设置
    video.volume = volume / 100;
    video.muted = isMuted;

    // 如果视频已加载，直接获取 duration
    if (video.duration && isFinite(video.duration)) {
      setDuration(video.duration);
    }

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (backgroundRef.current) {
        backgroundRef.current.pause();
        backgroundRef.current.currentTime = 0;
      }
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [videoFile.id, output.label, volume, isMuted]);

  // 同步播放
  const syncPlayPause = useCallback((playing: boolean) => {
    const fg = foregroundRef.current;
    const bg = backgroundRef.current;

    if (fg) {
      if (playing) {
        fg.play().catch(() => setIsPlaying(false));
      } else {
        fg.pause();
      }
    }
    if (bg) {
      if (playing) {
        bg.play().catch(() => {});
      } else {
        bg.pause();
      }
    }
  }, []);

  const handlePlayPause = useCallback(() => {
    if (isProcessing) return;
    const newPlaying = !isPlaying;
    setIsPlaying(newPlaying);
    syncPlayPause(newPlaying);
  }, [isPlaying, isProcessing, syncPlayPause]);

  const handleSeek = useCallback((time: number) => {
    const fg = foregroundRef.current;
    const bg = backgroundRef.current;
    if (fg) fg.currentTime = time;
    if (bg) bg.currentTime = time;
    setCurrentTime(time);
  }, []);

  const handleProgressHover = useCallback((e: React.MouseEvent) => {
    if (!progressRef.current || duration === 0) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(percent * duration);
    setHoverPosition(percent * 100);
  }, [duration]);

  // 音量控制
  const handleVolumeChange = useCallback((newVolume: number) => {
    onVolumeChange(newVolume);
    if (foregroundRef.current) {
      foregroundRef.current.volume = newVolume / 100;
      foregroundRef.current.muted = newVolume === 0;
    }
  }, [onVolumeChange]);

  const handleMuteToggle = useCallback(() => {
    const newMuted = !isMuted;
    onMuteChange(newMuted);
    if (!newMuted && volume === 0) {
      onVolumeChange(30);
    }
    if (foregroundRef.current) {
      foregroundRef.current.muted = newMuted;
      if (!newMuted && volume === 0) {
        foregroundRef.current.volume = 0.3;
      }
    }
  }, [isMuted, volume, onMuteChange, onVolumeChange]);

  return (
    <div className="flex flex-col" style={{ minWidth: 250 }}>
      {/* 标题行 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono text-slate-400">{output.label}</span>
        <span className="text-[10px] text-slate-500">实时预览</span>
      </div>

      {/* 视频画布 */}
      <div style={{ aspectRatio: style.containerAspectRatio, minWidth: 250 }} className="shrink-0">
        <VideoCanvas
          src={videoFile.previewUrl!}
          blurAmount={blurAmount}
          widthPercent={style.widthPercent}
          heightPercent={style.heightPercent}
          leftPercent={style.leftPercent}
          topPercent={style.topPercent}
          isMuted={isMuted}
          foregroundRef={foregroundRef}
          backgroundRef={backgroundRef}
        />
      </div>

      {/* 播放控件 */}
      <div className="mt-2" style={{ minWidth: 250 }}>
        <VideoControls
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          isMuted={isMuted}
          disabled={isProcessing}
          themeColor={themeColor}
          onPlayPause={handlePlayPause}
          onSeek={handleSeek}
          onVolumeChange={handleVolumeChange}
          onMuteToggle={handleMuteToggle}
          progressRef={progressRef}
          onProgressHover={handleProgressHover}
          hoverTime={hoverTime}
          hoverPosition={hoverPosition}
        />
      </div>
    </div>
  );
};

// ============================================================================
// 多预览组件（两列布局）
// ============================================================================

interface MultiPreviewProps {
  outputs: OutputConfig[];
  videoFile: VideoFile;
  blurAmount: number;
  volume: number;
  isMuted: boolean;
  onVolumeChange: (volume: number) => void;
  onMuteChange: (muted: boolean) => void;
  isProcessing: boolean;
  themeColor: ThemeColor;
  getPreviewStyle: (ow: number, oh: number, fw: number, fh: number) => PreviewStyle;
}

const MultiPreview: React.FC<MultiPreviewProps> = ({
  outputs,
  videoFile,
  blurAmount,
  volume,
  isMuted,
  onVolumeChange,
  onMuteChange,
  isProcessing,
  themeColor,
  getPreviewStyle,
}) => {
  return (
    <div className="h-full flex items-center justify-center overflow-y-auto">
      <div className="grid grid-cols-2 gap-4 w-full max-w-3xl p-4">
        {outputs.map((output) => (
          <PreviewItem
            key={output.label}
            output={output}
            videoFile={videoFile}
            blurAmount={blurAmount}
            volume={volume}
            isMuted={isMuted}
            onVolumeChange={onVolumeChange}
            onMuteChange={onMuteChange}
            isProcessing={isProcessing}
            themeColor={themeColor}
            getPreviewStyle={getPreviewStyle}
          />
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 主组件
// ============================================================================

export const PreviewArea: React.FC<PreviewAreaProps> = ({
  mode,
  currentVideo,
  blurAmount,
  volume,
  isMuted,
  onVolumeChange,
  onMuteChange,
  isProcessing,
  getPreviewStyle,
}) => {
  const outputs = MODE_CONFIG[mode].outputs;
  const isSingleOutput = outputs.length === 1;

  if (isSingleOutput) {
    return (
      <div className="h-full">
        <SinglePreview
          output={outputs[0]}
          videoFile={currentVideo}
          blurAmount={blurAmount}
          volume={volume}
          isMuted={isMuted}
          onVolumeChange={onVolumeChange}
          onMuteChange={onMuteChange}
          isProcessing={isProcessing}
          themeColor="rose"
          getPreviewStyle={getPreviewStyle}
        />
      </div>
    );
  }

  return (
    <MultiPreview
      outputs={outputs}
      videoFile={currentVideo}
      blurAmount={blurAmount}
      volume={volume}
      isMuted={isMuted}
      onVolumeChange={onVolumeChange}
      onMuteChange={onMuteChange}
      isProcessing={isProcessing}
      themeColor="rose"
      getPreviewStyle={getPreviewStyle}
    />
  );
};

export default PreviewArea;
