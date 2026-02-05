import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  // 文件对话框
  pickFiles: (title: string) => Promise<string[]>;
  pickOutDir: () => Promise<string>;

  // 视频处理 (现有功能)
  setLibs: (aFiles: string[], bFiles: string[], outputDir: string) => Promise<{ aCount: number; bCount: number; outDir: string }>;
  setConcurrency: (concurrency: number) => Promise<{ concurrency: number }>;
  startMerge: (orientation: 'landscape' | 'portrait') => Promise<{ done: number; failed: number; total: number }>;

  // 事件监听
  onJobStart: (callback: (data: { total: number; orientation: string; concurrency: number }) => void) => void;
  onJobLog: (callback: (data: { msg: string }) => void) => void;
  onJobProgress: (callback: (data: { done: number; failed: number; total: number; index: number; outPath: string }) => void) => void;
  onJobFailed: (callback: (data: { done: number; failed: number; total: number; index: number; error: string }) => void) => void;
  onJobFinish: (callback: (data: { done: number; failed: number; total: number }) => void) => void;

  // 移除监听器
  removeAllListeners: (channel: string) => void;
}

const api: ElectronAPI = {
  pickFiles: (title) => ipcRenderer.invoke('pick-files', { title }),
  pickOutDir: () => ipcRenderer.invoke('pick-outdir'),
  setLibs: (aFiles, bFiles, outputDir) => ipcRenderer.invoke('set-libs', { aFiles, bFiles, outputDir }),
  setConcurrency: (concurrency) => ipcRenderer.invoke('set-concurrency', { concurrency }),
  startMerge: (orientation) => ipcRenderer.invoke('start-merge', { orientation }),

  onJobStart: (cb) => ipcRenderer.on('job-start', (_e, data) => cb(data)),
  onJobLog: (cb) => ipcRenderer.on('job-log', (_e, data) => cb(data)),
  onJobProgress: (cb) => ipcRenderer.on('job-progress', (_e, data) => cb(data)),
  onJobFailed: (cb) => ipcRenderer.on('job-failed', (_e, data) => cb(data)),
  onJobFinish: (cb) => ipcRenderer.on('job-finish', (_e, data) => cb(data)),

  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
};

contextBridge.exposeInMainWorld('api', api);

// 类型声明 - 让 window.api 在全局可用
declare global {
  interface Window {
    api: ElectronAPI;
  }
}
