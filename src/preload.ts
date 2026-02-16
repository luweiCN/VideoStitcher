import { contextBridge, ipcRenderer } from "electron";

export interface ElectronAPI {
  // 文件对话框
  pickFiles: (
    title: string,
    filters?: { name: string; extensions: string[] }[],
    multiSelection?: boolean,
  ) => Promise<string[]>;
  pickOutDir: (defaultPath?: string) => Promise<string>;

  // === 原有视频处理功能 (保留兼容性) ===
  setLibs: (
    aFiles: string[],
    bFiles: string[],
    outputDir: string,
  ) => Promise<{ aCount: number; bCount: number; outDir: string }>;
  setConcurrency: (concurrency: number) => Promise<{ concurrency: number }>;
  startMerge: (
    orientation: "landscape" | "portrait",
  ) => Promise<{ done: number; failed: number; total: number }>;

  // === 新的视频处理 API ===
  // A+B 前后拼接
  videoStitchAB: (config: {
    aFiles: string[];
    bFiles: string[];
    outputDir: string;
    orientation: "landscape" | "portrait";
    concurrency?: number;
  }) => Promise<{ done: number; failed: number; total: number }>;

  // 统一视频合成（基于任务数组）
  videoMerge: (tasks: {
    files: { path: string; category: string }[];
    config?: {
      orientation: "horizontal" | "vertical";
      aPosition?: { x: number; y: number; width: number; height: number };
      bPosition?: { x: number; y: number; width: number; height: number };
      bgPosition?: { x: number; y: number; width: number; height: number };
      coverPosition?: { x: number; y: number; width: number; height: number };
    };
    outputDir: string;
    concurrency?: number;
  }[]) => Promise<{ done: number; failed: number; total: number }>;

  // 横屏合成
  videoHorizontalMerge: (config: {
    aVideos: string[];
    bVideos: string[];
    bgImage?: string;
    coverImages?: string[]; // 支持批量封面，每个任务随机选择
    outputDir: string;
    concurrency?: number;
    aPosition?: { x: number; y: number; width: number; height: number };
    bPosition?: { x: number; y: number; width: number; height: number };
    bPositions?: { x: number; y: number; width: number; height: number }[];
    bgPosition?: { x: number; y: number; width: number; height: number };
    coverPosition?: { x: number; y: number; width: number; height: number };
  }) => Promise<{ done: number; failed: number; total: number }>;

  // 竖屏合成
  videoVerticalMerge: (config: {
    mainVideos: string[];
    bgImage?: string;
    aVideos?: string[];
    coverImages?: string[]; // 支持批量封面，每个任务随机选择
    outputDir: string;
    concurrency?: number;
    aPosition?: { x: number; y: number; width: number; height: number };
    bPosition?: { x: number; y: number; width: number; height: number };
    bPositions?: { x: number; y: number; width: number; height: number }[];
    bgPosition?: { x: number; y: number; width: number; height: number };
    coverPosition?: { x: number; y: number; width: number; height: number };
  }) => Promise<{ done: number; failed: number; total: number }>;

  // 智能改尺寸
  videoResize: (config: {
    videos: string[];
    mode: "siya" | "fishing" | "unify_h" | "unify_v";
    blurAmount?: number;
    outputDir: string;
    concurrency?: number;
  }) => Promise<{ done: number; failed: number; total: number }>;

  // === 图片处理 API ===
  // 获取 CPU 核心数
  getCpuCount: () => Promise<{
    success: boolean;
    cpuCount?: number;
    error?: string;
  }>;

  // 图片压缩
  imageCompress: (config: {
    images: string[];
    targetSizeKB?: number;
    outputDir: string;
    concurrency?: number; // 并发处理数，0 或 undefined 表示自动（CPU 核心数 - 1）
  }) => Promise<{
    done: number;
    failed: number;
    total: number;
    results: any[];
  }>;

  // 封面格式转换
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

  // 九宫格切割
  imageGrid: (config: { images: string[]; outputDir: string; concurrency?: number }) => Promise<{
    done: number;
    failed: number;
    total: number;
    results: any[];
  }>;

  // 图片素材处理
  imageMaterial: (config: {
    images: string[];
    logoPath?: string;
    outputDir: string;
    previewSize?: "inside" | "cover" | "fill" | "pad";
    logoPosition?: { x: number; y: number }; // Logo 位置 (相对 800x800 画布)
    logoScale?: number; // Logo 缩放比例 (1 = 原始大小)
    exportOptions?: { single: boolean; grid: boolean }; // 导出选项
    concurrency?: number; // 并发线程数
  }) => Promise<{
    done: number;
    failed: number;
    total: number;
    results: any[];
  }>;

