import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/**
 * 视频素材信息
 */
export interface VideoMaterial {
  path: string;
  name: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
  fileSize?: number;
  orientation?: 'landscape' | 'portrait' | 'square';
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 是否加载完成 */
  isLoaded?: boolean;
}

/**
 * 获取单个视频的素材信息（通过单个 IPC 调用）
 */
async function fetchVideoMaterial(filePath: string): Promise<VideoMaterial> {
  const fileName = filePath.split(/[/\\]/).pop() || filePath;
  const material: VideoMaterial = {
    path: filePath,
    name: fileName,
    isLoading: true,
    isLoaded: false,
  };

  try {
    // 一次 IPC 调用获取所有信息
    const result = await window.api.getVideoFullInfo(filePath, { thumbnailMaxSize: 64 });

    if (result.success) {
      material.thumbnailUrl = result.thumbnail || undefined;
      material.previewUrl = result.previewUrl || undefined;
      material.fileSize = result.fileSize || undefined;
      material.width = result.width || undefined;
      material.height = result.height || undefined;
      material.duration = result.duration || undefined;
      material.orientation = result.orientation || undefined;
    }

    material.isLoaded = true;
  } catch (err) {
    console.error(`[useVideoMaterials] 加载视频信息失败: ${fileName}`, err);
  } finally {
    material.isLoading = false;
  }

  return material;
}

/**
 * useVideoMaterials Hook 选项
 */
export interface UseVideoMaterialsOptions {
  /** 日志回调 */
  onLog?: (message: string, type: 'info' | 'error' | 'success') => void;
}

/**
 * 视频素材管理 Hook
 *
 * 特点：
 * 1. 基于文件路径数组作为依赖，而不是任务
 * 2. 组件级缓存，hooks 卸载后缓存失效
 * 3. 支持增量加载，只加载新增的文件
 * 4. 返回的 materials 与传入的 paths 顺序一致
 * 5. 使用单个 IPC 方法（getVideoFullInfo）获取所有视频信息
 *
 * @param paths 文件路径数组
 * @param enabled 是否启用加载
 * @param options 可选配置
 * @returns materials 素材信息数组（与 paths 顺序一致）
 * @returns isLoading 是否正在加载
 * @returns getMaterial 根据路径获取单个素材（从缓存）
 */
export function useVideoMaterials(
  paths: string[],
  enabled: boolean = true,
  options?: UseVideoMaterialsOptions
): {
  materials: VideoMaterial[];
  isLoading: boolean;
  getMaterial: (path: string) => VideoMaterial | undefined;
  preloadPaths: (paths: string[]) => void;
} {
  // 素材状态（使用 Map 存储当前路径对应的素材）
  const [materialsMap, setMaterialsMap] = useState<Map<string, VideoMaterial>>(new Map());
  const [loadingCount, setLoadingCount] = useState(0);

  // 组件级缓存 - hooks 卸载后自动失效
  const cacheRef = useRef<Map<string, VideoMaterial>>(new Map());

  // 记录已请求过的路径，避免重复请求
  const requestedPathsRef = useRef<Set<string>>(new Set());

  // 记录正在加载的数量（用于批量日志）
  const batchLoadingRef = useRef(0);

  // 加载单个素材
  const loadMaterial = useCallback(async (filePath: string) => {
    // 检查组件级缓存
    if (cacheRef.current.has(filePath)) {
      const cached = cacheRef.current.get(filePath)!;
      setMaterialsMap((prev) => {
        const next = new Map(prev);
        next.set(filePath, cached);
        return next;
      });
      return;
    }

    // 检查是否已经在请求中
    if (requestedPathsRef.current.has(filePath)) {
      return;
    }
    requestedPathsRef.current.add(filePath);

    // 批量加载开始时的日志（只记录一次）
    if (batchLoadingRef.current === 0) {
      options?.onLog?.('正在加载视频信息...', 'info');
    }
    batchLoadingRef.current++;

    // 设置加载状态
    setLoadingCount((prev) => prev + 1);

    // 先设置一个加载中的占位
    setMaterialsMap((prev) => {
      const next = new Map(prev);
      next.set(filePath, {
        path: filePath,
        name: filePath.split(/[/\\]/).pop() || filePath,
        isLoading: true,
        isLoaded: false,
      });
      return next;
    });

    try {
      const material = await fetchVideoMaterial(filePath);

      // 更新组件级缓存
      cacheRef.current.set(filePath, material);

      // 更新状态
      setMaterialsMap((prev) => {
        const next = new Map(prev);
        next.set(filePath, material);
        return next;
      });
    } finally {
      setLoadingCount((prev) => prev - 1);
      batchLoadingRef.current--;

      // 批量加载结束时的日志（只记录一次）
      if (batchLoadingRef.current === 0) {
        options?.onLog?.('视频信息加载完成', 'success');
      }
    }
  }, [options]);

  // 当 paths 变化时，加载新的素材
  // 注意：不能依赖 materialsMap，否则会导致无限循环
  useEffect(() => {
    if (!enabled || paths.length === 0) return;

    // 使用 ref 检查是否需要加载（避免依赖 state）
    paths.forEach((path) => {
      const cached = cacheRef.current.get(path);
      if (!cached?.isLoaded && !requestedPathsRef.current.has(path)) {
        loadMaterial(path);
      }
    });
  }, [paths, enabled, loadMaterial]);

  // 根据路径顺序生成 materials 数组（使用 useMemo 缓存，避免无限循环）
  const materials = useMemo(() => {
    return paths.map((path) => {
      const material = materialsMap.get(path);
      if (material) return material;
      // 返回占位素材
      return {
        path,
        name: path.split(/[/\\]/).pop() || path,
        isLoading: true,
        isLoaded: false,
      };
    });
  }, [paths, materialsMap]);

  // 从组件级缓存获取单个素材
  const getMaterial = useCallback((path: string): VideoMaterial | undefined => {
    return cacheRef.current.get(path) || materialsMap.get(path);
  }, [materialsMap]);

  // 预加载一组路径
  const preloadPaths = useCallback((pathsToPreload: string[]) => {
    pathsToPreload.forEach((path) => {
      if (!cacheRef.current.has(path) && !requestedPathsRef.current.has(path)) {
        loadMaterial(path);
      }
    });
  }, [loadMaterial]);

  return {
    materials,
    isLoading: loadingCount > 0,
    getMaterial,
    preloadPaths,
  };
}

export default useVideoMaterials;
