import React, { useState, useCallback, useMemo } from 'react';
import {
  ArrowLeft, FileVideo, Image as ImageIcon, Layers, Eye, Play
} from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import FilePreviewModal from '@/components/FilePreviewModal';
import useVideoMaterials, { type VideoMaterial } from '@/hooks/useVideoMaterials';
import useImageMaterials, { type ImageMaterial } from '@/hooks/useImageMaterials';
import { formatDuration, formatFileSize } from '@/utils/format';
import type { Task, TaskFile } from '@shared/types/task';

// 重新导出供其他模块使用
export type { Task, TaskFile } from '@shared/types/task';

/** 任务列表最大显示数量 */
const MAX_DISPLAY_COUNT = 100;

/**
 * 输出配置
 */
export interface OutputConfig {
  fps?: string;
  resolution: string;
  codec?: string;
  format: string;
  /** 单个任务输出的视频数量（不是总任务数） */
  nums: number;
}

export interface TaskListProps {
  /** 任务列表 */
  tasks: Task[];
  /** 当前预览的任务索引（受控） */
  currentIndex: number;
  /** 输出配置 */
  output: OutputConfig;
  /** 任务类型 */
  type: string;
  /**缩略图来源（category 值） */
  thumbnail_source: string;
  /** 素材类型数组（与 task.files 一一对应） */
  materialsType?: ('video' | 'image')[];
  /** 主题色 */
  themeColor: 'slate' | 'violet' | 'rose' | 'fuchsia' | 'emerald' | 'cyan' | 'amber';
  /** 任务切换回调 */
  onTaskChange?: (index: number) => void;
  /** 是否禁用 */
  disabled?: boolean;
}

/** 主题色配置 */
const THEME_COLORS = {
  slate: {
    text: 'text-slate-400',
    bg: 'bg-slate-500',
    border: 'border-slate-500',
    ring: 'ring-slate-500',
    bgLight: 'bg-slate-500/5',
    bgLight20: 'bg-slate-500/20',
    bgLight30: 'bg-slate-500/30',
    bgLight70: 'bg-slate-500/70',
    borderLight: 'border-slate-500/60',
    borderLight30: 'border-slate-500/30',
  },
  violet: {
    text: 'text-violet-400',
    bg: 'bg-violet-500',
    border: 'border-violet-500',
    ring: 'ring-violet-500',
    bgLight: 'bg-violet-500/5',
    bgLight20: 'bg-violet-500/20',
    bgLight30: 'bg-violet-500/30',
    bgLight70: 'bg-violet-500/70',
    borderLight: 'border-violet-500/60',
    borderLight30: 'border-violet-500/30',
  },
  rose: {
    text: 'text-rose-400',
    bg: 'bg-rose-500',
    border: 'border-rose-500',
    ring: 'ring-rose-500',
    bgLight: 'bg-rose-500/5',
    bgLight20: 'bg-rose-500/20',
    bgLight30: 'bg-rose-500/30',
    bgLight70: 'bg-rose-500/70',
    borderLight: 'border-rose-500/60',
    borderLight30: 'border-rose-500/30',
  },
  fuchsia: {
    text: 'text-fuchsia-400',
    bg: 'bg-fuchsia-500',
    border: 'border-fuchsia-500',
    ring: 'ring-fuchsia-500',
    bgLight: 'bg-fuchsia-500/5',
    bgLight20: 'bg-fuchsia-500/20',
    bgLight30: 'bg-fuchsia-500/30',
    bgLight70: 'bg-fuchsia-500/70',
    borderLight: 'border-fuchsia-500/60',
    borderLight30: 'border-fuchsia-500/30',
  },
  emerald: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500',
    border: 'border-emerald-500',
    ring: 'ring-emerald-500',
    bgLight: 'bg-emerald-500/5',
    bgLight20: 'bg-emerald-500/20',
    bgLight30: 'bg-emerald-500/30',
    bgLight70: 'bg-emerald-500/70',
    borderLight: 'border-emerald-500/60',
    borderLight30: 'border-emerald-500/30',
  },
  cyan: {
    text: 'text-cyan-400',
    bg: 'bg-cyan-500',
    border: 'border-cyan-500',
    ring: 'ring-cyan-500',
    bgLight: 'bg-cyan-500/5',
    bgLight20: 'bg-cyan-500/20',
    bgLight30: 'bg-cyan-500/30',
    bgLight70: 'bg-cyan-500/70',
    borderLight: 'border-cyan-500/60',
    borderLight30: 'border-cyan-500/30',
  },
  amber: {
    text: 'text-amber-400',
    bg: 'bg-amber-500',
    border: 'border-amber-500',
    ring: 'ring-amber-500',
    bgLight: 'bg-amber-500/5',
    bgLight20: 'bg-amber-500/20',
    bgLight30: 'bg-amber-500/30',
    bgLight70: 'bg-amber-500/70',
    borderLight: 'border-amber-500/60',
    borderLight30: 'border-amber-500/30',
  },
};

