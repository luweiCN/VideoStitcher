import { useEffect, useState } from 'react';

/**
 * 输出目录缓存 Hook
 *
 * 自动缓存和恢复各模块的导出目录选择
 * - 模块首次使用时使用全局默认目录
 * - 后续使用时自动恢复上次选择的目录
 * - 每次选择目录后自动更新缓存
 */
export const useOutputDirCache = (moduleName: string) => {
  const CACHE_KEY = `outputDir_${moduleName}`;

  const [outputDir, setOutputDir] = useState<string>('');

  // 组件挂载时加载缓存的目录
  useEffect(() => {
    const loadCachedDir = async () => {
      try {
        // 优先读取模块特定的缓存
        const cachedDir = localStorage.getItem(CACHE_KEY);
        if (cachedDir) {
          setOutputDir(cachedDir);
          return;
        }

        // 如果没有缓存，读取全局默认设置
        const result = await window.api.getGlobalSettings();
        if (result?.settings?.defaultOutputDir) {
          setOutputDir(result.settings.defaultOutputDir);
        }
      } catch (err) {
        console.error('加载缓存目录失败:', err);
      }
    };

    loadCachedDir();
  }, [CACHE_KEY]);

  // 包装的 setState，同时更新缓存
  const updateOutputDir = (dir: string) => {
    setOutputDir(dir);
    // 保存到 localStorage
    try {
      localStorage.setItem(CACHE_KEY, dir);
    } catch (err) {
      console.error('保存缓存目录失败:', err);
    }
  };

  return {
    outputDir,
    setOutputDir: updateOutputDir,
  };
};
