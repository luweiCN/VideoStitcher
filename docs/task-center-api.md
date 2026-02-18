# 任务中心 API 接口文档

## 一、IPC 通道列表

### 1.1 任务操作

| 通道 | 方向 | 描述 |
|------|------|------|
| `task:create` | 渲染→主 | 创建任务 |
| `task:update` | 渲染→主 | 更新任务 |
| `task:delete` | 渲染→主 | 删除任务 |
| `task:get` | 渲染→主 | 获取单个任务 |
| `task:list` | 渲染→主 | 获取任务列表 |
| `task:start` | 渲染→主 | 开始任务 |
| `task:pause` | 渲染→主 | 暂停任务 |
| `task:resume` | 渲染→主 | 恢复任务 |
| `task:cancel` | 渲染→主 | 取消任务 |
| `task:retry` | 渲染→主 | 重试任务 |
| `task:update-output-dir` | 渲染→主 | 更新输出目录 |

### 1.2 批量操作

| 通道 | 方向 | 描述 |
|------|------|------|
| `task:start-all` | 渲染→主 | 开始所有待执行任务 |
| `task:pause-all` | 渲染→主 | 暂停所有运行中任务 |
| `task:cancel-all` | 渲染→主 | 取消所有未完成任务 |
| `task:clear-completed` | 渲染→主 | 清除已完成任务 |
| `task:clear-failed` | 渲染→主 | 清除失败任务 |

### 1.3 配置

| 通道 | 方向 | 描述 |
|------|------|------|
| `task:get-config` | 渲染→主 | 获取配置 |
| `task:set-config` | 渲染→主 | 设置配置 |
| `task:get-cpu-info` | 渲染→主 | 获取 CPU 核心数信息 |

### 1.4 并发控制

| 通道 | 方向 | 描述 |
|------|------|------|
| `task:set-concurrency` | 渲染→主 | 实时设置并发数和线程数 |
| `task:get-queue-status` | 渲染→主 | 获取当前队列状态 |

### 1.5 事件（主进程 → 渲染进程）

| 通道 | 描述 |
|------|------|
| `task:created` | 任务创建事件 |
| `task:updated` | 任务更新事件 |
| `task:deleted` | 任务删除事件 |
| `task:started` | 任务开始事件 |
| `task:progress` | 任务进度事件 |
| `task:log` | 任务日志事件 |
| `task:completed` | 任务完成事件 |
| `task:failed` | 任务失败事件 |
| `task:cancelled` | 任务取消事件 |

---

## 二、请求/响应格式

### 2.1 创建任务

**通道**: `task:create`

**请求**:
```typescript
interface CreateTaskRequest {
  type: TaskType;
  name: string;
  outputDir: string;
  params: Record<string, unknown>;
  files: {
    path: string;
    category: string;
    categoryLabel: string;
  }[];
  priority?: number;
  maxRetry?: number;
}
```

**响应**:
```typescript
interface CreateTaskResponse {
  success: boolean;
  task?: Task;
  error?: string;
}
```

**示例**:
```typescript
// 渲染进程调用
const result = await window.api.createTask({
  type: 'video_merge',
  name: '横屏合成任务 1',
  outputDir: '/Users/xxx/output',
  params: {
    orientation: 'horizontal',
    aPosition: { x: 0, y: 0, width: 1920, height: 1080 },
    bPosition: { x: 0, y: 0, width: 1920, height: 1080 },
  },
  files: [
    { path: '/path/to/a.mp4', category: 'A', categoryLabel: 'A面' },
    { path: '/path/to/b.mp4', category: 'B', categoryLabel: 'B面' },
  ],
});

// result.task.id 可用于后续操作
```

---

### 2.2 获取任务列表

**通道**: `task:list`

**请求**:
```typescript
interface TaskListRequest {
  filter?: {
    status?: TaskStatus[];
    type?: TaskType[];
    search?: string;
    dateFrom?: number;
    dateTo?: number;
  };
  sort?: {
    field: 'createdAt' | 'updatedAt' | 'priority' | 'progress';
    order: 'asc' | 'desc';
  };
  page?: number;
  pageSize?: number;
  withFiles?: boolean;   // 是否包含文件列表
  withOutputs?: boolean; // 是否包含输出列表
}
```

