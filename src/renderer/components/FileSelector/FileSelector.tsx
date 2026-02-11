import React, { useState, useRef, useCallback, useEffect, useContext } from 'react';
import { Upload, FileVideo, Image as ImageIcon, File, X, Eye, Trash2, Info } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { FilePreviewModal } from './FilePreviewModal';
import { useRegisterSetFilesCallback, useRegisterGetFileCountCallback, useRegisterGetFilesCallback, FileSelectorGroupContext, type SelectorContext } from './FileSelectorGroup';
import { useToastMessages } from '../Toast';
import { useFileProcessor } from './useFileProcessor';
import { getThemeConfig } from './themeConfig';
import { FileTooltipContent, formatFileSize } from './FileTooltip';

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
  /** 最大文件数量（单选时默认为1，多选时默认为无限） */
  maxCount?: number;
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

// ============================================================================
// 主组件
// ============================================================================

export const FileSelector: React.FC<FileSelectorProps> = ({
  id,
  name,
  accept,
  multiple = false,
  maxCount,
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
  // 计算实际的最大文件数量
  // 单选时默认为1，多选时使用传入值或无限（Infinity）
  const actualMaxCount = multiple ? (maxCount ?? Infinity) : 1;

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

  // 使用文件处理 hook
  const { processFiles, processPaths, detectFileType, buildNotificationMessage } = useFileProcessor();

  // 获取 FileSelectorGroup Context（可能在 Group 外部使用，所以可能为 null）
  const groupContext: SelectorContext | null = useContext(FileSelectorGroupContext);

  // 使用 ref 存储选择器属性，避免频繁重新注册
  const selectorPropsRef = useRef<Omit<FileSelectorProps, 'onChange'>>({
    id,
    name,
    accept,
    multiple,
    showList,
    minHeight,
    maxHeight,
    disabled,
    themeColor,
    directoryCache,
    required,
    defaultValue,
    onChange,
    onPreview
  });

  // 更新 ref 当属性变化时
  selectorPropsRef.current = {
    id,
    name,
    accept,
    multiple,
    showList,
    minHeight,
    maxHeight,
    disabled,
    themeColor,
    directoryCache,
    required,
    defaultValue,
    onChange,
    onPreview
  };

  // 注册选择器到 FileSelectorGroup（只在 id 或 groupContext 变化时重新注册）
  useEffect(() => {
    if (groupContext) {
      console.log('[FileSelector] 注册选择器到 Group:', id);
      groupContext.registerSelector(id, selectorPropsRef.current);

      return () => {
        console.log('[FileSelector] 注销选择器从 Group:', id);
        groupContext.unregisterSelector(id);
      };
    }
  }, [id, groupContext]);

  // 使用 ref 存储 onChange 回调，避免因 onChange 变化而重新注册
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // 获取 toast 通知函数
  const { success, error } = useToastMessages();

  // 注册文件更新回调到 FileSelectorGroup
  // 这个回调允许 FileSelectorGroup 直接更新本选择器的文件
  useRegisterSetFilesCallback(id, (newFiles: FileItem[]) => {
    setFiles(newFiles);
    onChangeRef.current?.(newFiles.map(f => f.path));
  });

  // 注册文件数量获取回调到 FileSelectorGroup
  // 用于在粘贴弹窗中显示当前文件数量
  useRegisterGetFileCountCallback(id, () => files.length);

  // 注册文件列表获取回调到 FileSelectorGroup
  // 用于在粘贴时进行重复检查
  useRegisterGetFilesCallback(id, () => files);

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
      bg-black/30
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

    // 多选模式下检查是否已达最大数量
    const currentCount = files.length;
    if (multiple && currentCount >= actualMaxCount) {
      error(`已达最大文件数量限制（${actualMaxCount} 个）`);
      return;
    }

    const extensions = getExtensions(accept);
    const filters = [{ name: 'Files', extensions }];

    try {
      const selectedPaths = await window.api.pickFiles(
        `选择${name}`,
        filters,
        multiple
      );

      if (selectedPaths.length > 0) {
        // 转换为原始文件数据
        const rawFiles = processPaths(selectedPaths);

        // 使用统一的文件处理逻辑
        const result = processFiles(rawFiles, {
          accept,
          multiple,
          maxCount: actualMaxCount,
          currentCount,
          existingPaths: new Set(files.map(f => f.path))
        });

        // 更新状态
        if (result.filesToAdd.length > 0) {
          if (multiple) {
            setFiles(prev => [...prev, ...result.filesToAdd]);
            onChange?.([...files.map(f => f.path), ...result.filesToAdd.map(f => f.path)]);
          } else {
            setFiles(result.filesToAdd);
            onChange?.(result.filesToAdd.map(f => f.path));
          }
        }

        // 显示通知
        const notification = buildNotificationMessage(
          result.addedCount,
          result.duplicateCount,
          result.formatRejectedCount,
          result.limitRejectedCount
        );

        if (notification.type === 'success') {
          success(notification.message);
        } else {
          error(notification.message);
        }
      }
    } catch (err) {
      console.error('文件选择失败:', err);
    }
  }, [accept, disabled, multiple, name, files, actualMaxCount, onChange, processPaths, processFiles, success, error, buildNotificationMessage]);

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

  /**
   * 处理拖放事件
   *
   * 处理流程：
   * 1. 收集阶段 - 把拖拽内容（文件/文件夹）转换成原始文件路径列表
   * 2. 调用 processFiles 处理（格式校验、数量限制、去重）
   * 3. 更新状态
   * 4. 显示通知
   */
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    if (disabled) return;

    const dataTransfer = e.dataTransfer;
    if (!dataTransfer.files || dataTransfer.files.length === 0) {
      return;
    }

    // ============================================================================
    // 第一步：收集阶段 - 把所有拖拽内容转换成原始文件路径列表
    // ============================================================================
    const rawPaths: { path: string; name: string }[] = [];

    for (let i = 0; i < dataTransfer.files.length; i++) {
      const file = dataTransfer.files[i];
      const path = (file as any).path;

      if (!path) continue; // 跳过没有路径的项目

      // 检测是否是文件夹
      let isDirectory = false;
      try {
        const typeResult = await window.api.checkPathType(path);
        if (typeResult.success) {
          isDirectory = typeResult.isDirectory || false;
        }
      } catch (err) {
        // 检测失败时的回退逻辑
        isDirectory = (file as any).isDirectory ||
          (!file.name.includes('.') && file.size === 0 && file.type === '');
      }

      if (isDirectory) {
        // 文件夹：读取第一层内容
        try {
          const result = await window.api.readDirectory({
            dirPath: path,
            includeHidden: false,
            recursive: false,
            maxDepth: 1,
            extensions: null
          });
          if (result.success && result.files) {
            for (const dirFile of result.files) {
              if (!dirFile.isDirectory) {
                rawPaths.push({ path: dirFile.path, name: dirFile.name });
              }
            }
          }
        } catch (err) {
          console.error('[FileSelector] 读取文件夹失败:', path, err);
        }
      } else {
        // 文件：直接添加
        rawPaths.push({ path, name: file.name });
      }
    }

    if (rawPaths.length === 0) {
      error('没有找到有效的文件');
      return;
    }

    // ============================================================================
    // 第二步：使用统一的文件处理逻辑
    // ============================================================================
    const result = processFiles(rawPaths, {
      accept,
      multiple,
      maxCount: actualMaxCount,
      currentCount: files.length,
      existingPaths: new Set(files.map(f => f.path))
    });

    console.log('[FileSelector] 拖放处理完成:', {
      收集到文件数: rawPaths.length,
      格式不符: result.formatRejectedCount,
      超出数量限制: result.limitRejectedCount,
      重复文件: result.duplicateCount,
      实际添加: result.addedCount
    });

    // ============================================================================
    // 第三步：更新状态
    // ============================================================================
    if (result.filesToAdd.length > 0) {
      if (multiple) {
        setFiles(prev => [...prev, ...result.filesToAdd]);
      } else {
        setFiles(result.filesToAdd);
        onChange?.(result.filesToAdd.map(f => f.path));
      }
    }

    // ============================================================================
    // 第四步：显示通知
    // ============================================================================
    const notification = buildNotificationMessage(
      result.addedCount,
      result.duplicateCount,
      result.formatRejectedCount,
      result.limitRejectedCount
    );

    if (notification.type === 'success') {
      success(notification.message);
    } else {
      error(notification.message);
    }
  }, [disabled, accept, multiple, files, actualMaxCount, onChange, processFiles, success, error, buildNotificationMessage]);

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
   * 处理文件信息更新（用于缓存）
   */
  const handleFileInfoUpdate = useCallback((updatedInfo: FileItem) => {
    setFiles(prev => prev.map(f =>
      f.path === updatedInfo.path ? updatedInfo : f
    ));
  }, []);

  /**
   * 根据文件类型返回上传区域的图标
   */
  const renderUploadAreaIcon = () => {
    // 使用主题色
    const iconColorClass = `text-[${theme.primary}] transition-colors`;

    if (accept === 'video') {
      return <FileVideo className={`w-7 h-7 ${iconColorClass}`} strokeWidth={1.5} />;
    }
    if (accept === 'image') {
      return <ImageIcon className={`w-7 h-7 ${iconColorClass}`} strokeWidth={1.5} />;
    }
    return <Upload className={`w-7 h-7 ${iconColorClass}`} strokeWidth={1.5} />;
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
            已选文件
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
              <FileTooltipContent file={file} onInfoUpdate={handleFileInfoUpdate} />
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
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2 py-1 rounded-full bg-black/50" style={{ color: theme.primaryLight }}>
              {files.length > 0 ? `已选 ${files.length} 个` : ''}{!multiple ? '(单选)' : maxCount ? `(最多 ${maxCount} 个)` : '(多选)'}
            </span>
            {/* 不显示列表时，头部右侧显示清空按钮 */}
            {!showList && hasFiles && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearAll();
                }}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                title="清空"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
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
                {accept === 'all' && '所有格式文件'}
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
