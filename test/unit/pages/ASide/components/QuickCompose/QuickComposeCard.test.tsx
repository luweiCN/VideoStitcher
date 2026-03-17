/**
 * QuickComposeCard 子组件测试
 * 测试剧本卡片的功能
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuickComposeCard } from '@renderer/pages/ASide/components/QuickCompose/QuickComposeCard';
import type { Screenplay, AIModel } from '@shared/types/aside';

describe('QuickComposeCard 组件', () => {
  // 测试数据
  const mockScreenplay: Screenplay = {
    id: 'sp-1',
    projectId: 'proj-1',
    content: '这是一个测试剧本，用于验证快速合成卡片的功能。'.repeat(10), // 长文本
    status: 'library',
    aiModel: 'gemini',
    estimatedDuration: 30,
    createdAt: '2026-03-17T10:00:00Z',
  };

  const defaultProps = {
    screenplay: mockScreenplay,
    index: 1,
    onModelChange: vi.fn(),
    onGenerate: vi.fn(),
    onDelete: vi.fn(),
    onPreview: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('渲染', () => {
    it('应该显示剧本序号', () => {
      render(<QuickComposeCard {...defaultProps} />);
      expect(screen.getByText(/剧本 1/)).toBeDefined();
    });

    it('应该显示预估时长', () => {
      render(<QuickComposeCard {...defaultProps} />);
      expect(screen.getByText(/30秒/)).toBeDefined();
    });

    it('应该显示模型选择器', () => {
      render(<QuickComposeCard {...defaultProps} />);
      expect(screen.getByLabelText(/选择模型/)).toBeDefined();
    });

    it('应该正确显示当前选中的模型', () => {
      render(<QuickComposeCard {...defaultProps} />);
      const selector = screen.getByLabelText(/选择模型/) as HTMLSelectElement;
      expect(selector.value).toBe('gemini');
    });

    it('应该显示内容预览（可折叠）', () => {
      render(<QuickComposeCard {...defaultProps} />);
      // 默认应该显示折叠状态
      expect(screen.getByText(/展开预览/)).toBeDefined();
    });

    it('应该显示删除按钮', () => {
      render(<QuickComposeCard {...defaultProps} />);
      expect(screen.getByRole('button', { name: /删除/ })).toBeDefined();
    });
  });

  describe('内容折叠功能', () => {
    it('点击展开预览应该显示完整内容', () => {
      render(<QuickComposeCard {...defaultProps} />);

      const toggleButton = screen.getByRole('button', { name: /展开预览/ });
      fireEvent.click(toggleButton);

      // 应该显示完整内容
      expect(screen.getByText(mockScreenplay.content)).toBeDefined();
      // 按钮文本应该变为折叠
      expect(screen.getByRole('button', { name: /折叠预览/ })).toBeDefined();
    });

    it('再次点击应该折叠内容', () => {
      render(<QuickComposeCard {...defaultProps} />);

      // 展开
      const toggleButton = screen.getByRole('button', { name: /展开预览/ });
      fireEvent.click(toggleButton);

      // 折叠
      const foldButton = screen.getByRole('button', { name: /折叠预览/ });
      fireEvent.click(foldButton);

      // 应该恢复折叠状态
      expect(screen.getByRole('button', { name: /展开预览/ })).toBeDefined();
    });
  });

  describe('模型选择', () => {
    it('选择模型应该触发 onModelChange 回调', () => {
      const onModelChange = vi.fn();
      render(<QuickComposeCard {...defaultProps} onModelChange={onModelChange} />);

      const selector = screen.getByLabelText(/选择模型/);
      fireEvent.change(selector, { target: { value: 'doubao' } });

      expect(onModelChange).toHaveBeenCalledWith('sp-1', 'doubao');
    });
  });

  describe('生成视频功能', () => {
    it('草稿状态应该显示生成视频按钮', () => {
      const screenplay = { ...mockScreenplay, status: 'library' as const };
      render(<QuickComposeCard {...defaultProps} screenplay={screenplay} />);

      expect(screen.getByRole('button', { name: /生成视频/ })).toBeDefined();
    });

    it('点击生成视频应该触发 onGenerate 回调', () => {
      const onGenerate = vi.fn();
      render(<QuickComposeCard {...defaultProps} onGenerate={onGenerate} />);

      const generateButton = screen.getByRole('button', { name: /生成视频/ });
      fireEvent.click(generateButton);

      expect(onGenerate).toHaveBeenCalledWith('sp-1');
    });

    it('生成中状态应该显示进度条和取消按钮', () => {
      const screenplay = { ...mockScreenplay, status: 'producing' as const };
      render(<QuickComposeCard {...defaultProps} screenplay={screenplay} />);

      expect(screen.getByText(/生成中/)).toBeDefined();
      expect(screen.getByRole('progressbar')).toBeDefined();
      expect(screen.getByRole('button', { name: /取消/ })).toBeDefined();
    });

    it('已完成状态应该显示预览和保存按钮', () => {
      const screenplay = {
        ...mockScreenplay,
        status: 'completed' as const,
        videoUrl: 'https://example.com/video.mp4'
      };
      render(<QuickComposeCard {...defaultProps} screenplay={screenplay} />);

      expect(screen.getByRole('button', { name: /预览/ })).toBeDefined();
      expect(screen.getByRole('button', { name: /保存/ })).toBeDefined();
    });

    it('点击预览按钮应该触发 onPreview 回调', () => {
      const onPreview = vi.fn();
      const screenplay = {
        ...mockScreenplay,
        status: 'completed' as const,
        videoUrl: 'https://example.com/video.mp4'
      };
      render(<QuickComposeCard
        {...defaultProps}
        screenplay={screenplay}
        onPreview={onPreview}
      />);

      const previewButton = screen.getByRole('button', { name: /预览/ });
      fireEvent.click(previewButton);

      expect(onPreview).toHaveBeenCalledWith('sp-1');
    });
  });

  describe('删除功能', () => {
    it('点击删除按钮应该触发 onDelete 回调', () => {
      const onDelete = vi.fn();
      render(<QuickComposeCard {...defaultProps} onDelete={onDelete} />);

      const deleteButton = screen.getByRole('button', { name: /删除/ });
      fireEvent.click(deleteButton);

      expect(onDelete).toHaveBeenCalledWith('sp-1');
    });
  });

  describe('重新生成功能', () => {
    it('已完成状态应该显示重新生成按钮', () => {
      const screenplay = {
        ...mockScreenplay,
        status: 'completed' as const,
        videoUrl: 'https://example.com/video.mp4'
      };
      render(<QuickComposeCard {...defaultProps} screenplay={screenplay} />);

      expect(screen.getByRole('button', { name: /重新生成/ })).toBeDefined();
    });

    it('点击重新生成应该触发 onGenerate 回调', () => {
      const onGenerate = vi.fn();
      const screenplay = {
        ...mockScreenplay,
        status: 'completed' as const,
        videoUrl: 'https://example.com/video.mp4'
      };
      render(<QuickComposeCard
        {...defaultProps}
        screenplay={screenplay}
        onGenerate={onGenerate}
      />);

      const regenerateButton = screen.getByRole('button', { name: /重新生成/ });
      fireEvent.click(regenerateButton);

      expect(onGenerate).toHaveBeenCalledWith('sp-1');
    });
  });

  describe('进度显示', () => {
    it('当有进度时应该显示进度条', () => {
      const screenplay = { ...mockScreenplay, status: 'producing' as const };
      const props = {
        ...defaultProps,
        screenplay,
        progress: 60, // 60% 进度
      };

      render(<QuickComposeCard {...props} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '60');
    });

    it('进度条应该显示百分比文本', () => {
      const screenplay = { ...mockScreenplay, status: 'producing' as const };
      const props = {
        ...defaultProps,
        screenplay,
        progress: 75,
      };

      render(<QuickComposeCard {...props} />);

      expect(screen.getByText(/75%/)).toBeDefined();
    });
  });

  describe('无障碍性', () => {
    it('所有按钮应该有 aria-label', () => {
      render(<QuickComposeCard {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button.getAttribute('aria-label') || button.textContent).toBeTruthy();
      });
    });

    it('进度条应该有正确的 aria 属性', () => {
      const screenplay = { ...mockScreenplay, status: 'producing' as const };
      const props = {
        ...defaultProps,
        screenplay,
        progress: 50,
      };

      render(<QuickComposeCard {...props} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
    });
  });
});
