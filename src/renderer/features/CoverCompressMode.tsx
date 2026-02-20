import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Loader2, Play, CheckCircle,
  Image as ImageIcon, XCircle, Settings, Shrink
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import OutputDirSelector from '@/components/OutputDirSelector';
import ConcurrencySelector from '@/components/ConcurrencySelector';
import OperationLogPanel from '@/components/OperationLogPanel';
import { FileSelector, FileSelectorGroup, FileItem, formatFileSize } from '@/components/FileSelector';
import { FilePreviewModal } from '@/components/FilePreviewModal';
import { Button } from '@/components/Button/Button';
import { Eye } from 'lucide-react';
import { ImageCompareModal } from '@/components/ImageCompareModal';
import { useOutputDirCache } from '@/hooks/useOutputDirCache';
import { useConcurrencyCache } from '@/hooks/useConcurrencyCache';
import { useOperationLogs } from '@/hooks/useOperationLogs';
import { useImageProcessingEvents } from '@/hooks/useImageProcessingEvents';
import { useImageMaterials } from '@/hooks/useImageMaterials';

/**
 * 图片文件状态
 */
interface ImageFile {
  id: string;
  path: string;
  name: string;
  status: 'pending' | 'waiting' | 'processing' | 'completed' | 'error';
  originalSize?: number;     // 原始文件大小（字节）
  compressedSize?: number;   // 压缩后大小（字节）
  compressedPath?: string;   // 压缩后文件路径
  previewUrl?: string;       // 图片预览 URL（用于弹窗预览）
  thumbnailUrl?: string;      // 缩略图 URL（用于任务列表，200x200 base64）
  width?: number;           // 图片宽度
  height?: number;         // 图片高度
  orientation?: string;    // 方向: portrait/landscape/square
  aspectRatio?: string;    // 长宽比
  format?: string;          // 图片格式
  _infoLoaded?: boolean;    // 是否已加载信息（用于懒加载）
  skipped?: boolean;        // 是否跳过压缩（文件已达标无需压缩）
}

