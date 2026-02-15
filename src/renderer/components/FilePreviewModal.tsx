import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, Video, Image as ImageIcon, FileText, Plus, Minus, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { VideoPlayer } from '@/components/VideoPlayer';
import { FileItem } from '@/components/FileSelector/FileSelector';

/**
 * 文件预览弹窗 - 支持视频和图片预览
 */

// ============================================================================
// 类型定义
// ============================================================================

interface FilePreviewModalProps {
  file: FileItem | null;
  visible: boolean;
  onClose: () => void;
  /** 所有文件列表（用于导航） */
  allFiles?: FileItem[];
  /** 当前文件索引 */
  currentIndex?: number;
  /** 切换到上一个文件 */
  onPrevious?: () => void;
  /** 切换到下一个文件 */
  onNext?: () => void;
  /** 视频播放器主题色 */
  themeColor?: 'slate' | 'violet' | 'rose' | 'fuchsia' | 'emerald' | 'cyan' | 'amber';
}

// ============================================================================
// 图片预览组件
// ============================================================================

interface ImagePreviewProps {
  file: FileItem;
  showPrevious?: boolean;
  showNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ file, showPrevious, showNext, onPrevious, onNext }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = React.useRef<HTMLDivElement>(null);
  const imageRef = React.useRef<HTMLImageElement>(null);

  useEffect(() => {
    const loadPreview = async () => {
      setIsLoading(true);
      try {
        // 使用 getImageFullInfo 获取图片信息（包含 previewUrl）
        const result = await window.api.getImageFullInfo(file.path, { thumbnailMaxSize: 1200 });
        console.log('[FilePreviewModal] getImageFullInfo result:', result);
        if (result.success && result.previewUrl) {
          setPreviewUrl(result.previewUrl);
        } else {
          console.error('获取预览失败:', result);
        }
      } catch (err) {
        console.error('加载图片预览失败:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadPreview();
  }, [file.path]);

  /**
   * 重置缩放和位置
   */
  const resetTransform = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  /**
   * 缩放图片
   */
  const handleZoom = useCallback((delta: number) => {
    setScale(prev => Math.max(0.1, Math.min(10, prev + delta)));
  }, []);

  /**
   * 鼠标滚轮缩放
   */
  const handleWheel = useCallback((e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    handleZoom(delta);
  }, [handleZoom]);

  /**
   * 开始拖拽
   */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [scale, position]);

  /**
   * 拖拽中
   */
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  }, [isDragging, dragStart]);

  /**
   * 结束拖拽
   */
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  /**
   * 用系统默认方式打开文件
   */
  const openInSystem = useCallback(() => {
    window.api.openPath(file.path);
  }, [file.path]);

  return (
    <div className="w-full h-full flex flex-col">
      {/* 图片预览区域 */}
      <div
        ref={containerRef}
        className="flex-1 relative bg-black flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {isLoading ? (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neutral-900 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-slate-500">加载预览中...</p>
          </div>
        ) : previewUrl ? (
          <img
            ref={imageRef}
            src={previewUrl}
            alt={file.name}
            className="max-w-full max-h-full object-contain select-none"
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              transition: isDragging ? 'none' : 'transform 0.2s ease-out',
              cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
            }}
            onMouseDown={handleMouseDown}
            draggable={false}
          />
        ) : (
          <div className="text-center">
            <p className="text-slate-500">预览加载失败</p>
          </div>
        )}

        {/* 缩放控制 */}
        {previewUrl && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/90 backdrop-blur-sm px-4 py-2.5 rounded-2xl border border-slate-700/50 shadow-lg">
            <button
              onClick={() => handleZoom(-0.2)}
              className="p-2 hover:bg-neutral-800/50 rounded-xl transition-colors text-slate-400 hover:text-white"
              title="缩小"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-slate-400 w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => handleZoom(0.2)}
              className="p-2 hover:bg-neutral-800/50 rounded-xl transition-colors text-slate-400 hover:text-white"
              title="放大"
            >
              <Plus className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-neutral-800" />
            <button
              onClick={resetTransform}
              className="p-2 hover:bg-neutral-800/50 rounded-xl transition-colors text-slate-400 hover:text-white"
              title="重置"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 上一个按钮 */}
        {showPrevious && onPrevious && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrevious();
            }}
            className="absolute left-6 top-1/2 -translate-y-1/2 p-4 bg-black/70 backdrop-blur-md hover:bg-neutral-900/90 rounded-2xl border border-slate-700/50 transition-all hover:scale-110 hover:shadow-lg z-10"
            title="上一个 (←)"
          >
            <ChevronLeft className="w-6 h-6 text-slate-300 hover:text-white" />
          </button>
        )}

        {/* 下一个按钮 */}
        {showNext && onNext && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            className="absolute right-6 top-1/2 -translate-y-1/2 p-4 bg-black/70 backdrop-blur-md hover:bg-neutral-900/90 rounded-2xl border border-slate-700/50 transition-all hover:scale-110 hover:shadow-lg z-10"
            title="下一个 (→)"
          >
            <ChevronRight className="w-6 h-6 text-slate-300 hover:text-white" />
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 未知文件预览组件
// ============================================================================

const UnknownFilePreview: React.FC<{ file: FileItem }> = ({ file }) => {
  /**
   * 用系统默认方式打开文件
   */
  const openInSystem = useCallback(() => {
    window.api.openPath(file.path);
  }, [file.path]);

  return (
    <div className="w-full h-full flex items-center justify-center bg-black p-8">
      <div className="text-center max-w-md">
        <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-neutral-900 flex items-center justify-center">
          <FileText className="w-12 h-12 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-300 mb-2">{file.name}</h3>
        <p className="text-sm text-slate-500 mb-6 break-all">{file.path}</p>
        <p className="text-sm text-slate-400 mb-8">
          此文件类型不支持在应用内预览，请使用系统默认程序打开
        </p>
        <button
          onClick={openInSystem}
          className="flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          打开文件
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// 主组件
// ============================================================================

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  visible,
  onClose,
  allFiles = [],
  currentIndex = -1,
  onPrevious,
  onNext,
  themeColor = 'cyan',
}) => {
  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        onPrevious?.();
      } else if (e.key === 'ArrowRight') {
        onNext?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose, onPrevious, onNext]);

  // 是否有多个文件
  const hasMultipleFiles = allFiles.length > 1;
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < allFiles.length - 1;

  if (!file || !visible) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[90vw] h-[85vh] bg-black backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col animate-scaleIn"
      >
        {/* 头部 */}
        <div className="shrink-0 flex items-center justify-start px-6 pr-14 py-4 border-b border-slate-800 bg-black/50 relative">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center shrink-0">
              {file.type === 'video' && <Video className="w-5 h-5 text-cyan-400" />}
              {file.type === 'image' && <ImageIcon className="w-5 h-5 text-fuchsia-400" />}
              {file.type === 'unknown' && <FileText className="w-5 h-5 text-slate-400" />}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-slate-200 truncate">{file.name}</h3>
              <p className="text-xs text-slate-500 truncate">{file.path}</p>
            </div>
            {hasMultipleFiles && currentIndex >= 0 && (
              <span className="inline-flex items-center text-xs font-mono px-3 py-1 rounded-full bg-neutral-900 text-cyan-400 border border-cyan-500/30 whitespace-nowrap shrink-0">
                {currentIndex + 1} / {allFiles.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-neutral-900 rounded-xl transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-hidden">
          {file.type === 'video' && (
            <VideoPlayer
              key={file.path}
              src={file.path}
              showTitle={false}
              showPrevious={canGoPrevious}
              showNext={canGoNext}
              onPrevious={onPrevious}
              onNext={onNext}
              themeColor={themeColor}
            />
          )}
          {file.type === 'image' && (
            <ImagePreview
              file={file}
              showPrevious={canGoPrevious}
              showNext={canGoNext}
              onPrevious={onPrevious}
              onNext={onNext}
            />
          )}
          {file.type === 'unknown' && <UnknownFilePreview file={file} />}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default FilePreviewModal;
