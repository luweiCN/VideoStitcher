import { useState, useCallback } from 'react';

/**
 * 视频音量缓存 Hook
 *
 * 自动缓存和恢复各模块的视频音量和静音状态
 * - 首次使用时使用默认值（音量 30%，非静音）
 * - 后续使用时自动恢复上次的设置
 * - 每次调节后自动更新缓存
 *
 * @param moduleKey 模块标识，用于区分不同模块的缓存
 * @returns 音量状态和控制方法
 *
 * @example
 * ```tsx
 * const { volume, isMuted, setVolume, setIsMuted } = useVideoVolumeCache('resize');
 *
 * // 在视频元素上应用
 * <video volume={volume / 100} muted={isMuted} />
 *
 * // 调节音量（自动缓存）
 * setVolume(50);
 * setIsMuted(true);
 * ```
 */
export const useVideoVolumeCache = (moduleKey: string) => {
  const VOLUME_KEY = `${moduleKey}_volume`;
  const MUTED_KEY = `${moduleKey}_muted`;

  // 音量状态（0-100），默认 30%
  const [volume, setVolumeState] = useState(() => {
    try {
      const cached = localStorage.getItem(VOLUME_KEY);
      if (cached !== null) {
        const parsed = parseInt(cached, 10);
        // 确保值在有效范围内
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('读取音量缓存失败:', err);
    }
    return 30; // 默认音量
  });

  // 静音状态，默认非静音
  const [isMuted, setIsMutedState] = useState(() => {
    try {
      const cached = localStorage.getItem(MUTED_KEY);
      return cached === 'true';
    } catch (err) {
      console.warn('读取静音缓存失败:', err);
    }
    return false; // 默认非静音
  });

  /**
   * 设置音量（同时更新缓存）
   */
  const setVolume = useCallback((newVolume: number) => {
    // 确保值在有效范围内
    const clampedVolume = Math.max(0, Math.min(100, newVolume));
    setVolumeState(clampedVolume);

    try {
      localStorage.setItem(VOLUME_KEY, clampedVolume.toString());
    } catch (err) {
      console.warn('保存音量缓存失败:', err);
    }
  }, [VOLUME_KEY]);

  /**
   * 设置静音状态（同时更新缓存）
   */
  const setIsMuted = useCallback((muted: boolean) => {
    setIsMutedState(muted);

    try {
      localStorage.setItem(MUTED_KEY, muted.toString());
    } catch (err) {
      console.warn('保存静音缓存失败:', err);
    }
  }, [MUTED_KEY]);

  /**
   * 切换静音状态
   */
  const toggleMuted = useCallback(() => {
    setIsMuted(!isMuted);
  }, [isMuted, setIsMuted]);

  return {
    volume,
    isMuted,
    setVolume,
    setIsMuted,
    toggleMuted,
  };
};

export default useVideoVolumeCache;
