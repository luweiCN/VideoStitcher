import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Volume1 } from 'lucide-react';

/**
 * 独立视频播放控件组件
 *
 * 特点：
 * - 现代视频编辑器风格
 * - 紧凑单行布局
 * - 自定义进度条带悬浮时间预览
 * - 弹出式音量控制面板
 * - 平滑动画过渡
 */

// ============================================================================
// 类型定义
// ============================================================================

type ThemeColor = 'rose' | 'cyan' | 'violet' | 'emerald' | 'amber';

export interface InlineVideoControlsProps {
  /** 前景视频元素引用 */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** 背景模糊视频元素引用（可选，用于同步播放） */
  backgroundVideoRef?: React.RefObject<HTMLVideoElement | null>;
  /** 主题色 */
  themeColor?: ThemeColor;
  /** 音量（0-100） */
  volume: number;
  /** 是否静音 */
  isMuted: boolean;
  /** 音量变化回调 */
  onVolumeChange: (volume: number) => void;
  /** 静音状态变化回调 */
  onMuteChange: (muted: boolean) => void;
  /** 是否禁用控件 */
  disabled?: boolean;
}

// ============================================================================
// 主题色配置
// ============================================================================

const THEME_COLORS: Record<ThemeColor, {
  main: string;
  light: string;
  gradient: string;
  glow: string;
}> = {
  rose: {
    main: '#fb7185',
    light: '#fda4af',
    gradient: 'from-rose-500 to-pink-500',
    glow: 'shadow-rose-500/50',
  },
  cyan: {
    main: '#22d3ee',
    light: '#67e8f9',
    gradient: 'from-cyan-500 to-teal-500',
    glow: 'shadow-cyan-500/50',
  },
  violet: {
    main: '#a78bfa',
    light: '#c4b5fd',
    gradient: 'from-violet-500 to-purple-500',
    glow: 'shadow-violet-500/50',
  },
  emerald: {
    main: '#34d399',
    light: '#6ee7b7',
    gradient: 'from-emerald-500 to-green-500',
    glow: 'shadow-emerald-500/50',
  },
  amber: {
    main: '#fbbf24',
    light: '#fcd34d',
    gradient: 'from-amber-500 to-yellow-500',
    glow: 'shadow-amber-500/50',
  },
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 格式化时间显示
 */
const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// ============================================================================
// 主组件
// ============================================================================

export const InlineVideoControls: React.FC<InlineVideoControlsProps> = ({
  videoRef,
  backgroundVideoRef,
  themeColor = 'rose',
  volume,
  isMuted,
  onVolumeChange,
  onMuteChange,
  disabled = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState(0);
  const [showVolumePanel, setShowVolumePanel] = useState(false);

  const progressRef = useRef<HTMLDivElement>(null);
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

  // 获取主题配置
  const theme = THEME_COLORS[themeColor];

  /**
   * 同步播放状态到视频元素
   */
  const syncPlayState = useCallback((playing: boolean) => {
    const video = videoRef.current;
    const bgVideo = backgroundVideoRef?.current;

    if (video) {
      if (playing) {
        video.play().catch(err => {
          console.warn('视频播放失败:', err);
          setIsPlaying(false);
        });
      } else {
        video.pause();
      }
    }

    // 同步背景视频
    if (bgVideo) {
      if (playing) {
        bgVideo.play().catch(() => {});
      } else {
        bgVideo.pause();
      }
    }
  }, [videoRef, backgroundVideoRef]);

  /**
   * 切换播放/暂停
   */
  const togglePlayPause = useCallback(() => {
    if (disabled) return;
    const newPlaying = !isPlaying;
    setIsPlaying(newPlaying);
    syncPlayState(newPlaying);
  }, [isPlaying, disabled, syncPlayState]);

  /**
   * 处理进度条点击
   */
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !progressRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const time = Math.max(0, Math.min(duration, percent * duration));

    setCurrentTime(time);

    const video = videoRef.current;
    const bgVideo = backgroundVideoRef?.current;

    if (video) {
      video.currentTime = time;
    }
    if (bgVideo) {
      bgVideo.currentTime = time;
    }
  }, [disabled, duration, videoRef, backgroundVideoRef]);

  /**
   * 处理进度条拖拽
   */
  const handleProgressDrag = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || disabled || !progressRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = percent * duration;

    setCurrentTime(time);

    const video = videoRef.current;
    const bgVideo = backgroundVideoRef?.current;

    if (video) {
      video.currentTime = time;
    }
    if (bgVideo) {
      bgVideo.currentTime = time;
    }
  }, [isDragging, disabled, duration, videoRef, backgroundVideoRef]);

  /**
   * 处理进度条悬浮
   */
  const handleProgressHover = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || duration === 0) return;

    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = percent * duration;

    setHoverTime(time);
    setHoverPosition(percent * 100);
  }, [duration]);

  /**
   * 处理音量变化
   */
  const handleVolumeChange = useCallback((newVolume: number) => {
    if (disabled) return;
    onVolumeChange(newVolume);
    onMuteChange(newVolume === 0);

    // 直接应用到视频元素
    const video = videoRef.current;
    if (video) {
      video.volume = newVolume / 100;
      video.muted = newVolume === 0;
    }
  }, [disabled, onVolumeChange, onMuteChange, videoRef]);

  /**
   * 切换静音
   */
  const toggleMute = useCallback(() => {
    if (disabled) return;
    const newMuted = !isMuted;
    onMuteChange(newMuted);

    // 取消静音时，如果音量是0，恢复到30%
    if (!newMuted && volume === 0) {
      onVolumeChange(30);
    }

    // 直接应用到视频元素
    const video = videoRef.current;
    if (video) {
      video.muted = newMuted;
      if (!newMuted && volume === 0) {
        video.volume = 0.3;
      }
    }
  }, [disabled, isMuted, volume, onMuteChange, onVolumeChange, videoRef]);

  /**
   * 视频时间更新事件处理
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (!isDragging) {
        setCurrentTime(video.currentTime);
      }
      setDuration(video.duration || 0);
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration || 0);
      // 应用当前音量设置
      video.volume = volume / 100;
      video.muted = isMuted;
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);

      // 同步重置背景视频
      const bgVideo = backgroundVideoRef?.current;
      if (bgVideo) {
        bgVideo.pause();
        bgVideo.currentTime = 0;
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
  }, [videoRef, backgroundVideoRef, volume, isMuted, isDragging]);

  // 计算进度百分比
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // 计算音量图标
  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  return (
    <div
      className={`
        relative flex items-center gap-2 px-3 py-2
        bg-black/60 backdrop-blur-md
        border border-white/10 rounded-lg
        transition-all duration-300
        ${disabled ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      {/* 播放/暂停按钮 */}
      <button
        onClick={togglePlayPause}
        disabled={disabled}
        className={`
          relative flex items-center justify-center
          w-8 h-8 rounded-full
          bg-gradient-to-br ${theme.gradient}
          shadow-lg ${theme.glow}
          transition-all duration-200
          hover:scale-110 hover:shadow-xl
          active:scale-95
        `}
        title={isPlaying ? '暂停' : '播放'}
      >
        {isPlaying ? (
          <Pause className="w-3.5 h-3.5 text-white" />
        ) : (
          <Play className="w-3.5 h-3.5 text-white ml-0.5" />
        )}
      </button>

      {/* 时间显示 */}
      <span className="text-[11px] text-slate-300 font-mono tracking-tight min-w-[32px]">
        {formatTime(currentTime)}
      </span>

      {/* 自定义进度条 */}
      <div
        ref={progressRef}
        className="relative flex-1 h-6 flex items-center cursor-pointer group"
        onClick={handleProgressClick}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => {
          setIsDragging(false);
          setHoverTime(null);
        }}
        onMouseMove={(e) => {
          handleProgressHover(e);
          handleProgressDrag(e);
        }}
      >
        {/* 进度条背景 */}
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          {/* 已播放进度 */}
          <div
            className={`h-full bg-gradient-to-r ${theme.gradient} rounded-full transition-all duration-75`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* 播放头指示器 */}
        <div
          className={`
            absolute top-1/2 -translate-y-1/2
            w-3 h-3 rounded-full
            bg-white shadow-lg
            transition-transform duration-150
            ${isDragging ? 'scale-125' : 'scale-0 group-hover:scale-100'}
          `}
          style={{ left: `calc(${progressPercent}% - 6px)` }}
        />

        {/* 悬浮时间预览 */}
        {hoverTime !== null && (
          <div
            className="
              absolute bottom-full mb-2 -translate-x-1/2
              px-2 py-1 rounded
              bg-black/90 border border-white/10
              text-[10px] text-white font-mono
              pointer-events-none whitespace-nowrap
              animate-in fade-in slide-in-from-bottom-1 duration-100
            "
            style={{ left: `${hoverPosition}%` }}
          >
            {formatTime(hoverTime)}
          </div>
        )}
      </div>

      {/* 总时长显示 */}
      <span className="text-[11px] text-slate-500 font-mono tracking-tight min-w-[32px]">
        {formatTime(duration)}
      </span>

      {/* 音量控制 - 延迟隐藏的悬浮面板 */}
      <div
        className="relative"
        onMouseEnter={handleVolumeAreaEnter}
        onMouseLeave={handleVolumeAreaLeave}
      >
        {/* 音量按钮 */}
        <button
          onClick={toggleMute}
          disabled={disabled}
          className={`
            flex items-center justify-center
            w-8 h-8 rounded-lg
            text-slate-400
            transition-all duration-200
            hover:text-white hover:bg-white/10
            active:scale-95
          `}
          title={isMuted ? '取消静音' : '静音'}
        >
          <VolumeIcon className="w-4 h-4" />
        </button>

        {/* 弹出式音量面板 */}
        {showVolumePanel && (
          <div
            className="
              absolute bottom-full left-1/2 -translate-x-1/2 mb-3
              p-3 rounded-lg
              bg-black/95 backdrop-blur-md
              border border-white/10
              shadow-2xl
              animate-in fade-in zoom-in-95 duration-150
            "
            onMouseEnter={handleVolumeAreaEnter}
            onMouseLeave={handleVolumeAreaLeave}
          >
            {/* 垂直音量滑块 */}
            <div className="flex flex-col items-center gap-2">
              {/* 当前音量百分比显示 */}
              <span className={`text-[11px] font-mono font-medium w-8 text-center whitespace-nowrap ${isMuted ? 'text-slate-500' : 'text-slate-300'}`}>
                {isMuted ? '静音' : `${volume}%`}
              </span>

              {/* 垂直滑块轨道 */}
              <div
                ref={volumeSliderRef}
                className="relative w-1.5 h-28 bg-white/10 rounded-full cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = 1 - (e.clientY - rect.top) / rect.height;
                  handleVolumeChange(Math.round(Math.max(0, Math.min(100, percent * 100))));
                }}
                onMouseDown={(e) => {
                  const handleDrag = (moveEvent: MouseEvent) => {
                    const rect = volumeSliderRef.current?.getBoundingClientRect();
                    if (rect) {
                      const percent = 1 - (moveEvent.clientY - rect.top) / rect.height;
                      handleVolumeChange(Math.round(Math.max(0, Math.min(100, percent * 100))));
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
                  handleVolumeChange(Math.round(Math.max(0, Math.min(100, percent * 100))));
                }}
              >
                {/* 音量填充条 */}
                <div
                  className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${theme.gradient} rounded-full transition-all duration-75`}
                  style={{ height: `${isMuted ? 0 : volume}%` }}
                />
                {/* 滑块手柄 */}
                <div
                  className={`
                    absolute left-1/2 -translate-x-1/2
                    w-3.5 h-3.5 rounded-full
                    bg-white shadow-lg border border-slate-300/20
                    transition-transform duration-100
                    hover:scale-110
                  `}
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

export default InlineVideoControls;