**响应**:
```typescript
interface TaskListResponse {
  success: boolean;
  tasks: Task[];
  total: number;
  page: number;
  pageSize: number;
  stats?: {
    pending: number;
    queued: number;
    running: number;
    paused: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
}
```

---

### 2.3 开始任务

**通道**: `task:start`

**请求**:
```typescript
interface StartTaskRequest {
  taskId: string;
}
```

**响应**:
```typescript
interface StartTaskResponse {
  success: boolean;
  error?: string;
}
```

---

### 2.4 任务进度事件

**通道**: `task:progress`

**事件数据**:
```typescript
interface TaskProgressEvent {
  taskId: string;
  progress: number;      // 0-100
  step?: string;         // 当前步骤描述
  elapsed?: number;      // 已耗时（秒）
  eta?: number;          // 预计剩余时间（秒）
}
```

---

### 2.5 任务日志事件

**通道**: `task:log`

**事件数据**:
```typescript
interface TaskLogEvent {
  taskId: string;
  log: {
    id: string;
    timestamp: number;
    level: 'info' | 'warning' | 'error' | 'success' | 'debug';
    message: string;
    raw?: string;
  };
}
```

---

## 三、渲染进程 API 封装

### 3.1 Preload 暴露

```typescript
// src/preload/index.ts

import { contextBridge, ipcRenderer } from 'electron';

// 类型定义
export interface TaskAPI {
  // 任务 CRUD
  createTask: (request: CreateTaskRequest) => Promise<CreateTaskResponse>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<{ success: boolean; error?: string }>;
  deleteTask: (id: string) => Promise<{ success: boolean; error?: string }>;
  getTask: (id: string) => Promise<Task | null>;
  getTasks: (request: TaskListRequest) => Promise<TaskListResponse>;
  
  // 任务控制
  startTask: (id: string) => Promise<{ success: boolean; error?: string }>;
  pauseTask: (id: string) => Promise<{ success: boolean; error?: string }>;
  resumeTask: (id: string) => Promise<{ success: boolean; error?: string }>;
  cancelTask: (id: string) => Promise<{ success: boolean; error?: string }>;
  retryTask: (id: string) => Promise<{ success: boolean; error?: string }>;
  updateTaskOutputDir: (id: string, outputDir: string) => Promise<{ success: boolean; error?: string }>;
  
  // 批量操作
  startAllTasks: () => Promise<{ success: boolean; count: number }>;
  pauseAllTasks: () => Promise<{ success: boolean; count: number }>;
  cancelAllTasks: () => Promise<{ success: boolean; count: number }>;
  clearCompletedTasks: (beforeDays?: number) => Promise<{ success: boolean; count: number }>;
  clearFailedTasks: () => Promise<{ success: boolean; count: number }>;
  
  // 配置
  getTaskConfig: () => Promise<TaskCenterConfig>;
  setTaskConfig: (config: Partial<TaskCenterConfig>) => Promise<{ success: boolean }>;
  
  // 事件监听
  onTaskCreated: (callback: (task: Task) => void) => () => void;
  onTaskUpdated: (callback: (task: Task) => void) => () => void;
  onTaskDeleted: (callback: (id: string) => void) => () => void;
  onTaskStarted: (callback: (data: { taskId: string }) => void) => () => void;
  onTaskProgress: (callback: (event: TaskProgressEvent) => void) => () => void;
  onTaskLog: (callback: (event: TaskLogEvent) => void) => () => void;
  onTaskCompleted: (callback: (data: { taskId: string; outputs: TaskOutput[] }) => void) => () => void;
  onTaskFailed: (callback: (data: { taskId: string; error: TaskError }) => void) => () => void;
  onTaskCancelled: (callback: (data: { taskId: string }) => void) => () => void;
}

// 暴露到 window.api
contextBridge.exposeInMainWorld('api', {
  // ... 其他现有 API
  
  // 任务相关
  createTask: (request) => ipcRenderer.invoke('task:create', request),
  updateTask: (id, updates) => ipcRenderer.invoke('task:update', id, updates),
  deleteTask: (id) => ipcRenderer.invoke('task:delete', id),
  getTask: (id) => ipcRenderer.invoke('task:get', id),
  getTasks: (request) => ipcRenderer.invoke('task:list', request),
  
  startTask: (id) => ipcRenderer.invoke('task:start', id),
  pauseTask: (id) => ipcRenderer.invoke('task:pause', id),
  resumeTask: (id) => ipcRenderer.invoke('task:resume', id),
  cancelTask: (id) => ipcRenderer.invoke('task:cancel', id),
  retryTask: (id) => ipcRenderer.invoke('task:retry', id),
  updateTaskOutputDir: (id, outputDir) => ipcRenderer.invoke('task:update-output-dir', id, outputDir),
  
  startAllTasks: () => ipcRenderer.invoke('task:start-all'),
  pauseAllTasks: () => ipcRenderer.invoke('task:pause-all'),
  cancelAllTasks: () => ipcRenderer.invoke('task:cancel-all'),
  clearCompletedTasks: (beforeDays) => ipcRenderer.invoke('task:clear-completed', beforeDays),
  clearFailedTasks: () => ipcRenderer.invoke('task:clear-failed'),
  
  getTaskConfig: () => ipcRenderer.invoke('task:get-config'),
  setTaskConfig: (config) => ipcRenderer.invoke('task:set-config', config),
  
  // 事件监听
  onTaskCreated: (callback) => {
    const handler = (_: any, task: Task) => callback(task);
    ipcRenderer.on('task:created', handler);
    return () => ipcRenderer.removeListener('task:created', handler);
  },
  onTaskUpdated: (callback) => {
    const handler = (_: any, task: Task) => callback(task);
    ipcRenderer.on('task:updated', handler);
    return () => ipcRenderer.removeListener('task:updated', handler);
  },
  onTaskDeleted: (callback) => {
    const handler = (_: any, id: string) => callback(id);
    ipcRenderer.on('task:deleted', handler);
    return () => ipcRenderer.removeListener('task:deleted', handler);
  },
  onTaskStarted: (callback) => {
    const handler = (_: any, data: { taskId: string }) => callback(data);
    ipcRenderer.on('task:started', handler);
    return () => ipcRenderer.removeListener('task:started', handler);
  },
  onTaskProgress: (callback) => {
    const handler = (_: any, event: TaskProgressEvent) => callback(event);
    ipcRenderer.on('task:progress', handler);
    return () => ipcRenderer.removeListener('task:progress', handler);
  },
  onTaskLog: (callback) => {
    const handler = (_: any, event: TaskLogEvent) => callback(event);
    ipcRenderer.on('task:log', handler);
    return () => ipcRenderer.removeListener('task:log', handler);
  },
  onTaskCompleted: (callback) => {
    const handler = (_: any, data: { taskId: string; outputs: TaskOutput[] }) => callback(data);
    ipcRenderer.on('task:completed', handler);
    return () => ipcRenderer.removeListener('task:completed', handler);
  },
  onTaskFailed: (callback) => {
    const handler = (_: any, data: { taskId: string; error: TaskError }) => callback(data);
    ipcRenderer.on('task:failed', handler);
    return () => ipcRenderer.removeListener('task:failed', handler);
  },
  onTaskCancelled: (callback) => {
    const handler = (_: any, data: { taskId: string }) => callback(data);
    ipcRenderer.on('task:cancelled', handler);
    return () => ipcRenderer.removeListener('task:cancelled', handler);
  },
});
```

