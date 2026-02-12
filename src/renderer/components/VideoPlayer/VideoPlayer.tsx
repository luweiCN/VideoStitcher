import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import Plyr from 'plyr';
import 'plyr-react/plyr.css';
import './VideoPlayer.css';

/**
 * 基于 Plyr 的视频播放器组件
 *
 * 设计特点：
 * - 使用 Plyr 的现代化 UI
 * - 支持动态主题色，与各功能模块保持一致
 * - 暗色影院风格
 * - 圆形玻璃拟态导航按钮
 */

// ============================================================================
// 类型定义
// ============================================================================

type ThemeColor = 'slate' | 'violet' | 'rose' | 'fuchsia' | 'emerald' | 'cyan';

export interface VideoPlayerProps {
  /** 视频 URL */
  src: string;
  /** 视频标题 */
  title?: string;
  /** 是否显示标题 */
  showTitle?: boolean;
  /** 自动播放 */
  autoPlay?: boolean;
  /** 循环播放 */
  loop?: boolean;
  /** 静音 */
  muted?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 是否显示上一个按钮 */
  showPrevious?: boolean;
  /** 是否显示下一个按钮 */
  showNext?: boolean;
  /** 上一个回调 */
  onPrevious?: () => void;
  /** 下一个回调 */
  onNext?: () => void;
  /** 播放状态变化回调 */
  onPlayStateChange?: (isPlaying: boolean) => void;
  /** 进度变化回调 */
  onProgress?: (currentTime: number, duration: number) => void;
  /** 主题色 */
  themeColor?: ThemeColor;
  /** 精简模式：只显示进度条和音量控制 */
  minimal?: boolean;
}

// ============================================================================
// 主题色配置
// ============================================================================

const THEME_COLORS: Record<ThemeColor, { main: string; hover: string; glow: string }> = {
  slate: {
    main: '#94a3b8',
    hover: '#cbd5e1',
    glow: 'rgba(148, 163, 184, 0.3)',
  },
  violet: {
    main: '#a78bfa',
    hover: '#c4b5fd',
    glow: 'rgba(167, 139, 250, 0.3)',
  },
  rose: {
    main: '#fb7185',
    hover: '#fda4af',
    glow: 'rgba(251, 113, 133, 0.3)',
  },
  fuchsia: {
    main: '#e879f9',
    hover: '#f0abfc',
    glow: 'rgba(232, 121, 249, 0.3)',
  },
  emerald: {
    main: '#34d399',
    hover: '#6ee7b7',
    glow: 'rgba(52, 211, 153, 0.3)',
  },
  cyan: {
    main: '#22d3ee',
    hover: '#67e8f9',
    glow: 'rgba(34, 211, 238, 0.3)',
  },
};

