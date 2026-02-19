import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 文件存在性缓存 Hook
 * 
 * 用于检查文件/目录是否存在，带缓存避免重复检查
 */

// 全局缓存，避免不同组件实例重复检查
const globalCache = new Map<string, { exists: boolean; timestamp: number }>();
const CACHE_TTL = 30 * 1000; // 30 秒缓存

interface UseFileExistsCacheResult {
  /** 检查单个路径是否存在 */
  checkPath: (path: string) => Promise<boolean>;
  /** 批量检查路径是否存在 */
  checkPaths: (paths: string[], forceRefresh?: boolean) => Promise<Map<string, boolean>>;
  /** 获取缓存的检查结果 */
  getCached: (path: string) => boolean | undefined;
  /** 清除缓存 */
  clearCache: () => void;
  /** 清除指定路径的缓存 */
  invalidatePaths: (paths: string[]) => void;
  /** 已检查的路径状态 */
  pathStatus: Map<string, boolean>;
}

export function useFileExistsCache(): UseFileExistsCacheResult {
  const [pathStatus, setPathStatus] = useState<Map<string, boolean>>(new Map());
  const pendingChecks = useRef<Set<string>>(new Set());

  const checkPath = useCallback(async (path: string): Promise<boolean> => {
    if (!path) return false;

    // 检查全局缓存
    const cached = globalCache.get(path);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setPathStatus((prev) => {
        const next = new Map(prev);
        next.set(path, cached.exists);
        return next;
      });
      return cached.exists;
    }

    // 避免重复请求
    if (pendingChecks.current.has(path)) {
      const existing = pathStatus.get(path);
      return existing ?? false;
    }

    pendingChecks.current.add(path);

    try {
      const result = await window.api.pathExists(path);
      const exists = result.exists;

      // 更新全局缓存
      globalCache.set(path, { exists, timestamp: Date.now() });

      setPathStatus((prev) => {
        const next = new Map(prev);
        next.set(path, exists);
        return next;
      });

      return exists;
    } catch {
      const exists = false;
      globalCache.set(path, { exists, timestamp: Date.now() });
      
      setPathStatus((prev) => {
        const next = new Map(prev);
        next.set(path, exists);
        return next;
      });
      
      return exists;
    } finally {
      pendingChecks.current.delete(path);
    }
  }, [pathStatus]);

  const checkPaths = useCallback(async (paths: string[], forceRefresh: boolean = false): Promise<Map<string, boolean>> => {
    const results = new Map<string, boolean>();
    
    // 过滤掉空路径和正在检查的路径
    const pathsToCheck = paths.filter((p) => p && !pendingChecks.current.has(p));
    
    // 先从缓存获取（除非强制刷新）
    const needsCheck: string[] = [];
    for (const path of pathsToCheck) {
      if (forceRefresh) {
        needsCheck.push(path);
      } else {
        const cached = globalCache.get(path);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          results.set(path, cached.exists);
        } else {
          needsCheck.push(path);
        }
      }
    }

    // 批量检查需要检查的路径
    if (needsCheck.length > 0) {
      needsCheck.forEach((p) => pendingChecks.current.add(p));
      
      try {
        const batchResult = await window.api.pathsExists(needsCheck);
        
        for (const [path, exists] of Object.entries(batchResult)) {
          results.set(path, exists);
          globalCache.set(path, { exists, timestamp: Date.now() });
        }

        setPathStatus((prev) => {
          const next = new Map(prev);
          for (const [path, exists] of results) {
            next.set(path, exists);
          }
          return next;
        });
      } catch {
        for (const path of needsCheck) {
          results.set(path, false);
          globalCache.set(path, { exists: false, timestamp: Date.now() });
        }
      } finally {
        needsCheck.forEach((p) => pendingChecks.current.delete(p));
      }
    }

    return results;
  }, []);

  const getCached = useCallback((path: string): boolean | undefined => {
    const cached = globalCache.get(path);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.exists;
    }
    return pathStatus.get(path);
  }, [pathStatus]);

  const clearCache = useCallback(() => {
    globalCache.clear();
    setPathStatus(new Map());
  }, []);

  const invalidatePaths = useCallback((paths: string[]) => {
    paths.forEach((path) => {
      globalCache.delete(path);
    });
    setPathStatus((prev) => {
      const next = new Map(prev);
      paths.forEach((path) => {
        next.delete(path);
      });
      return next;
    });
  }, []);

  return {
    checkPath,
    checkPaths,
    getCached,
    clearCache,
    invalidatePaths,
    pathStatus,
  };
}

// 导出单例获取函数，用于跨组件共享缓存
export function getFileExistsCache(): Map<string, boolean> {
  return new Map(
    Array.from(globalCache.entries())
      .filter(([, v]) => Date.now() - v.timestamp < CACHE_TTL)
      .map(([k, v]) => [k, v.exists])
  );
}
