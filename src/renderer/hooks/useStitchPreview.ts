import { useState, useEffect, useRef, useCallback } from 'react';

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
 * 预览缓存（模块级别）
 * key: aPath-bPath-orientation
 * value: tempPath
 */
const previewCache = new Map<string, string>();

/**
 * 待清理的预览文件列表
 */
const pendingCleanup = new Set<string>();

/**
 * 清理单个预览文件
 */
async function cleanupPreviewFile(tempPath: string): Promise<void> {
  try {
    await window.api.deleteTempPreview(tempPath);
    previewCache.delete(getCacheKeyFromPath(tempPath));
    pendingCleanup.delete(tempPath);
  } catch (e) {
    // 忽略清理错误
  }
}

/**
 * 清理所有缓存的预览文件
 */
async function cleanupAllCachedPreviews(): Promise<void> {
  const paths = Array.from(pendingCleanup);
  pendingCleanup.clear();
  previewCache.clear();

  for (const path of paths) {
    try {
      await window.api.deleteTempPreview(path);
    } catch (e) {
      // 忽略清理错误
    }
  }
}

/**
 * 从临时文件路径反推缓存 key（简化处理）
 */
function getCacheKeyFromPath(tempPath: string): string {
  // 简化处理，遍历查找
  for (const [key, value] of previewCache.entries()) {
    if (value === tempPath) return key;
  }
  return '';
}

/**
 * 生成缓存 key
 */
function getCacheKey(aPath: string, bPath: string, orientation: string): string {
  return `${aPath}-${bPath}-${orientation}`;
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
 * useStitchPreview Hook
 *
 * 用于生成 A+B 前后拼接的快速预览视频
 * 预览只截取 A 视频的最后 5 秒 + B 视频的前 5 秒
 *
 * 特点：
 * 1. Hook 级别缓存，切换任务时可复用
 * 2. 组件卸载时自动清理所有缓存的临时文件
 * 3. 全局音量缓存
 *
 * @param config 预览配置
 * @param enabled 是否启用
 */
export function useStitchPreview(
  config: StitchPreviewConfig | null,
  enabled: boolean = true
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
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);

  // 音量和播放状态（从全局缓存初始化）
  const [volume, setVolumeState] = useState(globalVolumeCache.volume);
  const [muted, setMutedState] = useState(globalVolumeCache.muted);
  const [isPlaying, setIsPlayingState] = useState(globalVolumeCache.isPlaying);

  // 用于取消预览生成的 ref
  const cancelRef = useRef(false);
  // 当前配置的 key，用于判断是否需要重新生成
  const currentKeyRef = useRef<string>('');
  // 记录本次 hook 实例创建的预览文件（用于卸载时清理）
  const instancePreviewsRef = useRef<Set<string>>(new Set());

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

  /**
   * 生成预览
   */
  const generatePreview = useCallback(async (forceRegenerate: boolean = false) => {
    if (!config || !enabled) {
      return;
    }

    const key = getCacheKey(config.aPath, config.bPath, config.orientation);
    currentKeyRef.current = key;
    cancelRef.current = false;

    // 检查缓存
    if (!forceRegenerate && previewCache.has(key)) {
      const cachedPath = previewCache.get(key)!;
      setPreviewPath(cachedPath);
      setIsFromCache(true);
      setError(null);
      return;
    }

    // 清理当前实例的旧预览（如果有）
    if (previewPath && !previewCache.has(getCacheKey(config.aPath, config.bPath, config.orientation))) {
      // 当前预览不在缓存中，说明是旧的，可以清理
    }

    setPreviewPath(null);
    setError(null);
    setIsGenerating(true);
    setIsFromCache(false);

    try {
      const result = await window.api.generateStitchPreviewFast({
        aPath: config.aPath,
        bPath: config.bPath,
        orientation: config.orientation,
        aDuration: config.aDuration,
        bDuration: config.bDuration,
      });

      // 检查是否已取消
      if (cancelRef.current || currentKeyRef.current !== key) {
        if (result.tempPath) {
          await window.api.deleteTempPreview(result.tempPath);
        }
        return;
      }

      if (result.success && result.tempPath) {
        // 更新缓存
        previewCache.set(key, result.tempPath);
        pendingCleanup.add(result.tempPath);
        instancePreviewsRef.current.add(result.tempPath);

        setPreviewPath(result.tempPath);
      } else {
        setError(result.error || '预览生成失败');
      }
    } catch (err) {
      if (!cancelRef.current) {
        setError(err instanceof Error ? err.message : '预览生成异常');
      }
    } finally {
      if (!cancelRef.current) {
        setIsGenerating(false);
      }
    }
  }, [config, enabled, previewPath]);

  /**
   * 手动重新生成（强制跳过缓存）
   */
  const regenerate = useCallback(() => {
    generatePreview(true);
  }, [generatePreview]);

  /**
   * 当配置变化时自动生成预览
   */
  useEffect(() => {
    if (!config || !enabled) {
      setPreviewPath(null);
      setError(null);
      setIsGenerating(false);
      setIsFromCache(false);
      return;
    }

    const key = getCacheKey(config.aPath, config.bPath, config.orientation);

    // 如果配置没变且有预览，不重新生成
    if (currentKeyRef.current === key && previewPath) {
      return;
    }

    // 防抖：延迟 300ms 后生成
    const timer = setTimeout(() => {
      generatePreview();
    }, 300);

    return () => {
      clearTimeout(timer);
      cancelRef.current = true;
    };
  }, [config, enabled, generatePreview, previewPath]);

  /**
   * 组件卸载时清理预览文件
   *
   * 注意：这里清理的是缓存中的预览文件
   * 这样即使切换到其他页面，预览文件也会被清理
   */
  useEffect(() => {
    return () => {
      cancelRef.current = true;
      // 清理所有缓存的预览文件
      cleanupAllCachedPreviews();
    };
  }, []);

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

export default useStitchPreview;