---

## 四、React Hook 封装

### 4.1 useTaskCenter

```typescript
// src/renderer/features/TaskCenter/hooks/useTaskCenter.ts

import { useState, useEffect, useCallback, useMemo } from 'react';

export interface UseTaskCenterOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useTaskCenter(options: UseTaskCenterOptions = {}) {
  const { autoRefresh = true, refreshInterval = 5000 } = options;
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 加载任务列表
  const loadTasks = useCallback(async () => {
    try {
      const result = await window.api.getTasks({
        withFiles: true,
        withOutputs: true,
      });
      
      if (result.success) {
        setTasks(result.tasks);
        setStats(result.stats ?? null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // 创建任务
  const createTask = useCallback(async (request: CreateTaskRequest) => {
    const result = await window.api.createTask(request);
    if (result.success && result.task) {
      setTasks(prev => [...prev, result.task!]);
    }
    return result;
  }, []);
  
  // 开始任务
  const startTask = useCallback(async (id: string) => {
    const result = await window.api.startTask(id);
    if (result.success) {
      setTasks(prev => prev.map(t => 
        t.id === id ? { ...t, status: 'queued' as const } : t
      ));
    }
    return result;
  }, []);
  
  // 暂停任务
  const pauseTask = useCallback(async (id: string) => {
    const result = await window.api.pauseTask(id);
    if (result.success) {
      setTasks(prev => prev.map(t => 
        t.id === id ? { ...t, status: 'paused' as const } : t
      ));
    }
    return result;
  }, []);
  
  // 取消任务
  const cancelTask = useCallback(async (id: string) => {
    const result = await window.api.cancelTask(id);
    if (result.success) {
      setTasks(prev => prev.filter(t => t.id !== id));
    }
    return result;
  }, []);
  
  // 删除任务
  const deleteTask = useCallback(async (id: string) => {
    const result = await window.api.deleteTask(id);
    if (result.success) {
      setTasks(prev => prev.filter(t => t.id !== id));
    }
    return result;
  }, []);
  
  // 监听事件
  useEffect(() => {
    const cleanups: (() => void)[] = [];
    
    // 任务创建
    cleanups.push(window.api.onTaskCreated((task) => {
      setTasks(prev => {
        if (prev.find(t => t.id === task.id)) return prev;
        return [...prev, task];
      });
    }));
    
    // 任务更新
    cleanups.push(window.api.onTaskUpdated((task) => {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
    }));
    
    // 任务删除
    cleanups.push(window.api.onTaskDeleted((id) => {
      setTasks(prev => prev.filter(t => t.id !== id));
    }));
    
    // 任务进度
    cleanups.push(window.api.onTaskProgress((event) => {
      setTasks(prev => prev.map(t => 
        t.id === event.taskId 
          ? { ...t, progress: event.progress, currentStep: event.step }
          : t
      ));
    }));
    
    // 任务完成
    cleanups.push(window.api.onTaskCompleted((data) => {
      setTasks(prev => prev.map(t => 
        t.id === data.taskId 
          ? { ...t, status: 'completed' as const, outputs: data.outputs }
          : t
      ));
    }));
    
    // 任务失败
    cleanups.push(window.api.onTaskFailed((data) => {
      setTasks(prev => prev.map(t => 
        t.id === data.taskId 
          ? { ...t, status: 'failed' as const, error: data.error }
          : t
      ));
    }));
    
    return () => cleanups.forEach(cleanup => cleanup());
  }, []);
  
  // 自动刷新
  useEffect(() => {
    if (!autoRefresh) return;
    
    const timer = setInterval(loadTasks, refreshInterval);
    return () => clearInterval(timer);
  }, [autoRefresh, refreshInterval, loadTasks]);
  
  // 初始加载
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);
  
  // 计算统计数据
  const computedStats = useMemo(() => {
    if (stats) return stats;
    
    return {
      pending: tasks.filter(t => t.status === 'pending').length,
      queued: tasks.filter(t => t.status === 'queued').length,
      running: tasks.filter(t => t.status === 'running').length,
      paused: tasks.filter(t => t.status === 'paused').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      cancelled: tasks.filter(t => t.status === 'cancelled').length,
    };
  }, [tasks, stats]);
  
  return {
    tasks,
    stats: computedStats,
    loading,
    error,
    refresh: loadTasks,
    createTask,
    startTask,
    pauseTask,
    resumeTask: async (id: string) => window.api.resumeTask(id),
    cancelTask,
    retryTask: async (id: string) => window.api.retryTask(id),
    deleteTask,
    startAllTasks: () => window.api.startAllTasks(),
    pauseAllTasks: () => window.api.pauseAllTasks(),
    cancelAllTasks: () => window.api.cancelAllTasks(),
    clearCompletedTasks: (beforeDays?: number) => window.api.clearCompletedTasks(beforeDays),
  };
}
```

