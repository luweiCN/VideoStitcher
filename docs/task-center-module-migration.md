# 任务中心 - 功能模块迁移指南

本文档记录了将功能模块从「直接执行」改造为「添加到任务中心」过程中遇到的问题和解决方案。

## 零、快速改造检查清单

改造一个模块时，按以下检查清单逐项确认：

### 需要移除的内容
- [ ] `isProcessing` 状态 → 改为 `isAdding`
- [ ] `progress` 状态（done/failed/total）
- [ ] `useVideoProcessingEvents` 或 `useImageProcessingEvents` hook
- [ ] `startProcessing()` 函数
- [ ] 进度显示 UI（进度条、进度文字等）
- [ ] `window.api.videoResize()` / `window.api.videoMerge()` 等直接处理调用
- [ ] `Play` 图标 import（改为 `Plus`）
- [ ] `ConcurrencySelector` 组件（并发数在任务中心设置）

### 需要添加的内容
- [ ] `import { useTaskContext } from "../contexts/TaskContext"`
- [ ] `import { Plus } from "lucide-react"`
- [ ] `import TaskAddedDialog from "../components/TaskAddedDialog"`
- [ ] `import TaskCountConfirmDialog from "../components/TaskCountConfirmDialog"`
- [ ] `import { useNavigate } from "react-router-dom"`
- [ ] `const { batchCreateTasks } = useTaskContext()`
- [ ] `const [isAdding, setIsAdding] = useState(false)`
- [ ] `const [showConfirmDialog, setShowConfirmDialog] = useState(false)`
- [ ] `const [showCountConfirmDialog, setShowCountConfirmDialog] = useState(false)`
- [ ] `addToTaskCenter()` 函数
- [ ] `doAddToTaskCenter()` 函数（核心逻辑）
- [ ] `clearEditor()` 函数
- [ ] `TaskAddedDialog` 组件
- [ ] `TaskCountConfirmDialog` 组件（任务超过100时）

### 需要修改的内容
- [ ] 按钮文字：`开始处理` → `添加到任务中心`
- [ ] 按钮图标：`Play` → `Plus`
- [ ] 按钮状态：`isProcessing` → `isAdding`
- [ ] 禁用状态：`disabled={isProcessing}` → `disabled={isAdding}`
- [ ] TaskList 组件：移除 `isProcessing` prop

---

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

### 步骤 0：准备工作

1. 确认模块的任务类型（TaskType）：
   - `video_merge` - 横竖屏极速合成
   - `video_resize` - 智能改尺寸
   - `video_stitch` - A+B 前后拼接
   - `image_material` - 图片素材处理
   - `cover_format` - 封面格式转换
   - `cover_compress` - 封面压缩
   - `lossless_grid` - 专业无损九宫格

2. 确认任务数据结构：`files` 字段必须包含 `category`、`category_name`（显示名）、`path`

### 步骤 1：修改导入

```typescript
// 移除
import { useVideoProcessingEvents } from "../hooks/useVideoProcessingEvents";
import { Play } from "lucide-react";
import ConcurrencySelector from "@/components/ConcurrencySelector";

// 添加
import { useNavigate } from "react-router-dom";
import { useTaskContext } from "../contexts/TaskContext";
import { Plus } from "lucide-react";
import TaskAddedDialog from "../components/TaskAddedDialog";
import TaskCountConfirmDialog from "../components/TaskCountConfirmDialog";
```

### 步骤 2：替换状态变量

