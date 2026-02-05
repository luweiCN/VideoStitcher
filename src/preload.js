"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    // 文件对话框
    pickFiles: (title, filters) => electron_1.ipcRenderer.invoke('pick-files', { title, filters }),
    pickOutDir: () => electron_1.ipcRenderer.invoke('pick-outdir'),
    // 原有视频处理功能
    setLibs: (aFiles, bFiles, outputDir) => electron_1.ipcRenderer.invoke('set-libs', { aFiles, bFiles, outputDir }),
    setConcurrency: (concurrency) => electron_1.ipcRenderer.invoke('set-concurrency', { concurrency }),
    startMerge: (orientation) => electron_1.ipcRenderer.invoke('start-merge', { orientation }),
    // 新的视频处理 API
    videoHorizontalMerge: (config) => electron_1.ipcRenderer.invoke('video-horizontal-merge', config),
    videoVerticalMerge: (config) => electron_1.ipcRenderer.invoke('video-vertical-merge', config),
    videoResize: (config) => electron_1.ipcRenderer.invoke('video-resize', config),
    // 图片处理 API
    imageCompress: (config) => electron_1.ipcRenderer.invoke('image-compress', config),
    imageCoverFormat: (config) => electron_1.ipcRenderer.invoke('image-cover-format', config),
    imageGrid: (config) => electron_1.ipcRenderer.invoke('image-grid', config),
    imageMaterial: (config) => electron_1.ipcRenderer.invoke('image-material', config),
    // 原有任务事件
    onJobStart: (cb) => electron_1.ipcRenderer.on('job-start', (_e, data) => cb(data)),
    onJobLog: (cb) => electron_1.ipcRenderer.on('job-log', (_e, data) => cb(data)),
    onJobProgress: (cb) => electron_1.ipcRenderer.on('job-progress', (_e, data) => cb(data)),
    onJobFailed: (cb) => electron_1.ipcRenderer.on('job-failed', (_e, data) => cb(data)),
    onJobFinish: (cb) => electron_1.ipcRenderer.on('job-finish', (_e, data) => cb(data)),
    // 新的视频处理事件
    onVideoStart: (cb) => electron_1.ipcRenderer.on('video-start', (_e, data) => cb(data)),
    onVideoProgress: (cb) => electron_1.ipcRenderer.on('video-progress', (_e, data) => cb(data)),
    onVideoFailed: (cb) => electron_1.ipcRenderer.on('video-failed', (_e, data) => cb(data)),
    onVideoFinish: (cb) => electron_1.ipcRenderer.on('video-finish', (_e, data) => cb(data)),
    onVideoLog: (cb) => electron_1.ipcRenderer.on('video-log', (_e, data) => cb(data)),
    // 图片处理事件
    onImageStart: (cb) => electron_1.ipcRenderer.on('image-start', (_e, data) => cb(data)),
    onImageProgress: (cb) => electron_1.ipcRenderer.on('image-progress', (_e, data) => cb(data)),
    onImageFailed: (cb) => electron_1.ipcRenderer.on('image-failed', (_e, data) => cb(data)),
    onImageFinish: (cb) => electron_1.ipcRenderer.on('image-finish', (_e, data) => cb(data)),
    // 移除监听器
    removeAllListeners: (channel) => electron_1.ipcRenderer.removeAllListeners(channel),
    // 自动更新 API
    getAppVersion: () => electron_1.ipcRenderer.invoke('get-app-version'),
    checkForUpdates: () => electron_1.ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => electron_1.ipcRenderer.invoke('download-update'),
    installUpdate: () => electron_1.ipcRenderer.invoke('install-update'),
    // 自动更新事件
    onUpdateAvailable: (cb) => electron_1.ipcRenderer.on('update-available', (_e, data) => cb(data)),
    onUpdateNotAvailable: (cb) => electron_1.ipcRenderer.on('update-not-available', (_e, data) => cb(data)),
    onUpdateError: (cb) => electron_1.ipcRenderer.on('update-error', (_e, data) => cb(data)),
    onUpdateDownloadProgress: (cb) => electron_1.ipcRenderer.on('update-download-progress', (_e, data) => cb(data)),
    onUpdateDownloaded: (cb) => electron_1.ipcRenderer.on('update-downloaded', (_e, data) => cb(data)),
};
electron_1.contextBridge.exposeInMainWorld('api', api);
