/**
 * useConfirm Hook
 * 提供 Promise 风格的确认对话框调用方式
 *
 * 使用示例：
 * const confirm = useConfirm();
 * const result = await confirm({
 *   title: '确认删除',
 *   message: '确定要删除这个项目吗？',
 *   variant: 'danger'
 * });
 * if (result) { ... }
 */

import { useCallback } from 'react';
import { useConfirmDialog } from '@renderer/components/ConfirmDialog/ConfirmDialogProvider';

export interface ConfirmOptions {
  /** 标题 */
  title: string;
  /** 消息内容 */
  message: string;
  /** 确认按钮文本 */
  confirmText?: string;
  /** 取消按钮文本 */
  cancelText?: string;
  /** 变体样式 */
  variant?: 'danger' | 'warning' | 'info';
}

/**
 * 确认对话框 Hook
 * 返回一个 confirm 函数，调用时显示确认对话框并返回 Promise
 */
export function useConfirm() {
  const { showConfirm } = useConfirmDialog();

  const confirm = useCallback(
    (options: ConfirmOptions): Promise<boolean> => {
      return showConfirm(options);
    },
    [showConfirm]
  );

  return confirm;
}