```typescript
// 移除
const [isProcessing, setIsProcessing] = useState(false);
const [progress, setProgress] = useState({ done: 0, failed: 0, total: 0 });

// 添加
const navigate = useNavigate();
const { batchCreateTasks } = useTaskContext();
const [isAdding, setIsAdding] = useState(false);
const [showConfirmDialog, setShowConfirmDialog] = useState(false);
const [showCountConfirmDialog, setShowCountConfirmDialog] = useState(false);
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

// 添加（完整示例，包含二次确认和清空逻辑）
// 核心添加逻辑
const doAddToTaskCenter = async () => {
  setIsAdding(true);
  addLog(`正在添加 ${tasks.length} 个任务到任务中心...`, "info");

  try {
    // 给每个任务添加 type 和 outputDir
    const tasksWithType = tasks.map((task) => ({
      ...task,
      type: 'video_resize' as const,  // ⚠️ 改为对应类型
      outputDir,
      config: {
        ...task.config,
        // 添加必要的配置（如 mode、blurAmount 等）
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

// 入口函数（含校验和二次确认）
const addToTaskCenter = async () => {
  // 前置校验
  if (tasks.length === 0) {
    addLog("请先选择要处理的文件", "warning");
    return;
  }
  if (!outputDir) {
    addLog("请先选择输出目录", "warning");
    return;
  }

  // 任务数量超过100时显示确认弹窗
  if (tasks.length > 100) {
    setShowCountConfirmDialog(true);
  } else {
    await doAddToTaskCenter();
  }
};

// 清空编辑区域
const clearEditor = () => {
  // 清空文件选择器
  fileSelectorGroupRef.current?.clearAll();
  // 清空本地状态
  setTasks([]);
  setCurrentIndex(0);
  addLog("已清空编辑区域", "info");
};
```

### 步骤 5：替换 UI

```tsx
// 移除进度显示
{progress.total > 0 && (
  <div className="...">
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">已完成</span>
      <span className="text-rose-400 font-bold">{progress.done}/{progress.total}</span>
    </div>
    <div className="w-full bg-slate-800 rounded-full h-2">
      <div className="bg-rose-500 h-2 rounded-full" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
    </div>
  </div>
)}

// 移除旧的按钮
<Button
  onClick={startProcessing}
  disabled={tasks.length === 0 || isProcessing || !outputDir}
  loading={isProcessing}
  leftIcon={!isProcessing && <Play className="w-4 h-4" />}
>
  {isProcessing ? "处理中..." : "开始处理"}
</Button>

// 添加新的按钮和弹窗
<Button
  onClick={addToTaskCenter}
  disabled={tasks.length === 0 || isAdding || !outputDir}
  variant="primary"
  size="md"
  fullWidth
  loading={isAdding}
  leftIcon={!isAdding && <Plus className="w-4 h-4" />}
>
  {isAdding ? "添加中..." : "添加到任务中心"}
</Button>

{/* 任务添加成功弹窗 */}
<TaskAddedDialog
  open={showConfirmDialog}
  taskCount={tasks.length}
  onClear={() => {
    clearEditor();
    setShowConfirmDialog(false);
  }}
  onKeep={() => setShowConfirmDialog(false)}
  onTaskCenter={() => {
    setShowConfirmDialog(false);
    navigate('/taskCenter');
  }}
/>

{/* 任务数量确认弹窗（超过100个时） */}
<TaskCountConfirmDialog
  open={showCountConfirmDialog}
  taskCount={tasks.length}
  onConfirm={() => {
    setShowCountConfirmDialog(false);
    doAddToTaskCenter();
  }}
  onCancel={() => setShowCountConfirmDialog(false)}
/>
```

### 步骤 6：更新禁用状态

```tsx
// 所有使用 isProcessing 的地方改为 isAdding
<FileSelector disabled={isAdding} />
<OutputDirSelector disabled={isAdding} />

// 移除 ConcurrencySelector（并发数在任务中心统一设置）
// <ConcurrencySelector ... />  // 删除

// TaskList 移除 isProcessing prop
<TaskList
  tasks={tasks}
  // isProcessing={isProcessing}  // 删除这行
  onTaskChange={setCurrentIndex}
/>
```

### 步骤 7：清理未使用的变量

删除所有未使用的变量和 import：
- `concurrency` 状态
- `useConcurrencyCache` hook
- 进度相关变量

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

### 已迁移的模块
- [x] VideoMergeMode.tsx - 横竖屏极速合成 ✅ 2024-02
- [x] ResizeMode.tsx - 智能改尺寸 ✅ 2024-02

### 需要迁移的模块
- [ ] VideoStitcherMode.tsx - A+B拼接 ⬅️ 下一个
- [ ] ImageMaterialMode.tsx - 图片素材处理
- [ ] CoverFormatMode.tsx - 封面格式转换
- [ ] CoverCompressMode.tsx - 封面压缩
- [ ] LosslessGridMode.tsx - 无损九宫格

