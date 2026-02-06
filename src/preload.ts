import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  // 文件对话框
  pickFiles: (title: string, filters?: { name: string; extensions: string[] }[], multiSelection?: boolean) => Promise<string[]>;
  pickOutDir: () => Promise<string>;

  // === 原有视频处理功能 (保留兼容性) ===
  setLibs: (aFiles: string[], bFiles: string[], outputDir: string) => Promise<{ aCount: number; bCount: number; outDir: string }>;
  setConcurrency: (concurrency: number) => Promise<{ concurrency: number }>;
  startMerge: (orientation: 'landscape' | 'portrait') => Promise<{ done: number; failed: number; total: number }>;

  // === 新的视频处理 API ===
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
    mode: 'siya' | 'fishing' | 'unify_h' | 'unify_v';
    blurAmount?: number;
    outputDir: string;
    concurrency?: number;
  }) => Promise<{ done: number; failed: number; total: number }>;

  // === 图片处理 API ===
  // 获取 CPU 核心数
  getCpuCount: () => Promise<{ success: boolean; cpuCount?: number; error?: string }>;

  // 图片压缩
  imageCompress: (config: {
    images: string[];
    targetSizeKB?: number;
    outputDir: string;
    concurrency?: number; // 并发处理数，0 或 undefined 表示自动（CPU 核心数 - 1）
  }) => Promise<{ done: number; failed: number; total: number; results: any[] }>;

  // 封面格式转换
  imageCoverFormat: (config: {
    images: string[];
    quality?: number;
    outputDir: string;
  }) => Promise<{ done: number; failed: number; total: number; results: any[] }>;

  // 九宫格切割
  imageGrid: (config: {
    images: string[];
    outputDir: string;
  }) => Promise<{ done: number; failed: number; total: number; results: any[] }>;

  // 图片素材处理
  imageMaterial: (config: {
    images: string[];
    logoPath?: string;
    outputDir: string;
    previewSize?: 'inside' | 'cover' | 'fill' | 'pad';
    logoPosition?: { x: number; y: number }; // Logo 位置 (相对 800x800 画布)
    logoScale?: number; // Logo 缩放比例 (1 = 原始大小)
    exportOptions?: { single: boolean; grid: boolean }; // 导出选项
  }) => Promise<{ done: number; failed: number; total: number; results: any[] }>;

  // 图片素材处理预览
  previewImageMaterial: (config: {
    imagePath: string;
    logoPath?: string;
    previewSize?: 'inside' | 'cover' | 'fill' | 'pad';
    logoPosition?: { x: number; y: number };
    logoScale?: number;
  }) => Promise<{ success: boolean; preview?: string; logo?: string; grid?: any[]; error?: string }>;

  // === 预览功能 API ===
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

  // 清理预览文件
  clearPreviews: () => Promise<{ success: boolean; error?: string }>;

  // 智能改尺寸预览
  generateResizePreviews: (config: {
    videoPath: string;
    mode: 'siya' | 'fishing' | 'unify_h' | 'unify_v';
    blurAmount: number;
  }) => Promise<{ success: boolean; previews?: Array<{ path: string; width: number; height: number; label: string }>; error?: string }>;

  // 清理指定预览文件
  clearResizePreviews: (previewPaths: string[]) => Promise<{ success: boolean; error?: string }>;

  // 获取预览文件的 URL
  getPreviewUrl: (filePath: string) => Promise<{ success: boolean; url?: string; error?: string }>;
  // 获取文件信息
  getFileInfo: (filePath: string) => Promise<{ success: boolean; info?: { name: string; size: number; type: string; ext: string }; error?: string }>;
  // 获取视频元数据
  getVideoMetadata: (filePath: string) => Promise<{ width: number; height: number; duration: number }>;

  // === 事件监听 ===
  // 原有任务事件
  onJobStart: (callback: (data: { total: number; orientation: string; concurrency: number }) => void) => void;
  onJobLog: (callback: (data: { msg: string }) => void) => void;
  onJobProgress: (callback: (data: { done: number; failed: number; total: number; index: number; outPath: string }) => void) => void;
  onJobFailed: (callback: (data: { done: number; failed: number; total: number; index: number; error: string }) => void) => void;
  onJobFinish: (callback: (data: { done: number; failed: number; total: number }) => void) => void;

  // 新的视频处理事件
  onVideoStart: (callback: (data: { total: number; mode: string; concurrency: number }) => void) => void;
  onVideoProgress: (callback: (data: { done: number; failed: number; total: number; index: number; outputPath: string }) => void) => void;
  onVideoFailed: (callback: (data: { done: number; failed: number; total: number; index: number; error: string }) => void) => void;
  onVideoFinish: (callback: (data: { done: number; failed: number; total: number }) => void) => void;
  onVideoLog: (callback: (data: { index: number; message: string }) => void) => void;

  // 图片处理事件
  onImageStart: (callback: (data: { total: number; mode: string }) => void) => void;
  onImageProgress: (callback: (data: { done: number; failed: number; total: number; current: string; result?: any }) => void) => void;
  onImageFailed: (callback: (data: { done: number; failed: number; total: number; current: string; error: string }) => void) => void;
  onImageFinish: (callback: (data: { done: number; failed: number; total: number }) => void) => void;

  // 预览事件
  onPreviewStart: (callback: (data: { mode: string }) => void) => void;
  onPreviewComplete: (callback: (data: { previewPath: string }) => void) => void;
  onPreviewError: (callback: (data: { error: string }) => void) => void;
  onPreviewLog: (callback: (data: { message: string }) => void) => void;

  // 移除监听器
  removeAllListeners: (channel: string) => void;

  // === 自动更新 API ===
  getAppVersion: () => Promise<{ version: string; isDevelopment: boolean }>;
  checkForUpdates: () => Promise<{ success: boolean; hasUpdate?: boolean; updateInfo?: any; error?: string }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => Promise<{ success: boolean; error?: string }>;
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;

  // 自动更新事件 - 返回清理函数
  onUpdateAvailable: (callback: (data: { version: string; releaseDate: string; releaseNotes: string }) => void) => () => void;
  onUpdateNotAvailable: (callback: (data: { version: string }) => void) => () => void;
  onUpdateError: (callback: (data: { message: string }) => void) => () => void;
  onUpdateDownloadProgress: (callback: (data: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => () => void;
  onUpdateDownloaded: (callback: (data: { version: string; releaseDate: string; releaseNotes: string }) => void) => () => void;
}

const api: ElectronAPI = {
  // 文件对话框
  pickFiles: (title, filters) => ipcRenderer.invoke('pick-files', { title, filters }),
  pickOutDir: () => ipcRenderer.invoke('pick-outdir'),

  // 原有视频处理功能
  setLibs: (aFiles, bFiles, outputDir) => ipcRenderer.invoke('set-libs', { aFiles, bFiles, outputDir }),
  setConcurrency: (concurrency) => ipcRenderer.invoke('set-concurrency', { concurrency }),
  startMerge: (orientation) => ipcRenderer.invoke('start-merge', { orientation }),

  // 新的视频处理 API
  videoHorizontalMerge: (config) => ipcRenderer.invoke('video-horizontal-merge', config),
  videoVerticalMerge: (config) => ipcRenderer.invoke('video-vertical-merge', config),
  videoResize: (config) => ipcRenderer.invoke('video-resize', config),

  // 图片处理 API
  getCpuCount: () => ipcRenderer.invoke('get-cpu-count'),
  imageCompress: (config) => ipcRenderer.invoke('image-compress', config),
  imageCoverFormat: (config) => ipcRenderer.invoke('image-cover-format', config),
  imageGrid: (config) => ipcRenderer.invoke('image-grid', config),
  imageMaterial: (config) => ipcRenderer.invoke('image-material', config),
  previewImageMaterial: (config) => ipcRenderer.invoke('preview-image-material', config),

  // 预览功能 API
  previewHorizontal: (config) => ipcRenderer.invoke('preview-horizontal', config),
  previewVertical: (config) => ipcRenderer.invoke('preview-vertical', config),
  clearPreviews: () => ipcRenderer.invoke('clear-previews'),
  getPreviewUrl: (filePath) => ipcRenderer.invoke('get-preview-url', filePath),
  getFileInfo: (filePath) => ipcRenderer.invoke('get-file-info', filePath),
  getVideoMetadata: (filePath) => ipcRenderer.invoke('video-get-metadata', filePath),

  // 智能改尺寸预览
  generateResizePreviews: (config) => ipcRenderer.invoke('generate-resize-previews', config),
  clearResizePreviews: (previewPaths) => ipcRenderer.invoke('clear-resize-previews', previewPaths),

  // 预览事件
  onPreviewStart: (cb) => ipcRenderer.on('preview-start', (_e, data) => cb(data)),
  onPreviewComplete: (cb) => ipcRenderer.on('preview-complete', (_e, data) => cb(data)),
  onPreviewError: (cb) => ipcRenderer.on('preview-error', (_e, data) => cb(data)),
  onPreviewLog: (cb) => ipcRenderer.on('preview-log', (_e, data) => cb(data)),

  // 原有任务事件
  onJobStart: (cb) => ipcRenderer.on('job-start', (_e, data) => cb(data)),
  onJobLog: (cb) => ipcRenderer.on('job-log', (_e, data) => cb(data)),
  onJobProgress: (cb) => ipcRenderer.on('job-progress', (_e, data) => cb(data)),
  onJobFailed: (cb) => ipcRenderer.on('job-failed', (_e, data) => cb(data)),
  onJobFinish: (cb) => ipcRenderer.on('job-finish', (_e, data) => cb(data)),

  // 新的视频处理事件
  onVideoStart: (cb) => ipcRenderer.on('video-start', (_e, data) => cb(data)),
  onVideoProgress: (cb) => ipcRenderer.on('video-progress', (_e, data) => cb(data)),
  onVideoFailed: (cb) => ipcRenderer.on('video-failed', (_e, data) => cb(data)),
  onVideoFinish: (cb) => ipcRenderer.on('video-finish', (_e, data) => cb(data)),
  onVideoLog: (cb) => ipcRenderer.on('video-log', (_e, data) => cb(data)),

  // 图片处理事件
  onImageStart: (cb) => ipcRenderer.on('image-start', (_e, data) => cb(data)),
  onImageProgress: (cb) => ipcRenderer.on('image-progress', (_e, data) => cb(data)),
  onImageFailed: (cb) => ipcRenderer.on('image-failed', (_e, data) => cb(data)),
  onImageFinish: (cb) => ipcRenderer.on('image-finish', (_e, data) => cb(data)),

  // 移除监听器
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // 自动更新 API
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // 自动更新事件 - 返回清理函数
  onUpdateAvailable: (cb) => {
    const listener = (_e: any, data: any) => cb(data);
    ipcRenderer.on('update-available', listener);
    return () => ipcRenderer.removeListener('update-available', listener);
  },
  onUpdateNotAvailable: (cb) => {
    const listener = (_e: any, data: any) => cb(data);
    ipcRenderer.on('update-not-available', listener);
    return () => ipcRenderer.removeListener('update-not-available', listener);
  },
  onUpdateError: (cb) => {
    const listener = (_e: any, data: any) => cb(data);
    ipcRenderer.on('update-error', listener);
    return () => ipcRenderer.removeListener('update-error', listener);
  },
  onUpdateDownloadProgress: (cb) => {
    const listener = (_e: any, data: any) => cb(data);
    ipcRenderer.on('update-download-progress', listener);
    return () => ipcRenderer.removeListener('update-download-progress', listener);
  },
  onUpdateDownloaded: (cb) => {
    const listener = (_e: any, data: any) => cb(data);
    ipcRenderer.on('update-downloaded', listener);
    return () => ipcRenderer.removeListener('update-downloaded', listener);
  },
};

contextBridge.exposeInMainWorld('api', api);

// 类型声明 - 让 window.api 在全局可用
declare global {
  interface Window {
    api: ElectronAPI;
  }
}
