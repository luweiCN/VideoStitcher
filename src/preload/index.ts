import { contextBridge } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
import type { Task } from '../shared/types/task';

const ipcRenderer = electronAPI.ipcRenderer;

export interface ElectronAPI {
  // 文件对话框
  pickFiles: (
    title: string,
    filters?: { name: string; extensions: string[] }[],
    multiSelection?: boolean,
  ) => Promise<string[]>;
  pickOutDir: (defaultPath?: string) => Promise<string>;

  // === 视频处理 API ===
  videoStitchAB: (tasks: {
    files: { path: string; category: string }[];
    config?: {
      orientation: "landscape" | "portrait";
    };
    outputDir: string;
    concurrency?: number;
  }[]) => Promise<{ done: number; failed: number; total: number; elapsed?: string }>;
  videoResize: (config: {
    videos: string[];
    mode: "siya" | "fishing" | "unify_h" | "unify_v";
    blurAmount?: number;
    outputDir: string;
    concurrency?: number;
  }) => Promise<{ done: number; failed: number; total: number }>;

  // === 图片处理 API ===
  getCpuCount: () => Promise<{
    success: boolean;
    cpuCount?: number;
    error?: string;
  }>;
  imageCompress: (config: {
    images: string[];
    targetSizeKB?: number;
    outputDir: string;
    concurrency?: number;
  }) => Promise<{
    done: number;
    failed: number;
    total: number;
    results: any[];
  }>;
  imageCoverFormat: (config: {
    images: string[];
    quality?: number;
    outputDir: string;
  }) => Promise<{
    done: number;
    failed: number;
    total: number;
    results: any[];
  }>;
  imageGrid: (config: { images: string[]; outputDir: string; concurrency?: number }) => Promise<{
    done: number;
    failed: number;
    total: number;
    results: any[];
  }>;
  imageMaterial: (config: {
    images: string[];
    logoPath?: string;
    outputDir: string;
    previewSize?: "inside" | "cover" | "fill" | "pad";
    logoPosition?: { x: number; y: number };
    logoScale?: number;
    exportOptions?: { single: boolean; grid: boolean };
    concurrency?: number;
  }) => Promise<{
    done: number;
    failed: number;
    total: number;
    results: any[];
  }>;
  previewImageMaterial: (config: {
    imagePath: string;
    logoPath?: string;
    previewSize?: "inside" | "cover" | "fill" | "pad";
    logoPosition?: { x: number; y: number };
    logoScale?: number;
  }) => Promise<{
    success: boolean;
    preview?: string;
    logo?: string;
    grid?: any[];
    error?: string;
  }>;