const CoverCompressMode: React.FC = () => {
  const [files, setFiles] = useState<ImageFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { outputDir, setOutputDir } = useOutputDirCache('CoverCompressMode');
  const { concurrency, setConcurrency } = useConcurrencyCache('CoverCompressMode');
  const [targetSizeKB, setTargetSizeKB] = useState(380);


  // 预览状态
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(-1);

  // 图片对比弹窗状态
  const [showCompare, setShowCompare] = useState(false);
  const [compareFile, setCompareFile] = useState<ImageFile | null>(null);

  // 进度状态
  const [progress, setProgress] = useState({ done: 0, failed: 0, total: 0 });

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
    moduleNameCN: '封面压缩',
    moduleNameEN: 'CoverCompress',
  });

  // 计算实际并发数显示文本（最大值由 ConcurrencySelector 组件自动限制为 16）
  const actualConcurrency = useMemo(() => {
    return concurrency === 0 ? `自动 (16)` : concurrency;
  }, [concurrency]);

  // 使用图片处理事件 Hook
  useImageProcessingEvents({
    onTaskStart: (data) => {
      // 记录当前处理第几个任务
      addLog(`开始处理第 ${data.index + 1} 个任务`, 'info');
      // 更新对应任务为处理中状态（绿色 loading）
      setFiles(prev => {
        const fileIndex = data.index;
        let found = false;
        return prev.map((f, idx) => {
          if (idx === fileIndex && !found) {
            found = true;
            return { ...f, status: 'processing' as const };
          }
          return f;
        });
      });
    },
    onTaskFinish: (data) => {
      // 找到对应文件，检查是否跳过压缩
      const file = files[data.index];
      const skipped = file?.skipped;
      if (skipped) {
        addLog(`文件已达标无需压缩，直接复制: ${file.name}`, 'success');
      } else {
        addLog(`第 ${data.index + 1} 个任务完成`, 'success');
      }
      setFiles(prev => {
        // 找到对应文件并更新为完成状态（保留 compressedSize 和 compressedPath）
        const fileIndex = data.index;
        let found = false;
        return prev.map((f, idx) => {
          if (idx === fileIndex && !found) {
            found = true;
            return { ...f, status: 'completed' as const };
          }
          return f;
        });
      });
    },
    onProgress: (data) => {
      setProgress({ done: data.done, failed: data.failed, total: data.total });
      // 如果文件跳过压缩，记录日志
      if (data.result?.skipped) {
        addLog(`文件已达标无需压缩，直接复制: ${data.current}`, 'info');
      } else {
        addLog(`进度: ${data.done}/${data.total} (失败 ${data.failed})`, 'info');
      }
      // 更新对应文件的状态，从 result 中获取压缩后大小和路径
      if (data.current) {
        setFiles(prev => prev.map(f => {
          if (f.path === data.current) {
            const compressedSize = data.result?.compressedSize;
            const compressedPath = data.result?.outputPath;
            const skipped = data.result?.skipped;
            return {
              ...f,
              status: 'processing' as const,  // 正在处理
              compressedSize: compressedSize !== undefined ? compressedSize : f.compressedSize,
              compressedPath: compressedPath !== undefined ? compressedPath : f.compressedPath,
              skipped: skipped !== undefined ? skipped : f.skipped
            };
          }
          return f;
        }));
      }
    },
    onFailed: (data) => {
      addLog(`❌ 处理失败: ${data.current} - ${data.error}`, 'error');
      setFiles(prev => prev.map(f => {
        if (f.path === data.current) {
          return { ...f, status: 'error' as const, error: data.error };
        }
        return f;
      }));
    },
    onFinish: (data) => {
      addLog(`✅ 处理完成! 成功 ${data.done}, 失败 ${data.failed}`);
      setIsProcessing(false);
    },
  });

  // 选择图片文件 - 使用 FileSelector
  const handleImagesChange = useCallback((filePaths: string[]) => {
    // 获取当前文件列表中的路径
    const currentPaths = new Set(files.map(f => f.path));
    // 获取新传入的路径
    const newPaths = new Set(filePaths);

    // 找出新增的文件
    const addedPaths = filePaths.filter(path => !currentPaths.has(path));
    // 找出被删除的文件
    const removedFiles = files.filter(f => !newPaths.has(f.path));

    // 处理新增的文件
    if (addedPaths.length > 0) {
      const newFiles: ImageFile[] = addedPaths.map(path => {
        const name = path.split('/').pop() || path.split('\\').pop() || path;
        return {
          id: Math.random().toString(36).substr(2, 9),
          path,
          name,
          status: 'pending' as const,
          _infoLoaded: false
        };
      });
      setFiles(prev => [...prev, ...newFiles]);
      addLog(`已添加 ${addedPaths.length} 张图片`, 'info');
    }

    // 处理被删除的文件
    if (removedFiles.length > 0) {
      // 从文件列表中移除
      setFiles(prev => prev.filter(f => newPaths.has(f.path)));
      addLog(`已移除 ${removedFiles.length} 张图片`, 'info');
    }

    // 如果全部清空
    if (filePaths.length === 0 && files.length > 0) {
      setFiles([]);
      addLog(`已清空图片`, 'info');
    }
  }, [files, addLog]);

  // 使用图片素材 Hook 加载图片信息
  const filePaths = useMemo(() => files.map(f => f.path), [files]);
  const { materials } = useImageMaterials(filePaths, true, {
    thumbnailMaxSize: 200,
    onLog: (message) => addLog(message, 'info'),
  });

  // 当 materials 变化时，同步到 files 状态
  useEffect(() => {
    if (materials.length === 0) return;

    setFiles(prev => {
      let hasUpdates = false;
      const next = prev.map((file, index) => {
        const material = materials[index];
        if (!material || !material.isLoaded) return file;
        if (file._infoLoaded) return file;  // 已加载过，跳过

        hasUpdates = true;
        const ext = file.name.split('.').pop()?.toUpperCase() || '';
        return {
          ...file,
          thumbnailUrl: material.thumbnailUrl,
          previewUrl: material.previewUrl,
          originalSize: material.fileSize,
          width: material.width,
          height: material.height,
          orientation: material.orientation,
          aspectRatio: material.aspectRatio,
          format: ext,
          _infoLoaded: true,
        };
      });

      return hasUpdates ? next : prev;
    });
  }, [materials]);

  // 打开预览
  const handlePreview = useCallback((file: ImageFile) => {
    // 转换为 FileItem 格式
    const fileItem: FileItem = {
      path: file.path,
      name: file.name,
      type: 'image' as const,
    };
    const index = files.findIndex(f => f.id === file.id);
    setPreviewFile(fileItem);
    setPreviewIndex(index);
    setShowPreview(true);
  }, [files]);

  // 关闭预览
  const handleClosePreview = useCallback(() => {
    setShowPreview(false);
  }, []);

  // 上一个/下一个预览
  const handlePreviousPreview = useCallback(() => {
    if (previewIndex > 0) {
      const prevFile = files[previewIndex - 1];
      const fileItem: FileItem = {
        path: prevFile.path,
        name: prevFile.name,
        type: 'image' as const,
      };
      setPreviewFile(fileItem);
      setPreviewIndex(previewIndex - 1);
    }
  }, [files, previewIndex]);

  const handleNextPreview = useCallback(() => {
    if (previewIndex < files.length - 1) {
      const nextFile = files[previewIndex + 1];
      const fileItem: FileItem = {
        path: nextFile.path,
        name: nextFile.name,
        type: 'image' as const,
      };
      setPreviewFile(fileItem);
      setPreviewIndex(previewIndex + 1);
    }
  }, [files, previewIndex]);

  // 打开对比弹窗
  const handleCompare = useCallback((file: ImageFile) => {
    setCompareFile(file);
    setShowCompare(true);
  }, []);

  // 开始处理
  const startProcessing = async () => {
    if (files.length === 0) {
      addLog('⚠️ 请先添加图片', 'warning');
      return;
    }
    if (!outputDir) {
      addLog('⚠️ 请先选择输出目录', 'warning');
      return;
    }
    if (isProcessing) return;

    setIsProcessing(true);
    // 不再自动清空日志，保留历史记录
    setProgress({ done: 0, failed: 0, total: files.length });

    // 所有任务设为等待状态（黄色）
    setFiles(prev => prev.map(f => ({ ...f, status: 'waiting' as const })));

    addLog('开始封面压缩处理...', 'info');
    addLog(`图片: ${files.length} 张`, 'info');
    addLog(`目标大小: ~${targetSizeKB}KB`, 'info');
    addLog(`并发数: ${actualConcurrency}`, 'info');

    try {
      await window.api.imageCompress({
        images: files.map(f => f.path),
        targetSizeKB,
        outputDir,
        concurrency: concurrency === 0 ? undefined : concurrency
      });
    } catch (err: any) {
      addLog(`❌ 处理失败: ${err.message || err}`, 'error');
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-screen bg-black text-slate-100 flex flex-col">
      <PageHeader
        title="封面压缩"
        icon={Shrink}
        iconColor="text-emerald-400"
        description={`智能压缩，自动调整质量与尺寸至 ~${targetSizeKB}KB`}
        showTaskIndicator={false}
        featureInfo={{
          title: '封面压缩',
          description: '智能压缩工具，自动调整图片质量与尺寸直到满足目标大小。',
          details: [
            '自动调整图片质量和尺寸，确保输出文件接近目标大小',
            '使用渐进式 JPEG 编码，优化压缩效果',
            '支持批量处理多个图片',
            '可调整目标文件大小（KB）',
            '显示压缩前后大小对比，实时预览效果',
          ],
          themeColor: 'emerald',
        }}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - File Selection + Settings */}
        <div className="w-80 border-r border-slate-800 bg-black flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          <div className="p-4 space-y-4">
            {/* 文件选择器 */}
            <FileSelectorGroup>
              <FileSelector
                id="coverCompressImages"
                name="选择图片"
                accept="image"
                multiple
                showList
                themeColor="emerald"
                directoryCache
                onChange={handleImagesChange}
                disabled={isProcessing}
              />
            </FileSelectorGroup>

            {/* Target Size Setting */}
            <div className="bg-black/50 border border-slate-800 rounded-xl p-4">
              <label className="text-sm font-bold text-slate-300 mb-3 block">目标大小 (KB)</label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="100"
                  max="1000"
                  step="10"
                  value={targetSizeKB}
                  onChange={(e) => setTargetSizeKB(Number(e.target.value))}
                  className="flex-1 accent-emerald-500"
                  disabled={isProcessing}
                />
                <span className="text-sm font-mono bg-slate-800 px-3 py-1 rounded-lg w-16 text-center">
                  ~{targetSizeKB}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                推荐值: 380KB (大多数平台的限制)
              </p>
            </div>
          </div>
        </div>

        {/* Middle Panel - File List Preview */}
        <div className="flex-1 bg-black flex flex-col overflow-hidden min-w-0">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-black/50">
            <h2 className="font-bold text-sm text-slate-300 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-emerald-400" />
              任务列表
            </h2>
            <div className="flex items-center gap-3">
              <span className="bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded-full">{files.length}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-1 gap-3">
              {files.map(f => (
                <div
                  key={f.id}
                  className={`bg-black/50 border rounded-xl p-4 flex items-center gap-4 transition-all ${
                    f.status === 'error' ? 'border-red-500/50' :
                    f.status === 'completed' ? 'border-emerald-500/50' :
                    'border-slate-800'
                  }`}
                >
                  {/* Preview - 优先使用缩略图，fallback 到预览图 */}
                  <div
                    className="relative w-16 h-16 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden group cursor-pointer"
                    onClick={() => handlePreview(f)}
                  >
                    {f.thumbnailUrl ? (
                      <img src={f.thumbnailUrl} alt={f.name} className="w-full h-full object-cover" />
                    ) : f.previewUrl ? (
                      <img src={f.previewUrl} alt={f.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-600" />
                    )}
                    {/* 悬浮时显示的眼睛图标 */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="w-6 h-6 text-white" />
                    </div>
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate text-sm text-slate-100">{f.name}</p>
                    <p className="text-xs text-slate-500 truncate">{f.path}</p>
                    {/* 文件信息 */}
                    {f.status === 'completed' && f.skipped ? (
                      // 跳过压缩（文件已达标无需压缩），只显示原始大小
                      <p className="text-sm mt-1 text-slate-400">
                        <span className="text-emerald-400">已达标无需压缩</span>
                        <span className="mx-1">·</span>
                        <span>{f.originalSize !== undefined ? formatFileSize(f.originalSize) : ''}</span>
                      </p>
                    ) : f.status === 'completed' && f.compressedSize && f.originalSize !== undefined ? (
                      // 正常压缩完成，显示压缩前后对比
                      <p className="text-sm mt-1">
                        <span className="text-slate-400">{formatFileSize(f.originalSize)}</span>
                        <span className="text-slate-600 mx-1">→</span>
                        <span className="text-emerald-400 font-bold">{formatFileSize(f.compressedSize)}</span>
                        <span className="text-slate-500 ml-1">
                          ({Math.round((1 - f.compressedSize / f.originalSize) * 100)}% 压缩)
                        </span>
                      </p>
                    ) : f.originalSize !== undefined ? (
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <p className="text-sm text-slate-400">{formatFileSize(f.originalSize)}</p>
                        {f.width && f.height && (
                          <p className="text-sm text-slate-500">{f.width}×{f.height}</p>
                        )}
                        {f.aspectRatio && (
                          <p className="text-sm text-slate-500">{f.aspectRatio}</p>
                        )}
                        {f.format && (
                          <p className="text-sm text-slate-400 px-1.5 py-0.5 bg-slate-800 rounded">{f.format}</p>
                        )}
                        {f.orientation && (
                          <p className="text-sm text-slate-400 px-1.5 py-0.5 bg-slate-800 rounded">
                            {f.orientation === 'portrait' ? '竖版' : f.orientation === 'landscape' ? '横版' : '方版'}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm mt-1 text-slate-500">加载中...</p>
                    )}
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2 shrink-0">
                    {f.status === 'waiting' && (
                      <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full border-2 border-yellow-400/50" />
                      </div>
                    )}
                    {f.status === 'processing' && (
                      <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                    )}
                    {f.status === 'completed' && (
                      <>
                        {/* 查看效果按钮 - 只有未跳过压缩时才显示 */}
                        {f.compressedSize && !f.skipped && (
                          <Button
                            onClick={() => handleCompare(f)}
                            size="sm"
                            themeColor="fuchsia"
                            className="mr-1"
                          >
                            查看效果
                          </Button>
                        )}
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      </>
                    )}
                    {f.status === 'error' && (
                      <div className="flex items-center gap-1 text-red-400">
                        <XCircle className="w-4 h-4" />
                        <span className="text-xs">失败</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Empty State */}
              {files.length === 0 && (
                <div className="text-center text-slate-500 py-20">
                  <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p>拖入图片开始处理</p>
                </div>
              )}
            </div>
          </div>
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
                themeColor="emerald"
              />

              <ConcurrencySelector
                value={concurrency}
                onChange={setConcurrency}
                disabled={isProcessing}
                themeColor="emerald"
              />
            </div>

            {/* Progress Display - Always show when processing */}
            {progress.total > 0 && (
              <div className="bg-black/50 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">处理进度</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">已完成</span>
                  <span className="text-emerald-400 font-bold">{progress.done}/{progress.total}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all"
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
                themeColor="emerald"
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
              leftIcon={!isProcessing && <Play className="w-4 h-4" />}
            >
              {isProcessing ? '处理中...' : '开始压缩'}
            </Button>
          </div>
        </div>
      </div>

      {/* 预览弹窗 */}
      <FilePreviewModal
        file={previewFile}
        visible={showPreview}
        onClose={handleClosePreview}
        allFiles={files.map(f => ({
          path: f.path,
          name: f.name,
          type: 'image' as const,
        }))}
        currentIndex={previewIndex}
        onPrevious={handlePreviousPreview}
        onNext={handleNextPreview}
        themeColor="emerald"
      />

      {/* 图片对比弹窗 */}
      {compareFile && (
        <ImageCompareModal
          visible={showCompare}
          onClose={() => setShowCompare(false)}
          beforePath={compareFile.path}
          afterPath={compareFile.compressedPath || compareFile.path}
          beforeSize={compareFile.originalSize}
          afterSize={compareFile.compressedSize}
          fileName={compareFile.name}
        />
      )}
    </div>
  );
};

export default CoverCompressMode;
