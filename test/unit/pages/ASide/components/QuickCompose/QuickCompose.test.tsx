/**
 * QuickCompose 主组件测试
 * 测试快速合成页面的核心功能
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuickCompose } from '@renderer/pages/ASide/components/QuickCompose';
import { useASideStore } from '@renderer/stores/asideStore';
import type { Screenplay } from '@shared/types/aside';

// Mock Zustand store
vi.mock('@renderer/stores/asideStore', () => ({
  useASideStore: vi.fn(),
}));

// Mock window.api
const mockAsideGetLibraryScreenplays = vi.fn();
const mockAsideUpdateScreenplayStatus = vi.fn();
const mockAsideGenerateVideoFromScreenplay = vi.fn();

window.api = {
  asideGetLibraryScreenplays: mockAsideGetLibraryScreenplays,
  asideUpdateScreenplayStatus: mockAsideUpdateScreenplayStatus,
  asideGenerateVideoFromScreenplay: mockAsideGenerateVideoFromScreenplay,
};

describe('QuickCompose 组件', () => {
  // 测试数据
  const mockScreenplays: Screenplay[] = [
    {
      id: 'sp-1',
      projectId: 'proj-1',
      content: '剧本1内容',
      status: 'library',
      aiModel: 'gemini',
      estimatedDuration: 30,
      createdAt: '2026-03-17T10:00:00Z',
    },
    {
      id: 'sp-2',
      projectId: 'proj-1',
      content: '剧本2内容',
      status: 'library',
      aiModel: 'gemini',
      estimatedDuration: 45,
      createdAt: '2026-03-17T10:05:00Z',
    },
    {
      id: 'sp-3',
      projectId: 'proj-1',
      content: '剧本3内容',
      status: 'producing',
      aiModel: 'doubao',
      estimatedDuration: 60,
      createdAt: '2026-03-17T10:10:00Z',
    },
  ];

  const mockStore = {
    currentProject: { id: 'proj-1', name: '测试项目' },
    libraryScripts: mockScreenplays,
    selectedModel: 'gemini',
    setLibraryScripts: vi.fn(),
    updateLibraryScript: vi.fn(),
    removeLibraryScript: vi.fn(),
    setCurrentView: vi.fn(),
    setModel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useASideStore as any).mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector(mockStore);
      }
      return mockStore;
    });
    mockAsideGetLibraryScreenplays.mockResolvedValue({
      success: true,
      screenplays: mockScreenplays,
    });
  });

  describe('页面渲染', () => {
    it('应该渲染快速合成页面标题', async () => {
      render(<QuickCompose />);

      await waitFor(() => {
        expect(screen.getByText(/待产库剧本/)).toBeDefined();
      });
    });

    it('应该显示剧本数量', async () => {
      render(<QuickCompose />);

      await waitFor(() => {
        expect(screen.getByText(/\(3\)/)).toBeDefined();
      });
    });

    it('应该显示返回按钮', async () => {
      render(<QuickCompose />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /返回/ })).toBeDefined();
      });
    });
  });

  describe('空状态处理', () => {
    it('当待产库为空时应该显示空状态提示', async () => {
      const emptyStore = {
        ...mockStore,
        libraryScripts: [],
      };

      (useASideStore as any).mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(emptyStore);
        }
        return emptyStore;
      });

      mockAsideGetLibraryScreenplays.mockResolvedValue({
        success: true,
        screenplays: [],
      });

      render(<QuickCompose />);

      await waitFor(() => {
        expect(screen.getByText(/待产库为空/)).toBeDefined();
        expect(screen.getByText(/请先生成剧本并添加到待产库/)).toBeDefined();
      });
    });
  });

  describe('剧本列表渲染', () => {
    it('应该渲染所有待产库剧本卡片', async () => {
      render(<QuickCompose />);

      await waitFor(() => {
        const cards = screen.getAllByTestId('screenplay-card');
        expect(cards.length).toBe(3);
      });
    });

    it('应该按创建时间降序显示剧本', async () => {
      render(<QuickCompose />);

      await waitFor(() => {
        const cards = screen.getAllByTestId('screenplay-card');
        // 第一个应该是最新创建的
        expect(cards[0]).toHaveTextContent('剧本3内容');
      });
    });
  });

  describe('模型选择功能', () => {
    it('每个剧本卡片应该有独立的模型选择器', async () => {
      render(<QuickCompose />);

      await waitFor(() => {
        const modelSelectors = screen.getAllByLabelText(/选择模型/);
        expect(modelSelectors.length).toBe(3);
      });
    });

    it('底部应该有统一模型选择器', async () => {
      render(<QuickCompose />);

      await waitFor(() => {
        expect(screen.getByLabelText(/统一模型选择/)).toBeDefined();
      });
    });

    it('点击应用全部应该更新所有剧本的模型', async () => {
      render(<QuickCompose />);

      await waitFor(() => {
        // 选择统一模型
        const unifiedSelector = screen.getByLabelText(/统一模型选择/);
        fireEvent.change(unifiedSelector, { target: { value: 'doubao' } });

        // 点击应用全部
        const applyAllButton = screen.getByRole('button', { name: /应用全部/ });
        fireEvent.click(applyAllButton);
      });

      // 应该调用更新方法
      expect(mockStore.updateLibraryScript).toHaveBeenCalledTimes(3);
    });
  });

  describe('批量生成功能', () => {
    it('应该显示批量生成全部按钮', async () => {
      render(<QuickCompose />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /批量生成全部/ })).toBeDefined();
      });
    });

    it('点击批量生成应该对所有剧本发起生成请求', async () => {
      mockAsideGenerateVideoFromScreenplay.mockResolvedValue({
        success: true,
        videoUrl: 'https://example.com/video.mp4',
      });

      render(<QuickCompose />);

      await waitFor(() => {
        const batchButton = screen.getByRole('button', { name: /批量生成全部/ });
        fireEvent.click(batchButton);
      });

      // 应该对每个剧本调用生成 API
      await waitFor(() => {
        expect(mockAsideGenerateVideoFromScreenplay).toHaveBeenCalledTimes(3);
      });
    });

    it('批量生成时应该显示进度条', async () => {
      mockAsideGenerateVideoFromScreenplay.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      );

      render(<QuickCompose />);

      await waitFor(() => {
        const batchButton = screen.getByRole('button', { name: /批量生成全部/ });
        fireEvent.click(batchButton);
      });

      // 应该显示进度信息
      await waitFor(() => {
        expect(screen.getByText(/生成进度/)).toBeDefined();
      });
    });
  });

  describe('删除功能', () => {
    it('点击删除按钮应该从待产库移除剧本', async () => {
      mockAsideUpdateScreenplayStatus.mockResolvedValue({ success: true });

      render(<QuickCompose />);

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button', { name: /删除/ });
        fireEvent.click(deleteButtons[0]);
      });

      await waitFor(() => {
        expect(mockAsideUpdateScreenplayStatus).toHaveBeenCalledWith(
          expect.any(String),
          'draft'
        );
        expect(mockStore.removeLibraryScript).toHaveBeenCalled();
      });
    });

    it('删除前应该显示确认对话框', async () => {
      // Mock window.confirm
      const mockConfirm = vi.fn(() => true);
      window.confirm = mockConfirm;

      render(<QuickCompose />);

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button', { name: /删除/ });
        fireEvent.click(deleteButtons[0]);
      });

      expect(mockConfirm).toHaveBeenCalledWith('确定从待产库中删除这个剧本吗？');
    });
  });

  describe('预览和保存功能', () => {
    it('生成完成后应该显示预览按钮', async () => {
      const completedStore = {
        ...mockStore,
        libraryScripts: [
          {
            ...mockScreenplays[0],
            status: 'completed',
            videoUrl: 'https://example.com/video.mp4',
          },
        ],
      };

      (useASideStore as any).mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(completedStore);
        }
        return completedStore;
      });

      render(<QuickCompose />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /预览/ })).toBeDefined();
      });
    });

    it('点击预览按钮应该打开预览模态框', async () => {
      const completedStore = {
        ...mockStore,
        libraryScripts: [
          {
            ...mockScreenplays[0],
            status: 'completed',
            videoUrl: 'https://example.com/video.mp4',
          },
        ],
      };

      (useASideStore as any).mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(completedStore);
        }
        return completedStore;
      });

      render(<QuickCompose />);

      await waitFor(() => {
        const previewButton = screen.getByRole('button', { name: /预览/ });
        fireEvent.click(previewButton);
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeDefined();
      });
    });

    it('预览后应该显示保存和重新生成按钮', async () => {
      const completedStore = {
        ...mockStore,
        libraryScripts: [
          {
            ...mockScreenplays[0],
            status: 'completed',
            videoUrl: 'https://example.com/video.mp4',
          },
        ],
      };

      (useASideStore as any).mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(completedStore);
        }
        return completedStore;
      });

      render(<QuickCompose />);

      await waitFor(() => {
        const previewButton = screen.getByRole('button', { name: /预览/ });
        fireEvent.click(previewButton);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /保存/ })).toBeDefined();
        expect(screen.getByRole('button', { name: /重新生成/ })).toBeDefined();
      });
    });
  });

  describe('加载状态', () => {
    it('初始加载时应该显示加载状态', async () => {
      // 延迟返回数据
      mockAsideGetLibraryScreenplays.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ success: true, screenplays: [] }), 100))
      );

      render(<QuickCompose />);

      // 应该显示加载指示器
      expect(screen.getByText(/加载中/)).toBeDefined();
    });
  });

  describe('错误处理', () => {
    it('加载失败时应该显示错误消息', async () => {
      mockAsideGetLibraryScreenplays.mockResolvedValue({
        success: false,
        error: '加载失败',
      });

      render(<QuickCompose />);

      await waitFor(() => {
        expect(screen.getByText(/加载待产库失败/)).toBeDefined();
      });
    });

    it('生成失败时应该显示错误消息', async () => {
      mockAsideGenerateVideoFromScreenplay.mockResolvedValue({
        success: false,
        error: '生成失败',
      });

      render(<QuickCompose />);

      await waitFor(() => {
        const generateButtons = screen.getAllByRole('button', { name: /生成视频/ });
        fireEvent.click(generateButtons[0]);
      });

      await waitFor(() => {
        expect(screen.getByText(/生成失败/)).toBeDefined();
      });
    });
  });

  describe('返回功能', () => {
    it('点击返回按钮应该返回到剧本生成页面', async () => {
      render(<QuickCompose />);

      await waitFor(() => {
        const backButton = screen.getByRole('button', { name: /返回/ });
        fireEvent.click(backButton);
      });

      expect(mockStore.setCurrentView).toHaveBeenCalledWith('step3-scripts');
    });
  });
});
