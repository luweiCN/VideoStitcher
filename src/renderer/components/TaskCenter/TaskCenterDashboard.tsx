/**
 * 任务中心仪表盘 - 重新设计版
 * 
 * 布局：
 * - 顶部：任务统计 + 系统监控
 * - 中间：并发控制
 * - 底部：左侧任务列表 + 右侧统一日志
 */

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Activity,
  Cpu,
  HardDrive,
  Play,
  Pause,
  List,
  Terminal,
} from 'lucide-react';
import * as Slider from '@radix-ui/react-slider';
import PageHeader from '@/components/PageHeader';
import { useTaskContext } from '@/contexts/TaskContext';
import { Button } from '@/components/Button/Button';
import { OperationLogPanel } from '@/components/OperationLogPanel';
import { useOperationLogs } from '@/hooks/useOperationLogs';
import type { Task } from '@shared/types/task';
import { TASK_TYPE_LABELS } from '@shared/types/task';

// 后端广播的状态类型
interface TaskCenterState {
  isPaused: boolean;
  runningCount: number;
  pendingCount: number;
  taskStats: { pending: number; running: number; completed: number; failed: number; cancelled: number; totalExecutionTime?: number };
  tasks: Task[]; // 任务列表（运行中+待执行，最多20条）
  systemStats: {
    cpu: { usage: number; cores: number[] };
    memory: { total: number; used: number; usedPercent: number; totalGB: string; usedGB: string };
    taskProcess: {
      cpuCores: number;
      totalCores: number;
      totalMemoryMB: string;
    };
  };
  config: { maxConcurrentTasks: number; threadsPerTask: number };
}

interface TaskCenterLog {
  taskId: number;
  taskType: string;
  message: string;
  level: string;
  timestamp: number;
}

interface TaskCenterDashboardProps {
  onBack: () => void;
  onViewAllTasks: () => void;
}