  // 图片素材处理预览
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
  // 快速生成 A+B 拼接预览视频（完整视频）
  generateStitchPreview: (config: {
    aPath: string;
    bPath: string;
    orientation: "landscape" | "portrait";
  }) => Promise<{ success: boolean; tempPath?: string; error?: string }>;

  // 快速生成 A+B 拼接预览视频（只截取 A 最后 5 秒 + B 前 5 秒）
  generateStitchPreviewFast: (config: {
    aPath: string;
    bPath: string;
    orientation: "landscape" | "portrait";
    aDuration?: number;
    bDuration?: number;
  }) => Promise<{ success: boolean; tempPath?: string; error?: string }>;

  // 删除临时预览文件
  deleteTempPreview: (
    tempPath: string,
  ) => Promise<{ success: boolean; error?: string }>;

  // 横屏合成预览
  previewHorizontal: (config: {
    aVideo?: string;
    bVideo: string;
    bgImage?: string;
    coverImage?: string;
  }) => Promise<{ success: boolean; previewPath?: string; error?: string }>;

  // 竖屏合成预览
  previewVertical: (config: {
    mainVideo: string;
    bgImage?: string;
    aVideo?: string;
  }) => Promise<{ success: boolean; previewPath?: string; error?: string }>;

  // 极速合成快速预览（降低画质 + 智能截取）
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

  // 清理预览文件
  clearPreviews: () => Promise<{ success: boolean; error?: string }>;

  // 智能改尺寸预览
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

  // 清理指定预览文件
  clearResizePreviews: (
    previewPaths: string[],
  ) => Promise<{ success: boolean; error?: string }>;
  // 获取预览文件的 URL - 直接返回 file:// 协议 URL（主进程已注册 file:// 协议）
  getPreviewUrl: (
    filePath: string,
  ) => Promise<{ success: boolean; url: string; error?: string }>;
  // 获取文件信息
  getFileInfo: (filePath: string) => Promise<{
    success: boolean;
    info?: { name: string; size: number; type: string; ext: string };
    error?: string;
  }>;
  // 获取视频元数据
  getVideoMetadata: (
    filePath: string,
  ) => Promise<{ width: number; height: number; duration: number }>;
  // 获取图片尺寸
  getImageDimensions: (filePath: string) => Promise<{
    width: number;
    height: number;
    orientation: "landscape" | "portrait" | "square";
    aspectRatio: string;
  } | null>;
  // 获取图片完整信息（缩略图 + 尺寸 + 文件大小）
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
  // 获取视频尺寸
  getVideoDimensions: (filePath: string) => Promise<{
    width: number;
    height: number;
    orientation: "landscape" | "portrait" | "square";
    aspectRatio: string;
    duration: number;
  } | null>;

  // 获取预览缩略图（可指定最长边，默认200）
  getPreviewThumbnail: (filePath: string, maxSize?: number) => Promise<{
    success: boolean;
    thumbnail?: string;
    width?: number;
    height?: number;
    error?: string;
  }>;

  // 获取视频缩略图
  getVideoThumbnail: (
    filePath: string,
    options?: {
      timeOffset?: number;  // 截取时间点（秒），默认 0
      maxSize?: number;     // 缩略图最大尺寸，默认 200
    }
  ) => Promise<{
    success: boolean;
    thumbnail?: string;
    duration?: number;       // 视频总时长
    actualTimeOffset?: number; // 实际截取的时间点
    error?: string;
  }>;

  // 获取视频完整信息（一次调用获取缩略图、大小、尺寸、时长）
  getVideoFullInfo: (
    filePath: string,
    options?: {
      thumbnailMaxSize?: number;  // 缩略图最大尺寸，默认 64
    }
  ) => Promise<{
    success: boolean;
    path: string;
    name: string;
    thumbnail?: string | null;      // base64 缩略图
    fileSize?: number | null;       // 文件大小（字节）
    width?: number | null;          // 视频宽度
    height?: number | null;         // 视频高度
    duration?: number | null;       // 时长（秒）
    orientation?: 'landscape' | 'portrait' | 'square' | null;
    aspectRatio?: string | null;    // 长宽比字符串
    error?: string;
  }>;

