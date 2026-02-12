import { useState, useCallback, useEffect, useRef, useTransition } from 'react';

/**
 * 操作日志 Hook
 * 提供日志状态管理和相关功能
 */
export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export interface UseOperationLogsOptions {
  /** 功能模块中文名，用于下载日志文件名 */
  moduleNameCN: string;
  /** 功能模块英文名，用于下载日志文件名 */
  moduleNameEN: string;
}

export interface UseOperationLogsReturn {
  /** 日志列表 */
  logs: LogEntry[];
  /** 添加日志 */
  addLog: (message: string, type?: LogEntry['type']) => void;
  /** 清空日志 */
  clearLogs: () => void;
  /** 复制日志到剪贴板 */
  copyLogs: (startIdx?: number, endIdx?: number) => Promise<boolean>;
  /** 下载日志为 txt 文件 */
  downloadLogs: () => void;
  /** 日志容器 ref，用于自动滚动 */
  logsEndRef: React.RefObject<HTMLDivElement | null>;
  /** 日志容器 ref，用于滚动检测 */
  logsContainerRef: React.RefObject<HTMLDivElement | null>;

  // 自动滚动相关
  /** 是否启用自动滚动 */
  autoScrollEnabled: boolean;
  /** 设置自动滚动开关 */
  setAutoScrollEnabled: (enabled: boolean) => void;
  /** 是否暂停自动滚动 */
  autoScrollPaused: boolean;
  /** 恢复自动滚动 */
  resumeAutoScroll: () => void;
  /** 滚动到底部 */
  scrollToBottom: () => void;
  /** 滚动到顶部 */
  scrollToTop: () => void;

  // 用户交互相关
  /** 用户开始交互（选择日志时暂停自动滚动） */
  onUserInteractStart: () => void;
  /** 用户结束交互 */
  onUserInteractEnd: () => void;
}

/**
 * 格式化时间戳为 HH:MM:SS 格式
 */