  // === 预览功能 API ===
  generateStitchPreview: (config: {
    aPath: string;
    bPath: string;
    orientation: "landscape" | "portrait";
    aDuration?: number;
    bDuration?: number;
  }) => Promise<{ success: boolean; tempPath?: string; error?: string; elapsed?: string }>;
  deleteTempPreview: (tempPath: string) => Promise<{ success: boolean; error?: string }>;
  previewHorizontal: (config: {
    aVideo?: string;
    bVideo: string;
    bgImage?: string;
    coverImage?: string;
  }) => Promise<{ success: boolean; previewPath?: string; error?: string }>;
  previewVertical: (config: {
    mainVideo: string;
    bgImage?: string;
    aVideo?: string;
  }) => Promise<{ success: boolean; previewPath?: string; error?: string }>;
  previewMergeFast: (config: {
    bVideo: string;
    aVideo?: string;
    bgImage?: string;
    coverImage?: string;
    orientation: "horizontal" | "vertical";
    aPosition?: { x: number; y: number; width: number; height: number };
    bPosition?: { x: number; y: number; width: number; height: number };
    coverPosition?: { x: number; y: number; width: number; height: number };
  }) => Promise<{ success: boolean; previewPath?: string; error?: string; elapsed?: string }>;
  clearPreviews: () => Promise<{ success: boolean; error?: string }>;
  generateResizePreviews: (config: {
    videoPath: string;
    mode: "siya" | "fishing" | "unify_h" | "unify_v";
    blurAmount: number;
  }) => Promise<{
    success: boolean;
    previews?: Array<{
      path: string;
      width: number;
      height: number;
      label: string;
    }>;
    error?: string;
  }>;
  clearResizePreviews: (previewPaths: string[]) => Promise<{ success: boolean; error?: string }>;
  getPreviewUrl: (filePath: string) => Promise<{ success: boolean; url: string; error?: string }>;
  getFileInfo: (filePath: string) => Promise<{
    success: boolean;
    info?: { name: string; size: number; type: string; ext: string };
    error?: string;
  }>;
  getVideoMetadata: (filePath: string) => Promise<{ width: number; height: number; duration: number }>;
  getImageDimensions: (filePath: string) => Promise<{
    width: number;
    height: number;
    orientation: "landscape" | "portrait" | "square";
    aspectRatio: string;
  } | null>;
  getImageFullInfo: (filePath: string, options?: { thumbnailMaxSize?: number }) => Promise<{
    success: boolean;
    path: string;
    name: string;
    thumbnail: string | null;
    previewUrl: string | null;
    width: number | null;
    height: number | null;
    orientation: "landscape" | "portrait" | "square" | null;
    aspectRatio: string | null;
    fileSize: number | null;
    error?: string;
  }>;
  getVideoDimensions: (filePath: string) => Promise<{
    width: number;
    height: number;
    orientation: "landscape" | "portrait" | "square";
    aspectRatio: string;
    duration: number;
  } | null>;
  getPreviewThumbnail: (filePath: string, maxSize?: number) => Promise<{
    success: boolean;
    thumbnail?: string;
    width?: number;
    height?: number;
    error?: string;
  }>;
  getVideoThumbnail: (filePath: string, options?: {
    timeOffset?: number;
    maxSize?: number;
  }) => Promise<{
    success: boolean;
    thumbnail?: string;
    duration?: number;
    actualTimeOffset?: number;
    error?: string;
  }>;
  getVideoFullInfo: (filePath: string, options?: {
    thumbnailMaxSize?: number;
  }) => Promise<{
    success: boolean;
    path: string;
    name: string;
    thumbnail?: string | null;
    fileSize?: number | null;
    width?: number | null;
    height?: number | null;
    duration?: number | null;
    orientation?: 'landscape' | 'portrait' | 'square' | null;
    aspectRatio?: string | null;
    error?: string;
  }>;

  // === 事件监听 ===
  onJobStart: (callback: (data: { total: number; orientation: string; concurrency: number }) => void) => () => void;
  onJobTaskStart: (callback: (data: { index: number }) => void) => () => void;
  onJobLog: (callback: (data: { msg: string }) => void) => () => void;
  onJobProgress: (callback: (data: { done: number; failed: number; total: number; index: number; outPath: string }) => void) => () => void;
  onJobFailed: (callback: (data: { done: number; failed: number; total: number; index: number; error: string }) => void) => () => void;
  onJobFinish: (callback: (data: { done: number; failed: number; total: number }) => void) => () => void;

  onVideoStart: (callback: (data: { total: number; mode: string; concurrency: number }) => void) => () => void;
  onVideoTaskStart: (callback: (data: { index: number; videoIndex?: number; videoId?: string; taskId?: string }) => void) => () => void;
  onVideoProgress: (callback: (data: { done: number; failed: number; total: number; index: number; videoId?: string; outputs?: string[] }) => void) => () => void;
  onVideoFailed: (callback: (data: { done: number; failed: number; total: number; index: number; videoId?: string; error: string }) => void) => () => void;
  onVideoFinish: (callback: (data: { done: number; failed: number; total: number; elapsed?: string }) => void) => () => void;
  onVideoLog: (callback: (data: { index: number; videoId?: string; message: string }) => void) => () => void;

