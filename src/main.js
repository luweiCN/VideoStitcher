const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const os = require("os");
const path = require("path");

const { buildPairs } = require("./ffmpeg/pair");
const { TaskQueue } = require("./ffmpeg/queue");
const { runFfmpeg } = require("./ffmpeg/ffmpegCmd");

let win;
let A = [];
let B = [];
let outDir = "";

const queue = new TaskQueue(Math.max(1, os.cpus().length - 1));

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 750,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true
    }
  });
  win.loadFile(path.join(__dirname, "renderer/index.html"));
}

app.whenReady().then(createWindow);

ipcMain.handle("pick-files", async (_e, { title }) => {
  const res = await dialog.showOpenDialog(win, {
    title,
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Videos", extensions: ["mp4", "mov", "mkv", "m4v", "avi"] }]
  });
  if (res.canceled) return [];
  return res.filePaths;
});

ipcMain.handle("pick-outdir", async () => {
  const res = await dialog.showOpenDialog(win, {
    title: "选择输出目录",
    properties: ["openDirectory", "createDirectory"]
  });
  if (res.canceled) return "";
  return res.filePaths[0];
});

ipcMain.handle("set-libs", async (_e, { aFiles, bFiles, outputDir }) => {
  A = aFiles || [];
  B = bFiles || [];
  outDir = outputDir || "";
  return { aCount: A.length, bCount: B.length, outDir };
});

ipcMain.handle("set-concurrency", async (_e, { concurrency }) => {
  queue.setConcurrency(Number(concurrency) || 1);
  return { concurrency: queue.concurrency };
});

ipcMain.handle("start-merge", async (_e, { orientation }) => {
  if (!A.length || !B.length) throw new Error("A库或B库为空");
  if (!outDir) throw new Error("未选择输出目录");

  const pairs = buildPairs(A, B);
  const total = pairs.length;

  let done = 0;
  let failed = 0;

  win.webContents.send("job-start", { total, orientation, concurrency: queue.concurrency });

  const tasks = pairs.map(({ a, b, index }) => {
    return queue.push(async () => {
      const aName = path.parse(a).name;
      const bName = path.parse(b).name;
      const outName = `${aName}__${bName}__${String(index).padStart(4, "0")}.mp4`;
      const outPath = path.join(outDir, outName);

      const payload = { aPath: a, bPath: b, outPath, orientation };

      const tryRun = async (attempt) => {
        win.webContents.send("job-log", { msg: `\n[${index}] attempt=${attempt}\nA=${a}\nB=${b}\nOUT=${outPath}\n` });
        return runFfmpeg(payload, (s) => {
          win.webContents.send("job-log", { msg: s });
        });
      };

      try {
        await tryRun(1);
        done++;
        win.webContents.send("job-progress", { done, failed, total, index, outPath });
      } catch (err) {
        win.webContents.send("job-log", { msg: `\n[${index}] 第一次失败，重试一次...\n${err.message}\n` });
        try {
          await tryRun(2);
          done++;
          win.webContents.send("job-progress", { done, failed, total, index, outPath });
        } catch (err2) {
          failed++;
          win.webContents.send("job-failed", { done, failed, total, index, error: err2.message });
        }
      }
    });
  });

  await Promise.allSettled(tasks);
  win.webContents.send("job-finish", { done, failed, total });
  return { done, failed, total };
});
