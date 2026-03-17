/**
 * StepLayout 组件测试
 * 测试步骤布局组件的渲染和功能
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepLayout } from '@/renderer/pages/ASide/components/StepLayout/index';

describe('StepLayout 组件', () => {
  const defaultProps = {
    title: '选择创意方向',
    stepNumber: 1,
    totalSteps: 4,
    children: <div data-testid="content">测试内容</div>,
  };

  describe('基础渲染', () => {
    it('应该渲染标题和步骤信息', () => {
      render(<StepLayout {...defaultProps} />);

      expect(screen.getByText('选择创意方向')).toBeInTheDocument();
      expect(screen.getByText('Step 1 / 4')).toBeInTheDocument();
    });

    it('应该渲染子内容', () => {
      render(<StepLayout {...defaultProps} />);

      expect(screen.getByTestId('content')).toBeInTheDocument();
      expect(screen.getByText('测试内容')).toBeInTheDocument();
    });

    it('应该应用正确的布局样式', () => {
      const { container } = render(<StepLayout {...defaultProps} />);

      // 检查主容器是否有 flex flex-col
      const mainContainer = container.firstChild as HTMLElement;
      expect(mainContainer).toHaveClass('h-full', 'flex', 'flex-col');
    });
  });

  describe('待产库显示逻辑', () => {
    it('当 showLibrary=false 时不应显示待产库', () => {
      render(<StepLayout {...defaultProps} showLibrary={false} />);

      expect(screen.queryByText('待产库')).not.toBeInTheDocument();
    });

    it('当 showLibrary=true 但 stepNumber < 3 时不显示待产库', () => {
      render(<StepLayout {...defaultProps} showLibrary={true} stepNumber={2} />);

      expect(screen.queryByText('待产库')).not.toBeInTheDocument();
    });

    it('当 showLibrary=true 且 stepNumber >= 3 时应显示待产库', () => {
      render(<StepLayout {...defaultProps} showLibrary={true} stepNumber={3} />);

      expect(screen.getByText('待产库')).toBeInTheDocument();
    });

    it('步骤 4 也应该显示待产库', () => {
      render(<StepLayout {...defaultProps} showLibrary={true} stepNumber={4} />);

      expect(screen.getByText('待产库')).toBeInTheDocument();
    });
  });

  describe('导航按钮', () => {
    describe('默认按钮', () => {
      it('应该渲染上一步和下一步按钮', () => {
        render(<StepLayout {...defaultProps} />);

        expect(screen.getByRole('button', { name: /上一步/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /下一步/i })).toBeInTheDocument();
      });

      it('步骤 1 的上一步按钮应该是禁用的', () => {
        render(<StepLayout {...defaultProps} stepNumber={1} />);

        const prevButton = screen.getByRole('button', { name: /上一步/i });
        expect(prevButton).toBeDisabled();
      });

      it('步骤 2-4 的上一步按钮应该是可用的', () => {
        render(<StepLayout {...defaultProps} stepNumber={2} />);

        const prevButton = screen.getByRole('button', { name: /上一步/i });
        expect(prevButton).not.toBeDisabled();
      });

      it('点击上一步按钮应该调用 onPrev', async () => {
        const user = userEvent.setup();
        const onPrev = vi.fn();
        render(<StepLayout {...defaultProps} stepNumber={2} onPrev={onPrev} />);

        const prevButton = screen.getByRole('button', { name: /上一步/i });
        await user.click(prevButton);

        expect(onPrev).toHaveBeenCalledTimes(1);
      });

      it('点击下一步按钮应该调用 onNext', async () => {
        const user = userEvent.setup();
        const onNext = vi.fn();
        render(<StepLayout {...defaultProps} onNext={onNext} />);

        const nextButton = screen.getByRole('button', { name: /下一步/i });
        await user.click(nextButton);

        expect(onNext).toHaveBeenCalledTimes(1);
      });

      it('下一步按钮应该使用渐变样式', () => {
        render(<StepLayout {...defaultProps} />);

        const nextButton = screen.getByRole('button', { name: /下一步/i });
        expect(nextButton).toHaveClass('bg-gradient-to-r', 'from-pink-600', 'to-violet-600');
      });
    });

    describe('自定义下一步按钮', () => {
      it('应该支持自定义下一步按钮', () => {
        const customButtons = (
          <>
            <button>快速合成</button>
            <button>导演模式</button>
          </>
        );
        render(<StepLayout {...defaultProps} nextButtons={customButtons} />);

        expect(screen.getByRole('button', { name: '快速合成' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '导演模式' })).toBeInTheDocument();
      });

      it('提供自定义按钮时应隐藏默认的下一步按钮', () => {
        const customButtons = <button>自定义按钮</button>;
        render(<StepLayout {...defaultProps} nextButtons={customButtons} />);

        expect(screen.queryByRole('button', { name: /下一步/i })).not.toBeInTheDocument();
      });

      it('提供自定义按钮时仍应显示上一步按钮', () => {
        const customButtons = <button>自定义按钮</button>;
        render(<StepLayout {...defaultProps} stepNumber={2} nextButtons={customButtons} />);

        expect(screen.getByRole('button', { name: /上一步/i })).toBeInTheDocument();
      });
    });
  });

  describe('内容区域滚动', () => {
    it('主内容区应该可滚动', () => {
      const { container } = render(<StepLayout {...defaultProps} />);

      const contentArea = container.querySelector('.overflow-y-auto');
      expect(contentArea).toBeInTheDocument();
    });

    it('头部应该是粘性的', () => {
      const { container } = render(<StepLayout {...defaultProps} />);

      const header = container.querySelector('header');
      expect(header).not.toBeNull();
      expect(header).toHaveClass('sticky', 'top-0');
    });

    it('底部导航应该是粘性的', () => {
      const { container } = render(<StepLayout {...defaultProps} />);

      const footer = container.querySelector('footer');
      expect(footer).not.toBeNull();
      expect(footer).toHaveClass('sticky', 'bottom-0');
    });
  });
});
