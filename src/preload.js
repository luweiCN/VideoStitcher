"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    pickFiles: (title) => electron_1.ipcRenderer.invoke('pick-files', { title }),
    pickOutDir: () => electron_1.ipcRenderer.invoke('pick-outdir'),
    setLibs: (aFiles, bFiles, outputDir) => electron_1.ipcRenderer.invoke('set-libs', { aFiles, bFiles, outputDir }),
    setConcurrency: (concurrency) => electron_1.ipcRenderer.invoke('set-concurrency', { concurrency }),
    startMerge: (orientation) => electron_1.ipcRenderer.invoke('start-merge', { orientation }),
    onJobStart: (cb) => electron_1.ipcRenderer.on('job-start', (_e, data) => cb(data)),
    onJobLog: (cb) => electron_1.ipcRenderer.on('job-log', (_e, data) => cb(data)),
    onJobProgress: (cb) => electron_1.ipcRenderer.on('job-progress', (_e, data) => cb(data)),
    onJobFailed: (cb) => electron_1.ipcRenderer.on('job-failed', (_e, data) => cb(data)),
    onJobFinish: (cb) => electron_1.ipcRenderer.on('job-finish', (_e, data) => cb(data)),
    removeAllListeners: (channel) => electron_1.ipcRenderer.removeAllListeners(channel),
};
electron_1.contextBridge.exposeInMainWorld('api', api);
