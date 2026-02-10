/**
 * 测量结果缓存
 *
 * 避免重复计算相同文本的测量结果
 * 提升性能，减少 DOM 操作
 */

import { MAX_CACHE_SIZE } from '../constants';

/**
 * 缓存条目
 */
interface CacheEntry {
  /** 文本内容 */
  text: string;
  /** 容器宽度 */
  width: number;
  /** 容器字体 */
  font: string;
  /** 截断位置 */
  truncateAt: number;
  /** 是否溢出 */
  overflow: boolean;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 生成缓存键
 */
function generateCacheKey(text: string, width: number, font: string): string {
  // 使用简单哈希算法
  const str = `${text}|${width}|${font}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为 32 位整数
  }
  return hash.toString(36);
}

/**
 * 测量缓存类
 */
export class MeasureCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;

  constructor(maxSize: number = MAX_CACHE_SIZE) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * 获取缓存条目
   */
  get(text: string, width: number, font: string): CacheEntry | null {
    const key = generateCacheKey(text, width, font);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // 检查是否过期（10 分钟）
    const now = Date.now();
    if (now - entry.timestamp > 10 * 60 * 1000) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  /**
   * 设置缓存条目
   */
  set(text: string, width: number, font: string, result: Omit<CacheEntry, 'timestamp'>): void {
    const key = generateCacheKey(text, width, font);

    // 检查缓存大小，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      let oldestKey = '';
      let oldestTimestamp = Infinity;

      for (const [k, entry] of this.cache.entries()) {
        if (entry.timestamp < oldestTimestamp) {
          oldestTimestamp = entry.timestamp;
          oldestKey = k;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      ...result,
      timestamp: Date.now(),
    });
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * 删除过期条目
   */
  evictExpired(maxAge: number = 10 * 60 * 1000): number {
    const now = Date.now();
    let evicted = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > maxAge) {
        this.cache.delete(key);
        evicted++;
      }
    }

    return evicted;
  }
}

/**
 * 默认缓存实例
 */
export const defaultMeasureCache = new MeasureCache();

/**
 * 缓存辅助函数
 */
export function getCachedMeasure(
  text: string,
  width: number,
  font: string,
  measureFn: () => { truncateAt: number; overflow: boolean }
): { truncateAt: number; overflow: boolean } {
  // 先尝试从缓存获取
  const cached = defaultMeasureCache.get(text, width, font);
  if (cached) {
    return {
      truncateAt: cached.truncateAt,
      overflow: cached.overflow,
    };
  }

  // 执行测量
  const result = measureFn();

  // 存入缓存
  defaultMeasureCache.set(text, width, font, result);

  return result;
}

/**
 * 清空默认缓存
 */
export function clearMeasureCache(): void {
  defaultMeasureCache.clear();
}
