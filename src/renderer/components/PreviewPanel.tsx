import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, FileVideo, ImageIcon, AlertCircle, Play, Pause, Volume2, VolumeX, Loader2, Grid3x3 } from 'lucide-react';

/**
 * 预览面板组件属性
 */
export interface PreviewPanelProps {
  // 横屏/竖屏合成模式
  mode: 'horizontal' | 'vertical' | 'image';

  // 横屏/竖屏模式的素材
  bgImage?: string;
  videos?: string[]; // 主视频
  sideAVideos?: string[]; // A面视频
  covers?: string[]; // 封面

  // 图片素材处理模式的素材
  images?: string[];
  logoPath?: string;

  // 主题色（用于不同功能的视觉区分）
  themeColor?: string;
}

/**
 * 预览状态
 */
type PreviewStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * 图片预览类型
 */
type ImagePreviewType = 'preview' | 'logo' | 'grid';

/**
 * 合成预览面板组件
 *
 * 功能：
 * - 实时调用 FFmpeg 合成视频预览
 * - 支持切换不同素材进行预览
 * - 支持视频播放控制
 * - 图片模式支持多种预览类型
 */
const PreviewPanel: React.FC<PreviewPanelProps> = ({
  mode,
  bgImage,
  videos = [],
  sideAVideos = [],
  covers = [],
  images = [],
  logoPath,
  themeColor = 'violet',
}) => {
  // 当前预览的视频索引
  const [currentIndex, setCurrentIndex] = useState(0);

  // 预览状态
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // 视频播放状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // 预览进度信息
  const [progressInfo, setProgressInfo] = useState<string>('');

  // 图片预览数据
  const [imagePreviewData, setImagePreviewData] = useState<{
    preview?: string;
    logo?: string;
    grid?: string[];
  }>({});
  const [imagePreviewType, setImagePreviewType] = useState<ImagePreviewType>('preview');

  // 防止重复加载的标志
  const isLoadingRef = useRef(false);
  const currentFilesRef = useRef<string[]>([]);

  // 监听预览事件（仅用于视频合成模式）
  useEffect(() => {
    const cleanup = () => {
      window.api.removeAllListeners('preview-start');
      window.api.removeAllListeners('preview-complete');
      window.api.removeAllListeners('preview-error');
      window.api.removeAllListeners('preview-log');
    };

    window.api.onPreviewStart((data) => {
      if (mode !== 'image') {
        setStatus('loading');
        setProgressInfo('开始合成预览...');
      }
    });

    window.api.onPreviewComplete((data) => {
      if (mode !== 'image') {
        setStatus('ready');
        setProgressInfo('');
        isLoadingRef.current = false;
      }
    });

    window.api.onPreviewError((data) => {
      if (mode !== 'image') {
        setStatus('error');
        setError(data.error);
        setProgressInfo('');
        isLoadingRef.current = false;
      }
    });

    window.api.onPreviewLog((data) => {
      if (mode !== 'image') {
        setProgressInfo(data.message.slice(0, 100)); // 只显示前100字符
      }
    });

    return cleanup;
  }, [mode]);

  // 获取当前应该预览的文件列表
  const targetFiles = mode === 'image' ? images : videos;

  // 获取当前显示的预览 URL
  const getCurrentPreviewUrl = useCallback((): string | null => {
    if (mode === 'image') {
      if (imagePreviewType === 'preview' && imagePreviewData.preview) {
        return `preview://${encodeURIComponent(imagePreviewData.preview)}`;
      } else if (imagePreviewType === 'logo' && imagePreviewData.logo) {
        return `preview://${encodeURIComponent(imagePreviewData.logo)}`;
      } else if (imagePreviewType === 'grid' && imagePreviewData.grid && imagePreviewData.grid.length > 0) {
        return `preview://${encodeURIComponent(imagePreviewData.grid[0])}`;
      }
      return null;
    }
    // 视频/合成模式 - 使用 iframe 的方式或者直接在事件中设置
    return null;
  }, [mode, imagePreviewType, imagePreviewData]);

  // 加载图片预览
  const loadImagePreview = useCallback(async (filePath: string) => {
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;
    setStatus('loading');
    setError(null);

    try {
      const result = await window.api.previewImageMaterial({
        imagePath: filePath,
        logoPath: logoPath,
        previewSize: 'cover'
      });

      if (result.success && result.preview) {
        setImagePreviewData({
          preview: result.preview,
          logo: result.logo,
          grid: result.grid?.grid?.map((g: any) => g.outputPath)
        });
        setStatus('ready');
      } else {
        throw new Error(result.error || '生成预览失败');
      }
    } catch (err: any) {
      setStatus('error');
      setError(err.message || '生成预览失败');
    } finally {
      isLoadingRef.current = false;
    }
  }, [logoPath]);

  // 触发视频合成预览
  const triggerVideoPreview = useCallback((index: number) => {
    if (isLoadingRef.current) return;

    const targetFile = targetFiles[index];
    if (!targetFile) return;

    isLoadingRef.current = true;
    setStatus('loading');
    setError(null);
    setProgressInfo('开始合成预览...');

    // 异步触发合成预览
    (async () => {
      try {
        let result;

        if (mode === 'horizontal') {
          // 横屏合成预览
          const aVideo = sideAVideos.length > 0 ? sideAVideos[index % sideAVideos.length] : undefined;
          result = await window.api.previewHorizontal({
            aVideo,
            bVideo: targetFile,
            bgImage,
            coverImage: covers.length > 0 ? covers[index % covers.length] : undefined,
          });
        } else if (mode === 'vertical') {
          // 竖屏合成预览
          const aVideo = sideAVideos.length > 0 ? sideAVideos[index % sideAVideos.length] : undefined;
          result = await window.api.previewVertical({
            mainVideo: targetFile,
            bgImage,
            aVideo,
          });
        }

        if (result && !result.success) {
          throw new Error(result.error || '预览生成失败');
        }
      } catch (err: any) {
        setStatus('error');
        setError(err.message || '预览生成失败');
        setProgressInfo('');
        isLoadingRef.current = false;
      }
    })();
  }, [mode, targetFiles, sideAVideos, bgImage, covers]);

  // 当素材变化时，自动预览第一个
  useEffect(() => {
    // 检查文件列表是否真的变化了
    const filesString = JSON.stringify(targetFiles);
    if (filesString === currentFilesRef.current) {
      return; // 文件列表没变化，不执行
    }
    currentFilesRef.current = filesString;

    // 重置状态
    if (targetFiles.length === 0) {
      setStatus('idle');
      setImagePreviewData({});
      setError(null);
      return;
    }

    // 加载第一个文件
    setCurrentIndex(0);

    if (mode === 'image') {
      loadImagePreview(targetFiles[0]);
    } else {
      triggerVideoPreview(0);
    }
  }, [mode, targetFiles, loadImagePreview, triggerVideoPreview]);

  // 切换到上一个/下一个
  const goToPrevious = () => {
    if (currentIndex <= 0 || isLoadingRef.current) return;

    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);

    if (mode === 'image') {
      loadImagePreview(targetFiles[newIndex]);
    } else {
      triggerVideoPreview(newIndex);
    }
  };

  const goToNext = () => {
    if (currentIndex >= targetFiles.length - 1 || isLoadingRef.current) return;

    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);

    if (mode === 'image') {
      loadImagePreview(targetFiles[newIndex]);
    } else {
      triggerVideoPreview(newIndex);
    }
  };

  // 视频播放控制
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // 空状态
  if (targetFiles.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center min-h-[400px]">
        <FileVideo className="w-16 h-16 text-slate-700 mb-4" />
        <p className="text-slate-500 text-sm">暂无预览内容</p>
        <p className="text-slate-600 text-xs mt-2">请先选择要处理的素材</p>
      </div>
    );
  }

  const colorClass = themeColor === 'amber' ? 'text-amber-400' :
                     themeColor === 'indigo' ? 'text-indigo-400' :
                     'text-violet-400';
  const bgClass = themeColor === 'amber' ? 'bg-amber-500/20' :
                  themeColor === 'indigo' ? 'bg-indigo-500/20' :
                  'bg-violet-500/20';

  // 获取当前预览 URL
  const currentPreviewUrl = getCurrentPreviewUrl();

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-full">
      {/* 顶部：标题 */}
      <div className="p-3 border-b border-slate-800">
        <div className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg ${bgClass} ${colorClass}`}>
          <FileVideo className="w-4 h-4" />
          <span className="font-medium">
            {mode === 'horizontal' ? '横屏合成预览' : mode === 'vertical' ? '竖屏合成预览' : '图片素材预览'}
          </span>
          <span className="text-xs opacity-70">({currentIndex + 1}/{targetFiles.length})</span>
        </div>
      </div>

      {/* 图片模式：预览类型切换 */}
      {mode === 'image' && status !== 'idle' && (
        <div className="px-3 py-2 border-b border-slate-800 flex gap-2">
          <button
            onClick={() => setImagePreviewType('preview')}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              imagePreviewType === 'preview'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
            }`}
          >
            预览图
          </button>
          <button
            onClick={() => setImagePreviewType('logo')}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              imagePreviewType === 'logo'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
            }`}
            disabled={!imagePreviewData.logo}
          >
            带Logo
          </button>
          <button
            onClick={() => setImagePreviewType('grid')}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              imagePreviewType === 'grid'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
            }`}
            disabled={!imagePreviewData.grid || imagePreviewData.grid.length === 0}
          >
            <Grid3x3 className="w-4 h-4 inline mr-1" />
            九宫格
          </button>
        </div>
      )}

      {/* 中间：预览区域 */}
      <div className="flex-1 flex items-center justify-center bg-black/50 min-h-[300px] relative p-2">
        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/50 p-4 z-10">
            <Loader2 className="w-12 h-12 text-violet-500 animate-spin mb-4" />
            <p className="text-white text-sm">{mode === 'image' ? '正在生成预览...' : '正在合成预览...'}</p>
            {progressInfo && (
              <p className="text-slate-400 text-xs mt-2 truncate max-w-[200px]">{progressInfo}</p>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center text-center p-4">
            <AlertCircle className="w-12 h-12 text-red-400 mb-2" />
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={() => {
                if (mode === 'image') {
                  loadImagePreview(targetFiles[currentIndex]);
                } else {
                  triggerVideoPreview(currentIndex);
                }
              }}
              className="mt-3 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 text-sm"
            >
              重试
            </button>
          </div>
        )}

        {status === 'ready' && (
          <div className="w-full h-full flex items-center justify-center">
            {mode === 'image' ? (
              // 图片模式
              imagePreviewType === 'grid' && imagePreviewData.grid ? (
                // 九宫格显示
                <div className="grid grid-cols-3 gap-1 w-full aspect-square">
                  {imagePreviewData.grid.map((gridPath, i) => (
                    <img
                      key={i}
                      src={`preview://${encodeURIComponent(gridPath)}`}
                      alt={`切片 ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ))}
                </div>
              ) : (
                // 单图显示
                <img
                  src={currentPreviewUrl || undefined}
                  alt="预览"
                  className="max-w-full max-h-full object-contain"
                  onError={() => {
                    setStatus('error');
                    setError('图片加载失败');
                  }}
                />
              )
            ) : (
              // 视频模式
              currentPreviewUrl && (
                <video
                  ref={videoRef}
                  src={currentPreviewUrl}
                  className="max-w-full max-h-full object-contain"
                  muted={isMuted}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onError={() => {
                    setStatus('error');
                    setError('视频加载失败');
                  }}
                />
              )
            )}

            {/* 视频控制按钮 */}
            {mode !== 'image' && currentPreviewUrl && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2">
                <button
                  onClick={togglePlay}
                  className="text-white hover:text-violet-400 transition-colors"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <button
                  onClick={toggleMute}
                  className="text-white hover:text-violet-400 transition-colors"
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
              </div>
            )}
          </div>
        )}

        {status === 'idle' && (
          <div className="text-slate-500 text-sm">选择素材以预览</div>
        )}
      </div>

      {/* 底部：文件信息和切换控制 */}
      <div className="p-3 border-t border-slate-800">
        {targetFiles[currentIndex] && (
          <div className="mb-2 text-center">
            <p className="text-sm text-white font-medium break-all leading-relaxed">
              {targetFiles[currentIndex].split('/').pop()}
            </p>
            {mode === 'image' && imagePreviewType === 'grid' && imagePreviewData.grid && (
              <p className="text-xs text-slate-500 mt-1">九宫格切片 (9张)</p>
            )}
          </div>
        )}

        {/* 切换按钮 */}
        {targetFiles.length > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={goToPrevious}
              disabled={currentIndex === 0 || status === 'loading'}
              className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-slate-500 text-sm">
              {status === 'loading' ? (mode === 'image' ? '生成中...' : '合成中...') : '切换素材'}
            </span>
            <button
              onClick={goToNext}
              disabled={currentIndex >= targetFiles.length - 1 || status === 'loading'}
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

export default PreviewPanel;
