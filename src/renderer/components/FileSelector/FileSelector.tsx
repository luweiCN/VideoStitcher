import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, FileVideo, Image as ImageIcon, File, X, Eye, Trash2, Info } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { FilePreviewModal } from './FilePreviewModal';

/**
 * 文件选择器组件 - 现代专业风格设计
 *
 * 设计特点：
 * - 精致的卡片式设计
 * - 微妙的发光边框效果
 * - 清晰的状态指示
 * - 优雅的动画过渡
 */

// ============================================================================
// 类型定义
// ============================================================================

export type FileAcceptType = 'video' | 'image' | 'all' | string[];

export interface FileItem {
  path: string;
  name: string;
  type: 'video' | 'image' | 'unknown';
  size?: number;
  dimensions?: string; // 尺寸，如 "1920x1080"
  orientation?: 'landscape' | 'portrait' | 'square'; // 横版/竖版/方形
  aspectRatio?: string; // 长宽比，如 "16:9"
  _infoLoaded?: boolean; // 内部标记：信息是否已加载
}

export interface FileSelectorProps {
  /** 唯一标识，用于目录缓存和粘贴识别 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 接受的文件类型 */
  accept: FileAcceptType;
  /** 是否允许多选 */
  multiple?: boolean;
  /** 是否显示文件列表 */
  showList?: boolean;
  /** 列表最小高度（px） */
  minHeight?: number;
  /** 列表最大高度（px） */
  maxHeight?: number;
  /** 是否禁用 */
  disabled?: boolean;
  /** 默认文件路径 */
  defaultValue?: string[];
  /** 主题颜色 */
  themeColor?: 'blue' | 'purple' | 'rose' | 'emerald' | 'amber' | 'violet' | 'indigo' | 'pink' | 'cyan' | 'fuchsia';
  /** 是否记住上次目录 */
  directoryCache?: boolean;
  /** 是否必选项 */
  required?: boolean;
  /** 值变化回调 */
  onChange?: (files: string[]) => void;
  /** 自定义预览处理 */
  onPreview?: (file: FileItem) => void;
}

// ============================================================================
// 工具函数
// ============================================================================

const getExtensions = (accept: FileAcceptType): string[] => {
  const typeMap = {
    video: ['mp4', 'mov', 'mkv', 'm4v', 'avi'],
    image: ['jpg', 'jpeg', 'png', 'webp'],
    all: ['*']
  };
  if (Array.isArray(accept)) return accept;
  return typeMap[accept] || typeMap.all;
};

const detectFileType = (filename: string): 'video' | 'image' | 'unknown' => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const videoExts = ['mp4', 'mov', 'mkv', 'm4v', 'avi', 'webm'];
  const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'];
  if (videoExts.includes(ext)) return 'video';
  if (imageExts.includes(ext)) return 'image';
  return 'unknown';
};

const formatFileSize = (bytes: number): string => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ============================================================================
// 主题配置
// ============================================================================

