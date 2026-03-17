/**
 * RecentRegions 组件功能测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecentRegions, getRecentRegions, saveRecentRegion } from '@renderer/pages/ASide/components/RegionSelector/RecentRegions';
import type { Region } from '@shared/types/aside';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('RecentRegions 组件', () => {
  const mockRegions: Region[] = [
    { id: 'beijing', name: '北京', emoji: '🏛️', group: '华北' },
    { id: 'shanghai', name: '上海', emoji: '🌃', group: '华东' },
  { id: 'tianjin', name: '天津', emoji: '🏰', group: '华北' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('应该返回空数组（当 localStorage 为空', () => {
    localStorageMock.getItem.mockReturnValue(null);
    const recent = getRecentRegions();
    expect(recent).toEqual([]);
  });

  it('应该返回解析后的数组', () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['beijing', 'shanghai']));
    const recent = getRecentRegions();
    expect(recent).toEqual(['beijing', 'shanghai']);
  });

  it('应该保存最近选择', () => {
    saveRecentRegion('beijing');
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'aside-recent-regions',
      JSON.stringify(['beijing'])
    );

    // 测试重复保存 - 应该去重
    saveRecentRegion('shanghai');
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'aside-recent-regions',
      JSON.stringify(['shanghai', 'beijing'])
    );

    // 测试保存超过最大数量限制
    const manyRegions = Array.from({ length: 15 }, (_, i) => `region-${i}`);
    localStorageMock.getItem.mockReturnValue(JSON.stringify(manyRegions));

    // 保存一个新地区
    saveRecentRegion('newRegion');
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'aside-recent-regions',
      JSON.stringify(['newRegion', ...manyRegions.slice(0, 10)])
    );
  });

  it('应该在没有最近选择时不返回 null', () => {
    localStorageMock.getItem.mockReturnValue(null);

    render(<RecentRegions regions={mockRegions} onSelect={() => {}} />);

    // 最近选择部分应该不渲染
    expect(screen.queryByText('最近选择：')).not.toBeInTheDocument();
  });

  it('应该在有最近选择时显示最近选择列表', () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['beijing', 'shanghai']));

    render(<RecentRegions regions={mockRegions} onSelect={() => {}} />);

    expect(screen.getByText('最近选择：')).toBeInTheDocument();
    expect(screen.getByText('北京')).toBeInTheDocument();
    expect(screen.getByText('上海')).toBeInTheDocument();
  });

  it('点击最近选择应该调用 onSelect', () => {
    const mockOnSelect = vi.fn();
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['beijing']));

    render(<RecentRegions regions={mockRegions} onSelect={mockOnSelect} />);

    const beijingButton = screen.getByText('北京');
    fireEvent.click(beijingButton);

    expect(mockOnSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'beijing',
        name: '北京',
        emoji: '🏛️',
        group: '华北',
      }).toBeInTheDocument()
    );
  });
});