### 4.2 useTaskLogs

```typescript
// src/renderer/features/TaskCenter/hooks/useTaskLogs.ts

import { useState, useEffect, useCallback, useRef } from 'react';

export function useTaskLogs(taskId: string | null) {
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    if (containerRef.current && autoScroll) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [autoScroll]);
  
  // 监听日志事件
  useEffect(() => {
    if (!taskId) {
      setLogs([]);
      return;
    }
    
    // 清空现有日志
    setLogs([]);
    
    // 监听新日志
    const cleanup = window.api.onTaskLog((event) => {
      if (event.taskId === taskId) {
        setLogs(prev => [...prev, event.log]);
        // 延迟滚动，等待 DOM 更新
        setTimeout(scrollToBottom, 0);
      }
    });
    
    return cleanup;
  }, [taskId, scrollToBottom]);
  
  // 用户手动滚动时禁用自动滚动
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    
    setAutoScroll(isAtBottom);
  }, []);
  
  return {
    logs,
    containerRef,
    autoScroll,
    setAutoScroll,
    handleScroll,
    scrollToBottom,
  };
}
```

---

## 五、错误码定义

| 错误码 | 描述 |
|--------|------|
| `TASK_NOT_FOUND` | 任务不存在 |
| `TASK_ALREADY_RUNNING` | 任务已在运行中 |
| `TASK_ALREADY_COMPLETED` | 任务已完成 |
| `TASK_ALREADY_CANCELLED` | 任务已取消 |
| `INVALID_OUTPUT_DIR` | 无效的输出目录 |
| `FILE_NOT_FOUND` | 素材文件不存在 |
| `FFMPEG_ERROR` | FFmpeg 执行错误 |
| `SHARP_ERROR` | Sharp 执行错误 |
| `UNKNOWN_ERROR` | 未知错误 |