/**
 * 根据文件扩展名获取文件类型
 */
const getFileIcon = (path: string) => {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'flv'];
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];

  if (videoExts.includes(ext)) {
    return { Icon: FileVideo, type: 'video' as const };
  } else if (imageExts.includes(ext)) {
    return { Icon: ImageIcon, type: 'image' as const };
  }
  return { Icon: FileVideo, type: 'video' as const };
};

/**
 * 通用任务列表组件
 */
export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  currentIndex,
  output,
  thumbnail_source,
  materialsType = [],
  themeColor,
  onTaskChange,
  disabled,
}) => {
  // 获取主题色配置
  const colors = THEME_COLORS[themeColor] || THEME_COLORS.rose;

  // 当前选中的任务
  const currentTask = tasks?.[currentIndex];

  // 用于显示的任务列表（最多100个，避免页面卡顿）
  const displayedTasks = useMemo(() => {
    return tasks.slice(0, MAX_DISPLAY_COUNT);
  }, [tasks]);

  // 是否有超出显示范围的任务
  const hasHiddenTasks = tasks.length > MAX_DISPLAY_COUNT;

  // 收集所有文件路径，并记录每个路径对应的类型（只处理显示的任务）
  const allFilePathsWithType = useMemo(() => {
    if (!displayedTasks || displayedTasks.length === 0) return [];
    const paths: { path: string; type: 'video' | 'image' }[] = [];
    displayedTasks.forEach(task => {
      task.files?.forEach((file, fileIdx) => {
        if (file.path && !paths.find(p => p.path === file.path)) {
          // 根据 materialsType 数组对应位置的类型，如果没有则默认 video
          const type = materialsType[fileIdx] || 'video';
          paths.push({ path: file.path, type });
        }
      });
    });
    return paths;
  }, [displayedTasks, materialsType]);

  // 分离视频和图片路径
  const videoPaths = useMemo(() => {
    return allFilePathsWithType.filter(p => p.type === 'video').map(p => p.path);
  }, [allFilePathsWithType]);

  const imagePaths = useMemo(() => {
    return allFilePathsWithType.filter(p => p.type === 'image').map(p => p.path);
  }, [allFilePathsWithType]);

  // 加载视频素材
  const { materials: videoMaterials } = useVideoMaterials(videoPaths, true);

  // 加载图片素材
  const { materials: imageMaterials } = useImageMaterials(imagePaths, true);

  // 合并所有素材
  const allMaterials = useMemo(() => {
    const map = new Map<string, VideoMaterial | ImageMaterial>();
    videoMaterials.forEach(m => map.set(m.path, m));
    imageMaterials.forEach(m => map.set(m.path, m));
    return map;
  }, [videoMaterials, imageMaterials]);

  // 素材映射（path -> material）
  const materialMap = useMemo(() => {
    const map = new Map<string, VideoMaterial | ImageMaterial>();
    allMaterials.forEach((m) => map.set(m.path, m));
    return map;
  }, [allMaterials]);

  // 预览弹窗状态
  const [showPreview, setShowPreview] = useState(false);
  const [previewFileIndex, setPreviewFileIndex] = useState(0);

  // 预览的文件列表
  const previewAllFiles = useMemo(() => {
    if (!currentTask?.files) return [];
    return currentTask.files.map(f => ({
      path: f.path,
      name: `${f.category_name}${f.index}`,
      type: getFileIcon(f.path).type,
    }));
  }, [currentTask]);

  /**
   * 切换任务
   */
  const switchToTask = useCallback((index: number) => {
    if (index < 0 || index >= tasks.length) return;
    onTaskChange?.(index);
  }, [tasks.length, onTaskChange]);

  /**
   * 上一条任务
   */
  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      switchToTask(currentIndex - 1);
    }
  }, [currentIndex, switchToTask]);

  /**
   * 下一条任务
   */
  const goToNext = useCallback(() => {
    if (currentIndex < tasks.length - 1) {
      switchToTask(currentIndex + 1);
    }
  }, [currentIndex, tasks.length, switchToTask]);

  /**
   * 打开文件预览
   */
  const handleOpenFilePreview = useCallback((fileIndex: number) => {
    setPreviewFileIndex(fileIndex);
    setShowPreview(true);
  }, []);

  /**
   * 关闭预览弹窗
   */
  const handleClosePreview = useCallback(() => {
    setShowPreview(false);
  }, []);

  /**
   * 预览弹窗中切换上一个
   */
  const handlePreviewPrevious = useCallback(() => {
    if (previewFileIndex > 0) {
      setPreviewFileIndex(previewFileIndex - 1);
    }
  }, [previewFileIndex]);

  /**
   * 预览弹窗中切换下一个
   */
  const handlePreviewNext = useCallback(() => {
    if (previewFileIndex < previewAllFiles.length - 1) {
      setPreviewFileIndex(previewFileIndex + 1);
    }
  }, [previewFileIndex, previewAllFiles.length]);

  return (
    <div className="flex flex-col overflow-hidden shrink-0">
      {/* 任务列表 Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-black/50 shrink-0">
        <h2 className="font-bold text-sm text-slate-300 flex items-center gap-2">
          <Layers className={`w-4 h-4 ${colors.text}`} />
          任务列表
        </h2>
        <div className="flex items-center gap-3">
          {hasHiddenTasks && (
            <span className="text-xs text-amber-400">
              当前参数下共{tasks.length}个任务，为了防止软件卡顿，预览任务最多显示{MAX_DISPLAY_COUNT}个
            </span>
          )}
          <span className="bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded-full">
            {tasks.length > 0 ? `${currentIndex + 1} / ${displayedTasks.length}` : tasks.length}
          </span>
        </div>
      </div>

      {/* 横向滚动任务栏 - 使用虚拟列表 */}
      <div className="h-20 border-b border-slate-800 shrink-0 overflow-hidden">
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center w-full h-full text-slate-500">
            <p className="text-xs">暂无任务</p>
          </div>
        ) : (
          <Virtuoso
            data={displayedTasks}
            horizontalDirection
            style={{ height: '100%', width: '100%', overflowY: 'hidden' }}
            className="custom-scrollbar"
            defaultItemHeight={64}
            itemContent={(index, task) => {
              // 获取缩略图来源的文件
              const thumbnailFile = task.files?.find(f => f.category === thumbnail_source);
              const material = thumbnailFile ? materialMap.get(thumbnailFile.path) : null;

              // 计算任务卡片的样式
              const cardClass = index === currentIndex
                ? `${colors.borderLight} ring-2 ${colors.ring}/20 ${colors.bgLight}`
                : 'border-slate-700 bg-black/50';

              return (
                <div
                  className="shrink-0 flex items-center px-1"
                  style={{ width: 64, height: '100%' }}
                >
                  <div
                    className={`relative w-14 h-14 rounded-lg border cursor-pointer ${cardClass} ${disabled ? 'pointer-events-none opacity-50' : ''}`}
                    onClick={() => switchToTask(index)}
                  >
                    {/* 缩略图 */}
                    <div className="absolute inset-0 rounded-lg overflow-hidden">
                      {material?.thumbnailUrl ? (
                        <img src={material.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-black">
                          <FileVideo className="w-5 h-5 text-slate-600" />
                        </div>
                      )}
                    </div>

                    {/* 当前预览指示器 */}
                    {index === currentIndex && (
                      <div className={`absolute -top-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 ${colors.bg} rounded text-[8px] font-medium text-black whitespace-nowrap z-10`}>
                        预览
                      </div>
                    )}
                  </div>
                </div>
              );
            }}
          />
        )}
      </div>

      {/* 任务详情区域 */}
      {currentTask && (
        <div className="bg-black/30 border-b border-slate-800 shrink-0">
          {/* 第一行：输出配置 + 导航/操作 */}
          <div className="px-3 py-2 flex items-center gap-2 border-b border-slate-800/50">
            {/* 左侧导航 */}
            <button
              onClick={goToPrevious}
              disabled={currentIndex === 0 || disabled}
              className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            {/* 输出配置信息 */}
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-slate-500">输出</span>
              <span className={`${colors.text} font-medium whitespace-nowrap`}>{output.resolution}</span>
              <span className="text-slate-600">·</span>
              {output.fps && (
                <>
                  <span className="text-slate-500">帧率</span>
                  <span className="text-slate-200">{output.fps}</span>
                  <span className="text-slate-600">·</span>
                </>
              )}
              <span className="text-slate-500">格式</span>
              <span className="text-slate-200">{output.format.toUpperCase()}</span>
              {output.nums > 1 && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-500">输出</span>
                  <span className="text-slate-200">{output.nums} 个</span>
                </>
              )}
            </div>

            {/* 弹性空间 */}
            <div className="flex-1" />

            {/* 右侧导航 */}
            <button
              onClick={goToNext}
              disabled={currentIndex >= tasks.length - 1 || disabled}
              className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </button>
          </div>

          {/* 文件列表 */}
          {(currentTask.files || []).map((file, fileIndex) => {
            const material = materialMap.get(file.path);
            const { Icon, type: fileType } = getFileIcon(file.path);

            return (
              <div
                key={`${file.category}-${file.index}`}
                className="px-3 py-2 flex items-center gap-2 border-b border-slate-800/30 last:border-b-0"
              >
                {/* Category 标签 */}
                <div className="flex items-center gap-1.5 shrink-0 w-10">
                  <span className={`text-[10px] font-medium ${colors.text}`}>
                    {file.category_name}{file.index}
                  </span>
                </div>

                {/* 缩略图 - 可点击预览 */}
                <button
                  onClick={() => handleOpenFilePreview(fileIndex)}
                  className="w-10 h-10 rounded bg-slate-800 overflow-hidden shrink-0 relative cursor-pointer hover:opacity-80 transition-opacity"
                >
                  {material?.thumbnailUrl ? (
                    <img src={material.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon className="w-5 h-5 text-slate-600" />
                    </div>
                  )}
                  {/* 半透明遮罩 + 图标 - 始终显示 */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    {fileType === 'video' ? (
                      <Play className="w-3.5 h-3.5 text-white/70 fill-white/70" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 text-white/70" />
                    )}
                  </div>
                </button>

                {/* 文件信息 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-100 truncate">{file.path.split('/').pop()}</p>
                  <div className="text-xs text-slate-500">
                    {!!(material as VideoMaterial)?.duration && <span>{formatDuration((material as VideoMaterial).duration!)}</span>}
                    {material?.width && material?.height && (
                      <span>
                        {!!(material as VideoMaterial)?.duration && ' · '}
                        {material.width}×{material.height}
                      </span>
                    )}
                    {material?.fileSize && (
                      <span>
                        {(!!(material as VideoMaterial)?.duration || material?.width) && ' · '}
                        {formatFileSize(material.fileSize)}
                      </span>
                    )}
                    {material?.width && material?.height && (
                      <span>
                        {(!!(material as VideoMaterial)?.duration || material?.width || material?.fileSize) && ' · '}
                        {material.aspectRatio}
                      </span>
                    )}
                    {material?.orientation && (
                      <span className=" px-1.5 py-0.5 bg-slate-800 rounded ml-1">
                        {material.orientation === 'landscape' ? '横版' : material.orientation === 'portrait' ? '竖版' : '方形'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 预览弹窗 */}
      {showPreview && currentTask && previewAllFiles[previewFileIndex] && (
        <FilePreviewModal
          file={previewAllFiles[previewFileIndex]}
          visible={showPreview}
          onClose={handleClosePreview}
          allFiles={previewAllFiles}
          currentIndex={previewFileIndex}
          onPrevious={previewFileIndex > 0 ? handlePreviewPrevious : undefined}
          onNext={previewFileIndex < previewAllFiles.length - 1 ? handlePreviewNext : undefined}
          themeColor={themeColor}
        />
      )}
    </div>
  );
};

export default TaskList;
