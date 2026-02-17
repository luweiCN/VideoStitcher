// Electron API 类型声明 - 从 preload 导出
// 此文件复制自 src/preload/index.ts 的接口定义

export interface ElectronAPI {
  // 文件对话框
  pickFiles: (
    title: string,
    filters?: { name: string; extensions: string[] }[],
    multiSelection?: boolean,
  ) => Promise<string[]>;
  pickOutDir: (defaultPath?: string) => Promise<string>;

  // 视频处理 API
  videoStitchAB: (tasks: {
    files: { path: string; category: string }[];
    config?: { orientation: "landscape" | "portrait" };
    outputDir: string;
    concurrency?: number;
  }[]) => Promise<{ done: number; failed: number; total: number; elapsed?: string }>;
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
  videoHorizontalMerge: (config: {
    aVideos: string[];
    bVideos: string[];
    bgImage?: string;
    coverImages?: string[];
    outputDir: string;
    concurrency?: number;
    aPosition?: { x: number; y: number; width: number; height: number };
    bPosition?: { x: number; y: number; width: number; height: number };
    bPositions?: { x: number; y: number; width: number; height: number }[];
    bgPosition?: { x: number; y: number; width: number; height: number };
    coverPosition?: { x: number; y: number; width: number; height: number };
  }) => Promise<{ done: number; failed: number; total: number }>;
  videoVerticalMerge: (config: {
    mainVideos: string[];
    bgImage?: string;
    aVideos?: string[];
    coverImages?: string[];
    outputDir: string;
    concurrency?: number;
    aPosition?: { x: number; y: number; width: number; height: number };
    bPosition?: { x: number; y: number; width: number; height: number };
    bPositions?: { x: number; y: number; width: number; height: number }[];
    bgPosition?: { x: number; y: number; width: number; height: number };
    coverPosition?: { x: number; y: number; width: number; height: number };
  }) => Promise<{ done: number; failed: number; total: number }>;
  videoResize: (config: {
    videos: Array<{ path: string; id: string }>;
    mode: "siya" | "fishing" | "unify_h" | "unify_v";
    blurAmount?: number;
    outputDir: string;
    concurrency?: number;
  }) => Promise<{ done: number; failed: number; total: number }>;

