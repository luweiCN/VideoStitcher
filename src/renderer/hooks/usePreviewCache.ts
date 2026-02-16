import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * 预览生成结果
 */
export interface PreviewGenerateResult {
  success: boolean;
  tempPath?: string;
  error?: string;
  elapsed?: string;
}

/**
 * 预览缓存管理器选项
 */
export interface PreviewCacheOptions<TConfig> {
  /** 缓存命名空间（用于区分不同模块） */
  namespace: string;
  /** 生成预览的函数 */
  generate: (config: TConfig, signal?: AbortSignal) => Promise<PreviewGenerateResult>;
  /** 删除临时文件的函数 */
  deleteTemp: (tempPath: string) => Promise<void>;
  /** 生成缓存 key 的函数 */
  getCacheKey: (config: TConfig) => string;
  /** 日志回调 */
  onLog?: (message: string, type: 'info' | 'success' | 'error') => void;
}

/**
 * 预览缓存管理器返回值
 */
export interface PreviewCacheResult {
  /** 预览文件路径 */
  previewPath: string | null;
  /** 是否正在生成 */
  isGenerating: boolean;
  /** 错误信息 */
  error: string | null;
  /** 是否命中缓存 */
  isFromCache: boolean;
  /** 强制重新生成 */
  regenerate: () => void;
}

/**
 * 全局缓存存储（按命名空间区分）
 */
const globalCacheStore = new Map<string, Map<string, string>>();

/**
 * 获取或创建命名空间的缓存
 */
function getNamespaceCache(namespace: string): Map<string, string> {
  if (!globalCacheStore.has(namespace)) {
    globalCacheStore.set(namespace, new Map());
  }
  return globalCacheStore.get(namespace)!;
}

/**
 * 全局正在生成的任务（按命名空间区分）
 * 存储: namespace -> { key, abortController }
 */
const globalGeneratingTasks = new Map<string, {
  key: string;
  abortController: AbortController;
  config: unknown;
}>();

/**
 * 通用的预览缓存管理 Hook
 *
 * 设计原则：
 * 1. 切换任务时，有缓存用缓存，无缓存则生成
 * 2. 相同任务正在生成时，等待不重复生成
 * 3. 不同任务正在生成时，取消旧任务，开始新任务
 * 4. 取消时，如果预览已完成，保存到缓存
 *
 * @param config 当前配置（变化时触发预览更新）
 * @param enabled 是否启用
 * @param options 配置选项
 */
