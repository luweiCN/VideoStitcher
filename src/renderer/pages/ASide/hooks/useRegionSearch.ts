/**
 * 区域搜索 Hook
 * 支持中文和拼音模糊搜索
 *
 * 功能特性:
 * - 中文匹配：直接匹配中文字符
 * - 全拼匹配：匹配完整拼音
 * - 首字母匹配：匹配拼音首字母
 * - 不区分大小写
 * - 使用 useMemo 优化性能
 */

import { useMemo } from 'react';
import pinyin from 'pinyin';
import type { Region } from '@shared/types/aside';

/**
 * 区域搜索 Hook
 *
 * @param regions - 区域列表
 * @param query - 搜索查询字符串
 * @returns 匹配的区域列表
 *
 * @example
 * ```ts
 * const regions = [
 *   { id: '1', name: '北京', emoji: '🏛️', group: '华北' },
 *   { id: '2', name: '上海', emoji: '🌃', group: '华东' },
 * ];
 *
 * // 中文搜索
 * useRegionSearch(regions, '北'); // 返回北京
 *
 * // 全拼搜索
 * useRegionSearch(regions, 'beijing'); // 返回北京
 *
 * // 首字母搜索
 * useRegionSearch(regions, 'bj'); // 返回北京
 * ```
 */
export function useRegionSearch(regions: Region[], query: string): Region[] {
  return useMemo(() => {
    // 空查询返回所有区域
    if (!query) return regions;

    // 标准化查询字符串（转小写并去除首尾空格）
    const lowerQuery = query.toLowerCase().trim();

    return regions.filter(region => {
      // 1. 中文匹配
      if (region.name.includes(query)) return true;

      // 2. 拼音匹配 - 全拼
      const fullPinyin = pinyin(region.name, {
        style: pinyin.STYLE_NORMAL,
        heteronym: false,
      })
        .flat()
        .join('')
        .toLowerCase();

      if (fullPinyin.includes(lowerQuery)) return true;

      // 3. 拼音匹配 - 首字母
      const firstLetters = pinyin(region.name, {
        style: pinyin.STYLE_FIRST_LETTER,
        heteronym: false,
      })
        .flat()
        .join('')
        .toLowerCase();

      if (firstLetters.includes(lowerQuery)) return true;

      return false;
    });
  }, [regions, query]);
}