// ============================================================================
// 主组件
// ============================================================================

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  title,
  showTitle = false,
  autoPlay = false,
  loop = false,
  muted = false,
  className = '',
  showPrevious = false,
  showNext = false,
  onPrevious,
  onNext,
  onPlayStateChange,
  onProgress,
  themeColor = 'cyan',
  minimal = false,
}) => {
  const playerRef = useRef<Plyr | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ onPlayStateChange, onProgress });

  // 预览 URL 状态
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(true);
  const [urlError, setUrlError] = useState<string | null>(null);

  // 获取当前主题色配置
  const colors = THEME_COLORS[themeColor];

  // 更新回调引用
  useEffect(() => {
    callbacksRef.current = { onPlayStateChange, onProgress };
  }, [onPlayStateChange, onProgress]);

  /**
   * 加载预览 URL
   */
  useEffect(() => {
    const loadPreviewUrl = async () => {
      setIsLoadingUrl(true);
      setUrlError(null);
      try {
        // 如果 src 已经是 preview:// 协议，直接使用
        if (src.startsWith('preview://')) {
          setPreviewUrl(src);
        } else {
          // 否则调用 API 转换文件路径为 preview:// URL
          const result = await window.api.getPreviewUrl(src);
          if (result.success && result.url) {
            setPreviewUrl(result.url);
          } else {
            setUrlError(result.error || '获取预览 URL 失败');
            console.error('获取预览 URL 失败:', result.error);
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '加载预览 URL 失败';
        setUrlError(errorMsg);
        console.error('加载预览 URL 失败:', err);
      } finally {
        setIsLoadingUrl(false);
      }
    };
    loadPreviewUrl();
  }, [src]);

  /**
   * 初始化 Plyr 实例
   */
  useEffect(() => {
    if (!previewUrl || isLoadingUrl) {
      return;
    }

    const videoElement = containerRef.current?.querySelector('video');
    if (!videoElement) {
      return;
    }

    const player = new Plyr(videoElement, {
      controls: minimal
        ? ['play', 'progress', 'current-time', 'duration', 'mute', 'volume']
        : [
            'play-large',
            'play',
            'progress',
            'current-time',
            'duration',
            'mute',
            'volume',
            'settings',
            'pip',
            'airplay',
            'fullscreen'
          ],
      autoplay: autoPlay,
      loop: { active: loop },
      muted,
      hideControls: false,
      clickToPlay: true,
      keyboard: {
        focused: true,
        global: true
      },
      download: null
    });

    playerRef.current = player;

    // 大播放按钮悬浮效果 - 保持居中放大的动画
    const playButton = containerRef.current?.querySelector('.plyr__control--overlaid') as HTMLElement;
    if (playButton) {
      // 默认状态：居中但不放大
      const setNormalState = () => {
        playButton.style.setProperty('transform', 'translate(-50%, -50%)', 'important');
      };

      // 悬浮状态：居中且放大
      const setHoverState = () => {
        playButton.style.setProperty('transform', 'translate(-50%, -50%) scale(1.1)', 'important');
      };

      setNormalState();

      // 监听鼠标事件
      playButton.addEventListener('mouseenter', setHoverState);
      playButton.addEventListener('mouseleave', setNormalState);
      playButton.addEventListener('mousedown', setHoverState);
      playButton.addEventListener('mouseup', setHoverState);
    }

    // 监听播放事件
    player.on('play', () => {
      callbacksRef.current.onPlayStateChange?.(true);
    });

    player.on('pause', () => {
      callbacksRef.current.onPlayStateChange?.(false);
    });

    player.on('timeupdate', (event) => {
      const plyr = event.detail.plyr;
      callbacksRef.current.onProgress?.(plyr.currentTime, plyr.duration);
    });

    player.on('ended', () => {
      if (!loop) {
        callbacksRef.current.onPlayStateChange?.(false);
      }
    });

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
          playerRef.current = null;
        } catch (e) {
          console.warn('Error destroying Plyr:', e);
        }
      }
    };
  }, [previewUrl, isLoadingUrl, autoPlay, loop, muted, minimal]);

  /**
   * 键盘快捷键处理
   */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && showPrevious && onPrevious) {
      e.stopPropagation();
      onPrevious();
    } else if (e.key === 'ArrowRight' && showNext && onNext) {
      e.stopPropagation();
      onNext();
    }
  }, [showPrevious, showNext, onPrevious, onNext]);

  useEffect(() => {
    containerRef.current?.addEventListener('keydown', handleKeyDown);
    return () => {
      containerRef.current?.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // 错误状态
  if (urlError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950/90 backdrop-blur-sm rounded-2xl">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/20 flex items-center justify-center">
            <X className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-red-400 font-medium mb-2">视频加载失败</p>
          <p className="text-slate-500 text-sm">{urlError}</p>
        </div>
      </div>
    );
  }

  // 加载状态
  if (isLoadingUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950/80 backdrop-blur-sm rounded-2xl">
        <div className="text-center">
          <div
            className="w-16 h-16 mx-auto mb-4 border-4 rounded-full animate-spin"
            style={{
              borderColor: `${colors.glow}`,
              borderTopColor: colors.main,
            }}
          />
          <p className="text-slate-400 text-sm">加载视频中...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-black rounded-2xl overflow-hidden group ${className}`}
      tabIndex={0}
      style={
        {
          '--plyr-color-main': colors.main,
          '--plyr-color-hover': colors.hover,
          '--plyr-color-glow': colors.glow,
        } as React.CSSProperties
      }
    >
      {/* Plyr 视频播放器 */}
      <video
        className="w-full h-full object-contain"
        playsInline
        src={previewUrl || undefined}
      />

      {/* 标题 */}
      {showTitle && title && (
        <div className="absolute top-4 left-4 px-4 py-2 bg-slate-900/70 backdrop-blur-md rounded-xl border border-slate-700/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <p className="text-sm font-medium text-slate-200">{title}</p>
        </div>
      )}

      {/* 上一个按钮 */}
      {showPrevious && onPrevious && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrevious();
          }}
          className="absolute left-6 top-1/2 -translate-y-1/2 p-4 bg-slate-900/70 backdrop-blur-md hover:bg-slate-800/90 rounded-2xl border border-slate-700/50 transition-all hover:scale-110 hover:shadow-lg z-10 opacity-0 group-hover:opacity-100"
          style={{ '--hover-shadow': colors.glow } as React.CSSProperties}
          title="上一个 (←)"
        >
          <ChevronLeft className="w-6 h-6 text-slate-300 hover:text-white" />
        </button>
      )}

      {/* 下一个按钮 */}
      {showNext && onNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-6 top-1/2 -translate-y-1/2 p-4 bg-slate-900/70 backdrop-blur-md hover:bg-slate-800/90 rounded-2xl border border-slate-700/50 transition-all hover:scale-110 hover:shadow-lg z-10 opacity-0 group-hover:opacity-100"
          style={{ '--hover-shadow': colors.glow } as React.CSSProperties}
          title="下一个 (→)"
        >
          <ChevronRight className="w-6 h-6 text-slate-300 hover:text-white" />
        </button>
      )}
    </div>
  );
};

export default VideoPlayer;