const getThemeConfig = (color: FileSelectorProps['themeColor'] = 'blue') => {
  const configs: Record<string, {
    primary: string;
    primaryLight: string;
    glow: string;
    bg: string;
    border: string;
  }> = {
    blue: {
      primary: '#3b82f6',
      primaryLight: '#60a5fa',
      glow: 'rgba(59, 130, 246, 0.5)',
      bg: 'rgba(59, 130, 246, 0.05)',
      border: 'rgba(59, 130, 246, 0.3)'
    },
    purple: {
      primary: '#8b5cf6',
      primaryLight: '#a78bfa',
      glow: 'rgba(139, 92, 246, 0.5)',
      bg: 'rgba(139, 92, 246, 0.05)',
      border: 'rgba(139, 92, 246, 0.3)'
    },
    rose: {
      primary: '#f43f5e',
      primaryLight: '#fb7185',
      glow: 'rgba(244, 63, 94, 0.5)',
      bg: 'rgba(244, 63, 94, 0.05)',
      border: 'rgba(244, 63, 94, 0.3)'
    },
    emerald: {
      primary: '#10b981',
      primaryLight: '#34d399',
      glow: 'rgba(16, 185, 129, 0.5)',
      bg: 'rgba(16, 185, 129, 0.05)',
      border: 'rgba(16, 185, 129, 0.3)'
    },
    amber: {
      primary: '#f59e0b',
      primaryLight: '#fbbf24',
      glow: 'rgba(245, 158, 11, 0.5)',
      bg: 'rgba(245, 158, 11, 0.05)',
      border: 'rgba(245, 158, 11, 0.3)'
    },
    violet: {
      primary: '#8b5cf6',
      primaryLight: '#a78bfa',
      glow: 'rgba(139, 92, 246, 0.5)',
      bg: 'rgba(139, 92, 246, 0.05)',
      border: 'rgba(139, 92, 246, 0.3)'
    },
    indigo: {
      primary: '#6366f1',
      primaryLight: '#818cf8',
      glow: 'rgba(99, 102, 241, 0.5)',
      bg: 'rgba(99, 102, 241, 0.05)',
      border: 'rgba(99, 102, 241, 0.3)'
    },
    pink: {
      primary: '#ec4899',
      primaryLight: '#f472b6',
      glow: 'rgba(236, 72, 153, 0.5)',
      bg: 'rgba(236, 72, 153, 0.05)',
      border: 'rgba(236, 72, 153, 0.3)'
    },
    cyan: {
      primary: '#06b6d4',
      primaryLight: '#22d3ee',
      glow: 'rgba(6, 182, 212, 0.5)',
      bg: 'rgba(6, 182, 212, 0.05)',
      border: 'rgba(6, 182, 212, 0.3)'
    },
    fuchsia: {
      primary: '#d946ef',
      primaryLight: '#e879f9',
      glow: 'rgba(217, 70, 239, 0.5)',
      bg: 'rgba(217, 70, 239, 0.05)',
      border: 'rgba(217, 70, 239, 0.3)'
    }
  };
  // 确保总是返回有效的配置，使用 blue 作为后备
  return configs[color || 'blue'] || configs.blue;
};

// ============================================================================
// 主组件
// ============================================================================