  onImageStart: (callback: (data: { total: number; mode: string }) => void) => () => void;
  onImageTaskStart: (callback: (data: { index: number; taskId?: string }) => void) => () => void;
  onImageProgress: (callback: (data: { done: number; failed: number; total: number; current: string; result?: any }) => void) => () => void;
  onImageFailed: (callback: (data: { done: number; failed: number; total: number; current: string; error: string }) => void) => () => void;
  onImageFinish: (callback: (data: { done: number; failed: number; total: number }) => void) => () => void;
  onImageTaskFinish: (callback: (data: { index: number }) => void) => () => void;

  onPreviewStart: (callback: (data: { mode: string }) => void) => () => void;
  onPreviewComplete: (callback: (data: { previewPath: string }) => void) => () => void;
  onPreviewError: (callback: (data: { error: string }) => void) => () => void;
  onPreviewLog: (callback: (data: { message: string }) => void) => () => void;

  removeAllListeners: (channel: string) => void;

  // === 全局配置 API ===
  getGlobalSettings: () => Promise<{ defaultOutputDir?: string; defaultConcurrency?: number }>;
  setGlobalSettings: (settings: { defaultOutputDir?: string; defaultConcurrency?: number }) => Promise<{ success: boolean; error?: string }>;

  // === 自动更新 API ===
  getAppVersion: () => Promise<{ version: string; isDevelopment: boolean }>;
  getDefaultDownloadDir: () => Promise<string>;
  getSystemMemory: () => Promise<{ total: number; free: number; used: number; totalGB: string; freeGB: string; usedGB: string }>;
  getCpuUsage: () => Promise<{ usage: number; cores: number }>;
  getCpuCoresUsage: () => Promise<{ cores: number[]; total: number }>;
  getSystemStats: () => Promise<{
    cpu: { usage: number; cores: number[] };
    memory: { total: number; free: number; used: number; usedPercent: number; totalGB: string; freeGB: string; usedGB: string };
  }>;
  getTaskProcessStats: () => Promise<{
    processes: Array<{ pid: number; name: string; cpu: number; memory: number; memoryMB: string }>;
    totalCpu: number;
    totalMemory: number;
    totalMemoryMB: string;
  }>;
  checkForUpdates: () => Promise<{ success: boolean; hasUpdate?: boolean; updateInfo?: any; error?: string }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => Promise<{ success: boolean; error?: string }>;
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;

  // macOS 应用内更新 API
  macSetUpdateInfo: (updateInfo: { version: string; releaseDate: string; releaseNotes: string }) => Promise<{ success: boolean; error?: string }>;
  macCheckForUpdates: () => Promise<{ success: boolean; hasUpdate?: boolean; updateInfo?: any; error?: string }>;
  macDownloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  macInstallUpdate: () => Promise<{ success: boolean; error?: string }>;

