/**
 * RegionSelector 组件测试
 * 测试地区选择、搜索、最近选择功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RegionSelector } from '@renderer/pages/ASide/components/RegionSelector';
import { useASideStore } from '@renderer/stores/asideStore';

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

// Mock useASideStore
vi.mock('@renderer/stores/asideStore', () => ({
  useASideStore: vi.fn(),
}));

describe('RegionSelector', () => {
  const mockSelectRegion = vi.fn();
  const mockGoToNextStep = vi.fn();
  const mockGoToPrevStep = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();

    (useASideStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      selectRegion: mockSelectRegion,
      goToNextStep: mockGoToNextStep,
      goToPrevStep: mockGoToPrevStep,
    });
  });

  it('应该渲染搜索框', () => {
    render(<RegionSelector />);

    const searchInput = screen.getByPlaceholderText('搜索地区（支持拼音）');
    expect(searchInput).toBeInTheDocument();
  });

  it('应该显示热门地区', () => {
    render(<RegionSelector />);

    // 检查是否显示热门地区标题
    expect(screen.getByText('热门地区：')).toBeInTheDocument();

    // 检查是否包含全国通用
    expect(screen.getByText('全国通用')).toBeInTheDocument();
  });

  it('应该显示其他地区', () => {
    render(<RegionSelector />);

    // 检查是否显示其他地区标题
    expect(screen.getByText('其他地区：')).toBeInTheDocument();

    // 检查是否包含一些非热门地区
    expect(screen.getByText('天津')).toBeInTheDocument();
  });

  it('应该支持中文搜索', async () => {
    render(<RegionSelector />);

    const searchInput = screen.getByPlaceholderText('搜索地区（支持拼音）');
    fireEvent.change(searchInput, { target: { value: '北京' } });

    await waitFor(() => {
      expect(screen.getByText('北京')).toBeInTheDocument();
      // 其他地区应该被过滤掉
      expect(screen.queryByText('上海')).not.toBeInTheDocument();
    });
  });

  it('应该支持拼音搜索', async () => {
    render(<RegionSelector />);

    const searchInput = screen.getByPlaceholderText('搜索地区（支持拼音）');
    fireEvent.change(searchInput, { target: { value: 'beijing' } });

    await waitFor(() => {
      expect(screen.getByText('北京')).toBeInTheDocument();
      expect(screen.queryByText('上海')).not.toBeInTheDocument();
    });
  });

  it('应该支持拼音首字母搜索', async () => {
    render(<RegionSelector />);

    const searchInput = screen.getByPlaceholderText('搜索地区（支持拼音）');
    fireEvent.change(searchInput, { target: { value: 'bj' } });

    await waitFor(() => {
      expect(screen.getByText('北京')).toBeInTheDocument();
      expect(screen.queryByText('上海')).not.toBeInTheDocument();
    });
  });

  it('点击地区应该调用 selectRegion 和 goToNextStep', () => {
    render(<RegionSelector />);

    const beijingButton = screen.getByText('北京').closest('button');
    fireEvent.click(beijingButton!);

    expect(mockSelectRegion).toHaveBeenCalledWith('beijing');
    expect(mockGoToNextStep).toHaveBeenCalled();
  });

  it('点击地区应该保存到最近选择', () => {
    render(<RegionSelector />);

    const beijingButton = screen.getByText('北京').closest('button');
    fireEvent.click(beijingButton!);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'aside-recent-regions',
      JSON.stringify(['beijing'])
    );
  });

  it('应该显示最近选择的地区', () => {
    // 预设最近选择
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['beijing', 'shanghai']));

    render(<RegionSelector />);

    expect(screen.getByText('最近选择：')).toBeInTheDocument();
    // 使用 getAllByText 因为地区可能在最近选择和热门地区中都出现
    expect(screen.getAllByText('北京').length).toBeGreaterThan(0);
    expect(screen.getAllByText('上海').length).toBeGreaterThan(0);
  });

  it('搜索时应该隐藏最近选择', async () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['beijing']));

    render(<RegionSelector />);

    // 初始显示最近选择
    expect(screen.getByText('最近选择：')).toBeInTheDocument();

    // 输入搜索词
    const searchInput = screen.getByPlaceholderText('搜索地区（支持拼音）');
    fireEvent.change(searchInput, { target: { value: '上海' } });

    await waitFor(() => {
      expect(screen.queryByText('最近选择：')).not.toBeInTheDocument();
    });
  });

  it('无搜索结果应该显示提示信息', async () => {
    render(<RegionSelector />);

    const searchInput = screen.getByPlaceholderText('搜索地区（支持拼音）');
    fireEvent.change(searchInput, { target: { value: '不存在的地区' } });

    await waitFor(() => {
      expect(screen.getByText('没有找到匹配的地区')).toBeInTheDocument();
      expect(screen.getByText('尝试其他搜索词')).toBeInTheDocument();
    });
  });
});