  // === 事件监听 ===
  // 原有任务事件
  onJobStart: (
    callback: (data: {
      total: number;
      orientation: string;
      concurrency: number;
    }) => void,
  ) => void;
  onJobTaskStart: (callback: (data: { index: number }) => void) => void;
  onJobLog: (callback: (data: { msg: string }) => void) => void;
  onJobProgress: (
    callback: (data: {
      done: number;
      failed: number;
      total: number;
      index: number;
      outPath: string;
    }) => void,
  ) => void;
  onJobFailed: (
    callback: (data: {
      done: number;
      failed: number;
      total: number;
      index: number;
      error: string;
    }) => void,
  ) => void;
  onJobFinish: (
    callback: (data: { done: number; failed: number; total: number }) => void,
  ) => void;

  // 新的视频处理事件
  onVideoStart: (
    callback: (data: {
      total: number;
      mode: string;
      concurrency: number;
    }) => void,
  ) => void;
  onVideoTaskStart: (
    callback: (data: { index: number; videoIndex?: number; videoId?: string; taskId?: string }) => void,
  ) => void;
  onVideoProgress: (
    callback: (data: {
      done: number;
      failed: number;
      total: number;
      index: number;
      videoId?: string;
      outputs?: string[];
    }) => void,
  ) => void;
  onVideoFailed: (
    callback: (data: {
      done: number;
      failed: number;
      total: number;
      index: number;
      videoId?: string;
      error: string;
    }) => void,
  ) => void;
  onVideoFinish: (
    callback: (data: { done: number; failed: number; total: number; elapsed?: string }) => void,
  ) => void;
  onVideoLog: (
    callback: (data: { index: number; videoId?: string; message: string }) => void,
  ) => void;

  // 图片处理事件
  onImageStart: (
    callback: (data: { total: number; mode: string }) => void,
  ) => void;
  onImageTaskStart: (
    callback: (data: { index: number; taskId?: string }) => void,
  ) => void;
  onImageProgress: (
    callback: (data: {
      done: number;
      failed: number;
      total: number;
      current: string;
      result?: any;
    }) => void,
  ) => void;
  onImageFailed: (
    callback: (data: {
      done: number;
      failed: number;
      total: number;
      current: string;
      error: string;
    }) => void,
  ) => void;
  onImageFinish: (
    callback: (data: { done: number; failed: number; total: number }) => void,
  ) => void;
  onImageTaskFinish: (callback: (data: { index: number }) => void) => void;

  // 预览事件
  onPreviewStart: (callback: (data: { mode: string }) => void) => void;
  onPreviewComplete: (
    callback: (data: { previewPath: string }) => void,
  ) => void;
  onPreviewError: (callback: (data: { error: string }) => void) => void;
  onPreviewLog: (callback: (data: { message: string }) => void) => void;

  // 移除监听器
  removeAllListeners: (channel: string) => void;

  // === 全局配置 API ===
  getGlobalSettings: () => Promise<{
    defaultOutputDir?: string;
    defaultConcurrency?: number;
  }>;
  setGlobalSettings: (settings: {
    defaultOutputDir?: string;
    defaultConcurrency?: number;
  }) => Promise<{ success: boolean; error?: string }>;

  // === 自动更新 API ===
  getAppVersion: () => Promise<{ version: string; isDevelopment: boolean }>;
  getDefaultDownloadDir: () => Promise<string>;
  getSystemMemory: () => Promise<{
    total: number;
    free: number;
    used: number;
    totalGB: string;
    freeGB: string;
    usedGB: string;
  }>;
  checkForUpdates: () => Promise<{
    success: boolean;
    hasUpdate?: boolean;
    updateInfo?: any;
    error?: string;
  }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => Promise<{ success: boolean; error?: string }>;
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;

  // macOS 应用内更新 API
  macSetUpdateInfo: (updateInfo: {
    version: string;
    releaseDate: string;
    releaseNotes: string;
  }) => Promise<{ success: boolean; error?: string }>;
  macCheckForUpdates: () => Promise<{
    success: boolean;
    hasUpdate?: boolean;
    updateInfo?: any;
    error?: string;
  }>;
  macDownloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  macInstallUpdate: () => Promise<{ success: boolean; error?: string }>;

  // 自动更新事件 - 返回清理函数
  onUpdateChecking: (callback: () => void) => () => void;
  onUpdateAvailable: (
    callback: (data: {
      version: string;
      releaseDate: string;
      releaseNotes: string;
    }) => void,
  ) => () => void;
  onUpdateNotAvailable: (
    callback: (data: { version: string }) => void,
  ) => () => void;
  onUpdateError: (callback: (data: { message: string }) => void) => () => void;
  onUpdateDownloadProgress: (
    callback: (data: {
      percent: number;
      bytesPerSecond: number;
      transferred: number;
      total: number;
    }) => void,
  ) => () => void;
  onUpdateDownloaded: (
    callback: (data: {
      version: string;
      releaseDate: string;
      releaseNotes: string;
    }) => void,
  ) => () => void;

