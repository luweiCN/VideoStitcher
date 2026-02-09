import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft, Upload, Loader2, Play, Trash2, CheckCircle,
  FolderOpen, Image as ImageIcon, XCircle, Settings, Cpu, Shrink
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import OutputDirSelector from '../components/OutputDirSelector';
import ConcurrencySelector from '../components/ConcurrencySelector';
import { useOutputDirCache } from '../hooks/useOutputDirCache';
import { useConcurrencyCache } from '../hooks/useConcurrencyCache';

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
  const [isDragging, setIsDragging] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // 进度状态
  const [progress, setProgress] = useState({ done: 0, failed: 0, total: 0 });
  const [logs, setLogs] = useState<string[]>([]);

  // 计算实际并发数显示文本（最大值由 ConcurrencySelector 组件自动限制为 16）
  const actualConcurrency = useMemo(() => {
    return concurrency === 0 ? `自动 (16)` : concurrency;
  }, [concurrency]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 添加日志
  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // 加载全局默认配置（已移至 useConcurrencyCache hook）

  // 清理监听器
  useEffect(() => {
    const cleanup = () => {
      window.api.removeAllListeners('image-start');
      window.api.removeAllListeners('image-progress');
      window.api.removeAllListeners('image-failed');
      window.api.removeAllListeners('image-finish');
    };

    window.api.onImageStart((data) => {
      addLog(`开始处理: 总任务 ${data.total}, 模式: ${data.mode}`);
      setProgress({ done: 0, failed: 0, total: data.total });

      // 重置所有文件状态为 processing
      setFiles(prev => prev.map(f => ({ ...f, status: 'processing' as const, compressedSize: undefined })));
    });

    window.api.onImageProgress((data) => {
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
    });

    window.api.onImageFailed((data) => {
      addLog(`❌ 处理失败: ${data.current} - ${data.error}`);
      setFiles(prev => prev.map(f => {
        if (f.path === data.current) {
          return { ...f, status: 'error' as const, error: data.error };
        }
        return f;
      }));
    });

    window.api.onImageFinish((data) => {
      addLog(`✅ 完成! 成功 ${data.done}, 失败 ${data.failed}`);
      setIsProcessing(false);
    });

    return cleanup;
  }, []);

  // 格式化文件大小
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // 选择图片文件
  const handleSelectImages = async () => {
    try {
      const selectedPaths = await window.api.pickFiles('选择图片', [
        { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'webp'] }
      ]);

      if (selectedPaths.length > 0) {
        const newFiles: ImageFile[] = await Promise.all(
          selectedPaths.map(async (path) => {
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
        addLog(`已添加 ${selectedPaths.length} 张图片`);
      }
    } catch (err) {
      addLog(`选择图片失败: ${err}`);
    }
  };

  // 拖拽事件处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedPaths = e.dataTransfer.files
      ? Array.from(e.dataTransfer.files)
          .filter(f => f.type.startsWith('image/'))
          .map(f => f.path)
      : [];

    if (droppedPaths.length === 0) {
      addLog('⚠️ 未检测到图片文件');
      return;
    }

    const newFiles: ImageFile[] = await Promise.all(
      droppedPaths.map(async (path) => {
        const name = path.split('/').pop() || path.split('\\').pop() || path;

        // 获取预览 URL
        let previewUrl: string | undefined;
        try {
          const result = await window.api.getPreviewUrl(path);
          if (result.success && result.url) {
            previewUrl = result.url;
          }
        } catch (err) {
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
    addLog(`已添加 ${droppedPaths.length} 张图片`);
  };

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
    setLogs([]);
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
        rightContent={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400"
              title="帮助"
              type="button"
            >
              <Settings className="w-4 h-4" />
            </button>
            {progress.total > 0 && (
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
            )}
          </div>
        }
      />

      {/* 帮助面板 */}
      {showHelp && (
        <div className="px-6 py-3 bg-emerald-500/10 border-b border-emerald-500/20">
          <div className="text-sm text-emerald-300">
            <strong>使用说明：</strong>
            智能压缩工具，自动调整图片质量与尺寸，直到满足目标大小。使用渐进式 JPEG 编码，支持批量处理。
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Control Panel */}
        <div className="w-full max-w-md border-r border-slate-800 bg-slate-900 p-6 flex flex-col gap-6 shrink-0 overflow-y-auto">
          {/* Upload Area */}
          <label
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleSelectImages}
            className={`flex flex-col items-center justify-center flex-1 min-h-[200px] border-2 border-dashed rounded-2xl transition-all cursor-pointer group ${
              isDragging
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-slate-800 hover:border-emerald-500 hover:bg-slate-800/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
            />
            <Upload className={`w-10 h-10 mb-4 transition-colors ${
              isDragging ? 'text-emerald-400' : 'text-slate-600 group-hover:text-emerald-400'
            }`} />
            <p className="text-slate-400 font-bold">点击或拖拽添加图片</p>
            <p className="text-slate-600 text-xs mt-2">支持 JPG、PNG、WEBP</p>
          </label>

          {/* 功能说明 */}
          <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
            <h3 className="text-xs font-bold text-emerald-400 uppercase mb-3">
              功能说明
            </h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>目标大小: ~{targetSizeKB}KB</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>智能调整: 质量/尺寸</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>输出格式: JPG (渐进式)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>支持批量处理</span>
              </li>
            </ul>
          </div>

          {/* File Count */}
          {files.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-sm text-slate-300">已添加 {files.length} 张图片</span>
              <button
                onClick={clearFiles}
                className="text-xs text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                清空
              </button>
            </div>
          )}

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
          {logs.length > 0 && (
            <div className="flex-1 min-h-[150px] bg-slate-950 rounded-xl border border-slate-800 p-3 overflow-hidden flex flex-col">
              <h4 className="text-xs font-bold text-slate-400 mb-2">处理日志</h4>
              <div className="flex-1 overflow-y-auto text-xs font-mono space-y-1">
                {logs.map((log, i) => (
                  <div key={i} className={
                    log.includes('❌') ? 'text-red-400' :
                    log.includes('✅') ? 'text-green-400' :
                    'text-slate-300'
                  }>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
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