### 需要实现的执行器
- [x] `executeSingleMergeTask` - 极速合成执行器 ✅
- [x] `executeResizeTask` - 智能改尺寸执行器 ✅
- [ ] `executeStitchTask` - A+B拼接执行器
- [ ] `executeImageTask` - 图片任务执行器

## 六、注意事项

1. **重新编译后要测试**：由于 better-sqlite3 是原生模块，每次重新安装依赖或切换 Node 版本后都需要重新编译

2. **清理旧代码**：迁移完成后要删除旧的 IPC 处理函数和 preload API，避免代码混乱

3. **类型一致性**：确保前端 Task 类型和数据库存储格式一致，Repository 层负责映射

4. **files 必须加载**：从数据库获取 task 后，必须单独调用 `getTaskFiles()` 加载文件列表

5. **配置可选**：任务类型 `video_merge` 等使用小写加下划线格式

6. **并发数移除**：迁移后的模块不再需要 ConcurrencySelector，并发数在任务中心统一设置

7. **进度显示移除**：迁移后的模块不再需要进度条等 UI，进度在任务中心查看

8. **状态类型映射**：Task 的状态类型与旧组件可能不一致，需要做映射：
   - `failed` → `error`
   - `running` → `processing`  
   - `cancelled` → `pending`（或其他合适状态）

9. **类型重命名冲突**：如果模块有与任务类型同名的类型（如 ResizeMode），需要重命名避免冲突：
   ```typescript
   // 旧代码
   type ResizeMode = 'siya' | 'fishing' | 'unify_h' | 'unify_v';
   
   // 新代码（重命名避免与 TaskType.ResizeMode 冲突）
   type ResizeModeType = 'siya' | 'fishing' | 'unify_h' | 'unify_v';
   ```

10. **Task id 类型**：TaskList 组件的 Task.id 是 number 类型，但旧代码可能使用 string：
    ```typescript
    // 旧代码
    id: `resize-${Date.now()}-${index}`  // string
    
    // 新代码
    id: index + 1  // number
    ```

11. **PreviewArea 状态映射**：如果使用 PreviewArea 组件，需要将 Task.status 映射为组件期望的状态：
    ```typescript
    status: (currentTask.status === 'failed' ? 'error' : 
             currentTask.status === 'running' ? 'processing' : 
             currentTask.status === 'cancelled' ? 'pending' : 
             currentTask.status) as 'pending' | 'completed' | 'error' | 'processing' | 'waiting'
    ```

12. **使用共享 Task 类型**：⚠️ **重要** - 在 preload 和 electron.d.ts 中定义函数签名时，必须使用共享的 `Task` 类型，而不是手动重新定义结构：
    ```typescript
    // ❌ 错误做法 - 重新定义结构
    generateResizeTasks: (config: {...}) => Promise<{
      success: boolean;
      tasks: Array<{
        id: number;
        status: string;
        files: Array<{ path: string; category: string }>;
        config: { mode: string };
        outputDir: string;
      }>;
    }>;
    
    // ✅ 正确做法 - 使用共享类型
    import type { Task } from '@shared/types/task';
    
    generateResizeTasks: (config: {...}) => Promise<{
      success: boolean;
      tasks: Task[];
    }>;
    ```
    这确保了类型定义的一致性，避免因手动定义导致的类型不匹配问题。

13. **任务生成使用 IPC**：⚠️ **重要** - 任务生成应该通过 IPC 在主进程完成，而不是在渲染进程：
    ```typescript
    // ❌ 错误做法 - 在渲染进程生成
    const generateTasks = useCallback((filePaths: string[]) => {
      const newTasks = filePaths.map((path, index) => ({
        id: index + 1,
        status: 'pending',
        // ...
      }));
      setTasks(newTasks);
    }, []);
    
    // ✅ 正确做法 - 通过 IPC 在主进程生成
    const generateTasks = useCallback(async () => {
      const result = await window.api.generateResizeTasks({
        videos,
        mode,
        blurAmount,
        outputDir,
      });
      if (result.success && result.tasks) {
        setTasks(result.tasks as Task[]);
      }
    }, [videos, mode, blurAmount, outputDir]);
    ```
    
    主进程需要添加对应的 IPC 处理器：
    ```typescript
    // src/main/ipc/taskGenerator.ts
    function generateResizeTasks(_event, params: ResizeTaskParams): { success: boolean; tasks: Task[] } {
      const { videos, mode, blurAmount, outputDir } = params;
      const tasks: Task[] = videos.map((path, index) => ({
        id: generateTempId(),
        status: 'pending',
        files: [{ path, category: 'V', category_name: '视频' }],
        config: { mode, blurAmount },
        outputDir,
      }));
      return { success: true, tasks };
    }
    
    ipcMain.handle("task:generate-resize", generateResizeTasks);
    ```

