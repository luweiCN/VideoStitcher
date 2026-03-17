/**
 * useRegionSearch Hook 测试
 *
 * 测试区域搜索功能，包括中文、全拼和首字母匹配
 */

import { renderHook } from '@testing-library/react';
import { useRegionSearch } from '@renderer/pages/ASide/hooks/useRegionSearch';
import type { Region } from '@shared/types/aside';

describe('useRegionSearch', () => {
  // 测试数据
  const mockRegions: Region[] = [
    { id: '1', name: '北京', emoji: '🏛️', group: '华北' },
    { id: '2', name: '上海', emoji: '🌃', group: '华东' },
    { id: '3', name: '广州', emoji: '🌆', group: '华南' },
    { id: '4', name: '深圳', emoji: '🏙️', group: '华南' },
    { id: '5', name: '天津', emoji: '🏰', group: '华北' },
  ];

  describe('空查询', () => {
    it('当查询为空字符串时，应返回所有区域', () => {
      const { result } = renderHook(() => useRegionSearch(mockRegions, ''));
      expect(result.current).toEqual(mockRegions);
    });

    it('当查询为纯空格时，应返回所有区域', () => {
      const { result } = renderHook(() => useRegionSearch(mockRegions, '   '));
      expect(result.current).toEqual(mockRegions);
    });
  });

  describe('中文匹配', () => {
    it('应支持中文完全匹配', () => {
      const { result } = renderHook(() => useRegionSearch(mockRegions, '北京'));
      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('北京');
    });

    it('应支持中文部分匹配', () => {
      const { result } = renderHook(() => useRegionSearch(mockRegions, '北'));
      expect(result.current).toHaveLength(1);
      expect(result.current.map(r => r.name)).toContain('北京');
    });

    it('应支持中文单字匹配', () => {
      const { result } = renderHook(() => useRegionSearch(mockRegions, '广'));
      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('广州');
    });
  });

  describe('全拼匹配', () => {
    it('应支持全拼完全匹配', () => {
      const { result } = renderHook(() => useRegionSearch(mockRegions, 'beijing'));
      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('北京');
    });

    it('应支持全拼部分匹配', () => {
      const { result } = renderHook(() => useRegionSearch(mockRegions, 'bei'));
      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('北京');
    });

    it('应支持全拼匹配多个区域', () => {
      const { result } = renderHook(() => useRegionSearch(mockRegions, 'shang'));
      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('上海');
    });

    it('应不区分大小写（全拼）', () => {
      const { result: result1 } = renderHook(() => useRegionSearch(mockRegions, 'BEIJING'));
      const { result: result2 } = renderHook(() => useRegionSearch(mockRegions, 'BeiJing'));

      expect(result1.current).toHaveLength(1);
      expect(result1.current[0].name).toBe('北京');
      expect(result2.current).toHaveLength(1);
      expect(result2.current[0].name).toBe('北京');
    });
  });

  describe('首字母匹配', () => {
    it('应支持首字母匹配', () => {
      const { result } = renderHook(() => useRegionSearch(mockRegions, 'bj'));
      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('北京');
    });

    it('应支持首字母匹配多个区域', () => {
      const { result } = renderHook(() => useRegionSearch(mockRegions, 's'));
      expect(result.current.length).toBeGreaterThan(0);
      // 应该包含上海（sh）和深圳（sz）
      const names = result.current.map(r => r.name);
      expect(names).toContain('上海');
      expect(names).toContain('深圳');
    });

    it('应不区分大小写（首字母）', () => {
      const { result: result1 } = renderHook(() => useRegionSearch(mockRegions, 'BJ'));
      const { result: result2 } = renderHook(() => useRegionSearch(mockRegions, 'Bj'));

      expect(result1.current).toHaveLength(1);
      expect(result1.current[0].name).toBe('北京');
      expect(result2.current).toHaveLength(1);
      expect(result2.current[0].name).toBe('北京');
    });
  });

  describe('边界情况', () => {
    it('当没有匹配结果时，应返回空数组', () => {
      const { result } = renderHook(() => useRegionSearch(mockRegions, 'xyz'));
      expect(result.current).toEqual([]);
    });

    it('应处理空区域数组', () => {
      const { result } = renderHook(() => useRegionSearch([], '北京'));
      expect(result.current).toEqual([]);
    });

    it('应处理特殊字符', () => {
      const { result } = renderHook(() => useRegionSearch(mockRegions, '@#$'));
      expect(result.current).toEqual([]);
    });
  });

  describe('性能优化', () => {
    it('应使用 useMemo 缓存结果', () => {
      const { result, rerender } = renderHook(
        ({ regions, query }) => useRegionSearch(regions, query),
        { initialProps: { regions: mockRegions, query: '北京' } },
      );

      const firstResult = result.current;

      // 使用相同的参数重新渲染
      rerender({ regions: mockRegions, query: '北京' });

      // 应该返回相同的引用（useMemo 缓存）
      expect(result.current).toBe(firstResult);
    });

    it('当依赖项变化时，应重新计算', () => {
      const { result, rerender } = renderHook(
        ({ regions, query }) => useRegionSearch(regions, query),
        { initialProps: { regions: mockRegions, query: '北京' } },
      );

      expect(result.current).toHaveLength(1);

      // 改变查询
      rerender({ regions: mockRegions, query: '上海' });

      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('上海');
    });
  });
});
