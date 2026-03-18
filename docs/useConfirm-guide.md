# useConfirm Hook 使用指南

## 概述

`useConfirm` 是一个 Promise 风格的确认对话框 Hook，提供简洁的 API 来显示确认对话框。

## 安装

`ConfirmDialogProvider` 已在 `App.tsx` 中全局注册，无需额外配置。

## 基础用法

```typescript
import { useConfirm } from '@renderer/hooks/useConfirm';

function MyComponent() {
  const confirm = useConfirm();

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: '确认删除',
      message: '确定要删除这个项目吗？此操作无法撤销。',
      variant: 'danger',
    });

    if (confirmed) {
      // 用户点击确认
      await deleteProject();
    } else {
      // 用户点击取消
      console.log('取消删除');
    }
  };

  return (
    <button onClick={handleDelete}>删除项目</button>
  );
}
```

## API

### useConfirm()

返回一个 `confirm` 函数。

### confirm(options: ConfirmOptions): Promise<boolean>

显示确认对话框并返回 Promise。

**参数:**

```typescript
interface ConfirmOptions {
  /** 标题 */
  title: string;

  /** 消息内容 */
  message: string;

  /** 确认按钮文本（默认：'确认'） */
  confirmText?: string;

  /** 取消按钮文本（默认：'取消'） */
  cancelText?: string;

  /** 变体样式（默认：'warning'） */
  variant?: 'danger' | 'warning' | 'info';
}
```

**返回值:**
- `true` - 用户点击确认按钮
- `false` - 用户点击取消按钮或关闭对话框

## 变体样式

### danger - 危险操作（红色）
用于删除、销毁等不可逆操作。

```typescript
await confirm({
  title: '确认删除项目',
  message: '此操作将删除所有数据，且无法恢复。',
  variant: 'danger',
});
```

### warning - 警告操作（橙色）
用于重要但可恢复的操作。

```typescript
await confirm({
  title: '确认清空缓存',
  message: '清空缓存后需要重新下载数据。',
  variant: 'warning',
});
```

### info - 提示信息（蓝色）
用于一般提示。

```typescript
await confirm({
  title: '确认退出',
  message: '您有未保存的更改，确定要退出吗？',
  variant: 'info',
});
```

## 完整示例

```typescript
import { useConfirm } from '@renderer/hooks/useConfirm';
import { useToastMessages } from '@renderer/components/Toast';

function ProjectCard({ project, onDelete }) {
  const confirm = useConfirm();
  const toast = useToastMessages();

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: '确认删除项目',
      message: `确定要删除项目「${project.name}」吗？此操作将删除所有相关的创意方向、人设和剧本数据，且无法恢复。`,
      confirmText: '确认删除',
      cancelText: '取消',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      await onDelete(project.id);
      toast.success('项目已删除');
    } catch (error) {
      toast.error(`删除失败: ${error.message}`);
    }
  };

  return (
    <div>
      <h3>{project.name}</h3>
      <button onClick={handleDelete}>删除</button>
    </div>
  );
}
```

## 优势

相比传统的 `window.confirm()`：

1. **Promise 接口** - 支持 async/await，代码更简洁
2. **可自定义** - 支持自定义标题、消息、按钮文本
3. **多种样式** - 三种视觉变体适配不同场景
4. **UI 一致** - 使用项目统一的设计风格
5. **更好的用户体验** - 模糊背景、动画效果

## 注意事项

- 确保在 `ConfirmDialogProvider` 包裹的组件内使用
- `confirm` 函数返回 Promise，需要使用 `await` 或 `.then()`
- 对话框会阻塞 UI，直到用户响应