---

## 七、改造记录

### ResizeMode（智能改尺寸）- 2024-02

**改造内容：**

**1. 主进程 IPC 处理器** (`src/main/ipc/taskGenerator.ts`)
- 添加 `ResizeTaskParams` 接口
- 添加 `generateResizeTasks` 函数，在主进程生成任务
- 注册 `task:generate-resize` IPC 处理器

**2. 任务执行器** (`src/main/ipc/video.ts`)
- 添加 `executeResizeTask` 函数，供 TaskQueueManager 调用
- 使用 `generateFileName` 防止文件名重复
- 使用 `SafeOutput` 原子性输出，防止覆盖
- 支持每个视频输出多个尺寸（siya/fishing 模式输出2个，unify_h/unify_v 输出1个）
- 每次 FFmpeg 启动都回调 PID（智能改尺寸串行执行多个 FFmpeg）

**3. 任务队列管理器** (`src/main/services/TaskQueueManager.ts`)
- 导入 `executeResizeTask`
- 在 switch 语句中添加 `video_resize` 类型处理
- 添加 `executeResizeTaskMethod` 方法
- 添加日志显示线程数和并发任务数

**4. Preload API** (`src/preload/index.ts`)
- 添加 `generateResizeTasks` API，使用共享 `Task[]` 类型

**5. 类型声明** (`src/renderer/types/electron.d.ts`)
- 添加 `generateResizeTasks` 类型声明，使用共享 `Task[]` 类型

**6. 前端模块** (`src/renderer/features/ResizeMode.tsx`)
- 移除：`useVideoProcessingEvents`、`isProcessing`、`progress`、`ConcurrencySelector`
- 添加：`isAdding`、`videos` 状态，`generateTasks` IPC 调用
- 添加 `pendingBlurAmount` 状态，滑块松开后才触发任务生成
- 添加 `TaskAddedDialog`、`TaskCountConfirmDialog` 组件
- 任务通过 IPC 在主进程生成，参数变化时自动重新生成

**7. 滤镜优化** (`src/shared/ffmpeg/resize.ts`)
- 优化模糊滤镜：先缩小 2 倍 → 模糊 → 放大回来
- 模糊值相应缩小（blurAmount/2），在小分辨率上保持相同的模糊效果
- 性能提升约 4 倍，同时保持画质细腻

**8. 进程监控优化** (`src/main/services/ProcessMonitor.ts`)
- 在调用 pidusage 前过滤掉不存在的进程
- 静默处理进程不存在错误

**遇到的问题：**
1. 类型 `ResizeMode` 与任务类型冲突，需要重命名为 `ResizeModeType`
2. Task.id 类型不匹配，需要改为 number
3. PreviewArea 组件的 status 类型与 Task.status 不完全一致，需要映射
4. **重要发现**：preload 和 electron.d.ts 中的函数签名应该使用共享的 `Task[]` 类型，而不是手动定义结构
5. **重要发现**：任务生成应该通过 IPC 在主进程完成，确保任务数据独立完整
6. **重要发现**：任务执行器需要使用 `generateFileName` 防重复和 `SafeOutput` 防覆盖
7. 滑块拖动中不应触发任务生成，需要使用临时状态 `pendingBlurAmount`，在 `onValueCommit` 时才更新真正的值
8. 智能改尺寸串行执行多个 FFmpeg，每个都需回调 PID
9. `boxblur` 对全分辨率模糊非常耗时，优化为缩小→模糊→放大