  // === 授权 API ===
  // 获取机器 ID（用于申请授权）
  getMachineId: () => Promise<{
    success: boolean;
    machineId?: string;
    error?: string;
  }>;
  // 检查授权状态
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
  // 获取授权详情
  getLicenseInfo: () => Promise<{
    authorized: boolean;
    developmentMode?: boolean;
    userInfo?: { user: string; machineId: string };
    reason?: string;
    licenseVersion?: string;
    updatedAt?: string;
  }>;
  // 授权状态变更事件
  onLicenseStatusChanged: (callback: (data: any) => void) => () => void;
  // 获取系统平台信息
  getPlatform: () => Promise<{ platform: string; arch: string }>;

  // === 文件操作 API ===
  // 批量重命名文件
  batchRenameFiles: (config: {
    operations: Array<{ sourcePath: string; targetName: string }>;
  }) => Promise<{
    success: number;
    failed: number;
    errors: Array<{ file: string; error: string }>;
  }>;
  // 读取目录内容
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
  // 检查路径类型（文件或目录）
  checkPathType: (filePath: string) => Promise<{
    success: boolean;
    isDirectory?: boolean;
    isFile?: boolean;
    error?: string;
  }>;
  // 在系统文件管理器中显示文件
  showItemInFolder: (path: string) => Promise<void>;
  // 用系统默认程序打开文件
  openPath: (path: string) => Promise<void>;

  // 文件操作事件
  onFileStart: (
    callback: (data: { total: number; sessionId: string }) => void,
  ) => () => void;
  onFileProgress: (
    callback: (data: {
      index: number;
      total: number;
      sourcePath: string;
      targetPath?: string;
      success: boolean;
      error?: string;
    }) => void,
  ) => () => void;
  onFileComplete: (
    callback: (data: {
      success: number;
      failed: number;
      errors: Array<{ file: string; error: string }>;
    }) => void,
  ) => () => void;

  // === 任务生成 API ===
  // 生成 A+B 前后拼接任务
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
      files: Array<{
        path: string;
        index: number;
        category: string;
        category_name: string;
      }>;
      config: { orientation: string };
      outputDir: string;
      concurrency: number;
    }>;
  }>;

  // 生成视频合成任务
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
      files: Array<{
        path: string;
        index: number;
        category: string;
        category_name: string;
      }>;
      config: { orientation: string };
      outputDir: string;
      concurrency: number;
    }>;
  }>;
}