  // 图片处理 API
  getCpuCount: () => Promise<{ success: boolean; cpuCount?: number; error?: string }>;
  imageCompress: (config: {
    images: string[];
    targetSizeKB?: number;
    outputDir: string;
    concurrency?: number;
  }) => Promise<{ done: number; failed: number; total: number; results: any[] }>;
  imageCoverFormat: (config: {
    images: string[];
    quality?: number;
    outputDir: string;
    concurrency?: number;
  }) => Promise<{ done: number; failed: number; total: number; results: any[] }>;
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
  }) => Promise<{ done: number; failed: number; total: number; results: any[] }>;
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
    grid?: { grid?: Array<{ outputPath: string }> };
    error?: string;
  }>;

  // 预览功能 API
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
    coverImage?: string;
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
    previews?: Array<{ path: string; width: number; height: number; label: string }>;
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
  getVideoFullInfo: (filePath: string, options?: { thumbnailMaxSize?: number }) => Promise<{
    success: boolean;
    path: string;
    name: string;
    thumbnail?: string | null;
    previewUrl?: string | null;
    fileSize?: number | null;
    width?: number | null;
    height?: number | null;
    duration?: number | null;
    orientation?: "landscape" | "portrait" | "square" | null;
    aspectRatio?: string | null;
    error?: string;
  }>;

  // 事件监听 - 返回清理函数
  onJobStart: (callback: (data: { total: number; orientation: string; concurrency: number }) => void) => () => void;
  onJobTaskStart: (callback: (data: { index: number }) => void) => () => void;
  onJobLog: (callback: (data: { msg: string }) => void) => () => void;
  onJobProgress: (callback: (data: {
    done: number;
    failed: number;
    total: number;
    index: number;
    outPath: string;
  }) => void) => () => void;
  onJobFailed: (callback: (data: {
    done: number;
    failed: number;
    total: number;
    index: number;
    error: string;
  }) => void) => () => void;
  onJobFinish: (callback: (data: { done: number; failed: number; total: number }) => void) => () => void;

  onVideoStart: (callback: (data: { total: number; mode: string; concurrency: number }) => void) => () => void;
  onVideoTaskStart: (callback: (data: {
    index: number;
    videoIndex?: number;
    videoId?: string;
    taskId?: string;
  }) => void) => () => void;
  onVideoProgress: (callback: (data: {
    done: number;
    failed: number;
    total: number;
    index: number;
    videoId?: string;
    outputs?: string[];
  }) => void) => () => void;
  onVideoFailed: (callback: (data: {
    done: number;
    failed: number;
    total: number;
    index: number;
    videoId?: string;
    error: string;
  }) => void) => () => void;
  onVideoFinish: (callback: (data: {
    done: number;
    failed: number;
    total: number;
    elapsed?: string;
  }) => void) => () => void;
  onVideoLog: (callback: (data: { index: number; videoId?: string; message: string }) => void) => () => void;

  onImageStart: (callback: (data: { total: number; mode: string }) => void) => () => void;
  onImageTaskStart: (callback: (data: { index: number; taskId?: string }) => void) => () => void;
  onImageProgress: (callback: (data: {
    done: number;
    failed: number;
    total: number;
    current: string;
    result?: any;
  }) => void) => () => void;
  onImageFailed: (callback: (data: {
    done: number;
    failed: number;
    total: number;
    current: string;
    error: string;
  }) => void) => () => void;
  onImageFinish: (callback: (data: { done: number; failed: number; total: number }) => void) => () => void;
  onImageTaskFinish: (callback: (data: { index: number }) => void) => () => void;

  onPreviewStart: (callback: (data: { mode: string }) => void) => () => void;
  onPreviewComplete: (callback: (data: { previewPath: string }) => void) => () => void;
  onPreviewError: (callback: (data: { error: string }) => void) => () => void;
  onPreviewLog: (callback: (data: { message: string }) => void) => () => void;

  removeAllListeners: (channel: string) => void;

  // 全局配置 API
  getGlobalSettings: () => Promise<{ defaultOutputDir?: string; defaultConcurrency?: number }>;
  setGlobalSettings: (settings: {
    defaultOutputDir?: string;
    defaultConcurrency?: number;
  }) => Promise<{ success: boolean; error?: string }>;

  // 自动更新 API
  getAppVersion: () => Promise<{ version: string; isDevelopment: boolean }>;
  getDefaultDownloadDir: () => Promise<string>;
  getSystemMemory: () => Promise<{
    total: number;
    free: number;
    used: number;
    totalGB: string;
    freeGB: string;
    usedGB: string;
    cpuCount?: number;
  }>;
  checkForUpdates: () => Promise<{ success: boolean; hasUpdate?: boolean; updateInfo?: any; error?: string }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => Promise<{ success: boolean; error?: string }>;
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;

  // macOS 应用内更新 API
  macSetUpdateInfo: (updateInfo: {
    version: string;
    releaseDate: string;
    releaseNotes: string;
  }) => Promise<{ success: boolean; error?: string }>;
  macCheckForUpdates: () => Promise<{ success: boolean; hasUpdate?: boolean; updateInfo?: any; error?: string }>;
  macDownloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  macInstallUpdate: () => Promise<{ success: boolean; error?: string }>;

  // 自动更新事件
  onUpdateChecking: (callback: () => void) => () => void;
  onUpdateAvailable: (callback: (data: {
    version: string;
    releaseDate: string;
    releaseNotes: string;
  }) => void) => () => void;
  onUpdateNotAvailable: (callback: (data: { version: string }) => void) => () => void;
  onUpdateError: (callback: (data: { message: string }) => void) => () => void;
  onUpdateDownloadProgress: (callback: (data: {
    percent: number;
    bytesPerSecond: number;
    transferred: number;
    total: number;
  }) => void) => () => void;
  onUpdateDownloaded: (callback: (data: {
    version: string;
    releaseDate: string;
    releaseNotes: string;
  }) => void) => () => void;

  // 授权 API
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

  // 文件操作 API
  batchRenameFiles: (config: {
    operations: Array<{ sourcePath: string; targetName: string }>;
  }) => Promise<{ success: number; failed: number; errors: Array<{ file: string; error: string }> }>;
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
  checkPathType: (filePath: string) => Promise<{
    success: boolean;
    isDirectory?: boolean;
    isFile?: boolean;
    error?: string;
  }>;
  showItemInFolder: (path: string) => Promise<void>;
  openPath: (path: string) => Promise<void>;

  onFileStart: (callback: (data: { total: number; sessionId: string }) => void) => () => void;
  onFileProgress: (callback: (data: {
    index: number;
    total: number;
    sourcePath: string;
    targetPath?: string;
    success: boolean;
    error?: string;
  }) => void) => () => void;
  onFileComplete: (callback: (data: {
    success: number;
    failed: number;
    errors: Array<{ file: string; error: string }>;
  }) => void) => () => void;

  // 任务生成 API
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
}