---

## 六、使用示例

### 6.1 在功能模块中创建任务

```typescript
// VideoMergeMode.tsx

const handleAddToTaskCenter = async () => {
  if (!bVideos.length) {
    addLog('请先选择主视频', 'warning');
    return;
  }
  
  // 生成任务配置
  const taskRequest: CreateTaskRequest = {
    type: 'video_merge',
    name: `横屏合成 - ${new Date().toLocaleString()}`,
    outputDir,
    params: {
      orientation,
      aPosition: materialPositions.aVideo,
      bPosition: materialPositions.bVideo,
      bgPosition: materialPositions.bgImage,
      coverPosition: materialPositions.coverImage,
      concurrency,
    },
    files: tasks.map(task => ({
      path: task.files.find(f => f.category === 'B')?.path || '',
      category: 'B',
      categoryLabel: 'B面',
    })),
  };
  
  const result = await window.api.createTask(taskRequest);
  
  if (result.success) {
    addLog(`任务已添加到任务中心: ${result.task?.id}`, 'success');
    // 可选：显示跳转到任务中心的提示
  } else {
    addLog(`添加任务失败: ${result.error}`, 'error');
  }
};
```

### 6.2 在任务中心查看和操作任务

```typescript
// TaskCenter/index.tsx

const TaskCenter: React.FC = () => {
  const {
    tasks,
    stats,
    loading,
    startTask,
    pauseTask,
    cancelTask,
    deleteTask,
    startAllTasks,
    pauseAllTasks,
  } = useTaskCenter();
  
  // ...
  
  return (
    <div>
      {/* 统计卡片 */}
      <div className="flex gap-4">
        <StatCard label="待执行" value={stats.pending} />
        <StatCard label="执行中" value={stats.running} />
        <StatCard label="已完成" value={stats.completed} />
        <StatCard label="失败" value={stats.failed} />
      </div>
      
      {/* 任务列表 */}
      <div>
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onStart={() => startTask(task.id)}
            onPause={() => pauseTask(task.id)}
            onCancel={() => cancelTask(task.id)}
            onDelete={() => deleteTask(task.id)}
          />
        ))}
      </div>
    </div>
  );
};
```

