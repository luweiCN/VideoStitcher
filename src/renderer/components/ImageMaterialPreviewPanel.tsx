import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, AlertCircle, Grid3x3, Image as ImageIcon } from 'lucide-react';

/**
 * 图片素材处理预览面板组件属性
 */
export interface ImageMaterialPreviewPanelProps {
  images: string[];
  logoPath?: string;
  previewSize?: 'inside' | 'cover' | 'fill' | 'pad';
  themeColor?: string;
}

/**
 * 预览状态
 */
type PreviewStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * 骨架屏组件 - 只占位图片位置
 */
const Skeleton: React.FC<{ width?: string; height?: string }> = ({ width = 'w-full', height = 'h-[200px]' }) => (
  <div className={`${width} ${height} bg-slate-700/50 rounded animate-pulse`}></div>
);

/**
 * 图片素材处理预览面板组件
 *
 * 功能：
 * - 依次展示三种预览类型：预览图、带Logo（可选）、九宫格
 * - 支持切换不同素材
 * - 骨架屏只占位图片位置，保持容器结构不变
 */
const ImageMaterialPreviewPanel: React.FC<ImageMaterialPreviewPanelProps> = ({
  images = [],
  logoPath,
  previewSize = 'cover',
  themeColor = 'amber',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  // 初始状态设为 loading，避免 idle → loading 闪烁
  const [status, setStatus] = useState<PreviewStatus>(images.length > 0 ? 'loading' : 'idle');
  const [error, setError] = useState<string | null>(null);

  // 独立的刷新加载标志，用于 logoPath/previewSize 变化时的后台刷新
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 图片预览数据
  const [imagePreviewData, setImagePreviewData] = useState<{
    preview?: string;
    logo?: string;
    grid?: string[];
  }>({});

  // 防止重复加载
  const isLoadingRef = useRef(false);
  const currentFilesRef = useRef<string[]>([]);

  // 加载图片预览
  const loadImagePreview = useCallback(async (filePath: string) => {
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;
    // 只在初次加载或切换素材时改变 status，刷新时保持内容可见
    const isRefresh = isRefreshing;
    if (!isRefresh) {
      setStatus('loading');
    }
    setError(null);

    try {
      const result = await window.api.previewImageMaterial({
        imagePath: filePath,
        logoPath: logoPath,
        previewSize: previewSize
      });

      if (result.success && result.preview) {
        setImagePreviewData({
          preview: result.preview,
          logo: result.logo,
          grid: result.grid?.grid?.map((g: any) => g.outputPath)
        });
        setStatus('ready');
        setIsRefreshing(false);
      } else {
        throw new Error(result.error || '生成预览失败');
      }
    } catch (err: any) {
      setStatus('error');
      setError(err.message || '生成预览失败');
      setIsRefreshing(false);
    } finally {
      isLoadingRef.current = false;
    }
  }, [logoPath, previewSize, isRefreshing]);

  // 当素材变化时，自动预览第一个
  useEffect(() => {
    const filesString = JSON.stringify(images);
    if (filesString === currentFilesRef.current) {
      return;
    }
    currentFilesRef.current = filesString;

    if (images.length === 0) {
      setStatus('idle');
      setImagePreviewData({});
      setError(null);
      return;
    }

    // 有素材时，确保显示骨架屏
    if (status === 'idle') {
      setStatus('loading');
    }
    setCurrentIndex(0);
    loadImagePreview(images[0]);
  }, [images, loadImagePreview]);

  // 当 logoPath 或 previewSize 变化时，重新加载当前预览
  useEffect(() => {
    if (images.length > 0 && currentIndex < images.length && status === 'ready') {
      // 设置刷新标志，但不改变 status（保持内容可见）
      setIsRefreshing(true);
      loadImagePreview(images[currentIndex]);
    }
  }, [logoPath, previewSize]);

  // 切换到上一个/下一个
  const goToPrevious = () => {
    if (currentIndex <= 0 || isLoadingRef.current) return;
    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);
    loadImagePreview(images[newIndex]);
  };

  const goToNext = () => {
    if (currentIndex >= images.length - 1 || isLoadingRef.current) return;
    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);
    loadImagePreview(images[newIndex]);
  };

  // 主题色样式 - 需要在空状态检查之前定义
  const colorClass = themeColor === 'amber' ? 'text-amber-400' : 'text-violet-400';
  const bgClass = themeColor === 'amber' ? 'bg-amber-500/20' : 'bg-violet-500/20';

  // 空状态 - 固定高度避免容器跳动
  if (images.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
        {/* 顶部：标题 */}
        <div className="p-3 border-b border-slate-800">
          <div className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg ${bgClass} ${colorClass}`}>
            <Grid3x3 className="w-4 h-4" />
            <span className="font-medium">图片素材预览</span>
          </div>
        </div>

        {/* 固定高度的空状态内容 */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-[500px]">
          <Grid3x3 className="w-16 h-16 text-slate-700 mb-4" />
          <p className="text-slate-500 text-sm">暂无预览内容</p>
          <p className="text-slate-600 text-xs mt-2">请先选择要处理的素材</p>
        </div>

        {/* 底部占位，保持结构一致 */}
        <div className="p-3 border-t border-slate-800">
          <div className="text-center text-slate-600 text-sm py-2">等待选择素材...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
      {/* 顶部：标题 */}
      <div className="p-3 border-b border-slate-800">
        <div className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg ${bgClass} ${colorClass}`}>
          <Grid3x3 className="w-4 h-4" />
          <span className="font-medium">图片素材预览</span>
          <span className="text-xs opacity-70">({currentIndex + 1}/{images.length})</span>
        </div>
      </div>

      {/* 预览内容区域 */}
      <div className="p-3 space-y-4">
        {/* 刷新时的加载提示 - 只在 logoPath/previewSize 变化时显示，切换素材时不显示 */}
        {isRefreshing && (
          <div className="bg-amber-500/20 border border-amber-500/30 rounded-lg px-3 py-2 flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-amber-400 text-sm">正在刷新预览...</span>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center text-center p-4">
            <AlertCircle className="w-12 h-12 text-red-400 mb-2" />
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={() => loadImagePreview(images[currentIndex])}
              className="mt-3 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 text-sm"
            >
              重试
            </button>
          </div>
        )}

        {status === 'idle' && (
          <div className="text-slate-500 text-sm text-center py-20">选择素材以预览</div>
        )}

        {/* 始终显示容器结构（只要有素材），loading 时图片位置显示骨架屏 */}
        {images.length > 0 && status !== 'idle' && status !== 'error' && (
          <div className="space-y-4">
            {/* 1. 预览图 */}
            <div className="bg-slate-800 rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-white">预览图 (800x800)</span>
              </div>
              <div className="p-3 flex justify-center">
                {status === 'loading' || isRefreshing ? (
                  <Skeleton height="h-[200px]" width="max-w-[280px]" />
                ) : (
                  <img
                    src={`preview://${encodeURIComponent(imagePreviewData.preview || '')}`}
                    alt="预览图"
                    className="max-w-full max-h-[200px] object-contain rounded"
                  />
                )}
              </div>
            </div>

            {/* 2. 带 Logo 图片 - 只在有 Logo 时显示 */}
            {logoPath && (
              <div className="bg-slate-800 rounded-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-2">
                  <Grid3x3 className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-medium text-white">带 Logo 图片 (800x800)</span>
                </div>
                <div className="p-3 flex justify-center">
                  {status === 'loading' || isRefreshing ? (
                    <Skeleton height="h-[200px]" width="max-w-[280px]" />
                  ) : imagePreviewData.logo ? (
                    <img
                      src={`preview://${encodeURIComponent(imagePreviewData.logo)}`}
                      alt="带Logo"
                      className="max-w-full max-h-[200px] object-contain rounded"
                    />
                  ) : null}
                </div>
              </div>
            )}

            {/* 3. 九宫格切片 */}
            <div className="bg-slate-800 rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-2">
                <Grid3x3 className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-white">九宫格切片 (9张)</span>
              </div>
              <div className="p-3">
                <div className="grid grid-cols-3 gap-1 aspect-square max-w-[280px] mx-auto">
                  {status === 'loading' || isRefreshing ? (
                    [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                      <Skeleton key={i} height="h-16" />
                    ))
                  ) : imagePreviewData.grid && imagePreviewData.grid.length > 0 ? (
                    imagePreviewData.grid.map((gridPath, i) => (
                      <img
                        key={i}
                        src={`preview://${encodeURIComponent(gridPath)}`}
                        alt={`切片 ${i + 1}`}
                        className="w-full h-full object-cover rounded"
                      />
                    ))
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 底部：文件信息和切换控制 */}
      <div className="p-3 border-t border-slate-800">
        {images[currentIndex] && (
          <div className="mb-2 text-center">
            <p className="text-sm text-white font-medium break-all leading-relaxed">
              {images[currentIndex].split('/').pop()}
            </p>
          </div>
        )}

        {/* 切换按钮 */}
        {images.length > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={goToPrevious}
              disabled={currentIndex === 0 || status === 'loading'}
              className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-slate-500 text-sm">
              {status === 'loading' ? '生成中...' : '切换素材'}
            </span>
            <button
              onClick={goToNext}
              disabled={currentIndex >= images.length - 1 || status === 'loading'}
              className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageMaterialPreviewPanel;
