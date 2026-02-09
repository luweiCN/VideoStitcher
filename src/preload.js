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
    getCpuCount: () => electron_1.ipcRenderer.invoke('get-cpu-count'),
    imageCompress: (config) => electron_1.ipcRenderer.invoke('image-compress', config),
    imageCoverFormat: (config) => electron_1.ipcRenderer.invoke('image-cover-format', config),
    imageGrid: (config) => electron_1.ipcRenderer.invoke('image-grid', config),
    imageMaterial: (config) => electron_1.ipcRenderer.invoke('image-material', config),
    previewImageMaterial: (config) => electron_1.ipcRenderer.invoke('preview-image-material', config),
    // 预览功能 API
    generateStitchPreview: (config) => electron_1.ipcRenderer.invoke('generate-stitch-preview', config),
    deleteTempPreview: (tempPath) => electron_1.ipcRenderer.invoke('delete-temp-preview', tempPath),
    previewHorizontal: (config) => electron_1.ipcRenderer.invoke('preview-horizontal', config),
    previewVertical: (config) => electron_1.ipcRenderer.invoke('preview-vertical', config),
    clearPreviews: () => electron_1.ipcRenderer.invoke('clear-previews'),
    getPreviewUrl: (filePath) => electron_1.ipcRenderer.invoke('get-preview-url', filePath),
    getFileInfo: (filePath) => electron_1.ipcRenderer.invoke('get-file-info', filePath),
    getVideoMetadata: (filePath) => electron_1.ipcRenderer.invoke('video-get-metadata', filePath),
    // 智能改尺寸预览
    generateResizePreviews: (config) => electron_1.ipcRenderer.invoke('generate-resize-previews', config),
    clearResizePreviews: (previewPaths) => electron_1.ipcRenderer.invoke('clear-resize-previews', previewPaths),
    // 预览事件
    onPreviewStart: (cb) => electron_1.ipcRenderer.on('preview-start', (_e, data) => cb(data)),
    onPreviewComplete: (cb) => electron_1.ipcRenderer.on('preview-complete', (_e, data) => cb(data)),
    onPreviewError: (cb) => electron_1.ipcRenderer.on('preview-error', (_e, data) => cb(data)),
    onPreviewLog: (cb) => electron_1.ipcRenderer.on('preview-log', (_e, data) => cb(data)),
    // 原有任务事件
    onJobStart: (cb) => electron_1.ipcRenderer.on('job-start', (_e, data) => cb(data)),
    onJobTaskStart: (cb) => electron_1.ipcRenderer.on('job-task-start', (_e, data) => cb(data)),
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
    // 全局配置 API
    getGlobalSettings: () => electron_1.ipcRenderer.invoke('get-global-settings'),
    setGlobalSettings: (settings) => electron_1.ipcRenderer.invoke('set-global-settings', settings),
    // 自动更新 API
    getAppVersion: () => electron_1.ipcRenderer.invoke('get-app-version'),
    getDefaultDownloadDir: () => electron_1.ipcRenderer.invoke('get-default-download-dir'),
    getSystemMemory: () => electron_1.ipcRenderer.invoke('get-system-memory'),
    checkForUpdates: () => electron_1.ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => electron_1.ipcRenderer.invoke('download-update'),
    installUpdate: () => electron_1.ipcRenderer.invoke('install-update'),
    openExternal: (url) => electron_1.ipcRenderer.invoke('open-external', url),
    // macOS 应用内更新 API
    macSetUpdateInfo: (updateInfo) => electron_1.ipcRenderer.invoke('mac-set-update-info', updateInfo),
    macCheckForUpdates: () => electron_1.ipcRenderer.invoke('mac-check-for-updates'),
    macDownloadUpdate: () => electron_1.ipcRenderer.invoke('mac-download-update'),
    macInstallUpdate: () => electron_1.ipcRenderer.invoke('mac-install-update'),
    // 自动更新事件 - 返回清理函数
    onUpdateChecking: (cb) => {
        const listener = () => cb();
        electron_1.ipcRenderer.on('update-checking', listener);
        return () => electron_1.ipcRenderer.removeListener('update-checking', listener);
    },
    onUpdateAvailable: (cb) => {
        const listener = (_e, data) => cb(data);
        electron_1.ipcRenderer.on('update-available', listener);
        return () => electron_1.ipcRenderer.removeListener('update-available', listener);
    },
    onUpdateNotAvailable: (cb) => {
        const listener = (_e, data) => cb(data);
        electron_1.ipcRenderer.on('update-not-available', listener);
        return () => electron_1.ipcRenderer.removeListener('update-not-available', listener);
    },
    onUpdateError: (cb) => {
        const listener = (_e, data) => cb(data);
        electron_1.ipcRenderer.on('update-error', listener);
        return () => electron_1.ipcRenderer.removeListener('update-error', listener);
    },
    onUpdateDownloadProgress: (cb) => {
        const listener = (_e, data) => cb(data);
        electron_1.ipcRenderer.on('update-download-progress', listener);
        return () => electron_1.ipcRenderer.removeListener('update-download-progress', listener);
    },
    onUpdateDownloaded: (cb) => {
        const listener = (_e, data) => cb(data);
        electron_1.ipcRenderer.on('update-downloaded', listener);
        return () => electron_1.ipcRenderer.removeListener('update-downloaded', listener);
    },
    // 授权 API
    getMachineId: () => electron_1.ipcRenderer.invoke('auth:get-machine-id'),
    checkLicense: (params) => electron_1.ipcRenderer.invoke('auth:check-license', params || {}),
    getLicenseInfo: () => electron_1.ipcRenderer.invoke('auth:get-license-info'),
    onLicenseStatusChanged: (cb) => {
        const listener = (_e, data) => cb(data);
        electron_1.ipcRenderer.on('license-status-changed', listener);
        return () => electron_1.ipcRenderer.removeListener('license-status-changed', listener);
    },
    getPlatform: () => electron_1.ipcRenderer.invoke('get-platform'),
    // 文件操作 API
    batchRenameFiles: (config) => electron_1.ipcRenderer.invoke('file:batch-rename', config),
    // 文件操作事件
    onFileStart: (cb) => {
        const listener = (_e, data) => cb(data);
        electron_1.ipcRenderer.on('file-start', listener);
        return () => electron_1.ipcRenderer.removeListener('file-start', listener);
    },
    onFileProgress: (cb) => {
        const listener = (_e, data) => cb(data);
        electron_1.ipcRenderer.on('file-progress', listener);
        return () => electron_1.ipcRenderer.removeListener('file-progress', listener);
    },
    onFileComplete: (cb) => {
        const listener = (_e, data) => cb(data);
        electron_1.ipcRenderer.on('file-complete', listener);
        return () => electron_1.ipcRenderer.removeListener('file-complete', listener);
    },
};
electron_1.contextBridge.exposeInMainWorld('api', api);