export const FileSelector: React.FC<FileSelectorProps> = ({
  id,
  name,
  accept,
  multiple = false,
  showList = true,
  minHeight = 80,
  maxHeight = 240,
  disabled = false,
  defaultValue = [],
  themeColor = 'blue',
  directoryCache = true,
  required = false,
  onChange,
  onPreview
}) => {
  const [files, setFiles] = useState<FileItem[]>(() =>
    defaultValue.map(path => ({
      path,
      name: path.split('/').pop() || path,
      type: detectFileType(path)
    }))
  );
  const [isDragging, setIsDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(-1);

  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const theme = getThemeConfig(themeColor);

  // ============================================================================
  // 样式
  // ============================================================================

  const getCardStyle = () => ({
    base: `
      relative
      overflow-hidden
      bg-black
      backdrop-blur-xl
      border
      rounded-2xl
      transition-all
      duration-300
    `,
    normal: `border-slate-800`,
    dragging: `border-[${theme.primary}] shadow-lg shadow-[${theme.glow}]`,
    disabled: `opacity-50 cursor-not-allowed`
  });

  const headerStyle = `
    flex items-center justify-between
    px-5
    py-3
    border-b
    border-slate-800
    bg-black/50
  `;

  const getUploadAreaStyle = () => ({
    base: `
      relative
      flex
      items-center
      justify-start
      gap-4
      mx-4
      my-4
      px-4
      py-3
      rounded-xl
      border
      border-dashed
      transition-all
      duration-200
      cursor-pointer
    `,
    normal: `hover:bg-[${theme.bg}]`,
    dragging: `bg-[${theme.bg}] scale-[1.02]`,
    hasFiles: `bg-[${theme.bg}]`
  });

  const getListStyle = () => ({
    container: `
      border-t
      border-slate-800
    `,
    header: `
      flex
      items-center
      justify-between
      px-5
      py-3
      border-b
      border-slate-800
      bg-black/50
    `,
    content: `
      max-h-[240px]
      overflow-y-auto
      scrollbar-thin
      scrollbar-thumb-gray-700
      hover:scrollbar-thumb-gray-600
    `,
    item: `
      group
      flex
      items-center
      gap-0
      px-5
      py-2
      border-b
      border-slate-800/50
      last:border-b-0
      hover:bg-black/50
      transition-colors
    `,
    icon: `
      w-8
      h-8
      flex
      items-center
      justify-center
      text-slate-500
      shrink-0
    `,
    info: `
      flex-1
      min-w-0
    `,
    name: `
      text-sm
      font-medium
      text-slate-100
      truncate
      group-hover:text-[${theme.primaryLight}]
      transition-colors
    `,
    meta: `
      text-xs
      text-slate-500
    `,
    actions: `
      hidden
      group-hover:flex
      items-center
      gap-1
      transition-all
    `,
    button: `
      p-2
      rounded-lg
      text-slate-500
      hover:text-[${theme.primary}]
      hover:bg-black/50
      transition-all
    `,
    deleteButton: `
      p-2
      rounded-lg
      text-slate-500
      hover:text-rose-400
      hover:bg-rose-500/10
      transition-all
    `
  });

  // ============================================================================
  // 文件操作
  // ============================================================================

  const handleSelectFiles = useCallback(async () => {
    if (disabled) return;

    const extensions = getExtensions(accept);
    const filters = [{ name: 'Files', extensions }];

    try {
      const selectedFiles = await window.api.pickFiles(
        `选择${name}`,
        filters,
        multiple
      );

      if (selectedFiles.length > 0) {
        const newFiles: FileItem[] = selectedFiles.map(filePath => ({
          path: filePath,
          name: filePath.split('/').pop() || filePath,
          type: detectFileType(filePath),
          _infoLoaded: false
        }));

        if (multiple) {
          setFiles(prev => [...prev, ...newFiles]);
        } else {
          setFiles(newFiles.slice(0, 1));
        }

        onChange?.(selectedFiles);
      }
    } catch (err) {
      console.error('文件选择失败:', err);
    }
  }, [accept, disabled, multiple, name, onChange]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    if (disabled) return;

    // TODO: 处理粘贴后的文件分配逻辑
    console.log('检测到拖放文件，需要实现分配逻辑');
  }, [disabled]);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles(prev => {
      const newFiles = prev.filter((_, i) => i !== index);
      onChange?.(newFiles.map(f => f.path));
      return newFiles;
    });
  }, [onChange]);

  const handleClearAll = useCallback(() => {
    setFiles([]);
    onChange?.([]);
  }, [onChange]);

  const handlePreview = useCallback((file: FileItem) => {
    if (onPreview) {
      onPreview(file);
    } else {
      const index = files.findIndex(f => f.path === file.path);
      setPreviewIndex(index);
      setPreviewFile(file);
      setShowPreview(true);
    }
  }, [files, onPreview]);

  /**
   * 上一个文件
   */
  const handlePrevious = useCallback(() => {
    if (previewIndex > 0) {
      const newIndex = previewIndex - 1;
      setPreviewIndex(newIndex);
      setPreviewFile(files[newIndex]);
    }
  }, [previewIndex, files]);

  /**
   * 下一个文件
   */
  const handleNext = useCallback(() => {
    if (previewIndex >= 0 && previewIndex < files.length - 1) {
      const newIndex = previewIndex + 1;
      setPreviewIndex(newIndex);
      setPreviewFile(files[newIndex]);
    }
  }, [previewIndex, files]);

  const handleClosePreview = useCallback(() => {
    setShowPreview(false);
    setTimeout(() => setPreviewFile(null), 300);
  }, []);

  // ============================================================================
  // 渲染辅助函数
  // ============================================================================

  /**
   * Tooltip 内容组件 - 懒加载版本
   * 首次悬浮时才获取文件信息
   */
  const FileTooltipContent: React.FC<{ file: FileItem }> = ({ file }) => {
    const [loading, setLoading] = useState(true);
    const [fileInfo, setFileInfo] = useState<FileItem>(file);
    const filesRef = useRef(files);

    // 更新 ref 引用
    useEffect(() => {
      filesRef.current = files;
    }, [files]);

    useEffect(() => {
      // 如果已经加载过，直接使用缓存
      const cachedFile = filesRef.current.find(f => f.path === file.path);
      if (cachedFile && cachedFile._infoLoaded) {
        setFileInfo(cachedFile);
        setLoading(false);
        return;
      }

      setLoading(true);

      // 并行获取文件信息
      Promise.allSettled([
        // 获取文件大小
        window.api.getFileInfo(file.path),
        // 获取文件尺寸
        file.type === 'video'
          ? window.api.getVideoDimensions(file.path)
          : file.type === 'image'
          ? window.api.getImageDimensions(file.path)
          : Promise.resolve(null)
      ]).then(([sizeResult, dimsResult]) => {
        const updatedInfo: FileItem = { ...file, _infoLoaded: true };

        // 处理文件大小
        if (sizeResult.status === 'fulfilled' && sizeResult.value.success && sizeResult.value.info) {
          updatedInfo.size = sizeResult.value.info.size;
        }

        // 处理文件尺寸
        if (dimsResult.status === 'fulfilled' && dimsResult.value) {
          const dims = dimsResult.value;
          updatedInfo.dimensions = `${dims.width}x${dims.height}`;
          updatedInfo.orientation = dims.orientation;
          updatedInfo.aspectRatio = dims.aspectRatio;
        }

        setFileInfo(updatedInfo);
        setLoading(false);

        // 更新 files 列表中的缓存
        setFiles(prev => prev.map(f =>
          f.path === file.path ? updatedInfo : f
        ));
      });
    }, [file.path, file.type]);

    // 获取文件类型颜色
    const getTypeColor = () => {
      if (fileInfo.type === 'video') return {
        bg: 'from-rose-500/20 to-rose-600/10',
        border: 'border-rose-500/30',
        icon: 'text-rose-400',
        label: 'text-rose-300'
      };
      if (fileInfo.type === 'image') return {
        bg: 'from-emerald-500/20 to-emerald-600/10',
        border: 'border-emerald-500/30',
        icon: 'text-emerald-400',
        label: 'text-emerald-300'
      };
      return {
        bg: 'from-gray-500/20 to-gray-400/10',
        border: 'border-slate-500/30',
        icon: 'text-slate-400',
        label: 'text-slate-100'
      };
    };

    const typeColor = getTypeColor();

    // 判断是否有媒体信息（尺寸或方向）
    const hasMediaInfo = !!(fileInfo.dimensions || fileInfo.orientation || fileInfo.aspectRatio);

    return (
      <Tooltip.Portal>
        <Tooltip.Content
          className="z-50 w-80 overflow-hidden rounded-2xl bg-black backdrop-blur-xl border border-slate-700/50 shadow-2xl shadow-black/50 data-state-closed:animate-hide data-state-open:animate-in"
          sideOffset={-5}
          side="left"
          align="start"
        >
          <Tooltip.Arrow className="fill-slate-700" />
          {/* 头部 - 文件名区域 */}
          <div className={`px-4 py-3 bg-gradient-to-r ${typeColor.bg} border-b border-slate-700/50`}>
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${typeColor.bg} flex items-center justify-center border ${typeColor.border} shrink-0`}>
                {fileInfo.type === 'video' && <FileVideo className={`w-5 h-5 ${typeColor.icon}`} />}
                {fileInfo.type === 'image' && <ImageIcon className={`w-5 h-5 ${typeColor.icon}`} />}
                {fileInfo.type !== 'video' && fileInfo.type !== 'image' && <File className={`w-5 h-5 ${typeColor.icon}`} />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-100 truncate leading-tight">{fileInfo.name}</h3>
                <p className={`text-xs ${typeColor.label} mt-0.5`}>
                  {fileInfo.type === 'video' ? '视频文件' : fileInfo.type === 'image' ? '图片文件' : '文件'}
                </p>
              </div>
            </div>
          </div>

          {/* 内容区域 */}
          <div className="p-4">
            {/* 加载状态 */}
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-slate-500">加载信息中...</p>
                </div>
              </div>
            ) : (
              <>
                {/* 关键信息网格 - 只在有媒体信息时显示 */}
                {hasMediaInfo ? (
                  <div className={`grid gap-2 mb-3 ${fileInfo.size !== undefined ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    {/* 尺寸 */}
                    {fileInfo.dimensions && (
                      <div className="bg-black/50 rounded-lg px-2 py-2 border border-slate-700/50 text-center">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">尺寸</p>
                        <p className="text-xs font-semibold text-cyan-400 font-mono leading-tight break-all">{fileInfo.dimensions}</p>
                      </div>
                    )}
                    {/* 大小 */}
                    {fileInfo.size !== undefined && (
                      <div className="bg-black/50 rounded-lg px-2 py-2 border border-slate-700/50 text-center">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">大小</p>
                        <p className="text-xs font-semibold text-slate-100 leading-tight">{formatFileSize(fileInfo.size)}</p>
                      </div>
                    )}
                    {/* 方向 */}
                    {fileInfo.orientation && (
                      <div className="bg-black/50 rounded-lg px-2 py-2 border border-slate-700/50 text-center">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">方向</p>
                        <p className="text-xs font-semibold text-slate-100 leading-tight">
                          {fileInfo.orientation === 'landscape' ? '横版' : fileInfo.orientation === 'portrait' ? '竖版' : '方形'}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* 非媒体文件：只显示大小 */
                  fileInfo.size !== undefined && (
                    <div className="bg-black/50 rounded-lg px-3 py-3 border border-slate-700/50 text-center mb-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">文件大小</p>
                      <p className="text-lg font-semibold text-slate-100">{formatFileSize(fileInfo.size)}</p>
                    </div>
                  )
                )}

                {/* 详细信息 */}
                <div className="space-y-2">
                  {/* 长宽比 */}
                  {fileInfo.aspectRatio && (
                    <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-black/30 border border-slate-700/30">
                      <span className="text-xs text-slate-500">长宽比</span>
                      <span className="text-sm font-mono font-medium text-slate-100">{fileInfo.aspectRatio}</span>
                    </div>
                  )}
                  {/* 文件类型 */}
                  <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-black/30 border border-slate-700/30">
                    <span className="text-xs text-slate-500">文件类型</span>
                    <span className="text-sm font-mono font-medium text-slate-100">
                      {fileInfo.name.split('.').pop()?.toUpperCase() || '未知'}
                    </span>
                  </div>
                </div>

                {/* 路径 */}
                <div className="mt-3 pt-3 border-t border-slate-900">
                  <div className="flex items-start gap-2">
                    <div className="w-4 h-4 rounded bg-black flex items-center justify-center shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-slate-400" />
                    </div>
                    <p className="text-xs text-slate-400 font-mono break-all leading-relaxed">{fileInfo.path}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </Tooltip.Content>
      </Tooltip.Portal>
    );
  };

  /**
   * 根据文件类型返回上传区域的图标
   */
  const renderUploadAreaIcon = () => {
    const iconColorClass = `text-slate-400 group-hover:text-[${theme.primaryLight}] transition-colors`;

    if (accept === 'video') {
      return <FileVideo className={`w-8 h-8 ${iconColorClass}`} />;
    }
    if (accept === 'image') {
      return <ImageIcon className={`w-8 h-8 ${iconColorClass}`} />;
    }
    return <Upload className={`w-8 h-8 ${iconColorClass}`} />;
  };

  const renderFileIcon = (file: FileItem) => {
    const iconColorClass = file.type === 'video'
      ? 'text-rose-400'
      : file.type === 'image'
      ? 'text-emerald-400'
      : 'text-slate-500';

    if (file.type === 'video') return <FileVideo className={`w-4 h-4 ${iconColorClass}`} />;
    if (file.type === 'image') return <ImageIcon className={`w-4 h-4 ${iconColorClass}`} />;
    return <File className={`w-4 h-4 text-slate-500`} />;
  };

  const renderFileList = () => {
    if (!showList || files.length === 0) return null;

    return (
      <div className={getListStyle().container}>
        {/* 列表头部 */}
        <div className={getListStyle().header}>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            已选择 {files.length} 个文件
          </span>
          <button
            onClick={handleClearAll}
            className="text-xs text-slate-500 hover:text-rose-400 transition-colors flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            清空
          </button>
        </div>

        {/* 文件列表 */}
        <div className={getListStyle().content}>
          {files.map((file, index) => (
            <Tooltip.Root key={`${file.path}-${index}`}>
              <Tooltip.Trigger asChild>
                <div className={`group ${getListStyle().item}`}>
                  {/* 文件图标 */}
                  <div className={getListStyle().icon}>
                    {renderFileIcon(file)}
                  </div>

                  {/* 文件信息 */}
                  <div className={getListStyle().info}>
                    <div className={getListStyle().name}>
                      {file.name}
                    </div>
                    <div className={getListStyle().meta}>
                      {file.size && formatFileSize(file.size)}
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className={getListStyle().actions}>
                    <button
                      onClick={() => handlePreview(file)}
                      className={getListStyle().button}
                      title="预览"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleRemoveFile(index)}
                      className={getListStyle().deleteButton}
                      title="删除"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </Tooltip.Trigger>
              <FileTooltipContent file={file} />
            </Tooltip.Root>
          ))}
        </div>
      </div>
    );
  };

  // ============================================================================
  // 主渲染
  // ============================================================================

  const hasFiles = files.length > 0;

  return (
    <>
      <div className={`${getCardStyle().base} ${disabled ? getCardStyle().disabled : ''} ${isDragging ? getCardStyle().dragging : getCardStyle().normal}`}>
        {/* 头部 */}
        <div className={headerStyle}>
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full animate-pulse`} style={{ backgroundColor: (required && !hasFiles) ? theme.primary : '#64748b' }} />
            <label className="text-sm font-semibold text-slate-100">{name}</label>
          </div>
          {files.length > 0 && (
            <span className="text-xs font-mono px-2 py-1 rounded-full bg-black/50" style={{ color: theme.primaryLight }}>
              {files.length}
            </span>
          )}
        </div>

        {/* 上传区域 */}
        <div
          className={`${getUploadAreaStyle().base} ${hasFiles ? getUploadAreaStyle().hasFiles : getUploadAreaStyle().normal} ${isDragging ? getUploadAreaStyle().dragging : ''}`}
          onClick={handleSelectFiles}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{
            minHeight: `${minHeight}px`,
            ...(disabled && { cursor: 'not-allowed' }),
            borderColor: hasFiles ? theme.primary : 'rgba(51, 65, 85, 0.5)'
          }}
          onMouseEnter={(e) => {
            if (!hasFiles) {
              // 使用 50% 透明度的主题色
              const primaryColor = theme.primary.match(/#[0-9a-fA-F]{6}/)?.[0];
              if (primaryColor) {
                const r = parseInt(primaryColor.slice(1, 3), 16);
                const g = parseInt(primaryColor.slice(3, 5), 16);
                const b = parseInt(primaryColor.slice(5, 7), 16);
                e.currentTarget.style.borderColor = `rgba(${r}, ${g}, ${b}, 0.5)`;
              }
            } else {
              e.currentTarget.style.borderColor = theme.primaryLight;
            }
          }}
          onMouseLeave={(e) => {
            if (hasFiles) {
              e.currentTarget.style.borderColor = theme.primary;
            } else {
              e.currentTarget.style.borderColor = 'rgba(51, 65, 85, 0.5)';
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple={multiple}
            accept={getExtensions(accept).map(ext => `.${ext}`).join(',')}
            disabled={disabled}
          />

          <div className="flex items-center gap-4 pointer-events-none">
            {renderUploadAreaIcon()}
            <div className="flex flex-col items-start gap-1">
              <span className="text-sm text-slate-500 group-hover:text-slate-400">
                支持点击或者拖放选择文件
              </span>
              <span className="text-xs text-slate-400">
                {accept === 'video' && 'MP4, MOV, MKV'}
                {accept === 'image' && 'JPG, PNG, WebP'}
                {accept === 'all' && '所有文件'}
                {Array.isArray(accept) && accept.join(', ').toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* 文件列表 */}
        {renderFileList()}
      </div>

      {/* 预览弹窗 */}
      {showPreview && previewFile && (
        <FilePreviewModal
          file={previewFile}
          visible={showPreview}
          onClose={handleClosePreview}
          allFiles={files}
          currentIndex={previewIndex}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      )}
    </>
  );
};

export default FileSelector;