export function usePreviewCache<TConfig>(
  config: TConfig | null,
  enabled: boolean,
  options: PreviewCacheOptions<TConfig>
): PreviewCacheResult {
  const {
    namespace,
    generate,
    deleteTemp,
    getCacheKey,
    onLog,
  } = options;

  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);

  // 当前配置的 key
  const currentKeyRef = useRef<string>('');
  // 已经处理过的 key（用于防止重复处理）
  const processedKeyRef = useRef<string>('');
  // 当前的 AbortController
  const abortControllerRef = useRef<AbortController | null>(null);
  // 防抖定时器
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 清理防抖定时器
   */
  const clearDebounceTimer = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  /**
   * 取消当前生成任务
   */
  const cancelCurrentGeneration = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 清理全局任务记录
    const globalTask = globalGeneratingTasks.get(namespace);
    if (globalTask) {
      globalTask.abortController.abort();
      globalGeneratingTasks.delete(namespace);
    }
  }, [namespace]);

  /**
   * 生成预览
   */
  const generatePreview = useCallback(async (
    configToUse: TConfig,
    key: string,
    signal: AbortSignal
  ) => {
    try {
      const result = await generate(configToUse, signal);

      // 如果已取消，检查结果
      if (signal.aborted) {
        // 如果生成成功，保存到缓存
        if (result.success && result.tempPath) {
          const cache = getNamespaceCache(namespace);
          cache.set(key, result.tempPath);
          const timeInfo = result.elapsed ? ` (耗时 ${result.elapsed}秒)` : '';
          onLog?.(`预览生成完成${timeInfo}（已缓存）`, 'success');
        } else if (result.tempPath) {
          // 生成失败，删除临时文件
          await deleteTemp(result.tempPath);
        }
        return;
      }

      // 未取消，处理结果
      if (result.success && result.tempPath) {
        // 保存到缓存
        const cache = getNamespaceCache(namespace);
        cache.set(key, result.tempPath);

        // 更新状态
        setPreviewPath(result.tempPath);
        setIsFromCache(false);
        setError(null);
        const timeInfo = result.elapsed ? ` (耗时 ${result.elapsed}秒)` : '';
        onLog?.(`预览生成完成${timeInfo}`, 'success');
      } else {
        setError(result.error || '预览生成失败');
        onLog?.(`预览生成失败: ${result.error || '未知错误'}`, 'error');
      }
    } catch (err) {
      if (!signal.aborted) {
        const errorMsg = err instanceof Error ? err.message : '预览生成异常';
        setError(errorMsg);
        onLog?.(`预览生成异常: ${errorMsg}`, 'error');
      }
    } finally {
      // 清理全局任务记录
      const globalTask = globalGeneratingTasks.get(namespace);
      if (globalTask && globalTask.key === key) {
        globalGeneratingTasks.delete(namespace);
      }

      // 只有当 key 没变时才更新 generating 状态
      if (currentKeyRef.current === key) {
        setIsGenerating(false);
      }
    }
  }, [namespace, generate, deleteTemp, onLog]);

  /**
   * 请求预览（核心逻辑）
   */
  const requestPreview = useCallback(async (configToUse: TConfig, forceRegenerate: boolean = false) => {
    const key = getCacheKey(configToUse);

    // 如果已经处理过这个 key，跳过
    if (!forceRegenerate && processedKeyRef.current === key) {
      return;
    }

    currentKeyRef.current = key;

    // 检查缓存
    const cache = getNamespaceCache(namespace);
    if (!forceRegenerate && cache.has(key)) {
      const cachedPath = cache.get(key)!;
      // 如果当前路径已经是这个缓存，静默跳过
      if (previewPath === cachedPath) {
        return;
      }
      processedKeyRef.current = key;
      setPreviewPath(cachedPath);
      setIsFromCache(true);
      setError(null);
      setIsGenerating(false);
      onLog?.('使用预览缓存', 'info');
      return;
    }

    // 检查全局正在生成的任务
    const globalTask = globalGeneratingTasks.get(namespace);

    if (globalTask) {
      if (globalTask.key === key) {
        // 相同任务正在生成，静默等待（不重复输出日志）
        setIsGenerating(true);
        return;
      } else {
        // 不同任务正在生成，取消旧任务
        globalTask.abortController.abort();
        globalGeneratingTasks.delete(namespace);
      }
    }

    // 标记开始处理这个 key
    processedKeyRef.current = key;

    // 开始新的生成任务
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // 记录到全局
    globalGeneratingTasks.set(namespace, {
      key,
      abortController,
      config: configToUse,
    });

    // 更新状态
    setPreviewPath(null);
    setError(null);
    setIsGenerating(true);
    setIsFromCache(false);
    onLog?.('正在生成预览...', 'info');

    // 开始生成
    await generatePreview(configToUse, key, abortController.signal);
  }, [namespace, getCacheKey, generatePreview, previewPath, onLog]);

  /**
   * 强制重新生成
   */
  const regenerate = useCallback(() => {
    if (!config || !enabled) return;
    clearDebounceTimer();
    cancelCurrentGeneration();
    requestPreview(config, true);
  }, [config, enabled, clearDebounceTimer, cancelCurrentGeneration, requestPreview]);

  /**
   * 当配置变化时，请求预览
   */
  useEffect(() => {
    // 清理防抖定时器
    clearDebounceTimer();

    if (!config || !enabled) {
      setPreviewPath(null);
      setError(null);
      setIsGenerating(false);
      setIsFromCache(false);
      processedKeyRef.current = ''; // 重置处理过的 key
      cancelCurrentGeneration();
      return;
    }

    const key = getCacheKey(config);

    // 如果已经处理过这个 key，跳过
    if (processedKeyRef.current === key) {
      return;
    }

    // 防抖：延迟 300ms 后请求预览
    debounceTimerRef.current = setTimeout(() => {
      requestPreview(config);
    }, 300);

    return () => {
      clearDebounceTimer();
      // 注意：不要在这里 abort，因为：
      // 1. 如果 config 没变，effect 重新执行只是因为依赖项变化，不应该取消
      // 2. 如果 config 变了，requestPreview 内部会处理取消旧任务
      // 3. abort 会导致正在进行的任务完成后不设置 previewPath
    };
  }, [config, enabled, getCacheKey, clearDebounceTimer, cancelCurrentGeneration, requestPreview]);

  /**
   * 组件卸载时清理
   */
  useEffect(() => {
    return () => {
      clearDebounceTimer();
      cancelCurrentGeneration();
    };
  }, [clearDebounceTimer, cancelCurrentGeneration]);

  return {
    previewPath,
    isGenerating,
    error,
    isFromCache,
    regenerate,
  };
}

/**
 * 清理指定命名空间的所有缓存
 */
export async function clearNamespaceCache(
  namespace: string,
  deleteTemp: (path: string) => Promise<void>
): Promise<void> {
  const cache = globalCacheStore.get(namespace);
  if (!cache) return;

  const paths = Array.from(cache.values());
  cache.clear();

  for (const path of paths) {
    try {
      await deleteTemp(path);
    } catch {
      // 忽略删除错误
    }
  }
}

export default usePreviewCache;
