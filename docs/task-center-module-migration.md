# 任务中心 - 功能模块迁移指南

本文档记录了将功能模块从「直接执行」改造为「添加到任务中心」过程中遇到的问题和解决方案。

## 一、整体架构

```
前端模块 (VideoMergeMode.tsx)
    ↓ batchCreateTasks(tasks)
TaskContext (React Context)
    ↓ window.api.batchCreateTasks(tasks)
Preload (IPC Bridge)
    ↓ ipcRenderer.invoke('task:batch-create', tasks)
IPC Handler (task.ts)
    ↓ taskRepository.createTask()
数据库 (SQLite)
    ↓
TaskQueueManager
    ↓ executeSingleMergeTask()
video.ts (单任务执行)
    ↓
FFmpeg
```

## 二、遇到的问题及解决方案

### 问题 1：数据库未初始化错误

**错误信息：**
```
Error: 数据库未初始化，请先调用 initDatabase()
```

**原因：**
TaskQueueManager 在模块加载时就创建了单例，构造函数中调用了 `configRepository.getAll()`，但此时数据库还未初始化。

**错误代码：**
```typescript
// TaskQueueManager.ts
export class TaskQueueManager {
  constructor() {
    this.config = configRepository.getAll(); // ❌ 数据库未初始化
  }
}
```

**解决方案：**
使用延迟初始化模式：

```typescript
export class TaskQueueManager {
  private config: TaskCenterConfig | null = null;
  private initialized: boolean = false;

  constructor() {
    // 构造函数中不访问数据库
  }

  init(): void {
    if (this.initialized) return;
    this.config = configRepository.getAll();
    this.initialized = true;
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.config) {
      this.config = { ...DEFAULT_TASK_CENTER_CONFIG };
    }
  }
}

// 主进程初始化时调用
initDatabase();
taskQueueManager.init(); // ✅ 数据库初始化后再初始化 TaskQueueManager
```

### 问题 2：better-sqlite3 编译版本不匹配

**错误信息：**
```
The module 'better-sqlite3/build/Release/better_sqlite3.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 127. This version of Node.js requires
NODE_MODULE_VERSION 123.
```

**原因：**
better-sqlite3 是原生模块，需要针对 Electron 的 Node.js 版本重新编译。

**解决方案：**
```bash
# 安装 @electron/rebuild
npm install @electron/rebuild --save-dev

# 重新编译 better-sqlite3
npx @electron/rebuild -f -w better-sqlite3
```

### 问题 3：任务执行时 files 为空数组

**错误信息：**
```
[executeSingleMergeTask] files: []
[executeSingleMergeTask] 缺少B面视频，files: []
```

**原因：**
`taskRepository.getTaskById()` 返回的 task 对象不包含 `files` 字段，files 存储在单独的 `task_files` 表中，需要单独加载。

**错误代码：**
```typescript
// TaskQueueManager.ts
private async startTask(taskId: string): Promise<void> {
  const task = taskRepository.getTaskById(taskId);
  // task.files 是 [] 或 undefined ❌
  await this.executeTask(task, executor);
}
```

**解决方案：**
在启动任务时加载 files：

```typescript
private async startTask(taskId: string): Promise<void> {
  const task = taskRepository.getTaskById(taskId);
  if (!task) return;

  // 加载文件列表 ✅
  task.files = taskRepository.getTaskFiles(taskId);

  await this.executeTask(task, executor);
}
```

### 问题 4：类型字段名不一致

**问题描述：**
前端 Task 类型使用的字段名与数据库字段名不一致：
- 前端 `config` vs 数据库 `params`
- 前端 `category_name` vs 数据库 `category_label`

**解决方案：**
1. 在共享类型文件中定义统一的 Task 类型
2. Repository 层负责字段映射

```typescript
// task.repository.ts
createTask(input: { config, files, ... }) {
  // 存储时：config → params
  stmt.run(..., JSON.stringify(input.config || {}), ...);
  
  // 存储时：category_name → category_label
  stmt.run(..., file.category_name, ...);
}

getTaskFiles(taskId: string): TaskFile[] {
  // 读取时：category_label → category_name
  return rows.map((row) => ({
    category_name: row.category_label as string,
  }));
}

mapRowToTask(row): Task {
  // 读取时：params → config
  config: JSON.parse(row.params as string),
}
```

### 问题 5：旧的 IPC 函数未清理

**问题描述：**
旧的 `handleVideoMerge`、`handleHorizontalMerge`、`handleVerticalMerge` 函数已经废弃，但还保留在代码中，造成混淆。

**解决方案：**
1. 删除废弃的函数
2. 删除对应的 IPC 注册
3. 删除 preload 中的 API
4. 删除类型定义

删除的函数：
- `handleVideoMerge` - 统一视频合成（多任务）
- `handleHorizontalMerge` - 横屏合成
- `handleVerticalMerge` - 竖屏合成

保留的函数：
- `executeSingleMergeTask` - 单任务执行（供 TaskQueueManager 调用）

## 三、迁移步骤模板

以下是将功能模块迁移到任务中心的步骤：

### 步骤 1：修改导入

```typescript
// 移除
import { useVideoProcessingEvents } from "../hooks/useVideoProcessingEvents";
import { Play } from "lucide-react";

// 添加
import { useTaskContext } from "../contexts/TaskContext";
import { Plus } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
```

