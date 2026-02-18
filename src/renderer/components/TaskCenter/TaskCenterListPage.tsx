/**
 * 任务中心列表页面 - 重新设计版
 * 
 * 功能：
 * - 任务类型和状态筛选
 * - 任务ID搜索
 * - 多选批量操作
 * - 单个任务操作（删除、取消、重新执行、详情）
 * - 素材文件预览
 * - 分页
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Layers,
  XCircle,
  Trash2,
  RefreshCw,
  FolderOpen,
  Search,
  Loader2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileVideo,
  Image as ImageIcon,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Pencil,
  FileX,
} from 'lucide-react';
import * as Select from '@radix-ui/react-select';
import * as Checkbox from '@radix-ui/react-checkbox';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import PageHeader from '@renderer/components/PageHeader';
import TaskStatusBadge from './TaskStatusBadge';
import { useTaskContext } from '@renderer/contexts/TaskContext';
import { Button } from '@renderer/components/Button';
import type { Task, TaskStatus, TaskType, TaskFile } from '@shared/types/task';
import { TASK_TYPE_LABELS } from '@shared/types/task';
import FilePreviewModal from '@renderer/components/FilePreviewModal';
import { useFileExistsCache } from '@renderer/hooks/useFileExistsCache';

interface TaskCenterListPageProps {
  onBack: () => void;
}

const PAGE_SIZE = 15;

const TaskCenterListPage: React.FC<TaskCenterListPageProps> = ({ onBack }) => {
  const { queueStatus, cancelTask, retryTask, deleteTask, formatRunTime } = useTaskContext();
  const { checkPaths, pathStatus } = useFileExistsCache();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<TaskType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [isIndeterminate, setIsIndeterminate] = useState(false);

  const [previewFiles, setPreviewFiles] = useState<{ files: TaskFile[]; index: number } | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<number | string>>(new Set());

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const options: Record<string, unknown> = {
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
        (options.filter as Record<string, unknown>).type = [typeFilter];
      }
      if (searchQuery) {
        options.filter = options.filter || {};
        (options.filter as Record<string, unknown>).search = searchQuery;
      }

      const result = await window.api.getTasks(options);
      const loadedTasks = (result.tasks || []) as Task[];
      setTasks(loadedTasks);
      setTotal(result.total || 0);
      setSelectedIds(new Set());

      // 收集所有需要检查的路径
      const pathsToCheck = new Set<string>();
      loadedTasks.forEach((task) => {
        // 检查素材文件
        (task.files || []).forEach((file) => {
          if (file.path) pathsToCheck.add(file.path);
        });
        // 检查输出文件
        (task.outputs || []).forEach((output) => {
          if (output.path) pathsToCheck.add(output.path);
        });
        // 检查输出目录
        if (task.outputDir) pathsToCheck.add(task.outputDir);
      });

      // 批量检查路径是否存在
      if (pathsToCheck.size > 0) {
        checkPaths(Array.from(pathsToCheck));
      }
    } catch (err) {
      console.error('[TaskCenterListPage] 加载任务失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [statusFilter, typeFilter, searchQuery, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [statusFilter, typeFilter, searchQuery]);

  useEffect(() => {
    if (tasks.length === 0) {
      setIsAllSelected(false);
      setIsIndeterminate(false);
      return;
    }
    const allSelected = tasks.every((t) => selectedIds.has(t.id));
    const someSelected = tasks.some((t) => selectedIds.has(t.id));
    setIsAllSelected(allSelected);
    setIsIndeterminate(someSelected && !allSelected);
  }, [selectedIds, tasks]);

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      setSelectedIds(new Set(tasks.map((t) => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectTask = (taskId: number, checked: boolean | 'indeterminate') => {
    const newSet = new Set(selectedIds);
    if (checked === true) {
      newSet.add(taskId);
    } else {
      newSet.delete(taskId);
    }
    setSelectedIds(newSet);
  };

  const handleSearch = () => {
    setSearchQuery(searchInput);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 个任务吗？`)) return;
    for (const id of selectedIds) {
      await deleteTask(id);
    }
    setSelectedIds(new Set());
    loadTasks();
  };

  const handleBatchCancel = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要取消选中的 ${selectedIds.size} 个任务吗？`)) return;
    for (const id of selectedIds) {
      const task = tasks.find((t) => t.id === id);
      if (task && (task.status === 'pending' || task.status === 'running')) {
        await cancelTask(id);
      }
    }
    setSelectedIds(new Set());
    loadTasks();
  };

  const handleBatchRetry = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要重新执行选中的 ${selectedIds.size} 个任务吗？`)) return;
    for (const id of selectedIds) {
      const task = tasks.find((t) => t.id === id);
      if (task && task.status !== 'running') {
        await retryTask(id);
      }
    }
    setSelectedIds(new Set());
    loadTasks();
  };

  const handleBatchUpdateOutputDir = async () => {
    if (selectedIds.size === 0) return;
    const newDir = await window.api.pickOutDir();
    if (!newDir) return;
    
    for (const id of selectedIds) {
      await window.api.updateTaskOutputDir(id, newDir);
    }
    loadTasks();
  };

  const handleUpdateOutputDir = async (taskId: number) => {
    const task = tasks.find((t) => t.id === taskId);
    const newDir = await window.api.pickOutDir(task?.outputDir);
    if (!newDir) return;
    await window.api.updateTaskOutputDir(taskId, newDir);
    loadTasks();
  };

  const handleOpenOutputDir = async (outputDir: string) => {
    if (outputDir) {
      await window.api.openPath(outputDir);
    }
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '-';
    const d = new Date(timestamp);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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

  const getFileType = (path: string): 'video' | 'image' => {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'flv'];
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
    if (videoExts.includes(ext)) return 'video';
    if (imageExts.includes(ext)) return 'image';
    return 'video';
  };

  const getFileIcon = (type: 'video' | 'image') => {
    return type === 'video' ? FileVideo : ImageIcon;
  };

  const getFileName = (path: string) => {
    return path.split(/[/\\]/).pop() || path;
  };

  const handlePreviewFile = (files: TaskFile[], index: number) => {
    setPreviewFiles({ files, index });
  };

  const handlePreviewPrevious = () => {
    if (previewFiles && previewFiles.index > 0) {
      setPreviewFiles({ ...previewFiles, index: previewFiles.index - 1 });
    }
  };

  const handlePreviewNext = () => {
    if (previewFiles && previewFiles.index < previewFiles.files.length - 1) {
      setPreviewFiles({ ...previewFiles, index: previewFiles.index + 1 });
    }
  };

  const toggleExpandTask = (taskId: number | string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  const runningCount = queueStatus?.running || 0;

  const canRetry = useCallback((status: TaskStatus) => status !== 'running', []);
  const canCancel = useCallback((status: TaskStatus) => status === 'pending' || status === 'running', []);
  const canOpenOutput = useCallback((status: TaskStatus) => status === 'completed', []);

  const selectedCount = selectedIds.size;
  const hasSelection = selectedCount > 0;

  const batchCanRetry = useMemo(() => {
    return Array.from(selectedIds).some((id) => {
      const task = tasks.find((t) => t.id === id);
      return task && canRetry(task.status);
    });
  }, [selectedIds, tasks, canRetry]);

  const batchCanCancel = useMemo(() => {
    return Array.from(selectedIds).some((id) => {
      const task = tasks.find((t) => t.id === id);
      return task && canCancel(task.status);
    });
  }, [selectedIds, tasks, canCancel]);

  const previewFileItems = useMemo(() => {
    if (!previewFiles) return [];
    return previewFiles.files.map((f) => ({
      path: f.path,
      name: getFileName(f.path),
      type: getFileType(f.path),
    }));
  }, [previewFiles]);

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      <PageHeader
        onBack={onBack}
        title="任务列表"
        icon={Layers}
        iconColor="text-violet-400"
        description={`共 ${total} 个任务`}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0 p-4 border-b border-slate-800 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">状态</label>
              <Select.Root value={statusFilter} onValueChange={(v) => setStatusFilter(v as TaskStatus | 'all')}>
                <Select.Trigger className="inline-flex items-center justify-between gap-2 px-3 py-1.5 bg-black/50 border border-slate-700 rounded-lg text-sm text-slate-300 hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 min-w-[120px] cursor-pointer">
                  <Select.Value />
                  <Select.Icon>
                    <ChevronRight className="w-3 h-3 rotate-90" />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-xl z-50" position="popper" sideOffset={4}>
                    <Select.Viewport className="p-1">
                      <Select.Item value="all" className="flex items-center px-3 py-2 text-sm text-slate-300 rounded cursor-pointer hover:bg-slate-800 focus:outline-none focus:bg-slate-800 select-none">
                        <Select.ItemText>全部状态</Select.ItemText>
                      </Select.Item>
                      <Select.Item value="pending" className="flex items-center px-3 py-2 text-sm text-slate-300 rounded cursor-pointer hover:bg-slate-800 focus:outline-none focus:bg-slate-800 select-none">
                        <Select.ItemText>待执行</Select.ItemText>
                      </Select.Item>
                      <Select.Item value="running" className="flex items-center px-3 py-2 text-sm text-slate-300 rounded cursor-pointer hover:bg-slate-800 focus:outline-none focus:bg-slate-800 select-none">
                        <Select.ItemText>执行中</Select.ItemText>
                      </Select.Item>
                      <Select.Item value="completed" className="flex items-center px-3 py-2 text-sm text-slate-300 rounded cursor-pointer hover:bg-slate-800 focus:outline-none focus:bg-slate-800 select-none">
                        <Select.ItemText>已完成</Select.ItemText>
                      </Select.Item>
                      <Select.Item value="failed" className="flex items-center px-3 py-2 text-sm text-slate-300 rounded cursor-pointer hover:bg-slate-800 focus:outline-none focus:bg-slate-800 select-none">
                        <Select.ItemText>失败</Select.ItemText>
                      </Select.Item>
                      <Select.Item value="cancelled" className="flex items-center px-3 py-2 text-sm text-slate-300 rounded cursor-pointer hover:bg-slate-800 focus:outline-none focus:bg-slate-800 select-none">
                        <Select.ItemText>已取消</Select.ItemText>
                      </Select.Item>
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">类型</label>
              <Select.Root value={typeFilter} onValueChange={(v) => setTypeFilter(v as TaskType | 'all')}>
                <Select.Trigger className="inline-flex items-center justify-between gap-2 px-3 py-1.5 bg-black/50 border border-slate-700 rounded-lg text-sm text-slate-300 hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 min-w-[140px] cursor-pointer">
                  <Select.Value />
                  <Select.Icon>
                    <ChevronRight className="w-3 h-3 rotate-90" />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-xl z-50" position="popper" sideOffset={4}>
                    <Select.Viewport className="p-1">
                      <Select.Item value="all" className="flex items-center px-3 py-2 text-sm text-slate-300 rounded cursor-pointer hover:bg-slate-800 focus:outline-none focus:bg-slate-800 select-none">
                        <Select.ItemText>全部类型</Select.ItemText>
                      </Select.Item>
                      {Object.entries(TASK_TYPE_LABELS).map(([key, label]) => (
                        <Select.Item key={key} value={key} className="flex items-center px-3 py-2 text-sm text-slate-300 rounded cursor-pointer hover:bg-slate-800 focus:outline-none focus:bg-slate-800 select-none">
                          <Select.ItemText>{label}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>

            <div className="flex items-center gap-2 flex-1 max-w-xs">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="搜索任务 ID..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full bg-black/50 border border-slate-700 rounded-lg pl-9 pr-8 py-1.5 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
                />
                {searchInput && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <Button variant="primary" size="sm" onClick={handleSearch}>
                搜索
              </Button>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {runningCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-xs text-emerald-400">{runningCount} 个执行中</span>
                  <span className="text-xs text-slate-500">· {formatRunTime()}</span>
                </div>
              )}
            </div>
          </div>

          {hasSelection && (
            <div className="flex items-center gap-4 px-4 py-3 bg-violet-500/10 border border-violet-500/20 rounded-lg">
              <span className="text-sm text-violet-300">
                已选择 <span className="font-semibold text-violet-200">{selectedCount}</span> 个任务
              </span>
              <div className="h-4 w-px bg-slate-700" />
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                取消选择
              </Button>
              {batchCanRetry && (
                <Button variant="secondary" size="sm" onClick={handleBatchRetry}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  重新执行
                </Button>
              )}
              {batchCanCancel && (
                <Button variant="ghost" size="sm" onClick={handleBatchCancel}>
                  <XCircle className="w-3.5 h-3.5 mr-1.5" />
                  取消任务
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleBatchUpdateOutputDir}>
                <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                修改输出目录
              </Button>
              <Button variant="ghost" size="sm" className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10" onClick={handleBatchDelete}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                删除
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <Layers className="w-12 h-12 mb-3 text-slate-600" />
              <p className="text-sm">暂无任务</p>
            </div>
          ) : (
            <div className="p-4">
              <div className="bg-black/30 border border-slate-800 rounded-xl overflow-hidden">
                <div className="grid grid-cols-[40px_70px_140px_90px_1fr_1fr_120px_130px_100px] gap-2 px-4 py-3 bg-slate-900/50 border-b border-slate-800 text-xs text-slate-500 font-medium">
                  <div className="flex items-center justify-center">
                    <Checkbox.Root
                      checked={isAllSelected ? true : isIndeterminate ? 'indeterminate' : false}
                      onCheckedChange={handleSelectAll}
                      className="w-4 h-4 bg-black border border-slate-600 rounded flex items-center justify-center hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 cursor-pointer data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500 data-[state=indeterminate]:bg-violet-500/50 data-[state=indeterminate]:border-violet-500/50"
                    >
                      <Checkbox.Indicator>
                        {isAllSelected ? <Check className="w-3 h-3 text-white" /> : <div className="w-2 h-0.5 bg-white rounded" />}
                      </Checkbox.Indicator>
                    </Checkbox.Root>
                  </div>
                  <div>ID</div>
                  <div>类型</div>
                  <div>状态</div>
                  <div>素材</div>
                  <div>输出</div>
                  <div>输出目录</div>
                  <div>创建时间 / 耗时</div>
                  <div className="text-right">操作</div>
                </div>

                <div className="divide-y divide-slate-800/50">
                  {tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      isSelected={selectedIds.has(task.id)}
                      isExpanded={expandedTasks.has(task.id)}
                      isOutputExpanded={expandedTasks.has(`output-${task.id}`)}
                      onSelect={(checked) => handleSelectTask(task.id, checked)}
                      onToggleExpand={() => toggleExpandTask(task.id)}
                      onToggleOutputExpand={() => toggleExpandTask(`output-${task.id}`)}
                      onRetry={() => retryTask(task.id)}
                      onCancel={() => cancelTask(task.id)}
                      onDelete={() => deleteTask(task.id)}
                      onOpenOutput={() => handleOpenOutputDir(task.outputDir || '')}
                      onUpdateOutputDir={() => handleUpdateOutputDir(task.id)}
                      onPreviewFile={(index) => handlePreviewFile(task.files || [], index)}
                      onPreviewOutput={(index) => {
                        const outputs = task.outputs || [];
                        const outputFiles = outputs.map(o => ({
                          path: o.path,
                          category: 'output',
                          category_name: '输出',
                          index: 0,
                        }));
                        setPreviewFiles({ files: outputFiles, index });
                      }}
                      canRetry={canRetry(task.status)}
                      canCancel={canCancel(task.status)}
                      canOpenOutput={canOpenOutput(task.status)}
                      pathStatus={pathStatus}
                      formatTime={formatTime}
                      formatExecutionTime={formatExecutionTime}
                      getFileName={getFileName}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="shrink-0 px-4 py-3 border-t border-slate-800 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              显示 {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, total)} / 共 {total} 条
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1 mx-2">
                {getPageNumbers().map((page, index) =>
                  page === 'ellipsis' ? (
                    <span key={`ellipsis-${index}`} className="px-2 text-slate-600">
                      ...
                    </span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`w-8 h-8 text-sm rounded-lg transition-colors cursor-pointer ${
                        currentPage === page
                          ? 'bg-violet-500 text-white font-medium'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}
              </div>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <FilePreviewModal
        file={previewFileItems[previewFiles?.index ?? -1] || null}
        visible={!!previewFiles}
        onClose={() => setPreviewFiles(null)}
        allFiles={previewFileItems}
        currentIndex={previewFiles?.index ?? -1}
        onPrevious={previewFiles && previewFiles.index > 0 ? handlePreviewPrevious : undefined}
        onNext={previewFiles && previewFiles.index < previewFiles.files.length - 1 ? handlePreviewNext : undefined}
        themeColor="violet"
      />
    </div>
  );
};

interface TaskRowProps {
  task: Task;
  isSelected: boolean;
  isExpanded: boolean;
  isOutputExpanded: boolean;
  onSelect: (checked: boolean | 'indeterminate') => void;
  onToggleExpand: () => void;
  onToggleOutputExpand: () => void;
  onRetry: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onOpenOutput: () => void;
  onUpdateOutputDir: () => void;
  onPreviewFile: (index: number) => void;
  onPreviewOutput: (index: number) => void;
  canRetry: boolean;
  canCancel: boolean;
  canOpenOutput: boolean;
  pathStatus: Map<string, boolean>;
  formatTime: (timestamp: number) => string;
  formatExecutionTime: (ms: number | undefined) => string;
  getFileName: (path: string) => string;
}

const TaskRow: React.FC<TaskRowProps> = ({
  task,
  isSelected,
  isExpanded,
  isOutputExpanded,
  onSelect,
  onToggleExpand,
  onToggleOutputExpand,
  onRetry,
  onCancel,
  onDelete,
  onOpenOutput,
  onUpdateOutputDir,
  onPreviewFile,
  onPreviewOutput,
  canRetry,
  canCancel,
  canOpenOutput,
  pathStatus,
  formatTime,
  formatExecutionTime,
  getFileName,
}) => {
  const taskTypeLabel = task.type ? TASK_TYPE_LABELS[task.type] : '未知类型';
  const files = task.files || [];
  const outputs = task.outputs || [];
  const displayCount = isExpanded ? files.length : 4;
  const outputDisplayCount = isOutputExpanded ? outputs.length : Math.min(outputs.length, 4);

  const getFileType = (path: string): 'video' | 'image' => {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'flv'];
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
    if (videoExts.includes(ext)) return 'video';
    if (imageExts.includes(ext)) return 'image';
    return 'video';
  };

  const getFileIcon = (type: 'video' | 'image') => {
    return type === 'video' ? FileVideo : ImageIcon;
  };

  const getCategoryColor = (index: number) => {
    const colors = [
      'bg-violet-500/20 text-violet-300 border-violet-500/30 hover:bg-violet-500/30',
      'bg-cyan-500/20 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/30',
      'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30',
      'bg-rose-500/20 text-rose-300 border-rose-500/30 hover:bg-rose-500/30',
      'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30',
      'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30 hover:bg-fuchsia-500/30',
      'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/30',
      'bg-pink-500/20 text-pink-300 border-pink-500/30 hover:bg-pink-500/30',
    ];
    return colors[index % colors.length];
  };

  const getOutputDirName = (path: string) => {
    return path.split(/[/\\]/).pop() || path;
  };

  return (
    <div className={`${isSelected ? 'bg-violet-500/5' : ''}`}>
      <div className="grid grid-cols-[40px_70px_140px_90px_1fr_1fr_120px_130px_100px] gap-2 px-4 py-3 items-center hover:bg-slate-900/30 transition-colors">
        <div className="flex items-center justify-center">
          <Checkbox.Root
            checked={isSelected}
            onCheckedChange={onSelect}
            className="w-4 h-4 bg-black border border-slate-600 rounded flex items-center justify-center hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 cursor-pointer data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
          >
            <Checkbox.Indicator>
              <Check className="w-3 h-3 text-white" />
            </Checkbox.Indicator>
          </Checkbox.Root>
        </div>

        <div className="text-xs font-mono text-slate-400">#{task.id}</div>

        <div className="text-sm text-white font-medium truncate" title={taskTypeLabel}>
          {taskTypeLabel}
        </div>

        <div>
          <TaskStatusBadge status={task.status} size="sm" />
        </div>

        <div className="min-w-0">
          <div className="flex flex-col gap-1.5">
            {files.length === 0 ? (
              <span className="text-xs text-slate-600">无素材</span>
            ) : (
              <>
                {Array.from({ length: Math.ceil(displayCount / 2) }).map((_, rowIndex) => (
                  <div key={rowIndex} className="flex gap-1.5">
                    {[0, 1].map((col) => {
                      const index = rowIndex * 2 + col;
                      if (index >= displayCount) return null;
                      const file = files[index];
                      const fileExists = pathStatus.get(file.path);
                      const fileType = getFileType(file.path);
                      const Icon = fileExists === false ? FileX : getFileIcon(fileType);
                      const fileName = getFileName(file.path);
                      const label = `${file.category_name || ''} ${fileName}`;
                      return (
                        <button
                          key={`${file.category}-${file.index || index}`}
                          onClick={() => fileExists !== false && onPreviewFile(index)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors cursor-pointer max-w-[160px] ${
                            fileExists === false 
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' 
                              : getCategoryColor(index)
                          }`}
                          title={fileExists === false ? `文件不存在: ${file.path}` : file.path}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
                {files.length > 4 && !isExpanded && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={onToggleExpand}
                      className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs text-violet-400 hover:text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded-lg transition-colors cursor-pointer"
                    >
                      +{files.length - 4} 展开
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                )}
                {files.length > 4 && isExpanded && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={onToggleExpand}
                      className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs text-violet-400 hover:text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded-lg transition-colors cursor-pointer"
                    >
                      收起
                      <ChevronUp className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="min-w-0">
          {canOpenOutput && outputs.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: Math.ceil(outputDisplayCount / 2) }).map((_, rowIndex) => (
                <div key={rowIndex} className="flex gap-1.5">
                  {[0, 1].map((col) => {
                    const index = rowIndex * 2 + col;
                    if (index >= outputDisplayCount) return null;
                    const output = outputs[index];
                    if (!output) return null;
                    const outputExists = pathStatus.get(output.path);
                    const fileType = output.type === 'other' ? 'video' : output.type;
                    const Icon = outputExists === false ? FileX : getFileIcon(fileType);
                    const fileName = getFileName(output.path);
                    return (
                      <button
                        key={`output-${output.id || index}`}
                        onClick={() => outputExists !== false && onPreviewOutput(index)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors cursor-pointer max-w-[160px] ${
                          outputExists === false 
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' 
                            : getCategoryColor(index + 4)
                        }`}
                        title={outputExists === false ? `文件不存在: ${output.path}` : output.path}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{fileName}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
              {outputs.length > 4 && !isOutputExpanded && (
                <div className="flex gap-1.5">
                  <button
                    onClick={onToggleOutputExpand}
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg transition-colors cursor-pointer"
                  >
                    +{outputs.length - 4} 展开
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              )}
              {outputs.length > 4 && isOutputExpanded && (
                <div className="flex gap-1.5">
                  <button
                    onClick={onToggleOutputExpand}
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg transition-colors cursor-pointer"
                  >
                    收起
                    <ChevronUp className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-600">-</span>
          )}
        </div>

        <div className="min-w-0">
          {task.outputDir ? (
            <div className="flex items-center gap-1">
              {(() => {
                const dirExists = pathStatus.get(task.outputDir!);
                return (
                  <>
                    <button
                      onClick={() => dirExists !== false && onOpenOutput()}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer flex-1 min-w-0 ${
                        dirExists === false 
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' 
                          : 'bg-slate-800/50 text-slate-400 hover:text-slate-300 hover:bg-slate-700/50 border border-slate-700/50'
                      }`}
                      title={dirExists === false ? `目录不存在: ${task.outputDir}` : task.outputDir}
                    >
                      {dirExists === false ? (
                        <FileX className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span className="truncate">{getOutputDirName(task.outputDir!)}</span>
                    </button>
                    <button
                      onClick={onUpdateOutputDir}
                      className="p-1.5 text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 rounded transition-colors cursor-pointer shrink-0"
                      title="修改输出目录"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </>
                );
              })()}
            </div>
          ) : (
            <button
              onClick={onUpdateOutputDir}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 border border-violet-500/20 transition-colors cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              设置目录
            </button>
          )}
        </div>

        <div className="text-xs space-y-0.5">
          <div className="text-slate-400">{formatTime(task.createdAt || 0)}</div>
          {task.status === 'completed' && task.executionTime && (
            <div className="text-violet-400 font-mono">{formatExecutionTime(task.executionTime)}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-1">
          {task.outputDir && (
            <Button variant="primary" size="sm" onClick={onOpenOutput}>
              详情
            </Button>
          )}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors cursor-pointer">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="min-w-[140px] bg-slate-900 border border-slate-700 rounded-lg p-1 shadow-xl z-50"
                sideOffset={4}
                align="end"
              >
                {canRetry && (
                  <DropdownMenu.Item
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 rounded cursor-pointer hover:bg-slate-800 focus:outline-none focus:bg-slate-800"
                    onSelect={onRetry}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    重新执行
                  </DropdownMenu.Item>
                )}
                {canCancel && (
                  <DropdownMenu.Item
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 rounded cursor-pointer hover:bg-slate-800 focus:outline-none focus:bg-slate-800"
                    onSelect={onCancel}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    取消任务
                  </DropdownMenu.Item>
                )}
                {canOpenOutput && (
                  <DropdownMenu.Item
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 rounded cursor-pointer hover:bg-slate-800 focus:outline-none focus:bg-slate-800"
                    onSelect={onOpenOutput}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    打开目录
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Separator className="h-px bg-slate-700 my-1" />
                <DropdownMenu.Item
                  className="flex items-center gap-2 px-3 py-2 text-sm text-rose-400 rounded cursor-pointer hover:bg-rose-500/10 focus:outline-none focus:bg-rose-500/10"
                  onSelect={onDelete}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  删除任务
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </div>
  );
};

export default TaskCenterListPage;
