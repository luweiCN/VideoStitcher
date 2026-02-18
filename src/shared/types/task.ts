/**
 * 任务相关共享类型定义
 * 在主进程和渲染进程之间共享
 */

// ==================== 任务状态 ====================

export type TaskStatus =
  | 'pending'   // 待执行
  | 'running'   // 执行中
  | 'completed' // 已完成
  | 'failed'    // 失败
  | 'cancelled'; // 已取消

// ==================== 任务类型 ====================

export type TaskType =
  | 'video_merge'    // 横竖屏极速合成
  | 'video_stitch'   // A+B 前后拼接
  | 'video_resize'   // 智能改尺寸
  | 'image_material' // 图片素材处理
  | 'cover_format'   // 封面格式转换
  | 'cover_compress' // 封面压缩
  | 'lossless_grid'; // 专业无损九宫格

// ==================== 任务文件 ====================

/**
 * 任务文件
 * 与数据库 task_files 表字段一致
 */
export interface TaskFile {
  id?: string;
  path: string;
  index?: number;
  category: string;
  category_name: string;
  sortOrder?: number;
}

// ==================== 单个任务 ====================

/**
 * 单个任务（前端预览 + 批量创建 + 数据库存储共用）
 * 每个任务是独立的个体，包含所有必要信息
 */
export interface Task {
  id: string;
  /** 任务类型 */
  type?: TaskType;
  /** 任务状态 */
  status: TaskStatus;
  /** 任务文件 */
  files: TaskFile[];
  /** 任务配置（如处理模式、位置信息等） */
  config?: Record<string, unknown>;
  /** 输出目录 */
  outputDir?: string;
  /** 错误信息 */
  error?: TaskError;
  
  // 以下为数据库持久化字段（可选）
  /** 任务名称（可选，显示时可根据 type 映射） */
  name?: string;
  /** 优先级 */
  priority?: number;
  /** 创建时间 */
  createdAt?: number;
  /** 更新时间 */
  updatedAt?: number;
  /** 开始时间 */
  startedAt?: number;
  /** 完成时间 */
  completedAt?: number;
  /** 执行时间（毫秒） */
  executionTime?: number;
  /** 进度 0-100 */
  progress?: number;
  /** 当前步骤描述 */
  currentStep?: string;
  /** 重试次数 */
  retryCount?: number;
  /** 最大重试次数 */
  maxRetry?: number;
  /** 输出文件列表 */
  outputs?: TaskOutput[];
  /** 执行进程 PID */
  pid?: number;
  /** 进程启动时间（用于防止 PID 复用） */
  pidStartedAt?: number;
}

// ==================== 任务错误 ====================

export interface TaskError {
  code?: string;
  message: string;
  stack?: string;
}

// ==================== 任务输出 ====================

export interface TaskOutput {
  id?: string;
  path: string;
  type: 'video' | 'image' | 'other';
  size?: number;
  createdAt?: number;
}

// ==================== 批量创建任务请求 ====================

/**
 * 批量创建任务请求
 * 直接使用前端已生成的 Task 格式
 */
export interface BatchCreateTaskRequest {
  tasks: Task[];
}

// ==================== 批量创建任务响应 ====================

export interface BatchCreateTaskResponse {
  success: boolean;
  tasks: Task[];
  successCount: number;
  failCount: number;
  errors?: Array<{ index: number; error: string }>;
  error?: string;
}

// ==================== 日志级别 ====================

export type LogLevel = 'info' | 'warning' | 'error' | 'success' | 'debug';

// ==================== 任务日志 ====================

export interface TaskLog {
  id: string;
  taskId: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  raw?: string;
}

// ==================== 任务进度事件 ====================

export interface TaskProgressEvent {
  taskId: string;
  progress: number;
  step?: string;
  elapsed?: number;
  eta?: number;
}

// ==================== 任务日志事件 ====================

export interface TaskLogEvent {
  taskId: string;
  log: TaskLog;
}

