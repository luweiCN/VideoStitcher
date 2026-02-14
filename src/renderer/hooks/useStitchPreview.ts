import { useState, useCallback } from 'react';
import { usePreviewCache, clearNamespaceCache } from './usePreviewCache';

/**
 * 全局音量缓存（应用级别共享）
 */
const globalVolumeCache = {
  volume: 0.1,
  muted: false,
  isPlaying: true, // 默认自动播放
};

/**
 * 获取全局音量
 */
export function getGlobalVolume(): number {
  return globalVolumeCache.volume;
}

/**
 * 设置全局音量
 */
export function setGlobalVolume(volume: number): void {
  globalVolumeCache.volume = Math.max(0, Math.min(1, volume));
}

/**
 * 获取全局静音状态
 */
export function getGlobalMuted(): boolean {
  return globalVolumeCache.muted;
}

/**
 * 设置全局静音状态
 */
export function setGlobalMuted(muted: boolean): void {
  globalVolumeCache.muted = muted;
}

/**
 * 获取全局播放状态
 */
export function getGlobalIsPlaying(): boolean {
  return globalVolumeCache.isPlaying;
}

/**
 * 设置全局播放状态
 */
export function setGlobalIsPlaying(isPlaying: boolean): void {
  globalVolumeCache.isPlaying = isPlaying;
}

/**
 * 预览配置
 */
export interface StitchPreviewConfig {
  /** A 面视频路径 */
  aPath: string;
  /** B 面视频路径 */
  bPath: string;
  /** 方向：横屏或竖屏 */
  orientation: 'landscape' | 'portrait';
  /** A 面视频时长（秒） */
  aDuration?: number;
  /** B 面视频时长（秒） */
  bDuration?: number;
}

/**
 * useStitchPreview Hook 选项
 */
export interface UseStitchPreviewOptions {
  /** 日志回调 */
  onLog?: (message: string, type: 'info' | 'error' | 'success') => void;
}

/**
 * useStitchPreview Hook
 *
 * 用于生成 A+B 前后拼接的快速预览视频
 * 预览只截取 A 视频的最后 5 秒 + B 视频的前 5 秒
 *
 * 特点：
 * 1. 使用通用预览缓存 hook，切换任务时可复用缓存
 * 2. 组件卸载时自动清理所有缓存的临时文件
 * 3. 全局音量和播放状态缓存
 *
 * @param config 预览配置
 * @param enabled 是否启用
 * @param options 可选配置
 */
export function useStitchPreview(
  config: StitchPreviewConfig | null,
  enabled: boolean = true,
  options?: UseStitchPreviewOptions
): {
  /** 预览视频路径 */
  previewPath: string | null;
  /** 是否正在生成 */
  isGenerating: boolean;
  /** 生成错误信息 */
  error: string | null;
  /** 手动重新生成 */
  regenerate: () => void;
  /** 当前音量（全局缓存） */
  volume: number;
  /** 设置音量（全局缓存） */
  setVolume: (volume: number) => void;
  /** 是否静音（全局缓存） */
  muted: boolean;
  /** 设置静音（全局缓存） */
  setMuted: (muted: boolean) => void;
  /** 是否播放中（全局缓存） */
  isPlaying: boolean;
  /** 设置播放状态（全局缓存） */
  setIsPlaying: (isPlaying: boolean) => void;
  /** 是否命中缓存 */
  isFromCache: boolean;
} {
  // 音量和播放状态（从全局缓存初始化）
  const [volume, setVolumeState] = useState(globalVolumeCache.volume);
  const [muted, setMutedState] = useState(globalVolumeCache.muted);
  const [isPlaying, setIsPlayingState] = useState(globalVolumeCache.isPlaying);

  /**
   * 设置音量（同时更新全局缓存）
   */
  const setVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolumeState(clampedVolume);
    setGlobalVolume(clampedVolume);
  }, []);

  /**
   * 设置静音（同时更新全局缓存）
   */
  const setMuted = useCallback((newMuted: boolean) => {
    setMutedState(newMuted);
    setGlobalMuted(newMuted);
  }, []);

  /**
   * 设置播放状态（同时更新全局缓存）
   */
  const setIsPlaying = useCallback((newIsPlaying: boolean) => {
    setIsPlayingState(newIsPlaying);
    setGlobalIsPlaying(newIsPlaying);
  }, []);

  // 使用通用预览缓存 hook
  const {
    previewPath,
    isGenerating,
    error,
    isFromCache,
    regenerate,
  } = usePreviewCache(config, enabled, {
    namespace: 'stitch-preview',
    generate: async (cfg, signal) => {
      const result = await window.api.generateStitchPreviewFast({
        aPath: cfg.aPath,
        bPath: cfg.bPath,
        orientation: cfg.orientation,
        aDuration: cfg.aDuration,
        bDuration: cfg.bDuration,
      });

      // 检查是否被取消
      if (signal?.aborted) {
        // 如果生成成功但被取消，仍然返回成功（会被缓存）
        return result;
      }

      return result;
    },
    deleteTemp: async (tempPath) => {
      await window.api.deleteTempPreview(tempPath);
    },
    getCacheKey: (cfg) => `${cfg.aPath}-${cfg.bPath}-${cfg.orientation}`,
    onLog: options?.onLog,
  });

  return {
    previewPath,
    isGenerating,
    error,
    regenerate,
    volume,
    setVolume,
    muted,
    setMuted,
    isPlaying,
    setIsPlaying,
    isFromCache,
  };
}

/**
 * 清理拼接预览的所有缓存
 */
export async function clearStitchPreviewCache(): Promise<void> {
  await clearNamespaceCache('stitch-preview', async (path) => {
    await window.api.deleteTempPreview(path);
  });
}

export default useStitchPreview;
