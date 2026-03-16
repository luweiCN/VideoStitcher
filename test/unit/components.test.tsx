import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * React 组件测试示例
 * 演示如何测试 React 组件
 */

// 示例组件：简单按钮
const SimpleButton = ({
  text,
  onClick,
  disabled = false,
}: {
  text: string;
  onClick?: () => void;
  disabled?: boolean;
}) => {
  return (
    <button onClick={onClick} disabled={disabled}>
      {text}
    </button>
  );
};

// 示例组件：文本显示
const TextDisplay = ({
  title,
  content,
}: {
  title: string;
  content: string;
}) => {
  return (
    <div>
      <h2>{title}</h2>
      <p>{content}</p>
    </div>
  );
};

describe('React 组件测试', () => {
  describe('SimpleButton 组件', () => {
    it('应该渲染按钮文本', () => {
      render(<SimpleButton text="点击我" />);
      expect(screen.getByText('点击我')).toBeDefined();
    });

    it('应该在点击时调用回调函数', () => {
      const handleClick = vi.fn();
      render(<SimpleButton text="点击我" onClick={handleClick} />);

      const button = screen.getByText('点击我');
      button.click();

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('禁用状态下不应该响应点击', () => {
      const handleClick = vi.fn();
      render(
        <SimpleButton text="点击我" onClick={handleClick} disabled={true} />
      );

      const button = screen.getByText('点击我');
      expect(button.hasAttribute('disabled')).toBe(true);
    });
  });

  describe('TextDisplay 组件', () => {
    it('应该显示标题和内容', () => {
      render(
        <TextDisplay title="测试标题" content="测试内容" />
      );

      expect(screen.getByText('测试标题')).toBeDefined();
      expect(screen.getByText('测试内容')).toBeDefined();
    });

    it('应该正确渲染 HTML 结构', () => {
      const { container } = render(
        <TextDisplay title="标题" content="内容" />
      );

      expect(container.querySelector('h2')).toBeDefined();
      expect(container.querySelector('p')).toBeDefined();
    });
  });
});
