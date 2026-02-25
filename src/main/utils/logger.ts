/**
 * 主进程日志模块
 * 
 * 功能：
 * 1. 所有 console 输出重定向到日志文件
 * 2. 日志轮换（5MB 后归档）
 * 3. 自动清理 7 天前的旧日志
 * 
 * 日志位置：
 * - macOS: ~/Library/Logs/VideoStitcher/main.log
 * - Windows: %USERPROFILE%\AppData\Roaming\VideoStitcher\logs\main.log
 */

import log from 'electron-log';
import fs from 'fs';
import path from 'path';

// 配置日志级别
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

// 单文件最大 5MB
log.transports.file.maxSize = 5 * 1024 * 1024;

// 日志轮换：归档旧日志并清理超过 7 天的
(log.transports.file as any).archiveLog = (logFile: { path: string }) => {
  const info = path.parse(logFile.path);
  const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 10);
  const archivePath = path.join(info.dir, `${info.name}-${date}${info.ext}`);

  try {
    fs.renameSync(logFile.path, archivePath);
  } catch {
    // 忽略重命名失败
  }

  // 清理超过 7 天的旧日志
  const now = Date.now();
  try {
    const files = fs.readdirSync(info.dir);
    files.forEach((f) => {
      if (f.startsWith(info.name) && f !== info.base) {
        const filePath = path.join(info.dir, f);
        try {
          const stat = fs.statSync(filePath);
          if (now - stat.mtimeMs > 7 * 24 * 60 * 60 * 1000) {
            fs.unlinkSync(filePath);
          }
        } catch {
          // 忽略
        }
      }
    });
  } catch {
    // 忽略目录读取失败
  }
};

// 重定向 console 到 electron-log
console.log = (...args) => log.info(...args);
console.warn = (...args) => log.warn(...args);
console.error = (...args) => log.error(...args);
(console as any).info = (...args: any[]) => log.info(...args);
(console as any).debug = (...args: any[]) => log.debug(...args);

/**
 * 获取日志文件路径
 */
export function getLogFilePath(): string {
  return log.transports.file.getFile().path;
}

/**
 * 获取日志内容（最后 N 行）
 */
export function getLogContent(lines: number = 200): string {
  const logPath = getLogFilePath();
  if (!fs.existsSync(logPath)) {
    return '';
  }
  const content = fs.readFileSync(logPath, 'utf-8');
  const allLines = content.split('\n');
  return allLines.slice(-lines).join('\n');
}

/**
 * 获取日志目录路径
 */
export function getLogDirectory(): string {
  return path.dirname(getLogFilePath());
}

export default log;
