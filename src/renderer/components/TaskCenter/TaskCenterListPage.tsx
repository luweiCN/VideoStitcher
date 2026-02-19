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
 * - URL 参数管理筛选状态
 * - 使用 TanStack Table 实现表格
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
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
import { useVideoMaterials } from '@renderer/hooks/useVideoMaterials';
import { useImageMaterials } from '@renderer/hooks/useImageMaterials';

const PAGE_SIZE = 15;
const THUMBNAIL_SIZE = 128;

interface TaskRowData extends Task {
  isSelected: boolean;
}

const columnHelper = createColumnHelper<TaskRowData>();

const TaskCenterListPage: React.FC = () => {
  const { cancelTask, retryTask, deleteTask, formatRunTime } = useTaskContext();
  const { checkPaths, pathStatus } = useFileExistsCache();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // 从 URL 参数读取筛选状态
  const statusFilter = (searchParams.get('status') || 'all') as TaskStatus | 'all';
  const typeFilter = (searchParams.get('type') || 'all') as TaskType | 'all';
  const searchQuery = searchParams.get('search') || '';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(searchQuery);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [isIndeterminate, setIsIndeterminate] = useState(false);

  const [previewFiles, setPreviewFiles] = useState<{ files: TaskFile[]; index: number } | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<number | string>>(new Set());
  const [outputExpandedTasks, setOutputExpandedTasks] = useState<Set<number>>(new Set());

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // 收集所有视频和图片路径用于获取缩略图
  const { videoPaths, imagePaths } = useMemo(() => {
    const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'flv'];
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
    const videos: string[] = [];
    const images: string[] = [];

    tasks.forEach((task) => {
      (task.files || []).forEach((file) => {
        const ext = file.path.split('.').pop()?.toLowerCase() || '';
        if (videoExts.includes(ext)) {
          videos.push(file.path);
        } else if (imageExts.includes(ext)) {
          images.push(file.path);
        }
      });
      (task.outputs || []).forEach((output) => {
        const ext = output.path.split('.').pop()?.toLowerCase() || '';
        if (videoExts.includes(ext)) {
          videos.push(output.path);
        } else if (imageExts.includes(ext)) {
          images.push(output.path);
        }
      });
    });

    return { videoPaths: videos, imagePaths: images };
  }, [tasks]);

  // 获取缩略图
  const { getMaterial: getVideoMaterial } = useVideoMaterials(videoPaths, !loading, {
    thumbnailMaxSize: THUMBNAIL_SIZE,
  });
  const { getMaterial: getImageMaterial } = useImageMaterials(imagePaths, !loading, {
    thumbnailMaxSize: THUMBNAIL_SIZE,
  });

  // 合并缩略图映射
  const thumbnails = useMemo(() => {
    const map = new Map<string, string>();
    videoPaths.forEach((path) => {
      const material = getVideoMaterial(path);
      if (material?.thumbnailUrl) {
        map.set(path, material.thumbnailUrl);
      }
    });
    imagePaths.forEach((path) => {
      const material = getImageMaterial(path);
      if (material?.thumbnailUrl) {
        map.set(path, material.thumbnailUrl);
      }
    });
    return map;
  }, [videoPaths, imagePaths, getVideoMaterial, getImageMaterial]);

  // 更新 URL 参数
  const updateSearchParams = useCallback((updates: Record<string, string | number | null>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === 'all' || value === '' || value === 1) {
        newParams.delete(key);
      } else {
        newParams.set(key, String(value));
      }
    });
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // 筛选状态变化处理
  const handleStatusFilterChange = useCallback((value: TaskStatus | 'all') => {
    updateSearchParams({ status: value === 'all' ? null : value, page: null });
  }, [updateSearchParams]);

  const handleTypeFilterChange = useCallback((value: TaskType | 'all') => {
    updateSearchParams({ type: value === 'all' ? null : value, page: null });
  }, [updateSearchParams]);

  const handlePageChange = useCallback((page: number) => {
    updateSearchParams({ page: page === 1 ? null : page });
  }, [updateSearchParams]);

  // 跳转到任务详情
  const handleViewTaskDetail = useCallback((taskId: number) => {
    navigate(`/task/${taskId}`);
  }, [navigate]);

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
        (task.files || []).forEach((file) => {
          if (file.path) pathsToCheck.add(file.path);
        });
        (task.outputs || []).forEach((output) => {
          if (output.path) pathsToCheck.add(output.path);
        });
        if (task.outputDir) pathsToCheck.add(task.outputDir);
      });

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
    updateSearchParams({ search: searchInput || null, page: null });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClearSearch = () => {
    setSearchInput('');
    updateSearchParams({ search: null, page: null });
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

  const toggleExpandTask = (taskId: number) => {
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

  const toggleOutputExpandTask = (taskId: number) => {
    setOutputExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
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

  const runningCount = tasks.filter(t => t.status === 'running').length;

  const canRetry = useCallback((status: TaskStatus) => status === 'failed' || status === 'cancelled' || status === 'completed', []);
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

  // 准备表格数据
  const tableData = useMemo(() => {
    return tasks.map((task) => ({
      ...task,
      isSelected: selectedIds.has(task.id),
    }));
  }, [tasks, selectedIds]);

  // 定义列
  const columns = useMemo(() => [
    columnHelper.display({
      id: 'select',
      header: () => (
        <Checkbox.Root
          checked={isAllSelected ? true : isIndeterminate ? 'indeterminate' : false}
          onCheckedChange={handleSelectAll}
          className="w-4 h-4 bg-black border border-slate-600 rounded flex items-center justify-center hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 cursor-pointer data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500 data-[state=indeterminate]:bg-violet-500/50 data-[state=indeterminate]:border-violet-500/50"
        >
          <Checkbox.Indicator>
            {isAllSelected ? <Check className="w-3 h-3 text-white" /> : <div className="w-2 h-0.5 bg-white rounded" />}
          </Checkbox.Indicator>
        </Checkbox.Root>
      ),
      cell: ({ row }) => (
        <Checkbox.Root
          checked={row.original.isSelected}
          onCheckedChange={(checked) => handleSelectTask(row.original.id, checked)}
          className="w-4 h-4 bg-black border border-slate-600 rounded flex items-center justify-center hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 cursor-pointer data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
        >
          <Checkbox.Indicator>
            <Check className="w-3 h-3 text-white" />
          </Checkbox.Indicator>
        </Checkbox.Root>
      ),
    }),
    columnHelper.accessor('id', {
      header: 'ID',
      cell: (info) => <span className="text-xs font-mono text-slate-400">#{info.getValue()}</span>,
    }),
    columnHelper.accessor('type', {
      header: '类型',
      cell: (info) => {
        const label = info.getValue() ? TASK_TYPE_LABELS[info.getValue()!] : '未知类型';
        return <span className="text-sm text-white font-medium whitespace-nowrap" title={label}>{label}</span>;
      },
    }),
    columnHelper.accessor('status', {
      header: '状态',
      cell: (info) => <TaskStatusBadge status={info.getValue()} size="sm" />,
    }),
    columnHelper.display({
      id: 'files',
      header: '素材',
      cell: ({ row }) => {
        const task = row.original;
        const files = task.files || [];
        const isExpanded = expandedTasks.has(task.id);
        const displayCount = isExpanded ? files.length : 4;

        if (files.length === 0) {
          return <span className="text-xs text-slate-600">无素材</span>;
        }

        return (
          <div className="flex flex-wrap gap-1">
            {files.slice(0, displayCount).map((file, index) => {
              const fileExists = pathStatus.get(file.path);
              const thumbnail = thumbnails.get(file.path);
              const fileType = getFileType(file.path);
              const Icon = fileExists === false ? FileX : getFileIcon(fileType);
              const fileName = getFileName(file.path);
              return (
                <button
                  key={`${file.category}-${file.index || index}`}
                  onClick={() => fileExists !== false && handlePreviewFile(files, index)}
                  className={`w-16 h-16 rounded border flex items-center justify-center transition-colors cursor-pointer overflow-hidden ${
                    fileExists === false
                      ? 'bg-rose-500/20 border-rose-500/30 text-rose-400'
                      : thumbnail
                        ? 'border-slate-700/50 hover:border-slate-600'
                        : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600 text-slate-400 hover:text-slate-200'
                  }`}
                  title={`${file.category_name || ''} ${fileName}${fileExists === false ? ' (文件不存在)' : ''}`}
                >
                  {thumbnail ? (
                    <img src={thumbnail} alt={fileName} className="w-full h-full object-cover" />
                  ) : (
                    <Icon className="w-6 h-6" />
                  )}
                </button>
              );
            })}
            {files.length > 4 && (
              <button
                onClick={() => toggleExpandTask(task.id)}
                className="h-16 px-2 text-xs text-violet-400 hover:text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded transition-colors cursor-pointer"
              >
                {isExpanded ? '收起' : `+${files.length - 4}`}
              </button>
            )}
          </div>
        );
      },
    }),
    columnHelper.display({
      id: 'outputs',
      header: '输出',
      cell: ({ row }) => {
        const task = row.original;
        const outputs = task.outputs || [];
        const isExpanded = outputExpandedTasks.has(task.id);
        const displayCount = isExpanded ? outputs.length : Math.min(outputs.length, 4);
        const canOpen = canOpenOutput(task.status);

        if (!canOpen || outputs.length === 0) {
          return <span className="text-xs text-slate-600">-</span>;
        }

        return (
          <div className="flex flex-wrap gap-1">
            {outputs.slice(0, displayCount).map((output, index) => {
              if (!output) return null;
              const outputExists = pathStatus.get(output.path);
              const thumbnail = thumbnails.get(output.path);
              const fileType = output.type === 'other' ? 'video' : output.type;
              const Icon = outputExists === false ? FileX : getFileIcon(fileType);
              const fileName = getFileName(output.path);
              return (
                <button
                  key={`output-${output.id || index}`}
                  onClick={() => {
                    if (outputExists !== false) {
                      const outputFiles = outputs.map(o => ({
                        path: o.path,
                        category: 'output',
                        category_name: '输出',
                        index: 0,
                      }));
                      setPreviewFiles({ files: outputFiles, index });
                    }
                  }}
                  className={`w-16 h-16 rounded border flex items-center justify-center transition-colors cursor-pointer overflow-hidden ${
                    outputExists === false
                      ? 'bg-rose-500/20 border-rose-500/30 text-rose-400'
                      : thumbnail
                        ? 'border-emerald-500/30 hover:border-emerald-500/50'
                        : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30'
                  }`}
                  title={`${fileName}${outputExists === false ? ' (文件不存在)' : ''}`}
                >
                  {thumbnail ? (
                    <img src={thumbnail} alt={fileName} className="w-full h-full object-cover" />
                  ) : (
                    <Icon className="w-6 h-6" />
                  )}
                </button>
              );
            })}
            {outputs.length > 4 && (
              <button
                onClick={() => toggleOutputExpandTask(task.id)}
                className="h-16 px-2 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded transition-colors cursor-pointer"
              >
                {isExpanded ? '收起' : `+${outputs.length - 4}`}
              </button>
            )}
          </div>
        );
      },
    }),
    columnHelper.display({
      id: 'outputDir',
      header: '输出目录',
      cell: ({ row }) => {
        const task = row.original;
        const getOutputDirName = (path: string) => path.split(/[/\\]/).pop() || path;

        if (task.outputDir) {
          const dirExists = pathStatus.get(task.outputDir);
          return (
            <div className="flex items-center gap-1">
              <button
                onClick={() => dirExists !== false && handleOpenOutputDir(task.outputDir!)}
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
                onClick={() => handleUpdateOutputDir(task.id)}
                className="p-1.5 text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 rounded transition-colors cursor-pointer shrink-0"
                title="修改输出目录"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        }

        return (
          <button
            onClick={() => handleUpdateOutputDir(task.id)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 border border-violet-500/20 transition-colors cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            设置目录
          </button>
        );
      },
    }),
    columnHelper.accessor('createdAt', {
      header: '创建时间 / 耗时',
      cell: ({ row, getValue }) => {
        const task = row.original;
        return (
          <div className="text-xs space-y-0.5 whitespace-nowrap">
            <div className="text-slate-400">{formatTime(getValue() || 0)}</div>
            {task.status === 'completed' && task.executionTime && (
              <div className="text-violet-400 font-mono">{formatExecutionTime(task.executionTime)}</div>
            )}
          </div>
        );
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: '操作',
      cell: ({ row }) => {
        const task = row.original;
        const taskCanRetry = canRetry(task.status);
        const taskCanCancel = canCancel(task.status);
        const taskCanOpenOutput = canOpenOutput(task.status);

        return (
          <div className="flex items-center justify-end gap-1">
            <Button variant="primary" size="sm" onClick={() => handleViewTaskDetail(task.id)}>
              详情
            </Button>
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
                  {taskCanRetry && (
                    <DropdownMenu.Item
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 rounded cursor-pointer hover:bg-slate-800 focus:outline-none focus:bg-slate-800"
                      onSelect={() => { retryTask(task.id); loadTasks(); }}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      重新执行
                    </DropdownMenu.Item>
                  )}
                  {taskCanCancel && (
                    <DropdownMenu.Item
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 rounded cursor-pointer hover:bg-slate-800 focus:outline-none focus:bg-slate-800"
                      onSelect={() => { cancelTask(task.id); loadTasks(); }}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      取消任务
                    </DropdownMenu.Item>
                  )}
                  {taskCanOpenOutput && (
                    <DropdownMenu.Item
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 rounded cursor-pointer hover:bg-slate-800 focus:outline-none focus:bg-slate-800"
                      onSelect={() => handleOpenOutputDir(task.outputDir || '')}
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      打开目录
                    </DropdownMenu.Item>
                  )}
                  <DropdownMenu.Separator className="h-px bg-slate-700 my-1" />
                  <DropdownMenu.Item
                    className="flex items-center gap-2 px-3 py-2 text-sm text-rose-400 rounded cursor-pointer hover:bg-rose-500/10 focus:outline-none focus:bg-rose-500/10"
                    onSelect={() => { deleteTask(task.id); loadTasks(); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    删除任务
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        );
      },
    }),
  ], [isAllSelected, isIndeterminate, selectedIds, expandedTasks, outputExpandedTasks, pathStatus, thumbnails, canRetry, canCancel, canOpenOutput]);

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      <PageHeader
        title="任务列表"
        icon={Layers}
        iconColor="text-violet-400"
        description={`共 ${total} 个任务`}
        showTaskIndicator={false}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0 p-4 border-b border-slate-800 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">状态</label>
              <Select.Root value={statusFilter} onValueChange={(v) => handleStatusFilterChange(v as TaskStatus | 'all')}>
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
              <Select.Root value={typeFilter} onValueChange={(v) => handleTypeFilterChange(v as TaskType | 'all')}>
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
                  placeholder="搜索 ID 或名称..."
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

        <div className="flex-1 overflow-auto">
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
              <div className="bg-black/30 border border-slate-800 rounded-xl overflow-x-auto">
                <table className="w-full border-collapse min-w-max">
                  <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id} className="bg-slate-900/50 border-b border-slate-800 text-xs text-slate-500 font-medium">
                        {headerGroup.headers.map((header, index, arr) => {
                          const isLast = index === arr.length - 1;
                          return (
                            <th
                              key={header.id}
                              className={`px-3 py-3 text-left whitespace-nowrap ${isLast ? 'sticky right-0 bg-slate-900/95 backdrop-blur-sm z-10' : ''}`}
                            >
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
                            </th>
                          );
                        })}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className={`group border-b border-slate-800/50 hover:bg-slate-900/30 ${row.original.isSelected ? 'bg-violet-500/5 hover:bg-violet-500/5' : ''}`}
                      >
                        {row.getVisibleCells().map((cell, index, arr) => {
                          const isLast = index === arr.length - 1;
                          return (
                            <td
                              key={cell.id}
                              className={`px-3 py-3 ${isLast ? 'sticky right-0 z-20 bg-slate-950 group-hover:bg-slate-900' : ''} ${isLast && row.original.isSelected ? '!bg-violet-500/5' : ''}`}
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
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

export default TaskCenterListPage;
