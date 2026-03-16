import { describe, it, expect } from 'vitest';

/**
 * 示例单元测试
 * 测试基本的工具函数
 */

describe('基础工具函数测试', () => {
  it('应该正确验证数字', () => {
    const isValidNumber = (value: unknown): value is number => {
      return typeof value === 'number' && !isNaN(value);
    };

    expect(isValidNumber(123)).toBe(true);
    expect(isValidNumber(0)).toBe(true);
    expect(isValidNumber(-1)).toBe(true);
    expect(isValidNumber(NaN)).toBe(false);
    expect(isValidNumber('123')).toBe(false);
    expect(isValidNumber(null)).toBe(false);
    expect(isValidNumber(undefined)).toBe(false);
  });

  it('应该正确格式化持续时间', () => {
    const formatDuration = (seconds: number): string => {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    expect(formatDuration(60)).toBe('1:00');
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(120)).toBe('2:00');
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(30)).toBe('0:30');
  });

  it('应该正确生成唯一 ID', () => {
    const generateId = (): string => {
      return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    };

    const id1 = generateId();
    const id2 = generateId();

    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
    expect(typeof id1).toBe('string');
    expect(typeof id2).toBe('string');
  });

  it('应该正确验证文件扩展名', () => {
    const isValidVideoExtension = (filename: string): boolean => {
      const validExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
      const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
      return validExtensions.includes(ext);
    };

    expect(isValidVideoExtension('video.mp4')).toBe(true);
    expect(isValidVideoExtension('video.MP4')).toBe(true);
    expect(isValidVideoExtension('video.mov')).toBe(true);
    expect(isValidVideoExtension('video.txt')).toBe(false);
    expect(isValidVideoExtension('video.jpg')).toBe(false);
    expect(isValidVideoExtension('video')).toBe(false);
  });

  it('应该正确截断文本', () => {
    const truncateText = (text: string, maxLength: number): string => {
      if (text.length <= maxLength) return text;
      return text.slice(0, maxLength - 3) + '...';
    };

    expect(truncateText('短文本', 10)).toBe('短文本');
    expect(truncateText('这是一个很长的文本内容', 10)).toBe('这是一个很长的...');
    expect(truncateText('', 10)).toBe('');
    expect(truncateText('正好十个字符的文本', 10)).toBe('正好十个字符的文本');
  });
});