  // 自动更新事件
  onUpdateChecking: (callback: () => void) => () => void;
  onUpdateAvailable: (callback: (data: { version: string; releaseDate: string; releaseNotes: string }) => void) => () => void;
  onUpdateNotAvailable: (callback: (data: { version: string }) => void) => () => void;
  onUpdateError: (callback: (data: { message: string }) => void) => () => void;
  onUpdateDownloadProgress: (callback: (data: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => () => void;
  onUpdateDownloaded: (callback: (data: { version: string; releaseDate: string; releaseNotes: string }) => void) => () => void;

  // === 授权 API ===
  getMachineId: () => Promise<{ success: boolean; machineId?: string; error?: string }>;
  checkLicense: (params?: { forceRefresh?: boolean }) => Promise<{
    authorized: boolean;
    developmentMode?: boolean;
    userInfo?: { user: string; machineId: string };
    reason?: string;
    usedCache?: boolean;
    offlineMode?: boolean;
    licenseVersion?: string;
    updatedAt?: string;
    offline?: boolean;
  }>;
  getLicenseInfo: () => Promise<{
    authorized: boolean;
    developmentMode?: boolean;
    userInfo?: { user: string; machineId: string };
    reason?: string;
    licenseVersion?: string;
    updatedAt?: string;
  }>;
  onLicenseStatusChanged: (callback: (data: any) => void) => () => void;
  getPlatform: () => Promise<{ platform: string; arch: string }>;

  // === 文件操作 API ===
  batchRenameFiles: (config: { operations: Array<{ sourcePath: string; targetName: string }> }) => Promise<{
    success: number;
    failed: number;
    errors: Array<{ file: string; error: string }>;
  }>;
  readDirectory: (config: {
    dirPath: string;
    includeHidden?: boolean;
    recursive?: boolean;
    maxDepth?: number;
    extensions?: Array<string>;
  }) => Promise<{
    success: boolean;
    files?: Array<{ path: string; name: string; isDirectory: boolean }>;
    error?: string;
  }>;
  checkPathType: (filePath: string) => Promise<{ success: boolean; isDirectory?: boolean; isFile?: boolean; error?: string }>;
  showItemInFolder: (path: string) => Promise<void>;
  openPath: (path: string) => Promise<void>;
  pathExists: (path: string) => Promise<{ exists: boolean }>;
  pathsExists: (paths: string[]) => Promise<Record<string, boolean>>;

  onFileStart: (callback: (data: { total: number; sessionId: string }) => void) => () => void;
  onFileProgress: (callback: (data: {
    index: number;
    total: number;
    sourcePath: string;
    targetPath?: string;
    success: boolean;
    error?: string;
  }) => void) => () => void;
  onFileComplete: (callback: (data: { success: number; failed: number; errors: Array<{ file: string; error: string }> }) => void) => () => void;

  // === 任务生成 API ===
  generateStitchTasks: (config: {
    aPaths: string[];
    bPaths: string[];
    count: number;
    outputDir: string;
    concurrency: number;
    orientation: "landscape" | "portrait";
  }) => Promise<{
    success: boolean;
    tasks: Array<{
      id: string;
      status: string;
      files: Array<{ path: string; index: number; category: string; category_name: string }>;
      config: { orientation: string };
      outputDir: string;
      concurrency: number;
    }>;
  }>;
  generateMergeTasks: (config: {
    bVideos: string[];
    aVideos?: string[];
    covers?: string[];
    bgImages?: string[];
    count: number;
    outputDir: string;
    concurrency: number;
    orientation: "horizontal" | "vertical";
  }) => Promise<{
    success: boolean;
    tasks: Array<{
      id: string;
      status: string;
      files: Array<{ path: string; index: number; category: string; category_name: string }>;
      config: { orientation: string };
      outputDir: string;
      concurrency: number;
    }>;
  }>;

  // === 任务中心 API ===
  createTask: (request: {
    type: string;
    name: string;
    outputDir: string;
    params: Record<string, unknown>;
    files: { path: string; category: string; categoryLabel: string }[];
    priority?: number;
    maxRetry?: number;
    threads?: number;
  }) => Promise<{ success: boolean; task?: any; error?: string }>;
  batchCreateTasks: (tasks: Task[]) => Promise<{ success: boolean; tasks: any[]; successCount: number; failCount: number; errors?: { index: number; error: string }[]; error?: string }>;
  getTask: (taskId: string) => Promise<any | null>;
  getTasks: (options?: {
    filter?: {
      status?: string[];
      type?: string[];
      search?: string;
      dateFrom?: number;
      dateTo?: number;
    };
    sort?: { field: string; order: 'asc' | 'desc' };
    page?: number;
    pageSize?: number;
    withFiles?: boolean;
    withOutputs?: boolean;
  }) => Promise<{ success: boolean; tasks: any[]; total: number; page: number; pageSize: number; stats?: any }>;
  deleteTask: (taskId: number) => Promise<{ success: boolean; error?: string }>;
  updateTaskOutputDir: (taskId: number, outputDir: string) => Promise<{ success: boolean; error?: string }>;
  startTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
  pauseTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
  resumeTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
  cancelTask: (taskId: number) => Promise<{ success: boolean; error?: string }>;
  retryTask: (taskId: number) => Promise<{ success: boolean; error?: string }>;
  startAllTasks: () => Promise<{ success: boolean; count: number }>;
  pauseAllTasks: () => Promise<{ success: boolean; count: number }>;
  cancelAllTasks: () => Promise<{ success: boolean; count: number }>;
  clearCompletedTasks: (beforeDays?: number) => Promise<{ success: boolean; count: number }>;
  clearFailedTasks: () => Promise<{ success: boolean; count: number }>;
  getTaskConfig: () => Promise<any>;
  setTaskConfig: (config: Record<string, any>) => Promise<{ success: boolean }>;
  setConcurrency: (config: { maxConcurrentTasks?: number; threadsPerTask?: number }) => Promise<{ success: boolean; config?: any; error?: string }>;
  getCpuInfo: () => Promise<{ cores: number; model: string; recommendedConcurrency: { maxConcurrentTasks: number; threadsPerTask: number } }>;
  getQueueStatus: () => Promise<{ running: number; queued: number; pending: number; completed: number; maxConcurrent: number; threadsPerTask: number; totalThreads: number }>;
  getTaskLogs: (taskId: number, options?: { limit?: number; offset?: number }) => Promise<any[]>;
  getRecentLogs: (limit?: number) => Promise<Array<{ id: number; taskId: number; timestamp: number; level: string; message: string; taskType?: string }>>;

  // 任务中心事件
  onTaskCreated: (callback: (task: any) => void) => () => void;
  onTaskUpdated: (callback: (task: any) => void) => () => void;
  onTaskDeleted: (callback: (id: number) => void) => () => void;
  onTaskStarted: (callback: (data: { taskId: number }) => void) => () => void;
  onTaskProgress: (callback: (data: { taskId: number; progress: number; step?: string }) => void) => () => void;
  onTaskLog: (callback: (data: { taskId: number; log: any }) => void) => () => void;
  onTaskCompleted: (callback: (data: { taskId: number; outputs: any[] }) => void) => () => void;
  onTaskFailed: (callback: (data: { taskId: number; error: any }) => void) => () => void;
  onTaskCancelled: (callback: (data: { taskId: number }) => void) => () => void;

  // 任务中心广播事件（新版）
  onTaskCenterState: (callback: (state: {
    isPaused: boolean;
    runningCount: number;
    queuedCount: number;
    taskStats: { pending: number; queued: number; running: number; paused: number; completed: number; failed: number; cancelled: number };
    runningTasks: any[];
    systemStats: {
      cpu: { usage: number; cores: number[] };
      memory: { total: number; used: number; usedPercent: number; totalGB: string; usedGB: string };
      processes: {
        processes: Array<{ pid: number; name: string; cpu: number; memory: number; memoryMB: string }>;
        totalCpu: number;
        totalMemory: number;
        totalMemoryMB: string;
      };
    };
    config: { maxConcurrentTasks: number; threadsPerTask: number };
  }) => void) => () => void;
  onTaskCenterLog: (callback: (log: { taskId: string; taskType: string; message: string; level: string; timestamp: number }) => void) => () => void;
}

const api: ElectronAPI = {
  // 文件对话框
  pickFiles: (title, filters) => ipcRenderer.invoke("pick-files", { title, filters }),
  pickOutDir: (defaultPath) => ipcRenderer.invoke("pick-outdir", { defaultPath }),

  // 视频处理 API
  videoStitchAB: (config) => ipcRenderer.invoke("video-stitch-ab", config),
  videoResize: (config) => ipcRenderer.invoke("video-resize", config),

  // 图片处理 API
  getCpuCount: () => ipcRenderer.invoke("get-cpu-count"),
  imageCompress: (config) => ipcRenderer.invoke("image-compress", config),
  imageCoverFormat: (config) => ipcRenderer.invoke("image-cover-format", config),
  imageGrid: (config) => ipcRenderer.invoke("image-grid", config),
  imageMaterial: (config) => ipcRenderer.invoke("image-material", config),
  previewImageMaterial: (config) => ipcRenderer.invoke("preview-image-material", config),

  // 预览功能 API
  generateStitchPreview: (config) => ipcRenderer.invoke("generate-stitch-preview", config),
  deleteTempPreview: (tempPath) => ipcRenderer.invoke("delete-temp-preview", tempPath),
  previewHorizontal: (config) => ipcRenderer.invoke("preview-horizontal", config),
  previewVertical: (config) => ipcRenderer.invoke("preview-vertical", config),
  previewMergeFast: (config) => ipcRenderer.invoke("preview-merge-fast", config),
  clearPreviews: () => ipcRenderer.invoke("clear-previews"),
  getPreviewUrl: (filePath) => ipcRenderer.invoke("get-preview-url", filePath),
  getFileInfo: (filePath) => ipcRenderer.invoke("get-file-info", filePath),
  getVideoMetadata: (filePath) => ipcRenderer.invoke("video-get-metadata", filePath),
  getImageDimensions: (filePath) => ipcRenderer.invoke("image:get-dimensions", filePath),
  getImageFullInfo: (filePath, options) => ipcRenderer.invoke("image:get-full-info", filePath, options),
  getVideoDimensions: (filePath) => ipcRenderer.invoke("video:get-dimensions", filePath),
  getPreviewThumbnail: (filePath) => ipcRenderer.invoke("get-preview-thumbnail", filePath),
  getVideoThumbnail: (filePath, options) => ipcRenderer.invoke("get-video-thumbnail", filePath, options),
  getVideoFullInfo: (filePath, options) => ipcRenderer.invoke("video:get-full-info", filePath, options),
  generateResizePreviews: (config) => ipcRenderer.invoke("generate-resize-previews", config),
  clearResizePreviews: (previewPaths) => ipcRenderer.invoke("clear-resize-previews", previewPaths),

  // 预览事件 - 使用 @electron-toolkit/preload 的 ipcRenderer.on 自动返回清理函数
  onPreviewStart: (cb) => ipcRenderer.on("preview-start", (_e, data) => cb(data)),
  onPreviewComplete: (cb) => ipcRenderer.on("preview-complete", (_e, data) => cb(data)),
  onPreviewError: (cb) => ipcRenderer.on("preview-error", (_e, data) => cb(data)),
  onPreviewLog: (cb) => ipcRenderer.on("preview-log", (_e, data) => cb(data)),

  // 原有任务事件
  onJobStart: (cb) => ipcRenderer.on("job-start", (_e, data) => cb(data)),
  onJobTaskStart: (cb) => ipcRenderer.on("job-task-start", (_e, data) => cb(data)),
  onJobLog: (cb) => ipcRenderer.on("job-log", (_e, data) => cb(data)),
  onJobProgress: (cb) => ipcRenderer.on("job-progress", (_e, data) => cb(data)),
  onJobFailed: (cb) => ipcRenderer.on("job-failed", (_e, data) => cb(data)),
  onJobFinish: (cb) => ipcRenderer.on("job-finish", (_e, data) => cb(data)),

  // 视频处理事件
  onVideoStart: (cb) => ipcRenderer.on("video-start", (_e, data) => cb(data)),
  onVideoTaskStart: (cb) => ipcRenderer.on("video-task-start", (_e, data) => cb(data)),
  onVideoProgress: (cb) => ipcRenderer.on("video-progress", (_e, data) => cb(data)),
  onVideoFailed: (cb) => ipcRenderer.on("video-failed", (_e, data) => cb(data)),
  onVideoFinish: (cb) => ipcRenderer.on("video-finish", (_e, data) => cb(data)),
  onVideoLog: (cb) => ipcRenderer.on("video-log", (_e, data) => cb(data)),

  // 图片处理事件
  onImageStart: (cb) => ipcRenderer.on("image-start", (_e, data) => cb(data)),
  onImageTaskStart: (cb) => ipcRenderer.on("image-task-start", (_e, data) => cb(data)),
  onImageProgress: (cb) => ipcRenderer.on("image-progress", (_e, data) => cb(data)),
  onImageFailed: (cb) => ipcRenderer.on("image-failed", (_e, data) => cb(data)),
  onImageFinish: (cb) => ipcRenderer.on("image-finish", (_e, data) => cb(data)),
  onImageTaskFinish: (cb) => ipcRenderer.on("image-task-finish", (_e, data) => cb(data)),

  // 移除监听器
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // 全局配置 API
  getGlobalSettings: () => ipcRenderer.invoke("get-global-settings"),
  setGlobalSettings: (settings) => ipcRenderer.invoke("set-global-settings", settings),

  // 自动更新 API
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getDefaultDownloadDir: () => ipcRenderer.invoke("get-default-download-dir"),
  getSystemMemory: () => ipcRenderer.invoke("get-system-memory"),
  getCpuUsage: () => ipcRenderer.invoke("get-cpu-usage"),
  getCpuCoresUsage: () => ipcRenderer.invoke("get-cpu-cores-usage"),
  getSystemStats: () => ipcRenderer.invoke("get-system-stats"),
  getTaskProcessStats: () => ipcRenderer.invoke("get-task-process-stats"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),

  // macOS 应用内更新 API
  macSetUpdateInfo: (updateInfo) => ipcRenderer.invoke("mac-set-update-info", updateInfo),
  macCheckForUpdates: () => ipcRenderer.invoke("mac-check-for-updates"),
  macDownloadUpdate: () => ipcRenderer.invoke("mac-download-update"),
  macInstallUpdate: () => ipcRenderer.invoke("mac-install-update"),

  // 自动更新事件
  onUpdateChecking: (cb) => ipcRenderer.on("update-checking", () => cb()),
  onUpdateAvailable: (cb) => ipcRenderer.on("update-available", (_e, data) => cb(data)),
  onUpdateNotAvailable: (cb) => ipcRenderer.on("update-not-available", (_e, data) => cb(data)),
  onUpdateError: (cb) => ipcRenderer.on("update-error", (_e, data) => cb(data)),
  onUpdateDownloadProgress: (cb) => ipcRenderer.on("update-download-progress", (_e, data) => cb(data)),
  onUpdateDownloaded: (cb) => ipcRenderer.on("update-downloaded", (_e, data) => cb(data)),

  // 授权 API
  getMachineId: () => ipcRenderer.invoke("auth:get-machine-id"),
  checkLicense: (params) => ipcRenderer.invoke("auth:check-license", params || {}),
  getLicenseInfo: () => ipcRenderer.invoke("auth:get-license-info"),
  onLicenseStatusChanged: (cb) => ipcRenderer.on("license-status-changed", (_e, data) => cb(data)),
  getPlatform: () => ipcRenderer.invoke("get-platform"),

  // 文件操作 API
  batchRenameFiles: (config) => ipcRenderer.invoke("file:batch-rename", config),
  readDirectory: (config) => ipcRenderer.invoke("file:read-directory", config),
  checkPathType: (filePath) => ipcRenderer.invoke("file:check-path-type", { filePath }),
  showItemInFolder: (path) => ipcRenderer.invoke("file:show-item-in-folder", path),
  openPath: (path) => ipcRenderer.invoke("file:open-path", path),
  pathExists: (path) => ipcRenderer.invoke("file:path-exists", path),
  pathsExists: (paths) => ipcRenderer.invoke("file:paths-exists", paths),

  // 文件操作事件
  onFileStart: (cb) => ipcRenderer.on("file-start", (_e, data) => cb(data)),
  onFileProgress: (cb) => ipcRenderer.on("file-progress", (_e, data) => cb(data)),
  onFileComplete: (cb) => ipcRenderer.on("file-complete", (_e, data) => cb(data)),

  // 任务生成 API
  generateStitchTasks: (config) => ipcRenderer.invoke("task:generate-stitch", config),
  generateMergeTasks: (config) => ipcRenderer.invoke("task:generate-merge", config),

  // 任务中心 API
  createTask: (request) => ipcRenderer.invoke("task:create", request),
  batchCreateTasks: (requests) => ipcRenderer.invoke("task:batch-create", requests),
  getTask: (taskId) => ipcRenderer.invoke("task:get", taskId),
  getTasks: (options) => ipcRenderer.invoke("task:list", options),
  deleteTask: (taskId) => ipcRenderer.invoke("task:delete", taskId),
  updateTaskOutputDir: (taskId, outputDir) => ipcRenderer.invoke("task:update-output-dir", taskId, outputDir),
  startTask: (taskId) => ipcRenderer.invoke("task:start", taskId),
  pauseTask: (taskId) => ipcRenderer.invoke("task:pause", taskId),
  resumeTask: (taskId) => ipcRenderer.invoke("task:resume", taskId),
  cancelTask: (taskId) => ipcRenderer.invoke("task:cancel", taskId),
  retryTask: (taskId) => ipcRenderer.invoke("task:retry", taskId),
  startAllTasks: () => ipcRenderer.invoke("task:start-all"),
  pauseAllTasks: () => ipcRenderer.invoke("task:pause-all"),
  cancelAllTasks: () => ipcRenderer.invoke("task:cancel-all"),
  clearCompletedTasks: (beforeDays) => ipcRenderer.invoke("task:clear-completed", beforeDays),
  clearFailedTasks: () => ipcRenderer.invoke("task:clear-failed"),
  getTaskConfig: () => ipcRenderer.invoke("task:get-config"),
  setTaskConfig: (config) => ipcRenderer.invoke("task:set-config", config),
  setConcurrency: (config) => ipcRenderer.invoke("task:set-concurrency", config),
  getCpuInfo: () => ipcRenderer.invoke("task:get-cpu-info"),
  getQueueStatus: () => ipcRenderer.invoke("task:get-queue-status"),
  getTaskLogs: (taskId, options) => ipcRenderer.invoke("task:get-logs", taskId, options),

  // 任务中心事件（旧版，保留兼容）
  onTaskCreated: (cb) => ipcRenderer.on("task:created", (_e, task) => cb(task)),
  onTaskUpdated: (cb) => ipcRenderer.on("task:updated", (_e, task) => cb(task)),
  onTaskDeleted: (cb) => ipcRenderer.on("task:deleted", (_e, id) => cb(id)),
  onTaskStarted: (cb) => ipcRenderer.on("task:started", (_e, data) => cb(data)),
  onTaskProgress: (cb) => ipcRenderer.on("task:progress", (_e, data) => cb(data)),
  onTaskLog: (cb) => ipcRenderer.on("task:log", (_e, data) => cb(data)),
  onTaskCompleted: (cb) => ipcRenderer.on("task:completed", (_e, data) => cb(data)),
  onTaskFailed: (cb) => ipcRenderer.on("task:failed", (_e, data) => cb(data)),
  onTaskCancelled: (cb) => ipcRenderer.on("task:cancelled", (_e, data) => cb(data)),

  // 任务中心广播事件（新版，每秒广播）
  onTaskCenterState: (cb) => {
    const handler = (_e: any, data: any) => cb(data);
    ipcRenderer.on("task-center:state", handler);
    return () => ipcRenderer.removeListener("task-center:state", handler);
  },
  onTaskCenterLog: (cb) => {
    const handler = (_e: any, data: any) => cb(data);
    ipcRenderer.on("task-center:log", handler);
    return () => ipcRenderer.removeListener("task-center:log", handler);
  },
  
  // 获取最近日志
  getRecentLogs: (limit) => ipcRenderer.invoke("task:get-recent-logs", limit),
};

contextBridge.exposeInMainWorld("api", api);

// 类型声明 - 让 window.api 在全局可用
declare global {
  interface Window {
    api: ElectronAPI;
  }
}
