import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getGlobalVolume,
  setGlobalVolume,
  getGlobalMuted,
  setGlobalMuted,
  getGlobalIsPlaying,
  setGlobalIsPlaying,
} from './useStitchPreview';

/**
 * 极速合成预览配置
 */
export interface MergePreviewConfig {
  /** 主视频路径 (B面) */
  bVideo: string;
  /** A面视频路径（可选） */
  aVideo?: string;
  /** 背景图路径（可选） */
  bgImage?: string;
  /** 封面图路径（可选） */
  coverImage?: string;
  /** 方向 */
  orientation: 'horizontal' | 'vertical';
  /** A面视频位置 */
  aPosition?: { x: number; y: number; width: number; height: number };
  /** B面视频位置 */
  bPosition?: { x: number; y: number; width: number; height: number };
  /** 封面位置 */
  coverPosition?: { x: number; y: number; width: number; height: number };
  /** A面视频时长（秒） */
  aDuration?: number;
  /** B面视频时长（秒） */
  bDuration?: number;
}

/**
 * useMergePreview Hook 选项
 */
export interface UseMergePreviewOptions {
  /** 日志回调 */
  onLog?: (message: string, type: 'info' | 'error' | 'success') => void;
}

/**
 * 极速合成预览 Hook（不使用缓存）
 */
export function useMergePreview(
  config: MergePreviewConfig | null,
  enabled: boolean = true,
  options?: UseMergePreviewOptions
): {
  previewPath: string | null;
  isGenerating: boolean;
  error: string | null;
  regenerate: () => void;
  volume: number;
  setVolume: (volume: number) => void;
  muted: boolean;
  setMuted: (muted: boolean) => void;
  isPlaying: boolean;
  setIsPlaying: (isPlaying: boolean) => void;
} {
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 用于取消请求和防抖
  const abortRef = useRef<AbortController | null>(null);
  const generatingRef = useRef(false);

  // 音量和播放状态（从全局缓存初始化）
  const volume = getGlobalVolume();
  const muted = getGlobalMuted();
  const isPlaying = getGlobalIsPlaying();

  const setVolume = useCallback((newVolume: number) => {
    setGlobalVolume(Math.max(0, Math.min(1, newVolume)));
  }, []);

  const setMuted = useCallback((newMuted: boolean) => {
    setGlobalMuted(newMuted);
  }, []);

  const setIsPlaying = useCallback((newIsPlaying: boolean) => {
    setGlobalIsPlaying(newIsPlaying);
  }, []);

  // 保存最新的 options 引用
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // 当配置变化时自动生成预览
  useEffect(() => {
    // 如果禁用或没有必要的配置，清空状态
    if (!enabled || !config?.bVideo) {
      setPreviewPath(null);
      setError(null);
      setIsGenerating(false);
      return;
    }

    // 如果正在生成，跳过
    if (generatingRef.current) {
      return;
    }

    // 取消之前的请求
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();
    const abortController = abortRef.current;

    generatingRef.current = true;
    setIsGenerating(true);
    setError(null);
    optionsRef.current?.onLog?.('正在生成预览视频...', 'info');

    window.api.previewMergeFast({
      bVideo: config.bVideo,
      aVideo: config.aVideo,
      bgImage: config.bgImage,
      coverImage: config.coverImage,
      orientation: config.orientation,
      aPosition: config.aPosition,
      bPosition: config.bPosition,
      coverPosition: config.coverPosition,
    }).then((result: { success: boolean; previewPath?: string; error?: string; elapsed?: string }) => {
      // 检查是否被取消
      if (abortController.signal.aborted) {
        return;
      }

      if (result.success && result.previewPath) {
        setPreviewPath(result.previewPath);
        setError(null);
        const timeInfo = result.elapsed ? ` (耗时 ${result.elapsed}秒)` : '';
        optionsRef.current?.onLog?.(`预览视频生成完成${timeInfo}`, 'success');
      } else {
        setError(result.error || '预览生成失败');
        optionsRef.current?.onLog?.(`预览生成失败: ${result.error || '未知错误'}`, 'error');
      }
    }).catch((err: Error) => {
      if (!abortController.signal.aborted) {
        const errorMsg = err.message || '预览生成失败';
        setError(errorMsg);
        optionsRef.current?.onLog?.(`预览生成失败: ${errorMsg}`, 'error');
      }
    }).finally(() => {
      generatingRef.current = false;
      setIsGenerating(false);
    });

    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [
    enabled,
    config?.bVideo,
    config?.aVideo,
    config?.bgImage,
    config?.coverImage,
    config?.orientation,
    config?.aPosition,
    config?.bPosition,
    config?.coverPosition,
  ]);

  /**
   * 手动重新生成
   */
  const regenerate = useCallback(() => {
    // 强制重置状态，触发重新生成
    generatingRef.current = false;
    setPreviewPath(null);
    setError(null);
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
  };
}

export default useMergePreview;
