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

/**
 * 区域搜索 Hook（泛型，支持任意含 name 字段的对象）
 *
 * @param items - 区域列表（需含 name 字段）
 * @param query - 搜索查询字符串
 * @returns 匹配的区域列表
 */
export function useRegionSearch<T extends { name: string }>(items: T[], query: string): T[] {
  return useMemo(() => {
    if (!query) return items;

    const lowerQuery = query.toLowerCase().trim();

    return items.filter(item => {
      // 1. 中文匹配
      if (item.name.includes(query)) return true;

      // 2. 拼音匹配 - 全拼
      const fullPinyin = pinyin(item.name, {
        style: pinyin.STYLE_NORMAL,
        heteronym: false,
      })
        .flat()
        .join('')
        .toLowerCase();

      if (fullPinyin.includes(lowerQuery)) return true;

      // 3. 拼音匹配 - 首字母
      const firstLetters = pinyin(item.name, {
        style: pinyin.STYLE_FIRST_LETTER,
        heteronym: false,
      })
        .flat()
        .join('')
        .toLowerCase();

      if (firstLetters.includes(lowerQuery)) return true;

      return false;
    });
  }, [items, query]);
}