---

## 七、并发控制 API

### 7.1 设置并发参数

**通道**: `task:set-concurrency`

**请求**:
```typescript
interface SetConcurrencyRequest {
  maxConcurrentTasks?: number;  // 最大同时执行任务数（1-8）
  threadsPerTask?: number;      // 每个任务使用的线程数
}
```

**响应**:
```typescript
interface SetConcurrencyResponse {
  success: boolean;
  config?: {
    maxConcurrentTasks: number;
    threadsPerTask: number;
  };
  error?: string;
}
```

**示例**:
```typescript
// 实时调整并发数
await window.api.setConcurrency({
  maxConcurrentTasks: 4,
  threadsPerTask: 2,
});
```

### 7.2 获取 CPU 信息

**通道**: `task:get-cpu-info`

**响应**:
```typescript
interface CpuInfoResponse {
  cores: number;              // CPU 核心数
  model: string;              // CPU 型号
  recommendedConcurrency: {
    maxConcurrentTasks: number;
    threadsPerTask: number;
  };
}
```

### 7.3 获取队列状态

**通道**: `task:get-queue-status`

**响应**:
```typescript
interface QueueStatusResponse {
  running: number;            // 正在运行的任务数
  queued: number;             // 队列中等待的任务数
  maxConcurrent: number;      // 最大并发数
  threadsPerTask: number;     // 每任务线程数
  totalThreads: number;       // 总线程使用量
}
```

---

## 八、TaskQueueManager 设计

### 8.1 核心接口

```typescript
// src/main/services/TaskQueueManager.ts

interface TaskQueueConfig {
  maxConcurrentTasks: number;
  threadsPerTask: number;
}

class TaskQueueManager {
  private config: TaskQueueConfig;
  private runningTasks: Map<string, TaskExecutor>;
  private queuedTasks: string[];
  private db: TaskRepository;
  
  constructor(config: TaskQueueConfig) {
    this.config = config;
    this.runningTasks = new Map();
    this.queuedTasks = [];
  }
  
  /**
   * 实时更新并发配置
   */
  updateConfig(config: Partial<TaskQueueConfig>): void {
    if (config.maxConcurrentTasks !== undefined) {
      this.config.maxConcurrentTasks = config.maxConcurrentTasks;
    }
    if (config.threadsPerTask !== undefined) {
      this.config.threadsPerTask = config.threadsPerTask;
    }
    
    // 尝试启动更多任务（如果有空位）
    this.tryStartNext();
  }
  
  /**
   * 添加任务到队列
   */
  enqueue(taskId: string): void {
    const task = this.db.getTaskById(taskId);
    if (!task) return;
    
    // 更新状态为 queued
    this.db.updateTaskStatus(taskId, 'queued');
    
    // 加入队列
    this.queuedTasks.push(taskId);
    
    // 尝试启动
    this.tryStartNext();
  }
  
  /**
   * 尝试启动下一个任务
   */
  private tryStartNext(): void {
    while (
      this.runningTasks.size < this.config.maxConcurrentTasks &&
      this.queuedTasks.length > 0
    ) {
      const taskId = this.queuedTasks.shift();
      if (taskId) {
        this.startTask(taskId);
      }
    }
  }
  
  /**
   * 启动单个任务
   */
  private async startTask(taskId: string): Promise<void> {
    const task = this.db.getTaskById(taskId);
    if (!task) return;
    
    // 创建执行器
    const executor = new TaskExecutor(task, {
      threads: this.config.threadsPerTask,
      onProgress: (progress, step) => {
        this.db.updateTaskProgress(taskId, progress, step);
        this.sendProgressEvent(taskId, progress, step);
      },
      onLog: (log) => {
        this.db.addLog(taskId, log);
        this.sendLogEvent(taskId, log);
      },
      onComplete: (outputs) => {
        this.db.updateTaskStatus(taskId, 'completed');
        this.db.addOutputs(taskId, outputs);
        this.runningTasks.delete(taskId);
        this.sendCompletedEvent(taskId, outputs);
        this.tryStartNext();
      },
      onError: (error) => {
        this.db.updateTaskStatus(taskId, 'failed', { error });
        this.runningTasks.delete(taskId);
        this.sendFailedEvent(taskId, error);
        this.tryStartNext();
      },
    });
    
    // 保存执行器引用
    this.runningTasks.set(taskId, executor);
    
    // 更新状态
    this.db.updateTaskStatus(taskId, 'running');
    this.sendStartedEvent(taskId);
    
    // 开始执行
    executor.execute();
  }
  
  /**
   * 暂停任务
   */
  pause(taskId: string): boolean {
    const executor = this.runningTasks.get(taskId);
    if (executor) {
      executor.pause();
      this.db.updateTaskStatus(taskId, 'paused');
      return true;
    }
    return false;
  }
  
  /**
   * 恢复任务
   */
  resume(taskId: string): boolean {
    const executor = this.runningTasks.get(taskId);
    if (executor) {
      executor.resume();
      this.db.updateTaskStatus(taskId, 'running');
      return true;
    }
    return false;
  }
  
  /**
   * 取消任务
   */
  cancel(taskId: string): boolean {
    // 如果在运行中
    const executor = this.runningTasks.get(taskId);
    if (executor) {
      executor.cancel();
      this.runningTasks.delete(taskId);
      this.db.updateTaskStatus(taskId, 'cancelled');
      this.tryStartNext();
      return true;
    }
    
    // 如果在队列中
    const index = this.queuedTasks.indexOf(taskId);
    if (index > -1) {
      this.queuedTasks.splice(index, 1);
      this.db.updateTaskStatus(taskId, 'cancelled');
      return true;
    }
    
    return false;
  }
  
  /**
   * 获取队列状态
   */
  getStatus(): QueueStatusResponse {
    return {
      running: this.runningTasks.size,
      queued: this.queuedTasks.length,
      maxConcurrent: this.config.maxConcurrentTasks,
      threadsPerTask: this.config.threadsPerTask,
      totalThreads: this.runningTasks.size * this.config.threadsPerTask,
    };
  }
}
```

