import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/**
 * 图片素材信息
 */
export interface ImageMaterial {
  path: string;
  name: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  orientation?: 'landscape' | 'portrait' | 'square';
  aspectRatio?: string;
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 是否加载完成 */
  isLoaded?: boolean;
}

/**
 * 获取单个图片的素材信息（通过单个 IPC 调用）
 */
async function fetchImageMaterial(filePath: string, thumbnailMaxSize: number = 200): Promise<ImageMaterial> {
  const fileName = filePath.split(/[/\\]/).pop() || filePath;
  const material: ImageMaterial = {
    path: filePath,
    name: fileName,
    isLoading: true,
    isLoaded: false,
  };

  try {
    // 一次 IPC 调用获取所有信息
    const result = await window.api.getImageFullInfo(filePath, { thumbnailMaxSize });

    if (result.success) {
      material.thumbnailUrl = result.thumbnail || undefined;
      material.previewUrl = result.previewUrl || undefined;
      material.fileSize = result.fileSize || undefined;
      material.width = result.width || undefined;
      material.height = result.height || undefined;
      material.orientation = result.orientation || undefined;
      material.aspectRatio = result.aspectRatio || undefined;
    }

    material.isLoaded = true;
  } catch (err) {
    console.error(`[useImageMaterials] 加载图片信息失败: ${fileName}`, err);
  } finally {
    material.isLoading = false;
  }

  return material;
}

/**
 * useImageMaterials Hook 选项
 */
export interface UseImageMaterialsOptions {
  /** 缩略图最大尺寸 */
  thumbnailMaxSize?: number;
  /** 日志回调 */
  onLog?: (message: string, type: 'info' | 'error' | 'success') => void;
}

/**
 * 图片素材管理 Hook
 *
 * 特点：
 * 1. 基于文件路径数组作为依赖
 * 2. 组件级缓存，hooks 卸载后缓存失效
 * 3. 支持增量加载，只加载新增的文件
 * 4. 返回的 materials 与传入的 paths 顺序一致
 * 5. 使用单个 IPC 方法（getImageFullInfo）获取所有图片信息
 *
 * @param paths 文件路径数组
 * @param enabled 是否启用加载
 * @param options 可选配置
 * @returns materials 素材信息数组（与 paths 顺序一致）
 * @returns isLoading 是否正在加载
 * @returns getMaterial 根据路径获取单个素材（从缓存）
 * @returns preloadPaths 预加载指定路径
 */
export function useImageMaterials(
  paths: string[],
  enabled: boolean = true,
  options?: UseImageMaterialsOptions
): {
  materials: ImageMaterial[];
  isLoading: boolean;
  getMaterial: (path: string) => ImageMaterial | undefined;
  preloadPaths: (paths: string[]) => void;
} {
  const thumbnailMaxSize = options?.thumbnailMaxSize ?? 200;

  // 素材状态（使用 Map 存储当前路径对应的素材）
  const [materialsMap, setMaterialsMap] = useState<Map<string, ImageMaterial>>(new Map());
  const [loadingCount, setLoadingCount] = useState(0);

  // 组件级缓存 - hooks 卸载后自动失效
  const cacheRef = useRef<Map<string, ImageMaterial>>(new Map());

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
      options?.onLog?.('正在加载图片信息...', 'info');
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
      // 获取素材信息
      const material = await fetchImageMaterial(filePath, thumbnailMaxSize);

      // 存入组件级缓存
      cacheRef.current.set(filePath, material);

      // 更新状态
      setMaterialsMap((prev) => {
        const next = new Map(prev);
        next.set(filePath, material);
        return next;
      });

      // 批量加载完成时的日志
      batchLoadingRef.current--;
      if (batchLoadingRef.current === 0) {
        options?.onLog?.('图片信息加载完成', 'success');
      }
    } catch (err) {
      console.error(`[useImageMaterials] 加载失败: ${filePath}`, err);
      setMaterialsMap((prev) => {
        const next = new Map(prev);
        next.set(filePath, {
          path: filePath,
          name: filePath.split(/[/\\]/).pop() || filePath,
          isLoading: false,
          isLoaded: true,
        });
        return next;
      });
    } finally {
      setLoadingCount((prev) => prev - 1);
    }
  }, [thumbnailMaxSize, options?.onLog]);

  // 预加载指定路径
  const preloadPaths = useCallback((pathsToPreload: string[]) => {
    pathsToPreload.forEach((path) => {
      if (!cacheRef.current.has(path) && !requestedPathsRef.current.has(path)) {
        loadMaterial(path);
      }
    });
  }, [loadMaterial]);

  // 监听 paths 变化，加载新增的素材
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
  const getMaterial = useCallback((path: string): ImageMaterial | undefined => {
    return cacheRef.current.get(path);
  }, []);

  return {
    materials,
    isLoading: loadingCount > 0,
    getMaterial,
    preloadPaths,
  };
}

export default useImageMaterials;