const api: ElectronAPI = {
  // 文件对话框
  pickFiles: (title, filters) =>
    ipcRenderer.invoke("pick-files", { title, filters }),
  pickOutDir: (defaultPath) =>
    ipcRenderer.invoke("pick-outdir", { defaultPath }),

  // 原有视频处理功能
  setLibs: (aFiles, bFiles, outputDir) =>
    ipcRenderer.invoke("set-libs", { aFiles, bFiles, outputDir }),
  setConcurrency: (concurrency) =>
    ipcRenderer.invoke("set-concurrency", { concurrency }),
  startMerge: (orientation) =>
    ipcRenderer.invoke("start-merge", { orientation }),

  // 新的视频处理 API
  videoStitchAB: (config) => ipcRenderer.invoke("video-stitch-ab", config),
  videoMerge: (tasks) => ipcRenderer.invoke("video-merge", tasks),
  videoHorizontalMerge: (config) =>
    ipcRenderer.invoke("video-horizontal-merge", config),
  videoVerticalMerge: (config) =>
    ipcRenderer.invoke("video-vertical-merge", config),
  videoResize: (config) => ipcRenderer.invoke("video-resize", config),

  // 图片处理 API
  getCpuCount: () => ipcRenderer.invoke("get-cpu-count"),
  imageCompress: (config) => ipcRenderer.invoke("image-compress", config),
  imageCoverFormat: (config) =>
    ipcRenderer.invoke("image-cover-format", config),
  imageGrid: (config) => ipcRenderer.invoke("image-grid", config),
  imageMaterial: (config) => ipcRenderer.invoke("image-material", config),
  previewImageMaterial: (config) =>
    ipcRenderer.invoke("preview-image-material", config),

  // 预览功能 API
  generateStitchPreview: (config) =>
    ipcRenderer.invoke("generate-stitch-preview", config),
  generateStitchPreviewFast: (config) =>
    ipcRenderer.invoke("generate-stitch-preview-fast", config),
  deleteTempPreview: (tempPath) =>
    ipcRenderer.invoke("delete-temp-preview", tempPath),
  previewHorizontal: (config) =>
    ipcRenderer.invoke("preview-horizontal", config),
  previewVertical: (config) => ipcRenderer.invoke("preview-vertical", config),
  previewMergeFast: (config) =>
    ipcRenderer.invoke("preview-merge-fast", config),
  clearPreviews: () => ipcRenderer.invoke("clear-previews"),
  getPreviewUrl: (filePath) => ipcRenderer.invoke("get-preview-url", filePath),
  getFileInfo: (filePath) => ipcRenderer.invoke("get-file-info", filePath),
  getVideoMetadata: (filePath) =>
    ipcRenderer.invoke("video-get-metadata", filePath),
  getImageDimensions: (filePath) =>
    ipcRenderer.invoke("image:get-dimensions", filePath),
  getImageFullInfo: (filePath, options) =>
    ipcRenderer.invoke("image:get-full-info", filePath, options),
  getVideoDimensions: (filePath) =>
    ipcRenderer.invoke("video:get-dimensions", filePath),
  getPreviewThumbnail: (filePath) =>
    ipcRenderer.invoke("get-preview-thumbnail", filePath),
  getVideoThumbnail: (filePath, options) =>
    ipcRenderer.invoke("get-video-thumbnail", filePath, options),
  getVideoFullInfo: (filePath, options) =>
    ipcRenderer.invoke("video:get-full-info", filePath, options),

  // 智能改尺寸预览
  generateResizePreviews: (config) =>
    ipcRenderer.invoke("generate-resize-previews", config),
  clearResizePreviews: (previewPaths) =>
    ipcRenderer.invoke("clear-resize-previews", previewPaths),

  // 预览事件
  onPreviewStart: (cb) =>
    ipcRenderer.on("preview-start", (_e, data) => cb(data)),
  onPreviewComplete: (cb) =>
    ipcRenderer.on("preview-complete", (_e, data) => cb(data)),
  onPreviewError: (cb) =>
    ipcRenderer.on("preview-error", (_e, data) => cb(data)),
  onPreviewLog: (cb) => ipcRenderer.on("preview-log", (_e, data) => cb(data)),

  // 原有任务事件
  onJobStart: (cb) => ipcRenderer.on("job-start", (_e, data) => cb(data)),
  onJobTaskStart: (cb) =>
    ipcRenderer.on("job-task-start", (_e, data) => cb(data)),
  onJobLog: (cb) => ipcRenderer.on("job-log", (_e, data) => cb(data)),
  onJobProgress: (cb) => ipcRenderer.on("job-progress", (_e, data) => cb(data)),
  onJobFailed: (cb) => ipcRenderer.on("job-failed", (_e, data) => cb(data)),
  onJobFinish: (cb) => ipcRenderer.on("job-finish", (_e, data) => cb(data)),

  // 新的视频处理事件
  onVideoStart: (cb) => ipcRenderer.on("video-start", (_e, data) => cb(data)),
  onVideoTaskStart: (cb) =>
    ipcRenderer.on("video-task-start", (_e, data) => cb(data)),
  onVideoProgress: (cb) =>
    ipcRenderer.on("video-progress", (_e, data) => cb(data)),
  onVideoFailed: (cb) => ipcRenderer.on("video-failed", (_e, data) => cb(data)),
  onVideoFinish: (cb) => ipcRenderer.on("video-finish", (_e, data) => cb(data)),
  onVideoLog: (cb) => ipcRenderer.on("video-log", (_e, data) => cb(data)),

  // 图片处理事件
  onImageStart: (cb) => ipcRenderer.on("image-start", (_e, data) => cb(data)),
  onImageTaskStart: (cb) =>
    ipcRenderer.on("image-task-start", (_e, data) => cb(data)),
  onImageProgress: (cb) =>
    ipcRenderer.on("image-progress", (_e, data) => cb(data)),
  onImageFailed: (cb) => ipcRenderer.on("image-failed", (_e, data) => cb(data)),
  onImageFinish: (cb) => ipcRenderer.on("image-finish", (_e, data) => cb(data)),
  onImageTaskFinish: (cb) =>
    ipcRenderer.on("image-task-finish", (_e, data) => cb(data)),

  // 移除监听器
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // 全局配置 API
  getGlobalSettings: () => ipcRenderer.invoke("get-global-settings"),
  setGlobalSettings: (settings) =>
    ipcRenderer.invoke("set-global-settings", settings),

  // 自动更新 API
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getDefaultDownloadDir: () => ipcRenderer.invoke("get-default-download-dir"),
  getSystemMemory: () => ipcRenderer.invoke("get-system-memory"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),

  // macOS 应用内更新 API
  macSetUpdateInfo: (updateInfo) =>
    ipcRenderer.invoke("mac-set-update-info", updateInfo),
  macCheckForUpdates: () => ipcRenderer.invoke("mac-check-for-updates"),
  macDownloadUpdate: () => ipcRenderer.invoke("mac-download-update"),
  macInstallUpdate: () => ipcRenderer.invoke("mac-install-update"),

  // 自动更新事件 - 返回清理函数
  onUpdateChecking: (cb) => {
    const listener = () => cb();
    ipcRenderer.on("update-checking", listener);
    return () => ipcRenderer.removeListener("update-checking", listener);
  },
  onUpdateAvailable: (cb) => {
    const listener = (_e: any, data: any) => cb(data);
    ipcRenderer.on("update-available", listener);
    return () => ipcRenderer.removeListener("update-available", listener);
  },
  onUpdateNotAvailable: (cb) => {
    const listener = (_e: any, data: any) => cb(data);
    ipcRenderer.on("update-not-available", listener);
    return () => ipcRenderer.removeListener("update-not-available", listener);
  },
  onUpdateError: (cb) => {
    const listener = (_e: any, data: any) => cb(data);
    ipcRenderer.on("update-error", listener);
    return () => ipcRenderer.removeListener("update-error", listener);
  },
  onUpdateDownloadProgress: (cb) => {
    const listener = (_e: any, data: any) => cb(data);
    ipcRenderer.on("update-download-progress", listener);
    return () =>
      ipcRenderer.removeListener("update-download-progress", listener);
  },
  onUpdateDownloaded: (cb) => {
    const listener = (_e: any, data: any) => cb(data);
    ipcRenderer.on("update-downloaded", listener);
    return () => ipcRenderer.removeListener("update-downloaded", listener);
  },

  // 授权 API
  getMachineId: () => ipcRenderer.invoke("auth:get-machine-id"),
  checkLicense: (params) =>
    ipcRenderer.invoke("auth:check-license", params || {}),
  getLicenseInfo: () => ipcRenderer.invoke("auth:get-license-info"),
  onLicenseStatusChanged: (cb) => {
    const listener = (_e: any, data: any) => cb(data);
    ipcRenderer.on("license-status-changed", listener);
    return () => ipcRenderer.removeListener("license-status-changed", listener);
  },
  getPlatform: () => ipcRenderer.invoke("get-platform"),

  // 文件操作 API
  batchRenameFiles: (config) => ipcRenderer.invoke("file:batch-rename", config),
  readDirectory: (config) => ipcRenderer.invoke("file:read-directory", config),
  checkPathType: (filePath) =>
    ipcRenderer.invoke("file:check-path-type", { filePath }),
  showItemInFolder: (path) =>
    ipcRenderer.invoke("file:show-item-in-folder", path),
  openPath: (path) => ipcRenderer.invoke("file:open-path", path),

  // 文件操作事件
  onFileStart: (cb) => {
    const listener = (_e: any, data: any) => cb(data);
    ipcRenderer.on("file-start", listener);
    return () => ipcRenderer.removeListener("file-start", listener);
  },
  onFileProgress: (cb) => {
    const listener = (_e: any, data: any) => cb(data);
    ipcRenderer.on("file-progress", listener);
    return () => ipcRenderer.removeListener("file-progress", listener);
  },
  onFileComplete: (cb) => {
    const listener = (_e: any, data: any) => cb(data);
    ipcRenderer.on("file-complete", listener);
    return () => ipcRenderer.removeListener("file-complete", listener);
  },

  // 任务生成 API
  generateStitchTasks: (config) =>
    ipcRenderer.invoke("task:generate-stitch", config),
  generateMergeTasks: (config) =>
    ipcRenderer.invoke("task:generate-merge", config),
};

contextBridge.exposeInMainWorld("api", api);

// 类型声明 - 让 window.api 在全局可用
declare global {
  interface Window {
    api: ElectronAPI;
  }
}
