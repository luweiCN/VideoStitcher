import { useEffect, useState } from 'react';

/**
 * 并发线程数缓存 Hook
 *
 * 自动缓存和恢复各模块的并发线程数选择
 * - 模块首次使用时使用全局默认值
 * - 后续使用时自动恢复上次选择的值
 * - 每次调整后自动更新缓存
 */
export const useConcurrencyCache = (moduleName: string) => {
  const CACHE_KEY = `concurrency_${moduleName}`;

  const [concurrency, setConcurrency] = useState<number>(3);

  // 组件挂载时加载缓存的线程数
  useEffect(() => {
    const loadCachedConcurrency = async () => {
      try {
        // 优先读取模块特定的缓存
        const cachedValue = localStorage.getItem(CACHE_KEY);
        if (cachedValue) {
          setConcurrency(parseInt(cachedValue, 10));
          return;
        }

        // 如果没有缓存，读取全局默认设置
        const result = await window.api.getGlobalSettings();
        if (result?.defaultConcurrency) {
          setConcurrency(result.defaultConcurrency);
        }
      } catch (err) {
        console.error('加载缓存线程数失败:', err);
      }
    };

    loadCachedConcurrency();
  }, [CACHE_KEY]);

  // 包装的 setState，同时更新缓存
  const updateConcurrency = (value: number) => {
    setConcurrency(value);
    // 保存到 localStorage
    try {
      localStorage.setItem(CACHE_KEY, value.toString());
    } catch (err) {
      console.error('保存缓存线程数失败:', err);
    }
  };

  return {
    concurrency,
    setConcurrency: updateConcurrency,
  };
};