---

## 九、TaskExecutor 设计（FFmpeg/Sharp 线程控制）

### 9.1 FFmpeg 执行器

```typescript
// src/main/services/executors/FfmpegExecutor.ts

interface FfmpegConfig {
  threads: number;  // 使用线程数
}

class FfmpegExecutor {
  private process: ChildProcess | null = null;
  private paused: boolean = false;
  private cancelled: boolean = false;
  
  constructor(
    private task: Task,
    private config: FfmpegConfig,
    private callbacks: ExecutorCallbacks
  ) {}
  
  async execute(): Promise<void> {
    const args = this.buildArgs();
    
    this.process = spawn(ffmpegPath, args);
    
    this.process.stdout?.on('data', (data) => {
      this.parseProgress(data.toString());
    });
    
    this.process.stderr?.on('data', (data) => {
      this.callbacks.onLog({
        level: 'info',
        message: data.toString(),
      });
    });
    
    this.process.on('close', (code) => {
      if (this.cancelled) {
        // 已取消，不触发回调
        return;
      }
      
      if (code === 0) {
        this.callbacks.onComplete(this.getOutputs());
      } else {
        this.callbacks.onError({
          code: 'FFMPEG_ERROR',
          message: `FFmpeg 退出码: ${code}`,
        });
      }
    });
  }
  
  /**
   * 构建 FFmpeg 参数（包含线程数）
   */
  private buildArgs(): string[] {
    const args: string[] = [];
    
    // 输入文件
    args.push('-i', this.getInputPath());
    
    // 线程数控制（关键）
    args.push('-threads', String(this.config.threads));
    
    // 编码器线程数
    args.push('-thread_queue_size', '512');
    
    // 输出配置
    args.push('-c:v', 'libx264');
    args.push('-preset', 'fast');
    
    // 其他参数...
    
    // 输出文件
    args.push('-y', this.getOutputPath());
    
    return args;
  }
  
  pause(): void {
    this.paused = true;
    // FFmpeg 不支持原生暂停，通过发送 SIGSTOP 信号
    if (this.process?.pid) {
      process.kill(this.process.pid, 'SIGSTOP');
    }
  }
  
  resume(): void {
    this.paused = false;
    // 恢复进程
    if (this.process?.pid) {
      process.kill(this.process.pid, 'SIGCONT');
    }
  }
  
  cancel(): void {
    this.cancelled = true;
    if (this.process) {
      this.process.kill('SIGKILL');
    }
  }
}
```