### 步骤 2：替换状态变量

```typescript
// 移除
const [isProcessing, setIsProcessing] = useState(false);

// 添加
const { batchCreateTasks } = useTaskContext();
const [isAdding, setIsAdding] = useState(false);
const [showConfirmDialog, setShowConfirmDialog] = useState(false);
```

### 步骤 3：移除事件监听

```typescript
// 删除整个 useVideoProcessingEvents 调用
useVideoProcessingEvents({
  onStart: (data) => { ... },
  onTaskStart: (data) => { ... },
  onProgress: (data) => { ... },
  onFailed: (data) => { ... },
  onFinish: (data) => { ... },
  onLog: (data) => { ... },
});
```

### 步骤 4：替换处理函数

```typescript
// 删除
const startProcessing = async () => {
  setIsProcessing(true);
  await window.api.videoMerge(tasksWithConfig);
  setIsProcessing(false);
};

// 添加
const addToTaskCenter = async () => {
  if (tasks.length === 0) {
    addLog("没有可处理的任务", "warning");
    return;
  }
  if (!outputDir) {
    addLog("请先选择输出目录", "warning");
    return;
  }

  setIsAdding(true);
  addLog(`正在添加 ${tasks.length} 个任务到任务中心...`, "info");

  try {
    // 给每个任务添加 type 和 outputDir
    const tasksWithType = tasks.map((task) => ({
      ...task,
      type: 'video_merge' as const,  // 改为对应类型
      outputDir,
      config: {
        ...task.config,
        // 添加必要的配置
      },
    }));

    const result = await batchCreateTasks(tasksWithType);

    if (result.successCount > 0) {
      addLog(`成功添加 ${result.successCount} 个任务到任务中心`, "success");
      setShowConfirmDialog(true);
    }
    if (result.failCount > 0) {
      addLog(`${result.failCount} 个任务添加失败`, "warning");
    }
  } catch (err: any) {
    addLog(`添加任务失败: ${err.message || err}`, "error");
  } finally {
    setIsAdding(false);
  }
};

// 清空编辑区域
const clearEditor = () => {
  // 清空所有状态
  setTasks([]);
  addLog("已清空编辑区域", "info");
};
```

### 步骤 5：替换 UI

```tsx
// 移除
<Button
  onClick={startProcessing}
  disabled={tasks.length === 0 || isProcessing || !outputDir}
  loading={isProcessing}
  leftIcon={!isProcessing && <Play className="w-4 h-4" />}
>
  {isProcessing ? "处理中..." : "开始处理"}
</Button>

// 添加
<Button
  onClick={addToTaskCenter}
  disabled={tasks.length === 0 || isAdding || !outputDir}
  loading={isAdding}
  leftIcon={!isAdding && <Plus className="w-4 h-4" />}
>
  {isAdding ? "添加中..." : "添加到任务中心"}
</Button>

{/* 确认清空对话框 */}
<ConfirmDialog
  open={showConfirmDialog}
  title="任务已添加"
  message="是否清空编辑区域？"
  confirmText="清空"
  cancelText="保留"
  type="success"
  onConfirm={() => {
    clearEditor();
    setShowConfirmDialog(false);
  }}
  onCancel={() => setShowConfirmDialog(false)}
/>
```

### 步骤 6：更新禁用状态

```tsx
// 所有使用 isProcessing 的地方改为 isAdding
<OutputDirSelector disabled={isAdding} />
<ConcurrencySelector disabled={isAdding} />
<TaskList isProcessing={isAdding} />
```

## 四、任务类型对照表

| 功能模块 | 任务类型 (TaskType) |
|---------|-------------------|
| 横竖屏合成 | `video_merge` |
| A+B拼接 | `video_stitch` |
| 智能改尺寸 | `video_resize` |
| 图片素材处理 | `image_material` |
| 封面格式转换 | `cover_format` |
| 封面压缩 | `cover_compress` |
| 无损九宫格 | `lossless_grid` |

## 五、待完成的工作

### 需要迁移的模块
- [ ] ResizeMode.tsx - 智能改尺寸
- [ ] VideoStitcherMode.tsx - A+B拼接
- [ ] ImageMaterialMode.tsx - 图片素材处理
- [ ] CoverFormatMode.tsx - 封面格式转换
- [ ] CoverCompressMode.tsx - 封面压缩
- [ ] LosslessGridMode.tsx - 无损九宫格

### 需要实现的执行器
- [ ] `executeResizeTask` - 智能改尺寸执行器
- [ ] `executeStitchTask` - A+B拼接执行器
- [ ] `executeImageTask` - 图片任务执行器

## 六、注意事项

1. **重新编译后要测试**：由于 better-sqlite3 是原生模块，每次重新安装依赖或切换 Node 版本后都需要重新编译

2. **清理旧代码**：迁移完成后要删除旧的 IPC 处理函数和 preload API，避免代码混乱

3. **类型一致性**：确保前端 Task 类型和数据库存储格式一致，Repository 层负责映射

4. **files 必须加载**：从数据库获取 task 后，必须单独调用 `getTaskFiles()` 加载文件列表

5. **配置可选**：任务类型 `video_merge` 等使用小写加下划线格式
