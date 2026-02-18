/**
 * 系统信息与外部操作 IPC 处理器
 * 包含：系统内存、下载目录、外部链接、平台信息、CPU 占用率等
 */

import { ipcMain, app, shell } from 'electron';
import os from 'os';
import si from 'systeminformation';
import { taskQueueManager } from '../services/TaskQueueManager';

/**
 * 获取系统默认下载目录
 */
async function handleGetDefaultDownloadDir(): Promise<string> {
  try {
    return app.getPath('downloads');
  } catch (err) {
    console.error('[默认下载目录] 获取失败:', err);
    return '';
  }
}

/**
 * 获取系统内存信息
 */
async function handleGetSystemMemory(): Promise<{
  total: number;
  free: number;
  used: number;
  totalGB: string;
  freeGB: string;
  usedGB: string;
}> {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;

  return {
    total: totalMemory,
    free: freeMemory,
    used: usedMemory,
    totalGB: (totalMemory / (1024 * 1024 * 1024)).toFixed(1),
    freeGB: (freeMemory / (1024 * 1024 * 1024)).toFixed(1),
    usedGB: (usedMemory / (1024 * 1024 * 1024)).toFixed(1),
  };
}

/**
 * 获取 CPU 当前占用率
 */
async function handleGetCpuUsage(): Promise<{
  usage: number;
  cores: number;
}> {
  try {
    const currentLoad = await si.currentLoad();
    return {
      usage: Math.round(currentLoad.currentLoad),
      cores: currentLoad.cpus.length,
    };
  } catch (err) {
    console.error('[CPU占用率] 获取失败:', err);
    return { usage: 0, cores: os.cpus().length };
  }
}

/**
 * 获取各核心 CPU 占用率
 */
async function handleGetCpuCoresUsage(): Promise<{
  cores: number[];
  total: number;
}> {
  try {
    const currentLoad = await si.currentLoad();
    const cores = currentLoad.cpus.map(cpu => Math.round(cpu.load));
    return {
      cores,
      total: Math.round(currentLoad.currentLoad),
    };
  } catch (err) {
    console.error('[CPU核心占用率] 获取失败:', err);
    const cpuCount = os.cpus().length;
    return {
      cores: new Array(cpuCount).fill(0),
      total: 0,
    };
  }
}

/**
 * 获取完整系统状态（CPU + 内存）
 */
async function handleGetSystemStats(): Promise<{
  cpu: {
    usage: number;
    cores: number[];
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usedPercent: number;
    totalGB: string;
    freeGB: string;
    usedGB: string;
  };
}> {
  try {
    const [currentLoad, mem] = await Promise.all([
      si.currentLoad(),
      si.mem(),
    ]);

    return {
      cpu: {
        usage: Math.round(currentLoad.currentLoad),
        cores: currentLoad.cpus.map(cpu => Math.round(cpu.load)),
      },
      memory: {
        total: mem.total,
        free: mem.free,
        used: mem.used,
        usedPercent: Math.round((mem.used / mem.total) * 100),
        totalGB: (mem.total / (1024 * 1024 * 1024)).toFixed(1),
        freeGB: (mem.free / (1024 * 1024 * 1024)).toFixed(1),
        usedGB: (mem.used / (1024 * 1024 * 1024)).toFixed(1),
      },
    };
  } catch (err) {
    console.error('[系统状态] 获取失败:', err);
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const cpuCount = os.cpus().length;
    return {
      cpu: {
        usage: 0,
        cores: new Array(cpuCount).fill(0),
      },
      memory: {
        total: totalMemory,
        free: freeMemory,
        used: totalMemory - freeMemory,
        usedPercent: Math.round(((totalMemory - freeMemory) / totalMemory) * 100),
        totalGB: (totalMemory / (1024 * 1024 * 1024)).toFixed(1),
        freeGB: (freeMemory / (1024 * 1024 * 1024)).toFixed(1),
        usedGB: ((totalMemory - freeMemory) / (1024 * 1024 * 1024)).toFixed(1),
      },
    };
  }
}

/**
 * 获取任务相关进程的 CPU 和内存占用
 */
async function handleGetTaskProcessStats(): Promise<{
  processes: Array<{
    pid: number;
    name: string;
    cpu: number;
    memory: number;
    memoryMB: string;
  }>;
  totalCpu: number;
  totalMemory: number;
  totalMemoryMB: string;
}> {
  try {
    // 获取所有进程
    const processesData = await si.processes();
    
    // 获取任务管理器追踪的 PID
    const runningPids = taskQueueManager.getRunningPids();
    
    // 筛选 FFmpeg 和任务相关进程
    const taskProcesses = processesData.list.filter(p => {
      // 任务追踪的进程
      if (runningPids.includes(p.pid)) return true;
      // FFmpeg 进程
      if (p.name && p.name.toLowerCase().includes('ffmpeg')) return true;
      // Node 子进程（可能包含 sharp）
      if (p.name && p.name.toLowerCase().includes('node')) {
        // 检查命令行是否包含 sharp 或 ffmpeg
        if (p.params && (p.params.includes('sharp') || p.params.includes('ffmpeg'))) {
          return true;
        }
      }
      return false;
    });

    // 计算总资源占用
    let totalCpu = 0;
    let totalMemory = 0;

    const processes = taskProcesses.map(p => {
      const cpu = p.cpu || 0;
      const memory = p.mem || 0;
      const memoryBytes = p.memRss || 0;
      
      totalCpu += cpu;
      totalMemory += memoryBytes;
      
      return {
        pid: p.pid,
        name: p.name || 'unknown',
        cpu: Math.round(cpu * 10) / 10,
        memory: Math.round(memory * 10) / 10,
        memoryMB: (memoryBytes / (1024 * 1024)).toFixed(1),
      };
    });

    return {
      processes,
      totalCpu: Math.round(totalCpu * 10) / 10,
      totalMemory,
      totalMemoryMB: (totalMemory / (1024 * 1024)).toFixed(1),
    };
  } catch (err) {
    console.error('[进程统计] 获取失败:', err);
    return {
      processes: [],
      totalCpu: 0,
      totalMemory: 0,
      totalMemoryMB: '0',
    };
  }
}

/**
 * 使用系统默认浏览器打开外部链接
 */
async function handleOpenExternal(_event: Electron.IpcMainInvokeEvent, url: string): Promise<{ success: boolean; error?: string }> {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 获取系统平台信息
 */
async function handleGetPlatform(): Promise<{ platform: string; arch: string }> {
  return { platform: process.platform, arch: process.arch };
}

// ==================== 注册处理器 ====================

/**
 * 注册所有系统信息 IPC 处理器
 */
export function registerSystemHandlers(): void {
  ipcMain.handle('get-default-download-dir', handleGetDefaultDownloadDir);
  ipcMain.handle('get-system-memory', handleGetSystemMemory);
  ipcMain.handle('get-cpu-usage', handleGetCpuUsage);
  ipcMain.handle('get-cpu-cores-usage', handleGetCpuCoresUsage);
  ipcMain.handle('get-system-stats', handleGetSystemStats);
  ipcMain.handle('get-task-process-stats', handleGetTaskProcessStats);
  ipcMain.handle('open-external', handleOpenExternal);
  ipcMain.handle('get-platform', handleGetPlatform);
}

export {
  handleGetDefaultDownloadDir,
  handleGetSystemMemory,
  handleGetCpuUsage,
  handleGetCpuCoresUsage,
  handleGetSystemStats,
  handleGetTaskProcessStats,
  handleOpenExternal,
  handleGetPlatform,
};