### 9.2 Sharp 执行器

```typescript
// src/main/services/executors/SharpExecutor.ts

import sharp from 'sharp';

interface SharpConfig {
  threads: number;
}

class SharpExecutor {
  constructor(
    private task: Task,
    private config: SharpConfig,
    private callbacks: ExecutorCallbacks
  ) {}
  
  async execute(): Promise<void> {
    const { inputPath, outputPath } = this.getPaths();
    
    // 设置并发线程数
    sharp.concurrency(this.config.threads);
    
    try {
      const pipeline = sharp(inputPath);
      
      // 应用处理参数
      this.applyTransforms(pipeline);
      
      // 执行处理
      await pipeline.toFile(outputPath);
      
      this.callbacks.onComplete([{
        path: outputPath,
        type: 'image',
      }]);
    } catch (err) {
      this.callbacks.onError({
        code: 'SHARP_ERROR',
        message: (err as Error).message,
      });
    }
  }
  
  pause(): void {
    // Sharp 不支持暂停，建议在任务级别处理
    console.warn('Sharp 任务不支持暂停');
  }
  
  resume(): void {
    console.warn('Sharp 任务不支持暂停/恢复');
  }
  
  cancel(): void {
    // Sharp 取消需要在 Promise 层面处理
    // 可以使用 AbortController（Node.js 15+）
  }
}
```

---

## 十、IPC 处理器实现

```typescript
// src/main/ipc/task.ts

import { ipcMain } from 'electron';
import os from 'os';
import { TaskQueueManager } from '../services/TaskQueueManager';
import { ConfigRepository } from '../database/repositories/config.repository';

let queueManager: TaskQueueManager | null = null;

export function registerTaskHandlers(): void {
  const configRepo = new ConfigRepository();
  
  // 初始化队列管理器
  queueManager = new TaskQueueManager({
    maxConcurrentTasks: configRepo.get('maxConcurrentTasks') ?? 2,
    threadsPerTask: configRepo.get('threadsPerTask') ?? 4,
  });
  
  // 设置并发参数（实时生效）
  ipcMain.handle('task:set-concurrency', async (_, config) => {
    try {
      queueManager?.updateConfig(config);
      
      // 同时保存到配置
      if (config.maxConcurrentTasks !== undefined) {
        configRepo.set('maxConcurrentTasks', config.maxConcurrentTasks);
      }
      if (config.threadsPerTask !== undefined) {
        configRepo.set('threadsPerTask', config.threadsPerTask);
      }
      
      return {
        success: true,
        config: {
          maxConcurrentTasks: queueManager?.getStatus().maxConcurrent,
          threadsPerTask: queueManager?.getStatus().threadsPerTask,
        },
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
  
  // 获取 CPU 信息
  ipcMain.handle('task:get-cpu-info', async () => {
    const cores = os.cpus().length;
    const model = os.cpus()[0]?.model ?? 'Unknown';
    
    return {
      cores,
      model,
      recommendedConcurrency: {
        maxConcurrentTasks: Math.max(1, Math.floor(cores / 4)),
        threadsPerTask: Math.max(1, cores - 1),
      },
    };
  });
  
  // 获取队列状态
  ipcMain.handle('task:get-queue-status', async () => {
    return queueManager?.getStatus() ?? {
      running: 0,
      queued: 0,
      maxConcurrent: 2,
      threadsPerTask: 4,
      totalThreads: 0,
    };
  });
  
  // ... 其他处理器
}
```