const TaskCenterDashboard: React.FC<TaskCenterDashboardProps> = ({ onBack, onViewAllTasks }) => {
  const {
    pauseAllTasks,
    resumeAllTasks,
    setConcurrency,
    formatRunTime,
    totalRunTime,
    getCpuInfo,
  } = useTaskContext();

  // 格式化任务总耗时（已完成任务的 executionTime 总和）
  const formatTaskTotalTime = () => {
    const ms = taskStats?.totalExecutionTime || 0;
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // 统一状态（由后端每秒广播）
  const [state, setState] = useState<TaskCenterState | null>(null);
  const [cpuCores, setCpuCores] = useState(8);
  const [localMaxTasks, setLocalMaxTasks] = useState(2);
  const [localThreads, setLocalThreads] = useState(4);

  // 统一日志
  const {
    logs,
    addLog,
    clearLogs,
    copyLogs,
    downloadLogs,
    logsContainerRef,
    logsEndRef,
    autoScrollEnabled,
    setAutoScrollEnabled,
    autoScrollPaused,
    resumeAutoScroll,
    scrollToBottom,
    scrollToTop,
    onUserInteractStart,
  } = useOperationLogs({
    moduleNameCN: '任务中心',
    moduleNameEN: 'TaskCenter',
  });

  // 获取 CPU 核心数
  useEffect(() => {
    getCpuInfo().then((info) => {
      setCpuCores(info.cores);
    });
  }, [getCpuInfo]);

  // 监听后端状态广播（每秒更新）
  useEffect(() => {
    const cleanup = window.api.onTaskCenterState?.((newState) => {
      setState(newState);
      setLocalMaxTasks(newState.config.maxConcurrentTasks);
      setLocalThreads(newState.config.threadsPerTask);
    });
    return () => cleanup?.();
  }, []);

  // 初始化加载最近100条日志
  useEffect(() => {
    const loadRecentLogs = async () => {
      try {
        const recentLogs = await window.api.getRecentLogs?.(100);
        if (recentLogs && recentLogs.length > 0) {
          recentLogs.forEach((log) => {
            const taskTypeLabel = log.taskType 
              ? (TASK_TYPE_LABELS[log.taskType as keyof typeof TASK_TYPE_LABELS] || log.taskType)
              : '';
            const prefix = log.taskType ? `[#${log.taskId}] [${taskTypeLabel}]` : '[系统]';
            addLog(`${prefix} ${log.message}`, log.level as any);
          });
        }
      } catch (err) {
        console.error('[TaskCenterDashboard] 加载历史日志失败:', err);
      }
    };
    loadRecentLogs();
  }, []);

  // 监听日志广播
  useEffect(() => {
    const cleanup = window.api.onTaskCenterLog?.((log: TaskCenterLog) => {
      // 系统日志（taskType === 'system'）
      if (log.taskType === 'system') {
        addLog(`[系统] ${log.message}`, log.level as any);
        return;
      }
      // 任务日志
      const taskTypeLabel = TASK_TYPE_LABELS[log.taskType as keyof typeof TASK_TYPE_LABELS] || log.taskType;
      addLog(`[#${log.taskId}] [${taskTypeLabel}] ${log.message}`, log.level as any);
    });
    return () => cleanup?.();
  }, [addLog]);

  const totalThreads = localMaxTasks * localThreads;
  const isOverloaded = totalThreads > cpuCores;

  const handleMaxTasksChange = async (value: number) => {
    setLocalMaxTasks(value);
    await setConcurrency(value, localThreads);
  };

  const handleThreadsChange = async (value: number) => {
    setLocalThreads(value);
    await setConcurrency(localMaxTasks, value);
  };

  // 颜色辅助函数
  const getUsageColor = (usage: number) => {
    if (usage >= 80) return 'bg-rose-500';
    if (usage >= 60) return 'bg-amber-500';
    if (usage >= 40) return 'bg-slate-400';
    return 'bg-slate-600';
  };

  // 从状态中提取数据
  const isPaused = state?.isPaused ?? false;
  const tasks = state?.tasks ?? [];
  const taskStats = state?.taskStats;
  const systemStats = state?.systemStats;
  const taskProcess = state?.systemStats?.taskProcess;

  // 任务占用系统的 CPU 比例
  const taskCpuPercent = taskProcess 
    ? Math.round(taskProcess.cpuCores / taskProcess.totalCores * 100) 
    : 0;
  
  // 任务占用系统的内存比例
  const taskMemoryPercent = taskProcess && systemStats
    ? Math.round(parseFloat(taskProcess.totalMemoryMB) / (systemStats.memory.total / 1024 / 1024) * 100)
    : 0;

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      {/* 页头 */}
      <PageHeader
        onBack={onBack}
        title="任务中心"
        icon={Layers}
        iconColor="text-violet-400"
        description="监控运行状态"
        rightContent={
          <Button variant="ghost" size="sm" onClick={onViewAllTasks}>
            <List className="w-4 h-4 mr-1.5" />
            完整列表
          </Button>
        }
      />

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">
        {/* 顶部：统计 + 系统监控 */}
        <div className="flex gap-4 shrink-0">
          {/* 左侧：任务统计 */}
          <div className="flex gap-3">
            <div className="bg-black/50 border border-slate-800 rounded-lg px-4 py-2 min-w-[100px]">
              <div className="text-[10px] text-slate-600">任务中心运行</div>
              <div className="font-mono text-base font-bold text-white">{formatRunTime()}</div>
              <div className="text-[10px] text-slate-600 mt-1">任务总耗时</div>
              <div className="font-mono text-base font-bold text-violet-400">{formatTaskTotalTime()}</div>
            </div>
            <div className="bg-black/50 border border-slate-800 rounded-lg px-4 py-2 min-w-[70px]">
              <div className="text-xs text-slate-500">执行中</div>
              <div className="text-lg font-bold text-emerald-400">{state?.runningCount ?? 0}</div>
              <div className="text-xs text-slate-500 mt-1">待执行</div>
              <div className="text-lg font-bold text-cyan-400">{state?.pendingCount ?? 0}</div>
            </div>
            <div className="bg-black/50 border border-slate-800 rounded-lg px-4 py-2 min-w-[70px]">
              <div className="text-xs text-slate-500">已完成</div>
              <div className="text-lg font-bold text-white">{taskStats?.completed ?? 0}</div>
              <div className="text-xs text-slate-500 mt-1">失败</div>
              <div className="text-lg font-bold text-rose-400">{taskStats?.failed ?? 0}</div>
            </div>
          </div>

          {/* CPU 核心 */}
          <div className="flex-1 bg-black/50 border border-slate-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400">CPU 核心</span>
              <span className="text-xs text-slate-500 ml-auto">{systemStats?.cpu.cores.length ?? 0} 核心</span>
            </div>
            <div className="flex gap-1">
              {(systemStats?.cpu.cores ?? []).map((usage, index) => (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="w-full h-20 bg-slate-800 rounded relative overflow-hidden">
                    <div
                      className={`absolute bottom-0 left-0 right-0 ${getUsageColor(usage)} transition-all duration-300`}
                      style={{ height: `${usage}%` }}
                    />
                  </div>
                  <span className="text-[8px] text-slate-600 mt-0.5">{index}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 右侧：负载监控 */}
          <div className="flex gap-3">
            {/* 系统负载 */}
            <div className="bg-black/50 border border-slate-800 rounded-lg p-3 min-w-[130px]">
              <div className="text-xs text-slate-500 mb-2">系统负载</div>
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400">CPU</span>
                    <span className="text-sm font-bold text-white">{systemStats?.cpu.usage ?? 0}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${getUsageColor(systemStats?.cpu.usage ?? 0)}`}
                      style={{ width: `${Math.min(systemStats?.cpu.usage ?? 0, 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400">内存</span>
                    <span className="text-sm font-bold text-white">{systemStats?.memory.usedPercent ?? 0}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${getUsageColor(systemStats?.memory.usedPercent ?? 0)}`}
                      style={{ width: `${Math.min(systemStats?.memory.usedPercent ?? 0, 100)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-600 mt-1">
                    {systemStats?.memory.usedGB ?? '0'} / {systemStats?.memory.totalGB ?? '0'} GB
                  </div>
                </div>
              </div>
            </div>
            
            {/* 任务负载 */}
            <div className="bg-black/50 border border-slate-800 rounded-lg p-3 min-w-[130px]">
              <div className="text-xs text-slate-500 mb-2">任务负载</div>
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400">CPU</span>
                    <span className="text-sm font-bold text-cyan-400">{taskCpuPercent}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded overflow-hidden">
                    <div
                      className={`h-full bg-cyan-500 transition-all duration-300`}
                      style={{ width: `${Math.min(taskCpuPercent, 100)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-600 mt-1">
                    {taskProcess?.cpuCores?.toFixed(1) ?? '0'} / {taskProcess?.totalCores ?? 0} 核心
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400">内存</span>
                    <span className="text-sm font-bold text-violet-400">{taskMemoryPercent}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded overflow-hidden">
                    <div
                      className={`h-full bg-violet-500 transition-all duration-300`}
                      style={{ width: `${Math.min(taskMemoryPercent, 100)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-600 mt-1">
                    {taskProcess?.totalMemoryMB ?? '0'} MB
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 并发控制 */}
        <div className="bg-black/50 border border-slate-800 rounded-lg p-3 shrink-0">
          <div className="flex items-center gap-8">
            {/* 并发任务 */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-16">并发任务</span>
                <Slider.Root
                  className="relative flex items-center select-none touch-none w-36 h-5"
                  value={[localMaxTasks]}
                  onValueChange={([v]) => handleMaxTasksChange(v)}
                  max={16}
                  min={1}
                  step={1}
                >
                  <Slider.Track className="bg-slate-800 relative grow rounded-full h-1.5">
                    <Slider.Range className="absolute bg-violet-500 rounded-full h-full" />
                  </Slider.Track>
                  <Slider.Thumb className="block w-4 h-4 bg-white rounded-full shadow-lg hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer transition-colors" />
                </Slider.Root>
                <span className="text-xs text-violet-400 font-mono w-5 text-center">{localMaxTasks}</span>
              </div>
              <span className="text-[10px] text-slate-600 ml-[76px]">同时执行的任务数量</span>
            </div>
            
            {/* 编码线程 */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-16">编码线程</span>
                <Slider.Root
                  className="relative flex items-center select-none touch-none w-36 h-5"
                  value={[localThreads]}
                  onValueChange={([v]) => handleThreadsChange(v)}
                  max={16}
                  min={1}
                  step={1}
                >
                  <Slider.Track className="bg-slate-800 relative grow rounded-full h-1.5">
                    <Slider.Range className="absolute bg-cyan-500 rounded-full h-full" />
                  </Slider.Track>
                  <Slider.Thumb className="block w-4 h-4 bg-white rounded-full shadow-lg hover:bg-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition-colors" />
                </Slider.Root>
                <span className="text-xs text-cyan-400 font-mono w-5 text-center">{localThreads}</span>
              </div>
              <span className="text-[10px] text-slate-600 ml-[76px]">FFmpeg 编码线程（不含解码/滤镜）</span>
            </div>
            
            <div className="flex flex-col items-end ml-auto">
              <div className="text-xs text-slate-500">
                预估线程: <span className="text-slate-300">{totalThreads}</span> / {cpuCores} 核心
                {isOverloaded && <span className="text-amber-400 ml-2">可能超载</span>}
              </div>
            </div>
          </div>
        </div>

        {/* 底部：任务列表 + 日志 */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* 左侧：任务列表 */}
          <div className="w-[420px] flex flex-col bg-black/50 border border-slate-800 rounded-lg overflow-hidden">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium">任务列表</span>
                {isPaused && <span className="text-xs text-amber-400">(已暂停)</span>}
              </div>
              {isPaused ? (
                <Button variant="primary" size="sm" onClick={resumeAllTasks}>
                  <Play className="w-3.5 h-3.5 mr-1" />
                  恢复
                </Button>
              ) : state?.runningCount && state.runningCount > 0 ? (
                <Button variant="ghost" size="sm" onClick={pauseAllTasks}>
                  <Pause className="w-3.5 h-3.5 mr-1" />
                  暂停
                </Button>
              ) : null}
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {tasks.length === 0 ? (
                <div className="text-center py-8">
                  <Layers className="w-10 h-10 text-slate-700 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">
                    {isPaused ? '任务中心已暂停' : '暂无待执行任务'}
                  </p>
                </div>
              ) : (
                tasks.map((task: Task) => (
                  <TaskItem key={task.id} task={task} />
                ))
              )}
            </div>
          </div>

          {/* 右侧：统一日志 */}
          <OperationLogPanel
            logs={logs}
            addLog={addLog}
            clearLogs={clearLogs}
            copyLogs={copyLogs}
            downloadLogs={downloadLogs}
            logsContainerRef={logsContainerRef}
            logsEndRef={logsEndRef}
            autoScrollEnabled={autoScrollEnabled}
            setAutoScrollEnabled={setAutoScrollEnabled}
            autoScrollPaused={autoScrollPaused}
            resumeAutoScroll={resumeAutoScroll}
            scrollToBottom={scrollToBottom}
            scrollToTop={scrollToTop}
            onUserInteractStart={onUserInteractStart}
            height="100%"
            themeColor="violet"
            className="flex-1"
            titleComponent={
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-medium">执行日志</span>
                <span className="text-xs text-slate-500 ml-2">{logs.length} 条</span>
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
};

// 任务项组件
const TaskItem: React.FC<{ task: Task }> = ({ task }) => {
  const taskTypeLabel = task.type ? TASK_TYPE_LABELS[task.type] : '未知类型';
  const isRunning = task.status === 'running';
  
  // 执行耗时（仅运行中任务显示）
  const elapsed = task.startedAt ? Math.floor((Date.now() - task.startedAt) / 1000) : 0;
  const elapsedStr = elapsed > 60 
    ? `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}` 
    : `${elapsed}s`;

  return (
    <div className="group bg-slate-900/50 border border-slate-800/60 rounded-lg p-3 hover:border-slate-700 transition-all duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isRunning ? (
            <div className="relative">
              <div className="w-2 h-2 bg-emerald-400 rounded-full" />
              <div className="absolute inset-0 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
            </div>
          ) : (
            <div className="w-2 h-2 bg-slate-500 rounded-full" />
          )}
          <span className="text-xs text-slate-500 font-mono">#{task.id}</span>
          <span className="text-sm font-medium text-white">{taskTypeLabel}</span>
        </div>
        {isRunning && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-mono">PID: {task.pid || '--'}</span>
            <span className="text-base font-mono font-bold text-violet-400">
              {elapsedStr}
            </span>
          </div>
        )}
      </div>
      {isRunning && task.currentStep && (
        <div className="text-xs text-slate-500 truncate mt-1 ml-4">
          {task.currentStep}
        </div>
      )}
    </div>
  );
};

export default TaskCenterDashboard;