function formatTimestamp(): string {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * 根据消息内容推断日志类型
 */
function inferLogType(message: string): LogEntry['type'] {
  if (message.includes('[错误]') || message.includes('❌')) {
    return 'error';
  }
  if (message.includes('成功') || message.includes('完成') || message.includes('✅')) {
    return 'success';
  }
  if (message.includes('[警告]') || message.includes('⚠️')) {
    return 'warning';
  }
  return 'info';
}

/**
 * 自动恢复自动滚动的延迟时间（毫秒）
 */
const AUTO_RESUME_DELAY = 30000; // 30 秒

/**
 * 操作日志 Hook
 *
 * @example
 * ```tsx
 * const { logs, addLog, clearLogs, autoScrollEnabled, resumeAutoScroll } = useOperationLogs({
 *   moduleNameCN: 'A+B前后拼接',
 *   moduleNameEN: 'VideoStitcher'
 * });
 * ```
 */
export function useOperationLogs(options: UseOperationLogsOptions): UseOperationLogsReturn {
  const { moduleNameCN, moduleNameEN } = options;

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  // 使用 useTransition 优化批量日志更新性能
  // 当大量日志快速添加时，将日志更新标记为"过渡"，优先处理用户交互
  const [isLogUpdatePending, startLogTransition] = useTransition();

  // 批量添加优化：缓存待添加的日志
  const pendingLogsRef = useRef<LogEntry[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 刷新待添加的日志到状态中（使用 transition 优化）
  const flushPendingLogs = useCallback(() => {
    if (pendingLogsRef.current.length === 0) return;

    const logsToAdd = pendingLogsRef.current.splice(0);
    // 使用 startTransition 将日志更新标记为非紧急
    // 这样当大量日志同时刷新时，用户交互仍然保持响应
    startLogTransition(() => {
      setLogs(prev => [...prev, ...logsToAdd]);
    });
    pendingLogsRef.current = [];
  }, [startLogTransition]);

  // 定期刷新待添加的日志
  useEffect(() => {
    const timer = setInterval(flushPendingLogs, 500); // 每 500ms 刷新一次
    return () => clearInterval(timer);
  }, [flushPendingLogs]);

  const [autoScrollPaused, setAutoScrollPaused] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // 自动恢复定时器
  const autoResumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 清除自动恢复定时器
  const clearAutoResumeTimer = useCallback(() => {
    if (autoResumeTimerRef.current) {
      clearTimeout(autoResumeTimerRef.current);
      autoResumeTimerRef.current = null;
    }
  }, []);

  // 启动自动恢复定时器（30秒后自动恢复）
  const startAutoResumeTimer = useCallback(() => {
    clearAutoResumeTimer();
    autoResumeTimerRef.current = setTimeout(() => {
      // 只有在开关打开且暂停状态时才自动恢复
      if (autoScrollEnabled && autoScrollPaused) {
        setAutoScrollPaused(false);
      }
    }, AUTO_RESUME_DELAY);
  }, [autoScrollEnabled, autoScrollPaused, clearAutoResumeTimer]);

  // 设置自动滚动开关
  const handleSetAutoScrollEnabled = useCallback((enabled: boolean) => {
    setAutoScrollEnabled(enabled);
    if (enabled) {
      // 打开开关时：恢复自动滚动状态
      setAutoScrollPaused(false);
      clearAutoResumeTimer();
      // 延迟滚动确保 DOM 更新
      setTimeout(() => {
        const container = logsContainerRef.current;
        if (!container) return;
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth',
        });
      }, 0);
    } else {
      // 关闭开关时：清除暂停状态和定时器
      setAutoScrollPaused(false);
      clearAutoResumeTimer();
    }
  }, [clearAutoResumeTimer]);

  // 滚动到底部（平滑滚动）
  const scrollToBottom = useCallback(() => {
    const container = logsContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  }, []);

  // 滚动到顶部（平滑滚动）
  const scrollToTop = useCallback(() => {
    const container = logsContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, []);

  // 恢复自动滚动
  const resumeAutoScroll = useCallback(() => {
    setAutoScrollPaused(false);
    clearAutoResumeTimer();
    // 立即滚动到底部
    scrollToBottom();
  }, [scrollToBottom, clearAutoResumeTimer]);

  // 用户开始交互（选择日志时暂停自动滚动，启动 30 秒恢复定时器）
  const onUserInteractStart = useCallback(() => {
    if (autoScrollEnabled) {
      setAutoScrollPaused(true);
      // 启动 30 秒后自动恢复的定时器
      startAutoResumeTimer();
    }
  }, [autoScrollEnabled, startAutoResumeTimer]);

  // 用户结束交互
  const onUserInteractEnd = useCallback(() => {
    // 不做任何操作，让 30 秒定时器自动恢复
  }, []);

  // 自动滚动到底部（当有新日志且启用自动滚动且未暂停时）
  useEffect(() => {
    if (!autoScrollEnabled || autoScrollPaused) {
      return;
    }

    // 使用 requestAnimationFrame 确保 DOM 更新后再滚动
    const rafId = requestAnimationFrame(() => {
      const container = logsContainerRef.current;
      if (!container) return;

      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth', // 平滑滚动
      });
    });

    return () => cancelAnimationFrame(rafId);
  }, [logs, autoScrollEnabled, autoScrollPaused]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      clearAutoResumeTimer();
    };
  }, [clearAutoResumeTimer]);

  // 添加日志（使用批量优化）
  const addLog = useCallback((message: string, type?: LogEntry['type']) => {
    const logType = type ?? inferLogType(message);
    const newLog: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: formatTimestamp(),
      message: message,
      type: logType,
    };

    // 添加到待添加队列
    pendingLogsRef.current.push(newLog);
  }, []);

  // 清空日志
  const clearLogs = useCallback(() => {
    setLogs([]);
    setAutoScrollPaused(false); // 清空日志后恢复自动滚动
    clearAutoResumeTimer();
  }, [clearAutoResumeTimer]);

  // 复制日志到剪贴板
  const copyLogs = useCallback(async (startIdx?: number, endIdx?: number) => {
    try {
      // 复制前先暂停自动滚动，并启动 30 秒恢复定时器
      if (autoScrollEnabled) {
        setAutoScrollPaused(true);
        startAutoResumeTimer();
      }

      const start = startIdx ?? 0;
      const end = endIdx ?? logs.length - 1;
      const logsToCopy = logs.slice(Math.max(0, start), Math.min(logs.length, end + 1));

      const text = logsToCopy
        .map(log => `[${log.timestamp}] ${log.message}`)
        .join('\n');

      await navigator.clipboard.writeText(text);
      addLog('日志已复制到剪贴板', 'success');
      return true;
    } catch (err) {
      addLog('复制失败: ' + (err as Error).message, 'error');
      return false;
    }
  }, [logs, addLog, autoScrollEnabled, startAutoResumeTimer]);

  // 下载日志为 txt 文件
  const downloadLogs = useCallback(() => {
    try {
      // 文件名格式：功能模块中文+英文+时间.txt
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
      const fileName = `${moduleNameCN}_${moduleNameEN}_${dateStr}_${timeStr}.txt`;

      // 根据平台选择合适的换行符：Windows 用 CRLF，其他用 LF
      const lineBreak = process.platform === 'win32' ? '\r\n' : '\n';
      // 添加 BOM 帮助识别 UTF-8 编码
      const bom = '\uFEFF'; // UTF-8 BOM
      const content = logs
        .map(log => `[${log.timestamp}] ${log.message}`)
        .join(lineBreak);

      // 创建 Blob 并下载，添加 BOM
      const blob = new Blob([bom + content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addLog(`日志已下载: ${fileName}`, 'success');
    } catch (err) {
      addLog('下载失败: ' + (err as Error).message, 'error');
    }
  }, [logs, moduleNameCN, moduleNameEN, addLog]);

  return {
    logs,
    addLog,
    clearLogs,
    copyLogs,
    downloadLogs,
    logsEndRef,
    logsContainerRef,

    // 自动滚动相关
    autoScrollEnabled,
    setAutoScrollEnabled: handleSetAutoScrollEnabled,
    autoScrollPaused,
    resumeAutoScroll,
    scrollToBottom,
    scrollToTop,

    // 用户交互相关
    onUserInteractStart,
    onUserInteractEnd,
  };
}
