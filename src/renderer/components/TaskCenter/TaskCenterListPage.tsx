/**
 * 任务中心列表页面 - 完整版（分页 + 筛选）
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Clock,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Loader2,
} from 'lucide-react';
import PageHeader from '@renderer/components/PageHeader';
import TaskStatusBadge from './TaskStatusBadge';
import { useTaskContext } from '@renderer/contexts/TaskContext';
import { Button } from '@renderer/components/Button/Button';
import type { Task, TaskStatus, TaskType } from '@shared/types/task';

interface TaskCenterListPageProps {
  onBack: () => void;
}

const PAGE_SIZE = 20;

const taskTypeLabels: Record<string, string> = {
  video_merge: '极速合成',
  video_stitch: 'A+B拼接',
  video_resize: '智能改尺寸',
  image_material: '图片素材处理',
  cover_format: '封面格式转换',
  cover_compress: '封面压缩',
  lossless_grid: '无损九宫格',
};

const TaskCenterListPage: React.FC<TaskCenterListPageProps> = ({ onBack }) => {
  const { queueStatus, pauseTask, resumeTask, cancelTask, retryTask, deleteTask, pauseAllTasks, formatRunTime } = useTaskContext();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // 加载任务列表
  const loadTasks = async () => {
    setLoading(true);
    try {
      const options: any = {
        page: currentPage,
        pageSize: PAGE_SIZE,
        withFiles: true,
        withOutputs: true,
      };
      if (statusFilter !== 'all') {
        options.filter = { status: [statusFilter] };
      }
      if (typeFilter !== 'all') {
        options.filter = options.filter || {};
        options.filter.type = [typeFilter];
      }
      if (searchQuery) {
        options.filter = options.filter || {};
        options.filter.search = searchQuery;
      }

      const result = await window.api.getTasks(options);
      setTasks((result.tasks || []) as Task[]);
      setTotal(result.total || 0);
    } catch (err) {
      console.error('[TaskCenterListPage] 加载任务失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [statusFilter, typeFilter, searchQuery, currentPage]);

  // 筛选条件变化时重置页码
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, typeFilter, searchQuery]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // 清空已完成任务
  const handleClearCompleted = async () => {
    if (!confirm('确定要清空所有已完成的任务吗？')) return;
    try {
      await window.api.clearCompletedTasks();
      loadTasks();
    } catch (err) {
      console.error('[TaskCenterListPage] 清空失败:', err);
    }
  };

  // 打开输出目录
  const handleOpenOutputDir = async (outputDir: string) => {
    if (outputDir) {
      await window.api.openPath(outputDir);
    }
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 格式化执行时间
  const formatExecutionTime = (ms: number | undefined) => {
    if (!ms) return '-';
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
          <Button key="cancel" variant="ghost" size="sm" onClick={() => cancelTask(task.id)}>
            <XCircle className="w-3.5 h-3.5" />
          </Button>,
          <Button key="delete" variant="ghost" size="sm" onClick={() => deleteTask(task.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        );
        break;
      case 'running':
        actions.push(
          <Button key="cancel" variant="ghost" size="sm" onClick={() => cancelTask(task.id)}>
            <XCircle className="w-3.5 h-3.5" />
          </Button>
        );
        break;
      case 'completed':
        actions.push(
          <Button key="open" variant="ghost" size="sm" onClick={() => handleOpenOutputDir(task.outputDir || '')}>
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

  const runningCount = queueStatus?.running || 0;
  const queuedCount = queueStatus?.queued || 0;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* 页头 */}
      <PageHeader onBack={onBack} title="任务列表" icon={Layers} iconColor="text-violet-400" description="查看所有处理任务" />

      {/* 主内容区 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* 筛选栏 */}
          <div className="flex items-center gap-4 p-4 bg-black/50 border border-slate-800 rounded-xl">
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
              onChange={(e) => setTypeFilter(e.target.value)}
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
                placeholder="搜索任务..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg pl-10 pr-4 py-1.5 focus:outline-none focus:border-violet-500"
              />
            </div>

            {/* 清空已完成 */}
            <Button variant="ghost" size="sm" onClick={handleClearCompleted}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              清空已完成
            </Button>
          </div>

          {/* 统计信息 */}
          <div className="flex items-center gap-6 text-xs text-slate-500">
            <span>
              共 <span className="text-slate-300">{total}</span> 个任务
            </span>
            {runningCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                执行中 <span className="text-emerald-400">{runningCount}</span>
              </span>
            )}
            {queuedCount > 0 && (
              <span>
                排队中 <span className="text-cyan-400">{queuedCount}</span>
              </span>
            )}
          </div>

          {/* 任务列表 */}
          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-12 bg-black/30 border border-slate-800 rounded-xl">
                <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">暂无任务</p>
              </div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-4 p-4 bg-black/50 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors"
                >
                  {/* 状态 */}
                  <TaskStatusBadge status={task.status} />

                  {/* 任务信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white truncate">
                        {task.name || `任务 #${task.id}`}
                      </span>
                      <span className="text-xs text-slate-500">
                        {taskTypeLabels[task.type || ''] || task.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                      <span>{formatTime(task.createdAt || 0)}</span>
                      <span>执行时间: {formatExecutionTime(task.executionTime)}</span>
                      {task.progress !== undefined && task.progress > 0 && (
                        <span className="text-violet-400">{task.progress}%</span>
                      )}
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1">{getTaskActions(task)}</div>
                </div>
              ))
            )}
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button variant="ghost" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
                上一页
              </Button>
              <span className="text-sm text-slate-400">
                {currentPage} / {totalPages}
              </span>
              <Button variant="ghost" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                下一页
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 底部操作栏（有运行中任务时显示） */}
      {runningCount > 0 && (
        <div className="border-t border-slate-800 bg-black/80 backdrop-blur-xl px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
              <span className="text-sm text-slate-300">{runningCount} 个任务执行中</span>
              <span className="text-xs text-slate-500">运行时间: {formatRunTime()}</span>
            </div>
            <Button variant="secondary" size="sm" onClick={pauseAllTasks}>
              <Pause className="w-3.5 h-3.5 mr-1" />
              全部暂停
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskCenterListPage;
