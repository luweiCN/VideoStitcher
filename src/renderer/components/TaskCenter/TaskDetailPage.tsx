/**
 * 任务详情页
 * 
 * 上下结构布局（可滚动）：
 * - 顶部：任务基本信息 + 操作按钮
 * - 中间：素材列表
 * - 中间：产物预览
 * - 底部：日志区域
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FileVideo,
  Image as ImageIcon,
  Play,
  Eye,
  Loader2,
  XCircle,
  Clock,
  FolderOpen,
  RefreshCw,
  Calendar,
  Timer,
  HardDrive,
  X,
  Video,
  Trash2,
  Edit3,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import PageHeader from '@renderer/components/PageHeader';
import TaskStatusBadge from './TaskStatusBadge';
import { OperationLogPanel } from '@renderer/components/OperationLogPanel';
import FilePreviewModal from '@renderer/components/FilePreviewModal';
import VideoPlayer from '@renderer/components/VideoPlayer/VideoPlayer';
import { useFileExistsCache } from '@renderer/hooks/useFileExistsCache';
import { useTaskContext } from '@renderer/contexts/TaskContext';
import { useTaskSubscription } from '@renderer/hooks/useTaskSubscription';
import useVideoMaterials, { type VideoMaterial } from '@renderer/hooks/useVideoMaterials';
import useImageMaterials, { type ImageMaterial } from '@renderer/hooks/useImageMaterials';
import { useOperationLogs } from '@renderer/hooks/useOperationLogs';
import { formatDuration, formatFileSize } from '@renderer/utils/format';
import { Button } from '@renderer/components/Button';
import type { Task, TaskFile, TaskOutput, TaskLog } from '@shared/types/task';
import { TASK_TYPE_LABELS } from '@shared/types/task';

const TaskDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const taskId = parseInt(id || '', 10);
  
  const { cancelTask, retryTask, deleteTask } = useTaskContext();
  
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState<{ path: string; name: string; type: 'video' | 'image' } | null>(null);
  const [outputPreview, setOutputPreview] = useState<{ path: string; url: string; type: 'video' | 'image' } | null>(null);
  const [outputMeta, setOutputMeta] = useState<{ width: number; height: number; orientation: 'landscape' | 'portrait' | 'square' } | null>(null);
  const [generatingPreview, setGeneratingPreview] = useState(false);

  const { checkPaths, invalidatePaths, pathStatus } = useFileExistsCache();

  // 使用日志 hook
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
    moduleNameCN: `任务${taskId}`,
    moduleNameEN: `Task${taskId}`,
  });

  // 加载任务详情
  const loadTask = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.api.getTask(taskId);
      if (result) {
        setTask(result as Task);
        
        // 收集需要检查的路径
        const pathsToCheck = new Set<string>();
        (result.files || []).forEach((file: TaskFile) => {
          if (file.path) pathsToCheck.add(file.path);
        });
        (result.outputs || []).forEach((output: TaskOutput) => {
          if (output.path) pathsToCheck.add(output.path);
        });
        if (result.outputDir) pathsToCheck.add(result.outputDir);
        
        // 强制刷新输出文件的缓存
        const outputPathList = (result.outputs || []).map((o: TaskOutput) => o.path).filter(Boolean);
        if (outputPathList.length > 0) {
          invalidatePaths(outputPathList);
        }
        
        // 等待路径检查完成
        if (pathsToCheck.size > 0) {
          await checkPaths(Array.from(pathsToCheck), true);
        }
      }
    } catch (err) {
      console.error('[TaskDetailPage] 加载任务失败:', err);
    } finally {
      setLoading(false);
    }
  }, [taskId, checkPaths, invalidatePaths]);

  // 加载任务日志
  const loadLogs = useCallback(async () => {
    try {
      const taskLogs = await window.api.getTaskLogs(taskId);
      (taskLogs || []).forEach((log: TaskLog) => {
        const logType = log.level === 'error' ? 'error' : 
              log.level === 'warning' ? 'warning' : 
              log.level === 'success' ? 'success' : 'info';
        addLog(log.message, logType, log.timestamp);
      });
    } catch (err) {
      console.error('[TaskDetailPage] 加载日志失败:', err);
    }
  }, [taskId, addLog]);

  // 使用任务订阅 hook - 监听任务状态变化和日志
  useTaskSubscription({
    taskId,
    onTaskUpdated: async (updatedTask) => {
      const prevStatus = task?.status;
      
      // 任务完成时，重新加载完整任务数据（包含 outputs）
      if (updatedTask.status === 'completed' && prevStatus !== 'completed') {
        await loadTask();
        return;
      }
      
      // 其他情况只更新状态相关字段，保留 files 数组不被清空
      setTask((prev) => {
        if (!prev) return updatedTask;
        return {
          ...prev,
          status: updatedTask.status,
          progress: updatedTask.progress,
          currentStep: updatedTask.currentStep,
          startedAt: updatedTask.startedAt,
          completedAt: updatedTask.completedAt,
          executionTime: updatedTask.executionTime,
          error: updatedTask.error,
          pid: updatedTask.pid,
          pidStartedAt: updatedTask.pidStartedAt,
        };
      });
    },
    onTaskLog: (data) => {
      const logType = data.log.level === 'error' ? 'error' : 
            data.log.level === 'warning' ? 'warning' : 
            data.log.level === 'success' ? 'success' : 'info';
      addLog(data.log.message, logType, data.log.timestamp);
    },
    onTaskProgress: (data) => {
      if (data.step) {
        addLog(data.step, 'info');
      }
    },
  });

  // 初始化加载
  useEffect(() => {
    loadTask();
    loadLogs();
  }, [loadTask, loadLogs]);

  // 获取素材路径
  const filePaths = useMemo(() => {
    if (!task?.files) return [];
    return task.files.map(f => f.path);
  }, [task?.files]);

  // 加载视频素材（使用更大的缩略图）
  const { materials: videoMaterials } = useVideoMaterials(
    filePaths.filter(p => {
      const ext = p.split('.').pop()?.toLowerCase() || '';
      return ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'flv'].includes(ext);
    }),
    true,
    { thumbnailMaxSize: 320 }
  );

  // 加载图片素材（使用更大的缩略图）
  const { materials: imageMaterials } = useImageMaterials(
    filePaths.filter(p => {
      const ext = p.split('.').pop()?.toLowerCase() || '';
      return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
    }),
    true,
    { thumbnailMaxSize: 320 }
  );

  // 合并素材映射
  const materialMap = useMemo(() => {
    const map = new Map<string, VideoMaterial | ImageMaterial>();
    videoMaterials.forEach(m => map.set(m.path, m));
    imageMaterials.forEach(m => map.set(m.path, m));
    return map;
  }, [videoMaterials, imageMaterials]);

  // 获取文件类型
  const getFileType = (path: string): 'video' | 'image' => {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'flv'];
    if (videoExts.includes(ext)) return 'video';
    return 'image';
  };

  // 获取文件图标
  const getFileIcon = (type: 'video' | 'image') => {
    return type === 'video' ? FileVideo : ImageIcon;
  };

  // 获取文件名
  const getFileName = (path: string) => {
    return path.split(/[/\\]/).pop() || path;
  };

  // 预览素材文件
  const handlePreviewFile = (file: TaskFile) => {
    setPreviewFile({
      path: file.path,
      name: getFileName(file.path),
      type: getFileType(file.path),
    });
  };

  // 检查输出文件是否有效
  const outputExists = useMemo(() => {
    if (!task?.outputs || task.outputs.length === 0) return false;
    return task.outputs.some(output => pathStatus.get(output.path) === true);
  }, [task?.outputs, pathStatus]);

  // 生成预览
  const generatePreviewVideo = useCallback(async () => {
    if (!task || generatingPreview) return;
    
    setGeneratingPreview(true);
    try {
      const output = task.outputs?.[0];
      if (!output) return;

      // 获取预览 URL
      const previewUrl = await window.api.getPreviewUrl(output.path);
      if (previewUrl.success && previewUrl.url) {
        setOutputPreview({
          path: output.path,
          url: previewUrl.url,
          type: (output.type === 'image' ? 'image' : 'video') as 'video' | 'image',
        });
      }

      // 获取视频元数据（仅视频类型）
      if (output.type === 'video' || !output.type) {
        try {
          const meta = await window.api.getVideoDimensions(output.path);
          if (meta) {
            setOutputMeta({
              width: meta.width,
              height: meta.height,
              orientation: meta.orientation,
            });
          }
        } catch (metaErr) {
          console.error('[TaskDetailPage] 获取视频元数据失败:', metaErr);
        }
      }
    } catch (err) {
      console.error('[TaskDetailPage] 生成预览失败:', err);
    } finally {
      setGeneratingPreview(false);
    }
  }, [task, generatingPreview]);

  // 当任务完成且有输出时，自动加载预览
  useEffect(() => {
    if (task?.status === 'completed' && outputExists && !outputPreview && !generatingPreview) {
      generatePreviewVideo();
    }
  }, [task?.status, outputExists, outputPreview, generatingPreview, generatePreviewVideo]);

  // 格式化时间
  const formatTime = (timestamp: number | undefined) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
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

  // 打开输出目录
  const handleOpenOutputDir = async () => {
    if (task?.outputDir) {
      await window.api.openPath(task.outputDir);
    }
  };

  // 修改输出目录
  const handleUpdateOutputDir = async () => {
    if (!task) return;
    const newDir = await window.api.pickOutDir(task.outputDir);
    if (!newDir) return;
    await window.api.updateTaskOutputDir(task.id, newDir);
    loadTask();
  };

  // 任务操作
  const handleRetry = useCallback(async () => {
    if (!task) return;
    await retryTask(task.id);
    loadTask();
  }, [task, retryTask, loadTask]);

  const handleCancel = useCallback(async () => {
    if (!task) return;
    await cancelTask(task.id);
    loadTask();
  }, [task, cancelTask, loadTask]);

  const handleDelete = useCallback(async () => {
    if (!task) return;
    if (!confirm('确定要删除此任务吗？')) return;
    await deleteTask(task.id);
    navigate(-1);
  }, [task, deleteTask, navigate]);

  // 操作可用性
  const canRetry = task && (task.status === 'failed' || task.status === 'cancelled' || task.status === 'completed');
  const canCancel = task && (task.status === 'pending' || task.status === 'running');

  // 根据输出视频方向计算预览高度
  const previewHeight = useMemo(() => {
    if (!outputMeta) return { maxHeight: 320, minHeight: 280 };
    if (outputMeta.orientation === 'portrait') {
      return { maxHeight: 520, minHeight: 400 };
    }
    if (outputMeta.orientation === 'square') {
      return { maxHeight: 380, minHeight: 320 };
    }
    return { maxHeight: 320, minHeight: 280 };
  }, [outputMeta]);

  // 获取分类颜色
  const getCategoryColor = (index: number) => {
    const colors = [
      'bg-violet-500/20 text-violet-300 border-violet-500/30',
      'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      'bg-amber-500/20 text-amber-300 border-amber-500/30',
      'bg-rose-500/20 text-rose-300 border-rose-500/30',
      'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    ];
    return colors[index % colors.length];
  };

  if (loading) {
    return (
      <div className="h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (isNaN(taskId)) {
    return (
      <div className="h-screen bg-black text-white flex flex-col items-center justify-center">
        <XCircle className="w-12 h-12 text-rose-400 mb-4" />
        <p className="text-slate-400">任务 ID 无效</p>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mt-4">
          返回
        </Button>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="h-screen bg-black text-white flex flex-col items-center justify-center">
        <XCircle className="w-12 h-12 text-rose-400 mb-4" />
        <p className="text-slate-400">任务不存在</p>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mt-4">
          返回
        </Button>
      </div>
    );
  }

  const taskTypeLabel = task.type ? TASK_TYPE_LABELS[task.type] : '未知类型';

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      <PageHeader
        title={`任务 #${task.id}`}
        icon={FileVideo}
        iconColor="text-violet-400"
        description={taskTypeLabel}
        showTaskIndicator={false}
      />

      {/* 可滚动的主体内容 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
          {/* 1. 任务基本信息 */}
          <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <div className="flex items-start gap-4">
              {/* 状态 */}
              <div className="flex items-center gap-3">
                <TaskStatusBadge status={task.status} size="md" />
              </div>

              {/* 基本信息 */}
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-500">创建时间</div>
                    <div className="text-sm text-slate-300">{formatTime(task.createdAt)}</div>
                  </div>
                </div>
                
                {task.status === 'completed' && (
                  <div className="flex items-center gap-2">
                    <Timer className="w-4 h-4 text-slate-500 shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-500">执行耗时</div>
                      <div className="text-sm text-emerald-400 font-mono">{formatExecutionTime(task.executionTime)}</div>
                    </div>
                  </div>
                )}

                {task.outputDir && (
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-slate-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] text-slate-500">输出目录</div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={handleOpenOutputDir}
                          className="text-sm text-violet-400 hover:text-violet-300 truncate cursor-pointer"
                          title={task.outputDir}
                        >
                          {getFileName(task.outputDir)}
                        </button>
                        <button
                          onClick={handleUpdateOutputDir}
                          className="p-0.5 text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 rounded transition-colors cursor-pointer shrink-0"
                          title="修改输出目录"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {task.error && (
                  <div className="col-span-2 md:col-span-1">
                    <div className="text-[10px] text-slate-500">错误信息</div>
                    <div className="text-sm text-rose-400 truncate" title={task.error.message}>
                      {task.error.message}
                    </div>
                  </div>
                )}
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-2 shrink-0">
                {task.outputDir && (
                  <Button variant="secondary" size="sm" onClick={handleOpenOutputDir}>
                    <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                    打开目录
                  </Button>
                )}
                
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="6" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="12" cy="18" r="2" />
                      </svg>
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
                          onSelect={handleRetry}
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          重新执行
                        </DropdownMenu.Item>
                      )}
                      {canCancel && (
                        <DropdownMenu.Item
                          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 rounded cursor-pointer hover:bg-slate-800 focus:outline-none focus:bg-slate-800"
                          onSelect={handleCancel}
                        >
                          <X className="w-3.5 h-3.5" />
                          取消任务
                        </DropdownMenu.Item>
                      )}
                      <DropdownMenu.Separator className="h-px bg-slate-700 my-1" />
                      <DropdownMenu.Item
                        className="flex items-center gap-2 px-3 py-2 text-sm text-rose-400 rounded cursor-pointer hover:bg-rose-500/10 focus:outline-none focus:bg-rose-500/10"
                        onSelect={handleDelete}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        删除任务
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            </div>
          </section>

          {/* 2. 素材列表 */}
          <section className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800/50 flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <FileVideo className="w-4 h-4 text-violet-400" />
                素材列表
              </h3>
              <span className="text-xs text-slate-500">{task.files?.length || 0} 个文件</span>
            </div>
            <div className="p-3">
              {(task.files || []).length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  <p className="text-sm">暂无素材</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {(task.files || []).map((file, index) => {
                    const material = materialMap.get(file.path);
                    const fileExists = pathStatus.get(file.path);
                    const fileType = getFileType(file.path);
                    const Icon = fileExists === false ? XCircle : getFileIcon(fileType);

                    return (
                      <div
                        key={`${file.category}-${file.index || index}`}
                        className={`group relative bg-slate-800/50 border border-slate-700/50 rounded-lg overflow-hidden hover:border-slate-600 transition-all ${
                          fileExists === false ? 'opacity-60' : 'cursor-pointer'
                        }`}
                        onClick={() => fileExists !== false && handlePreviewFile(file)}
                      >
                        {/* 缩略图 */}
                        <div className="aspect-video bg-slate-800 relative">
                          {material?.thumbnailUrl ? (
                            <img src={material.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Icon className={`w-8 h-8 ${fileExists === false ? 'text-rose-400' : 'text-slate-600'}`} />
                            </div>
                          )}
                          {/* 播放/预览图标 */}
                          {fileExists !== false && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                              {fileType === 'video' ? (
                                <Play className="w-6 h-6 text-white/80 fill-white/80" />
                              ) : (
                                <Eye className="w-6 h-6 text-white/80" />
                              )}
                            </div>
                          )}
                          {/* 文件不存在标记 */}
                          {fileExists === false && (
                            <div className="absolute top-1.5 right-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              不存在
                            </div>
                          )}
                        </div>
                        {/* 文件信息 */}
                        <div className="p-2">
                          {/* 分类名称 - 显眼显示 */}
                          <div className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded border mb-1 ${getCategoryColor(index)}`}>
                            {file.category_name}
                          </div>
                          <p className="text-xs text-slate-300 truncate" title={file.path}>
                            {getFileName(file.path)}
                          </p>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {material && (
                              <>
                                {(material as VideoMaterial).duration && (
                                  <span>{formatDuration((material as VideoMaterial).duration!)}</span>
                                )}
                                {material.width && material.height && (
                                  <>
                                    {(material as VideoMaterial).duration && <span> · </span>}
                                    <span>{material.width}×{material.height}</span>
                                  </>
                                )}
                                {material.fileSize && (
                                  <>
                                    {(material as VideoMaterial).duration || material.width ? <span> · </span> : null}
                                    <span>{formatFileSize(material.fileSize)}</span>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* 3. 产物预览 */}
          <section className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800/50 flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                {task.type === 'image_material' || task.type === 'cover_format' || task.type === 'lossless_grid' ? (
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Video className="w-4 h-4 text-emerald-400" />
                )}
                产物预览
              </h3>
              {task.outputs && task.outputs.length > 0 && (
                <span className="text-xs text-slate-500">{task.outputs.length} 个输出</span>
              )}
            </div>
            
            <div className="p-4">
              <div className="flex items-center justify-center" style={{ minHeight: previewHeight.minHeight }}>
                {task.status !== 'completed' ? (
                  // 任务未完成
                  <div className="text-center text-slate-500">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">任务未完成</p>
                    {task.status === 'running' && (
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                        <p className="text-xs text-violet-400">处理中...</p>
                      </div>
                    )}
                  </div>
                ) : !outputExists ? (
                  // 产物不存在
                  <div className="text-center text-slate-500">
                    <XCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">产物文件不存在</p>
                    <p className="text-xs mt-1">可能已被移动或删除</p>
                  </div>
                ) : generatingPreview || !outputPreview ? (
                  // 正在加载预览
                  <div className="text-center text-slate-500">
                    <Loader2 className="w-12 h-12 mx-auto mb-3 animate-spin text-violet-400" />
                    <p className="text-sm">正在加载预览...</p>
                  </div>
                ) : (
                  // 显示预览
                  <div className="w-full flex gap-4">
                    <div className="flex-1 rounded-lg overflow-hidden flex items-center justify-center" style={{ maxHeight: previewHeight.maxHeight }}>
                      {outputPreview.type === 'image' ? (
                        <img
                          src={outputPreview.url}
                          alt={getFileName(outputPreview.path)}
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <VideoPlayer
                          src={outputPreview.url}
                          title={getFileName(outputPreview.path)}
                          themeColor="violet"
                          minimal
                          className="h-full"
                        />
                      )}
                    </div>
                    {(task.outputs || []).length > 1 && (
                      <div className="w-48 flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: previewHeight.maxHeight }}>
                        {(task.outputs || []).map((output, index) => {
                          const exists = pathStatus.get(output.path);
                          const fileName = getFileName(output.path);
                          const isActive = output.path === outputPreview.path;
                          return (
                            <button
                              key={`output-${output.id || index}`}
                              onClick={async () => {
                                if (exists === false) return;
                                const previewUrl = await window.api.getPreviewUrl(output.path);
                                if (previewUrl.success && previewUrl.url) {
                                  setOutputPreview({
                                    path: output.path,
                                    url: previewUrl.url,
                                    type: (output.type === 'image' ? 'image' : 'video') as 'video' | 'image',
                                  });
                                  // 获取新视频的元数据（仅视频类型）
                                  if (output.type !== 'image') {
                                    try {
                                      const meta = await window.api.getVideoDimensions(output.path);
                                      if (meta) {
                                        setOutputMeta({
                                          width: meta.width,
                                          height: meta.height,
                                          orientation: meta.orientation,
                                        });
                                      }
                                    } catch (e) {
                                      console.error(e);
                                    }
                                  }
                                }
                              }}
                              className={`text-left p-2.5 rounded-lg border text-xs transition-all ${
                                isActive
                                  ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                                  : exists === false
                                  ? 'bg-slate-800/30 border-slate-700/50 text-slate-600 cursor-not-allowed'
                                  : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600 cursor-pointer'
                              }`}
                              disabled={exists === false}
                            >
                              <div className="truncate font-medium">{fileName}</div>
                              {output.size && (
                                <div className="text-[10px] text-slate-500 mt-0.5">{formatFileSize(output.size)}</div>
                              )}
                              {exists === false && (
                                <div className="text-[10px] text-rose-400 mt-0.5">文件不存在</div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 4. 日志区域 */}
          <section className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
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
              height="400px"
              themeColor="violet"
              className="border-0 rounded-none"
              titleComponent={
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    任务日志
                    {logs.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400">
                        {logs.length}
                      </span>
                    )}
                  </h3>
                  {task.status === 'running' && (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                      实时
                    </span>
                  )}
                </div>
              }
            />
          </section>
        </div>
      </div>

      {/* 文件预览弹窗 */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          visible={!!previewFile}
          onClose={() => setPreviewFile(null)}
          allFiles={task.files?.map(f => ({
            path: f.path,
            name: getFileName(f.path),
            type: getFileType(f.path),
          })) || []}
          currentIndex={task.files?.findIndex(f => f.path === previewFile.path) ?? 0}
          onPrevious={() => {
            const currentIndex = task.files?.findIndex(f => f.path === previewFile.path) ?? -1;
            if (currentIndex > 0 && task.files) {
              const prevFile = task.files[currentIndex - 1];
              setPreviewFile({
                path: prevFile.path,
                name: getFileName(prevFile.path),
                type: getFileType(prevFile.path),
              });
            }
          }}
          onNext={() => {
            const currentIndex = task.files?.findIndex(f => f.path === previewFile.path) ?? -1;
            if (currentIndex < (task.files?.length || 0) - 1 && task.files) {
              const nextFile = task.files[currentIndex + 1];
              setPreviewFile({
                path: nextFile.path,
                name: getFileName(nextFile.path),
                type: getFileType(nextFile.path),
              });
            }
          }}
          themeColor="violet"
        />
      )}
    </div>
  );
};

export default TaskDetailPage;
