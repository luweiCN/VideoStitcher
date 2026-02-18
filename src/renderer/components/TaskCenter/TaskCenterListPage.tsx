/**
 * 任务中心列表页面
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Layers,
  Clock,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  FolderOpen,
  ChevronRight,
  Search,
  Filter,
  Loader2,
} from 'lucide-react';
import PageHeader from '@renderer/components/PageHeader';
import TaskStatusBadge from './TaskStatusBadge';
import ConcurrencyControl from './ConcurrencyControl';
import { useTaskContext } from '@renderer/contexts/TaskContext';
import { Button } from '@renderer/components/Button/Button';
import type { Task, TaskStatus, TaskType } from '@shared/types/task';

interface TaskCenterListPageProps {
  onBack: () => void;
  onOpenTaskDetail?: (taskId: string) => void;
}

const taskTypeLabels: Record<TaskType, string> = {
  videoMerge: '横竖屏合成',
  resize: '智能改尺寸',
  imageMaterial: '图片素材处理',
  coverFormat: '封面格式转换',
  coverCompress: '封面压缩',
  losslessGrid: '无损九宫格',
  videoStitcher: 'A+B拼接',
};

const TaskCenterListPage: React.FC<TaskCenterListPageProps> = ({ onBack }) => {
  const {
    runningTasks,
    queueStatus,
    pauseTask,
    resumeTask,
    cancelTask,
    retryTask,
    deleteTask,
    pauseAllTasks,
    formatRunTime,
  } = useTaskContext();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<TaskType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 加载任务列表
  useEffect(() => {
    const loadTasks = async () => {
      setLoading(true);
      try {
        const options: any = {};
        if (statusFilter !== 'all') options.status = statusFilter;
        if (typeFilter !== 'all') options.type = typeFilter;
        if (searchQuery) options.search = searchQuery;

        const result = await window.api.getTasks(options);
        setTasks(result.tasks || []);
      } catch (err) {
        console.error('[TaskCenterListPage] 加载任务失败:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, [statusFilter, typeFilter, searchQuery]);

  // 合并运行中任务和列表任务
  const allTasks = useMemo(() => {
    const runningIds = new Set(runningTasks.map((t) => t.id));
    const listTasks = tasks.filter((t) => !runningIds.has(t.id));
    return [...runningTasks, ...listTasks];
  }, [runningTasks, tasks]);

  // 统计数据
  const stats = useMemo(() => {
    const all = allTasks.length;
    const pending = allTasks.filter((t) => t.status === 'pending').length;
    const running = allTasks.filter((t) => t.status === 'running' || t.status === 'queued').length;
    const completed = allTasks.filter((t) => t.status === 'completed').length;
    const failed = allTasks.filter((t) => t.status === 'failed').length;
    return { all, pending, running, completed, failed };
  }, [allTasks]);

  // 清空已完成任务
  const handleClearCompleted = async () => {
    if (!confirm('确定要清空所有已完成的任务吗？')) return;
    try {
      const completedTasks = allTasks.filter((t) => t.status === 'completed');
      await Promise.all(completedTasks.map((t) => deleteTask(t.id)));
    } catch (err) {
      console.error('[TaskCenterListPage] 清空失败:', err);
    }
  };

  // 打开输出目录
  const handleOpenOutputDir = async (task: Task) => {
    await window.api.openPath(task.outputDir);
  };

  // 格式化时间
  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 格式化执行时间
  const formatExecutionTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // 获取操作按钮
  const getTaskActions = (task: Task) => {
    const actions: React.ReactNode[] = [];

    switch (task.status) {
      case 'pending':
        actions.push(
          <Button key="delete" variant="ghost" size="sm" onClick={() => deleteTask(task.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        );
        break;
      case 'queued':
        actions.push(
          <Button key="cancel" variant="ghost" size="sm" onClick={() => cancelTask(task.id)}>
            <XCircle className="w-3.5 h-3.5" />
          </Button>
        );
        break;
      case 'running':
        actions.push(
          <Button key="pause" variant="ghost" size="sm" onClick={() => pauseTask(task.id)}>
            <Pause className="w-3.5 h-3.5" />
          </Button>,
          <Button key="cancel" variant="ghost" size="sm" onClick={() => cancelTask(task.id)}>
            <XCircle className="w-3.5 h-3.5" />
          </Button>
        );
        break;
      case 'paused':
        actions.push(
          <Button key="resume" variant="ghost" size="sm" onClick={() => resumeTask(task.id)}>
            <Play className="w-3.5 h-3.5" />
          </Button>,
          <Button key="cancel" variant="ghost" size="sm" onClick={() => cancelTask(task.id)}>
            <XCircle className="w-3.5 h-3.5" />
          </Button>,
          <Button key="delete" variant="ghost" size="sm" onClick={() => deleteTask(task.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        );
        break;
      case 'completed':
        actions.push(
          <Button
            key="open"
            variant="ghost"
            size="sm"
            onClick={() => handleOpenOutputDir(task)}
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </Button>,
          <Button key="delete" variant="ghost" size="sm" onClick={() => deleteTask(task.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        );
        break;
      case 'failed':
      case 'cancelled':
        actions.push(
          <Button key="retry" variant="ghost" size="sm" onClick={() => retryTask(task.id)}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>,
          <Button key="delete" variant="ghost" size="sm" onClick={() => deleteTask(task.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        );
        break;
    }

    return actions;
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* 页头 */}
      <PageHeader
        onBack={onBack}
        title="任务中心"
        icon={Layers}
        iconColor="text-violet-400"
        description="管理所有处理任务"
      />

      {/* 主内容区 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* 统计概览 */}
          <div className="grid grid-cols-5 gap-4">
            <StatCard label="待执行" value={stats.pending} icon={Clock} color="slate" />
            <StatCard
              label="执行中"
              value={stats.running}
              icon={Loader2}
              color="violet"
              animate
            />
            <StatCard label="已完成" value={stats.completed} icon={CheckCircle} color="emerald" />
            <StatCard label="失败" value={stats.failed} icon={XCircle} color="rose" />
            <StatCard
              label="总计"
              value={stats.all}
              icon={Layers}
              color="cyan"
              subText={runningTasks.length > 0 ? `运行时间: ${formatRunTime()}` : undefined}
            />
          </div>

          {/* 并发控制 */}
          <ConcurrencyControl />

          {/* 筛选栏 */}
          <div className="flex items-center gap-4 p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
            {/* 状态筛选 */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')}
                className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-violet-500"
              >
                <option value="all">全部状态</option>
                <option value="pending">待执行</option>
                <option value="queued">排队中</option>
                <option value="running">执行中</option>
                <option value="paused">已暂停</option>
                <option value="completed">已完成</option>
                <option value="failed">失败</option>
                <option value="cancelled">已取消</option>
              </select>
            </div>

            {/* 类型筛选 */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TaskType | 'all')}
              className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-violet-500"
            >
              <option value="all">全部类型</option>
              {Object.entries(taskTypeLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>

            {/* 搜索框 */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="搜索任务名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg pl-10 pr-4 py-1.5 focus:outline-none focus:border-violet-500"
              />
            </div>

            {/* 清空已完成 */}
            {stats.completed > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearCompleted}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                清空已完成
              </Button>
            )}
          </div>

          {/* 任务列表 */}
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
              </div>
            ) : allTasks.length === 0 ? (
              <div className="text-center py-12">
                <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">暂无任务</p>
              </div>
            ) : (
              allTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  actions={getTaskActions(task)}
                  formatTime={formatTime}
                  formatExecutionTime={formatExecutionTime}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* 底部操作栏（有运行中任务时显示） */}
      {runningTasks.length > 0 && (
        <div className="border-t border-slate-800 bg-slate-900/80 backdrop-blur-xl px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
              <span className="text-sm text-slate-300">
                {runningTasks.length} 个任务运行中
              </span>
              <span className="text-xs text-slate-500">
                运行时间: {formatRunTime()}
              </span>
            </div>
            <Button variant="secondary" themeColor="amber" size="sm" onClick={pauseAllTasks}>
              <Pause className="w-3.5 h-3.5 mr-1.5" />
              全部暂停
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// 统计卡片组件
const StatCard: React.FC<{
  label: string;
  value: number;
  icon: React.FC<{ className?: string }>;
  color: string;
  animate?: boolean;
  subText?: string;
}> = ({ label, value, icon: Icon, color, animate, subText }) => {
  const colorClasses: Record<string, string> = {
    slate: 'text-slate-400',
    violet: 'text-violet-400',
    emerald: 'text-emerald-400',
    rose: 'text-rose-400',
    cyan: 'text-cyan-400',
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${colorClasses[color]} ${animate ? 'animate-spin' : ''}`} />
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {subText && <div className="text-xs text-slate-500 mt-1">{subText}</div>}
    </div>
  );
};

// 任务卡片组件
const TaskCard: React.FC<{
  task: Task;
  actions: React.ReactNode[];
  formatTime: (date: Date | string) => string;
  formatExecutionTime: (ms: number) => string;
}> = ({ task, actions, formatTime, formatExecutionTime }) => {
  const typeLabel = taskTypeLabels[task.type] || task.type;
  const progress = task.progress || 0;
  const isRunning = task.status === 'running';

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
      {/* 头部 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
            {task.thumbnail ? (
              <img
                src={task.thumbnail}
                alt=""
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <Layers className="w-5 h-5 text-slate-500" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">{task.name}</h3>
            <p className="text-xs text-slate-500">{typeLabel}</p>
          </div>
        </div>
        <TaskStatusBadge status={task.status} />
      </div>

      {/* 进度条（运行中时显示） */}
      {isRunning && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>{task.currentStep || '处理中...'}</span>
            <span className="text-violet-400 font-medium">{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* 元信息 */}
      <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
        <span>输出: {task.outputDir}</span>
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span>创建: {formatTime(task.createdAt)}</span>
        {task.executionTime > 0 && (
          <span>执行时间: {formatExecutionTime(task.executionTime)}</span>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-800">
        {actions}
        <Button variant="ghost" size="sm">
          详情
          <ChevronRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
};

export default TaskCenterListPage;
