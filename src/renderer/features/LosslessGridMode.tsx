import React, { useState, useRef, useCallback } from 'react';
import {
  Grid3X3, Upload, Loader2, CheckCircle, XCircle, ArrowLeft,
  Image as ImageIcon, Layers, Settings, Eye, FolderOpen, Trash2
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import OutputDirSelector from '../components/OutputDirSelector';
import ConcurrencySelector from '../components/ConcurrencySelector';
import OperationLogPanel from '../components/OperationLogPanel';
import FilePreviewModal from '../components/FilePreviewModal';
import { FileSelector, FileSelectorGroup, type FileSelectorRef, formatFileSize } from '../components/FileSelector';
import { Button } from '../components/Button/Button';
import { useOutputDirCache } from '../hooks/useOutputDirCache';
import { useConcurrencyCache } from '../hooks/useConcurrencyCache';
import { useOperationLogs } from '../hooks/useOperationLogs';
import { useImageProcessingEvents } from '../hooks/useImageProcessingEvents';

interface LosslessGridModeProps {
  onBack: () => void;
}

/**
 * 图片文件状态
 */
interface ImageFile {
  id: string;
  path: string;
  name: string;
  status: 'pending' | 'waiting' | 'processing' | 'completed' | 'error';
  thumbnailUrl?: string;      // 缩略图 URL（用于任务列表）
  previewUrl?: string;        // 预览图 URL（用于全屏预览）
  originalSize?: number;      // 原始文件大小（字节）
  width?: number;             // 图片宽度
  height?: number;            // 图片高度
  orientation?: string;        // 方向: portrait/landscape/square
  aspectRatio?: string;        // 宽高比，如 16:9
  error?: string;             // 错误信息
}

const LosslessGridMode: React.FC<LosslessGridModeProps> = ({ onBack }) => {
  const [files, setFiles] = useState<ImageFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0); // 当前选中的任务索引
  const [isProcessing, setIsProcessing] = useState(false);
  const { outputDir, setOutputDir } = useOutputDirCache('LosslessGridMode');
  const { concurrency, setConcurrency } = useConcurrencyCache('LosslessGridMode');

  // FileSelector ref，用于调用清空方法
  const fileSelectorRef = useRef<FileSelectorRef>(null);

  // 进度状态
  const [progress, setProgress] = useState({ done: 0, failed: 0, total: 0 });

  // 预览弹窗状态
  const [showPreview, setShowPreview] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  // 当前选中的文件（用于预览）
  const currentFile = files[currentIndex];

  // 使用日志 Hook
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
    moduleNameCN: '专业无损九宫格',
    moduleNameEN: 'LosslessGrid',
  });

  // 使用图片处理事件 Hook
  useImageProcessingEvents({
    onStart: (data) => {
      addLog(`开始处理: 总任务 ${data.total}, 模式: ${data.mode}`, 'info');
      setProgress({ done: 0, failed: 0, total: data.total });
    },
    onTaskStart: (data) => {
      addLog(`开始处理第 ${data.index + 1} 个任务`, 'info');
      setFiles(prev => {
        let found = false;
        return prev.map((f, idx) => {
          if (idx === data.index && !found) {
            found = true;
            return { ...f, status: 'processing' as const };
          }
          return f;
        });
      });
    },
    onTaskFinish: (data) => {
      addLog(`第 ${data.index + 1} 个任务完成`, 'success');
      setFiles(prev => {
        let found = false;
        return prev.map((f, idx) => {
          if (idx === data.index && !found) {
            found = true;
            return { ...f, status: 'completed' as const };
          }
          return f;
        });
      });
    },
    onProgress: (data) => {
      setProgress({ done: data.done, failed: data.failed, total: data.total });
      addLog(`进度: ${data.done}/${data.total} (失败 ${data.failed})`, 'info');
    },
    onFailed: (data) => {
      addLog(`处理失败: ${data.current} - ${data.error}`, 'error');
      const failedIndex = files.findIndex(f => f.path === data.current);
      if (failedIndex >= 0) {
        setFiles(prev => prev.map((f, idx) => {
          if (idx === failedIndex) {
            return { ...f, status: 'error' as const, error: data.error };
          }
          return f;
        }));
      }
    },
    onFinish: (data) => {
      addLog(`完成! 成功 ${data.done}, 失败 ${data.failed}`, 'success');
      setIsProcessing(false);
    },
  });

  // 格式化文件大小
  const formatSize = (bytes: number) => {
    return formatFileSize(bytes);
  };

  // 选择图片文件 - 使用 FileSelector
  const handleImagesChange = useCallback(async (filePaths: string[]) => {
    if (filePaths.length === 0) return;

    addLog(`正在添加 ${filePaths.length} 张图片...`, 'info');

    // 创建初始文件对象
    const newFiles: ImageFile[] = filePaths.map(path => ({
      id: Math.random().toString(36).substr(2, 9),
      path,
      name: path.split('/').pop() || path,
      status: 'pending' as const,
    }));

    // 先添加文件
    setFiles(prev => [...prev, ...newFiles]);

    // 批量加载所有图片信息（IPC 并行）
    const loadAllImages = async () => {
      try {
        const fileName = filePaths.length > 0 ? filePaths[0].split('/').pop() : '';
        addLog(`开始加载图片信息: ${filePaths.length} 张`, 'info');

        const imagePromises = filePaths.map(async (filePath, idx) => {
          const fileName = filePath.split('/').pop() || filePath;

          // 逐个获取并记录日志
          addLog(`[${idx + 1}/${filePaths.length}] 获取尺寸: ${fileName}`, 'info');
          const dimensionsResult = await window.api.getImageDimensions(filePath);

          addLog(`[${idx + 1}/${filePaths.length}] 获取大小: ${fileName}`, 'info');
          const fileInfoResult = await window.api.getFileInfo(filePath);

          addLog(`[${idx + 1}/${filePaths.length}] 获取缩略图: ${fileName}`, 'info');
          const thumbnailResult = await window.api.getPreviewThumbnail(filePath, 500);

          return {
            index: idx,
            path: filePath,
            width: dimensionsResult?.width,
            height: dimensionsResult?.height,
            orientation: dimensionsResult?.orientation,
            aspectRatio: dimensionsResult?.aspectRatio,
            originalSize: fileInfoResult?.info?.size,
            thumbnailUrl: thumbnailResult.success ? thumbnailResult.thumbnail : undefined,
          };
        });

        const imageInfos = await Promise.all(imagePromises);

        // 更新文件信息
        setFiles(prev => {
          const updated = [...prev];
          const startIndex = prev.length - filePaths.length;

          filePaths.forEach((filePath, idx) => {
            const imageIndex = startIndex + idx;
            const info = imageInfos[idx];
            if (updated[imageIndex] && updated[imageIndex].path === filePath) {
              const fileName = filePath.split('/').pop() || filePath;
              updated[imageIndex] = {
                ...updated[imageIndex],
                width: info.width,
                height: info.height,
                orientation: info.orientation,
                aspectRatio: info.aspectRatio,
                originalSize: info.originalSize,
                thumbnailUrl: info.thumbnailUrl,
              };
              addLog(`[${idx + 1}/${filePaths.length}] 图片信息加载完成: ${fileName} (${info.width}×${info.height})`, 'success');
            }
          });

          return updated;
        });
      } catch (err) {
        addLog(`加载图片信息失败: ${err}`, 'error');
        console.error('加载图片信息失败:', err);
      }
    };

    // 异步加载图片信息
    loadAllImages();

    addLog(`已添加 ${filePaths.length} 张图片`, 'info');

    // 延迟清空 FileSelector
    setTimeout(() => {
      fileSelectorRef.current?.clearFiles();
    }, 0);
  }, [addLog]);

  // 移除文件
  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  // 清空文件列表
  const clearFiles = () => {
    setFiles([]);
    setCurrentIndex(0);
    fileSelectorRef.current?.clearFiles();
  };

  // 切换任务
  const switchToTask = (index: number) => {
    if (index < 0 || index >= files.length) return;
    setCurrentIndex(index);
  };

  // 上一张
  const goToPrevious = () => {
    if (currentIndex > 0) {
      switchToTask(currentIndex - 1);
    }
  };

  // 下一张
  const goToNext = () => {
    if (currentIndex < files.length - 1) {
      switchToTask(currentIndex + 1);
    }
  };

  // 打开预览
  const handleOpenPreview = (index: number) => {
    setPreviewIndex(index);
    setShowPreview(true);
  };

  // 关闭预览
  const handleClosePreview = () => {
    setShowPreview(false);
  };

  // 上一张预览
  const handlePreviousPreview = () => {
    if (previewIndex > 0) {
      setPreviewIndex(previewIndex - 1);
    }
  };

  // 下一张预览
  const handleNextPreview = () => {
    if (previewIndex < files.length - 1) {
      setPreviewIndex(previewIndex + 1);
    }
  };

  // 开始处理
  const startProcessing = async () => {
    if (files.length === 0) {
      addLog('请先添加图片', 'warning');
      return;
    }
    if (!outputDir) {
      addLog('请先选择输出目录', 'warning');
      return;
    }
    if (isProcessing) return;

    setIsProcessing(true);
    clearLogs();
    setProgress({ done: 0, failed: 0, total: files.length });

    // 所有任务设为等待状态
    setFiles(prev => prev.map(f => ({ ...f, status: 'waiting' as const })));

    addLog('开始九宫格切割处理...', 'info');
    addLog(`图片: ${files.length} 张`, 'info');
    addLog(`并发数: ${concurrency === 0 ? '自动' : concurrency}`, 'info');

    try {
      await window.api.imageGrid({
        images: files.map(f => f.path),
        outputDir,
        concurrency: concurrency === 0 ? undefined : concurrency,
      });
    } catch (err: any) {
      addLog(`处理失败: ${err.message || err}`, 'error');
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-screen bg-black text-slate-100 flex flex-col">
      <PageHeader
        onBack={onBack}
        title="专业无损九宫格"
        icon={Grid3X3}
        iconColor="text-cyan-400"
        description="1:1原图，无损无压缩九宫格切割"
        featureInfo={{
          title: '专业无损九宫格',
          description: '对原图进行无损 3×3 切割，保持原始分辨率和画质。',
          details: [
            '自动进行 3×3 九宫格分割，输出 9 张图片',
            '建议上传 1:1 正方形原图以获得最佳效果',
            '支持批量处理，PNG 格式输出保证最佳画质',
          ],
          themeColor: 'cyan',
        }}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - File Selection + Settings */}
        <div className="w-80 border-r border-slate-800 bg-black flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          <div className="p-4 space-y-4">
            {/* 图片文件选择器 */}
            <FileSelectorGroup>
              <FileSelector
                ref={fileSelectorRef}
                id="losslessGridImages"
                name="图片文件"
                accept="image"
                multiple
                showList={false}
                themeColor="cyan"
                directoryCache
                onChange={handleImagesChange}
                disabled={isProcessing}
              />
            </FileSelectorGroup>

            {/* 输出目录 */}
            <OutputDirSelector
              value={outputDir}
              onChange={setOutputDir}
              disabled={isProcessing}
              themeColor="cyan"
            />

            {/* 并发线程数 */}
            <ConcurrencySelector
              value={concurrency}
              onChange={setConcurrency}
              disabled={isProcessing}
              themeColor="cyan"
              compact
            />
          </div>
        </div>

        {/* Middle Panel - flex-1 with vertical layout */}
        <div className="flex-1 bg-black flex flex-col overflow-hidden min-w-0">
          {/* Top: Task List Header + Horizontal Scroll + Selected Task Details */}
          <div className="flex-shrink-0 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-black/50 shrink-0">
              <h2 className="font-bold text-sm text-slate-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                任务列表
              </h2>
              <div className="flex items-center gap-3">
                <span className="bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded-full">{files.length}</span>
                {files.length > 0 && (
                  <button
                    onClick={clearFiles}
                    className="text-xs text-slate-400 hover:text-rose-400 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-rose-500/50 hover:bg-rose-500/10 transition-all"
                  >
                    清除全部
                  </button>
                )}
              </div>
            </div>

            {/* 横向滚动任务栏 */}
            <div className="h-20 overflow-x-auto overflow-y-hidden border-b border-slate-800 shrink-0">
              <div className="flex items-center h-full px-4 gap-2">
                {files.map((f, index) => (
                  <div
                    key={f.id}
                    className={`relative shrink-0 w-14 h-14 rounded-lg border cursor-pointer ${
                      index === currentIndex
                        ? 'border-cyan-500/60 ring-2 ring-cyan-500/20 bg-cyan-500/5'
                        : f.status === 'error'
                        ? 'border-red-500/50 bg-red-500/5'
                        : f.status === 'completed'
                        ? 'border-emerald-500/50 bg-emerald-500/5'
                        : f.status === 'waiting'
                        ? 'border-cyan-500/30 bg-cyan-500/5'
                        : 'border-slate-700 bg-slate-800/50'
                    }`}
                    onClick={() => switchToTask(index)}
                  >
                    {/* 缩略图 */}
                    <div className="absolute inset-0 rounded-lg overflow-hidden">
                      {f.thumbnailUrl ? (
                        <img src={f.thumbnailUrl} alt={f.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-slate-600" />
                        </div>
                      )}
                    </div>

                    {/* processing 状态 */}
                    {f.status === 'processing' && (
                      <div className="absolute inset-0 rounded-lg bg-black/50 flex items-center justify-center pointer-events-none">
                        <Loader2 className="w-5 h-5 text-cyan-500 animate-spin" />
                      </div>
                    )}
                    {/* waiting 状态 */}
                    {f.status === 'waiting' && (
                      <div className="absolute inset-0 rounded-lg bg-black/30 flex items-center justify-center pointer-events-none">
                        <div className="w-4 h-4 rounded-full bg-cyan-500/70" />
                      </div>
                    )}
                    {/* completed 状态 */}
                    {f.status === 'completed' && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
                        <CheckCircle className="w-2.5 h-2.5 text-black" />
                      </div>
                    )}
                    {/* error 状态 */}
                    {f.status === 'error' && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
                        <span className="text-black text-[8px] font-bold">!</span>
                      </div>
                    )}
                  </div>
                ))}
                {files.length === 0 && (
                  <div className="flex items-center justify-center w-full h-full text-slate-500">
                    <p className="text-xs">暂无任务</p>
                  </div>
                )}
              </div>
            </div>

            {/* 选中任务详情 */}
            {files[currentIndex] && (
              <div className="bg-black/30 border-b border-slate-800 shrink-0">
                {/* 上方：基本信息 */}
                <div className="px-3 py-2 flex items-center gap-2">
                  {/* 导航按钮 */}
                  <button
                    onClick={goToPrevious}
                    disabled={currentIndex === 0}
                    className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  {/* 缩略图 */}
                  <div className="w-10 h-10 rounded bg-slate-800 overflow-hidden shrink-0">
                    {files[currentIndex].thumbnailUrl ? (
                      <img src={files[currentIndex].thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-slate-600" />
                      </div>
                    )}
                  </div>

                  {/* 文件信息 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{files[currentIndex].name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {files[currentIndex].originalSize && (
                        <span className="text-[10px] text-slate-500">{formatSize(files[currentIndex].originalSize)}</span>
                      )}
                      {files[currentIndex].width && files[currentIndex].height && (
                        <span className="text-[10px] text-slate-500">{files[currentIndex].width}×{files[currentIndex].height}</span>
                      )}
                      {files[currentIndex].orientation && (
                        <span className="text-[10px] text-slate-500 px-1 py-0.5 bg-slate-800 rounded">
                          {files[currentIndex].orientation === 'portrait' ? '竖版' : files[currentIndex].orientation === 'landscape' ? '横版' : '方版'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* 预览按钮 */}
                    {files[currentIndex].thumbnailUrl && (
                      <button
                        onClick={() => handleOpenPreview(currentIndex)}
                        className="p-1.5 hover:bg-slate-800 text-slate-500 hover:text-slate-300 rounded transition-colors"
                        title="预览"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    {/* 删除按钮 */}
                    {files[currentIndex].status === 'pending' && !isProcessing && (
                      <button
                        onClick={() => removeFile(files[currentIndex].id)}
                        className="p-1.5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {files[currentIndex].status === 'processing' && (
                      <Loader2 className="w-5 h-5 text-cyan-500 animate-spin" />
                    )}
                    {files[currentIndex].status === 'completed' && (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    )}
                    {files[currentIndex].status === 'error' && (
                      <div className="flex items-center gap-1 text-red-400">
                        <XCircle className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  {/* 导航按钮 */}
                  <button
                    onClick={goToNext}
                    disabled={currentIndex >= files.length - 1}
                    className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 rotate-180" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom: Preview Area */}
          {currentFile && currentFile.thumbnailUrl && (
            <div className="flex-1 border-t border-slate-800 bg-black/30 shrink-0 flex flex-col items-center justify-center">
              {/* 预览图 */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
                  原图预览
                </span>
                <img
                  src={currentFile.thumbnailUrl}
                  alt={currentFile.name}
                  className="h-64 w-auto object-contain rounded-lg border border-slate-700"
                />
                <span className="text-[10px] text-slate-500 mt-2">
                  {currentFile.width}×{currentFile.height}
                </span>
                <span className="text-[10px] text-cyan-400 mt-1">
                  将被切割为 9 张 {Math.ceil((currentFile.width || 0) / 3)}×{Math.ceil((currentFile.height || 0) / 3)} 的切片
                </span>
              </div>
            </div>
          )}

          {/* 空状态 */}
          {files.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              <div className="flex flex-col items-center">
                <Grid3X3 className="w-16 h-16 opacity-20 mb-4" />
                <p className="text-xs">暂无任务</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Settings + Logs + Button */}
        <div className="w-80 border-l border-slate-800 bg-black flex flex-col shrink-0 overflow-y-hidden">
          <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            {/* Settings */}
            <div className="bg-black/50 border border-slate-800 rounded-xl p-4 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Settings className="w-3.5 h-3.5" />
                设置
              </h3>
              <OutputDirSelector
                value={outputDir}
                onChange={setOutputDir}
                disabled={isProcessing}
                themeColor="cyan"
              />
              <ConcurrencySelector
                value={concurrency}
                onChange={setConcurrency}
                disabled={isProcessing}
                themeColor="cyan"
                compact
              />
            </div>

            {/* Progress Display */}
            {progress.total > 0 && (
              <div className="bg-black/50 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">处理进度</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">已完成</span>
                  <span className="text-cyan-400 font-bold">{progress.done}/{progress.total}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-cyan-500 h-2 rounded-full transition-all"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                  />
                </div>
                {progress.failed > 0 && (
                  <div className="text-xs text-rose-400">失败: {progress.failed}</div>
                )}
              </div>
            )}

            {/* Logs */}
            <div className="flex-1 min-h-[300px]">
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
                themeColor="cyan"
              />
            </div>

            {/* Start Button */}
            <Button
              onClick={startProcessing}
              disabled={files.length === 0 || !outputDir || isProcessing}
              variant="primary"
              size="md"
              fullWidth
              loading={isProcessing}
              leftIcon={!isProcessing && <FolderOpen className="w-4 h-4" />}
              themeColor="cyan"
            >
              {isProcessing ? '处理中...' : '开始处理'}
            </Button>
          </div>
        </div>
      </div>

      {/* 预览弹窗 */}
      {showPreview && files[previewIndex] && (
        <FilePreviewModal
          file={{
            path: files[previewIndex].path,
            name: files[previewIndex].name,
            type: 'image'
          }}
          visible={showPreview}
          onClose={handleClosePreview}
          allFiles={files.map(img => ({
            path: img.path,
            name: img.name,
            type: 'image' as const,
          }))}
          currentIndex={previewIndex}
          onPrevious={handlePreviousPreview}
          onNext={handleNextPreview}
          themeColor="cyan"
        />
      )}
    </div>
  );
};

export default LosslessGridMode;
