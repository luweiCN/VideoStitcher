import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ArrowLeft, Upload, Loader2, Play, Trash2, CheckCircle,
  FolderOpen, Image as ImageIcon, XCircle, Settings, Cpu, Shrink
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import OutputDirSelector from '../components/OutputDirSelector';
import ConcurrencySelector from '../components/ConcurrencySelector';
import OperationLogPanel from '../components/OperationLogPanel';
import { FileSelector, FileSelectorGroup } from '../components/FileSelector';
import { useOutputDirCache } from '../hooks/useOutputDirCache';
import { useConcurrencyCache } from '../hooks/useConcurrencyCache';
import { useOperationLogs } from '../hooks/useOperationLogs';
import { useImageProcessingEvents } from '../hooks/useImageProcessingEvents';

interface CoverCompressModeProps {
  onBack: () => void;
}

/**
 * 图片文件状态
 */
interface ImageFile {
  id: string;
  path: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  originalSize: number;      // 原始文件大小（字节）
  compressedSize?: number;   // 压缩后大小（字节）
  previewUrl?: string;       // 图片预览 URL
  error?: string;
}

const CoverCompressMode: React.FC<CoverCompressModeProps> = ({ onBack }) => {
  const [files, setFiles] = useState<ImageFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { outputDir, setOutputDir } = useOutputDirCache('CoverCompressMode');
  const { concurrency, setConcurrency } = useConcurrencyCache('CoverCompressMode');
  const [targetSizeKB, setTargetSizeKB] = useState(380);

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
    onStart: (data) => {
      addLog(`开始处理: 总任务 ${data.total}, 模式: ${data.mode}`);
      setProgress({ done: 0, failed: 0, total: data.total });
      // 重置所有文件状态为 processing
      setFiles(prev => prev.map(f => ({ ...f, status: 'processing' as const, compressedSize: undefined })));
    },
    onProgress: (data) => {
      setProgress({ done: data.done, failed: data.failed, total: data.total });
      addLog(`进度: ${data.done}/${data.total} (失败 ${data.failed})`);
      // 更新对应文件的状态，从 result 中获取压缩后大小
      if (data.current) {
        setFiles(prev => prev.map(f => {
          if (f.path === data.current) {
            const compressedSize = data.result?.compressedSize;
            return {
              ...f,
              status: 'completed' as const,
              compressedSize: compressedSize !== undefined ? compressedSize : f.compressedSize
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
      addLog(`✅ 完成! 成功 ${data.done}, 失败 ${data.failed}`, 'success');
      setIsProcessing(false);
    },
  });

  // 格式化文件大小
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // 选择图片文件 - 使用 FileSelector
  const handleImagesChange = useCallback(async (filePaths: string[]) => {
    const newFiles: ImageFile[] = await Promise.all(
      filePaths.map(async (path) => {
        const name = path.split('/').pop() || path.split('\\').pop() || path;

        // 获取预览 URL
        let previewUrl: string | undefined;
        try {
          const result = await window.api.getPreviewUrl(path);
          if (result.success && result.url) {
            previewUrl = result.url;
          }
        } catch (err) {
          // 预览失败不影响文件添加
          console.warn('获取预览失败:', path, err);
        }

        // 获取文件大小
        let originalSize = 0;
        try {
          const fileInfo = await window.api.getFileInfo(path);
          if (fileInfo.success && fileInfo.info) {
            originalSize = fileInfo.info.size;
          }
        } catch (err) {
          console.warn('获取文件大小失败:', path, err);
        }

        return {
          id: Math.random().toString(36).substr(2, 9),
          path,
          name,
          originalSize,
          status: 'pending' as const,
          previewUrl
        };
      })
    );

    setFiles(prev => [...prev, ...newFiles]);
    addLog(`已添加 ${filePaths.length} 张图片`);
  }, [addLog]);

  // 移除文件
  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  // 清空文件列表
  const clearFiles = () => {
    setFiles([]);
  };

  // 选择输出目录
  const handleSelectOutputDir = async () => {
    try {
      const dir = await window.api.pickOutDir();
      if (dir) {
        setOutputDir(dir);
        addLog(`输出目录: ${dir}`);
      }
    } catch (err) {
      addLog(`选择输出目录失败: ${err}`);
    }
  };

  // 开始处理
  const startProcessing = async () => {
    if (files.length === 0) {
      addLog('⚠️ 请先添加图片');
      return;
    }
    if (!outputDir) {
      addLog('⚠️ 请先选择输出目录');
      return;
    }
    if (isProcessing) return;

    setIsProcessing(true);
    clearLogs();
    setProgress({ done: 0, failed: 0, total: files.length });

    addLog('开始封面压缩处理...');
    addLog(`图片: ${files.length} 张`);
    addLog(`目标大小: ~${targetSizeKB}KB`);
    addLog(`并发数: ${actualConcurrency}`);

    try {
      await window.api.imageCompress({
        images: files.map(f => f.path),
        targetSizeKB,
        outputDir,
        concurrency: concurrency === 0 ? undefined : concurrency
      });
    } catch (err: any) {
      addLog(`❌ 处理失败: ${err.message || err}`);
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-white flex flex-col">
      <PageHeader
        onBack={onBack}
        title="封面压缩"
        icon={Shrink}
        iconColor="text-emerald-400"
        description={`智能压缩，自动调整质量与尺寸至 ~${targetSizeKB}KB`}
        featureTag="自动调整至目标大小"
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
        rightContent={
          progress.total > 0 && (
            <>
              <div className="text-sm">
                <span className="font-bold text-emerald-400">{progress.done}</span>
                <span className="text-gray-500"> / {progress.total}</span>
                {progress.failed > 0 && (
                  <span className="ml-2 text-red-400">(失败 {progress.failed})</span>
                )}
              </div>
              <div className="w-32 bg-gray-800 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
            </>
          )
        }
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Control Panel */}
        <div className="w-full max-w-md border-r border-slate-800 bg-slate-900 p-6 flex flex-col gap-6 shrink-0 overflow-y-auto">
          {/* 图片文件选择器 */}
          <div className="shrink-0">
            <FileSelectorGroup>
              <FileSelector
              id="coverCompressImages"
              name="图片文件"
              accept="image"
              multiple
              showList={false}
              themeColor="emerald"
              directoryCache
              onChange={handleImagesChange}
              disabled={isProcessing}
            />
            </FileSelectorGroup>
          </div>

          {/* Target Size Setting */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
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

          {/* Concurrency Setting */}
          <ConcurrencySelector
            value={concurrency}
            onChange={setConcurrency}
            disabled={isProcessing}
            themeColor="emerald"
            className="p-4 bg-slate-950 rounded-xl border border-slate-800"
          />

          {/* Output Directory */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
            <OutputDirSelector
              value={outputDir}
              onChange={setOutputDir}
              disabled={isProcessing}
              themeColor="emerald"
            />
          </div>

          {/* Start Button */}
          <button
            onClick={startProcessing}
            disabled={files.length === 0 || !outputDir || isProcessing}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/20"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                处理中...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                开始压缩
              </>
            )}
          </button>

          {/* Logs */}
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

        {/* Right List Panel */}
        <div className="flex-1 bg-slate-950 p-6 overflow-y-auto">
          <div className="grid grid-cols-1 gap-3">
            {files.map(f => (
              <div
                key={f.id}
                className={`bg-slate-900 border rounded-xl p-4 flex items-center gap-4 transition-all ${
                  f.status === 'error' ? 'border-red-500/50' :
                  f.status === 'completed' ? 'border-emerald-500/50' :
                  'border-slate-800'
                }`}
              >
                {/* Preview */}
                <div className="w-16 h-16 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                  {f.previewUrl ? (
                    <img src={f.previewUrl} alt={f.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-slate-600" />
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate text-sm">{f.name}</p>
                  <p className="text-xs text-slate-500">{f.path}</p>
                  {/* Size Comparison */}
                  {f.status === 'completed' && f.compressedSize ? (
                    <p className="text-sm mt-1">
                      <span className="text-slate-400">{formatSize(f.originalSize)}</span>
                      <span className="text-slate-600 mx-1">→</span>
                      <span className="text-emerald-400 font-bold">{formatSize(f.compressedSize)}</span>
                      <span className="text-slate-500 ml-1">
                        ({Math.round((1 - f.compressedSize / f.originalSize) * 100)}% 压缩)
                      </span>
                    </p>
                  ) : f.originalSize > 0 ? (
                    <p className="text-sm mt-1 text-slate-400">{formatSize(f.originalSize)}</p>
                  ) : (
                    <p className="text-sm mt-1 text-slate-500">等待处理...</p>
                  )}
                </div>

                {/* Status */}
                <div className="flex items-center gap-2 shrink-0">
                  {f.status === 'pending' && !isProcessing && (
                    <button
                      onClick={() => removeFile(f.id)}
                      className="p-2 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {f.status === 'processing' && (
                    <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                  )}
                  {f.status === 'completed' && (
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
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
    </div>
  );
};

export default CoverCompressMode;
