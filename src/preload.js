const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  pickFiles: (title) => ipcRenderer.invoke("pick-files", { title }),
  pickOutDir: () => ipcRenderer.invoke("pick-outdir"),
  setLibs: (aFiles, bFiles, outputDir) => ipcRenderer.invoke("set-libs", { aFiles, bFiles, outputDir }),
  setConcurrency: (concurrency) => ipcRenderer.invoke("set-concurrency", { concurrency }),
  startMerge: (orientation) => ipcRenderer.invoke("start-merge", { orientation }),

  onJobStart: (cb) => ipcRenderer.on("job-start", (_e, data) => cb(data)),
  onJobLog: (cb) => ipcRenderer.on("job-log", (_e, data) => cb(data)),
  onJobProgress: (cb) => ipcRenderer.on("job-progress", (_e, data) => cb(data)),
  onJobFailed: (cb) => ipcRenderer.on("job-failed", (_e, data) => cb(data)),
  onJobFinish: (cb) => ipcRenderer.on("job-finish", (_e, data) => cb(data))
});
