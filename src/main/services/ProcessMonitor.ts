/**
 * 进程监控工具
 * 跨平台获取进程 CPU 和内存使用情况（Windows + macOS）
 */

import { exec } from 'child_process';
import pidusage from 'pidusage';

/**
 * 进程统计信息
 */
export interface ProcessStats {
  pid: number;
  cpu: number;      // CPU 使用率（百分比）
  memory: number;   // 内存使用量（字节）
  memoryMB: number; // 内存使用量（MB）
}

/**
 * 任务进程统计（包含进程树）
 */
export interface TaskProcessStats {
  mainPid: number;
  processes: ProcessStats[];
  totalCpu: number;    // 总 CPU 使用率
  totalMemory: number; // 总内存（字节）
  totalMemoryMB: number;
  coreCount: number;   // 占用的核心数（近似）
}

/**
 * 进程监控器
 * 
 * 特点：
 * 1. 使用 pidusage 跨平台获取进程信息（比 systeminformation 更准确）
 * 2. 递归获取进程树（FFmpeg 会 fork 子进程）
 * 3. 累加所有相关进程的资源占用
 */
export class ProcessMonitor {
  /**
   * 获取单个进程的统计信息
   */
  async getProcessStats(pid: number): Promise<ProcessStats | null> {
    try {
      const stats = await pidusage(pid);
      return {
        pid,
        cpu: stats.cpu || 0,
        memory: stats.memory || 0,
        memoryMB: Math.round((stats.memory || 0) / (1024 * 1024) * 10) / 10,
      };
    } catch {
      return null;
    }
  }

  /**
   * 批量获取多个进程的统计信息
   */
  async getBatchProcessStats(pids: number[]): Promise<ProcessStats[]> {
    if (pids.length === 0) return [];
    
    // 过滤掉不存在的进程
    const alivePids = pids.filter(pid => this.isProcessAlive(pid));
    if (alivePids.length === 0) return [];
    
    try {
      const stats = await pidusage(alivePids);
      const results: ProcessStats[] = [];
      
      for (const [pidStr, stat] of Object.entries(stats)) {
        const pid = parseInt(pidStr, 10);
        if (!isNaN(pid) && stat) {
          results.push({
            pid,
            cpu: stat.cpu || 0,
            memory: stat.memory || 0,
            memoryMB: Math.round((stat.memory || 0) / (1024 * 1024) * 10) / 10,
          });
        }
      }
      
      return results;
    } catch (err) {
      // 进程不存在时静默处理，不打印错误
      return [];
    }
  }

  /**
   * 获取进程的所有子进程 PID（递归）
   * 
   * macOS/Linux: 使用 pgrep
   * Windows: 使用 wmic
   */
  async getProcessTree(mainPid: number): Promise<number[]> {
    const allPids = new Set<number>([mainPid]);
    const toCheck = [mainPid];
    
    while (toCheck.length > 0) {
      const pid = toCheck.shift()!;
      const childPids = await this.getChildPids(pid);
      
      for (const childPid of childPids) {
        if (!allPids.has(childPid)) {
          allPids.add(childPid);
          toCheck.push(childPid);
        }
      }
    }
    
    return Array.from(allPids);
  }

  /**
   * 获取直接子进程 PID
   */
  private async getChildPids(parentPid: number): Promise<number[]> {
    return new Promise((resolve) => {
      let cmd: string;
      
      if (process.platform === 'win32') {
        // Windows: 使用 wmic 查询子进程
        cmd = `wmic process where ParentProcessId=${parentPid} get ProcessId /format:csv`;
      } else {
        // macOS/Linux: 使用 pgrep
        cmd = `pgrep -P ${parentPid}`;
      }
      
      exec(cmd, { timeout: 2000 }, (err, stdout) => {
        if (err || !stdout.trim()) {
          resolve([]);
          return;
        }
        
        const pids: number[] = [];
        
        if (process.platform === 'win32') {
          // Windows wmic 输出格式：
          // Node,ProcessId
          // ,1234
          // ,5678
          const lines = stdout.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            // 跳过标题行和空行
            if (!trimmed || trimmed.includes('Node,') || trimmed.includes('ProcessId')) continue;
            
            // 解析 PID
            const parts = trimmed.split(',');
            const pidStr = parts[parts.length - 1]?.trim();
            if (pidStr) {
              const pid = parseInt(pidStr, 10);
              if (!isNaN(pid) && pid > 0) {
                pids.push(pid);
              }
            }
          }
        } else {
          // macOS/Linux pgrep 输出格式：
          // 1234
          // 5678
          const lines = stdout.split('\n');
          for (const line of lines) {
            const pid = parseInt(line.trim(), 10);
            if (!isNaN(pid) && pid > 0) {
              pids.push(pid);
            }
          }
        }
        
        resolve(pids);
      });
    });
  }

  /**
   * 获取任务进程的完整统计（包含进程树）
   * 这是主要方法，用于监控 FFmpeg/sharp 进程
   */
  async getTaskProcessStats(mainPid: number): Promise<TaskProcessStats> {
    // 获取进程树
    const allPids = await this.getProcessTree(mainPid);
    
    // 批量获取进程信息
    const processes = await this.getBatchProcessStats(allPids);
    
    // 计算总和
    let totalCpu = 0;
    let totalMemory = 0;
    
    for (const p of processes) {
      totalCpu += p.cpu;
      totalMemory += p.memory;
    }
    
    // CPU 占用的核心数（近似）
    // 100% = 1 核，200% = 2 核
    const coreCount = Math.round(totalCpu / 100 * 10) / 10;
    
    return {
      mainPid,
      processes,
      totalCpu: Math.round(totalCpu * 10) / 10,
      totalMemory,
      totalMemoryMB: Math.round(totalMemory / (1024 * 1024) * 10) / 10,
      coreCount,
    };
  }

  /**
   * 批量获取多个任务进程的统计
   * 用于任务中心的并发任务监控
   */
  async getBatchTaskProcessStats(pids: number[]): Promise<Map<number, TaskProcessStats>> {
    const results = new Map<number, TaskProcessStats>();
    
    // 并行获取所有任务的进程树
    const treePromises = pids.map(async (pid) => {
      const stats = await this.getTaskProcessStats(pid);
      return { pid, stats };
    });
    
    const allResults = await Promise.all(treePromises);
    
    for (const { pid, stats } of allResults) {
      results.set(pid, stats);
    }
    
    return results;
  }

  /**
   * 验证进程是否存在
   */
  isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }
}

// 导出单例
export const processMonitor = new ProcessMonitor();