// ==================== 队列状态 ====================

export interface QueueStatus {
  running: number;
  queued: number;
  pending: number;
  completed: number;
  maxConcurrent: number;
  threadsPerTask: number;
  totalThreads: number;
}

// ==================== CPU 信息 ====================

export interface CpuInfo {
  cores: number;
  model: string;
  recommendedConcurrency: {
    maxConcurrentTasks: number;
    threadsPerTask: number;
  };
}

// ==================== 数据库统计 ====================

export interface DatabaseStats {
  fileSize: number;
  taskCount: number;
  logCount: number;
  outputCount: number;
  oldestTask: number | null;
  newestTask: number | null;
}

// ==================== 备份信息 ====================

export interface BackupInfo {
  name: string;
  path: string;
  size: number;
  time: number;
}

// ==================== 完整性检查结果 ====================

export interface IntegrityCheckResult {
  healthy: boolean;
  errors: string[];
  canRepair: boolean;
}

// ==================== 任务类型显示名称 ====================

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  video_merge: '横竖屏极速合成',
  video_stitch: 'A+B 前后拼接',
  video_resize: '智能改尺寸',
  image_material: '图片素材处理',
  cover_format: '封面格式转换',
  cover_compress: '封面压缩',
  lossless_grid: '专业无损九宫格',
};

// ==================== 任务状态显示名称 ====================

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: '待执行',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

// ==================== 任务统计 ====================

export interface TaskStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  totalExecutionTime?: number; // 已完成任务的总执行时间（毫秒）
}

// ==================== 任务中心配置 ====================

export interface TaskCenterConfig {
  // 并发控制
  maxConcurrentTasks: number;
  threadsPerTask: number;
  
  // 运行状态
  isPaused: boolean;           // 任务中心是否暂停
  totalRunTime: number;        // 任务中心累计运行时间（毫秒）
  sessionStartTime: number | null;  // 当前会话开始时间
  
  // 自动化选项
  autoStartTasks: boolean;
  autoRetryFailed: boolean;
  maxRetryCount: number;
  showNotification: boolean;
  
  // 清理和备份
  keepCompletedDays: number;
  autoBackup: boolean;
  maxBackupCount: number;
}

// ==================== 默认配置 ====================

export const DEFAULT_TASK_CENTER_CONFIG: TaskCenterConfig = {
  // 并发控制
  maxConcurrentTasks: 2,
  threadsPerTask: 4,
  
  // 运行状态
  isPaused: false,
  totalRunTime: 0,
  sessionStartTime: null,
  
  // 自动化选项
  autoStartTasks: true,
  autoRetryFailed: false,
  maxRetryCount: 3,
  showNotification: true,
  
  // 清理和备份
  keepCompletedDays: 7,
  autoBackup: true,
  maxBackupCount: 5,
};

// ==================== 创建任务请求 ====================

export interface CreateTaskRequest {
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
  threads?: number;
}

// ==================== 创建任务响应 ====================

export interface CreateTaskResponse {
  success: boolean;
  task?: Task;
  error?: string;
}

// ==================== 任务筛选 ====================

export interface TaskFilter {
  status?: TaskStatus[];
  type?: TaskType[];
  search?: string;
  dateFrom?: number;
  dateTo?: number;
}

// ==================== 任务排序 ====================

export interface TaskSort {
  field: 'createdAt' | 'updatedAt' | 'priority' | 'progress';
  order: 'asc' | 'desc';
}

// ==================== 任务列表选项 ====================

export interface TaskListOptions {
  filter?: TaskFilter;
  sort?: TaskSort;
  page?: number;
  pageSize?: number;
  withFiles?: boolean;
  withOutputs?: boolean;
}

// ==================== 任务列表结果 ====================

export interface TaskListResult {
  success: boolean;
  tasks: Task[];
  total: number;
  page: number;
  pageSize: number;
  stats?: TaskStats;
}
