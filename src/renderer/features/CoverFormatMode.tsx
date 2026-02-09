import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Upload, Loader2, Play, Trash2, CheckCircle,
  Image as ImageIcon, XCircle, AlertCircle, Image
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import OutputDirSelector from '../components/OutputDirSelector';
import { useOutputDirCache } from '../hooks/useOutputDirCache';

interface CoverFormatModeProps {
  onBack: () => void;
}

interface ImageFile {
  id: string;
  path: string;
  name: string;
  size: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

const CoverFormatMode: React.FC<CoverFormatModeProps> = ({ onBack }) => {
  const [files, setFiles] = useState<ImageFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { outputDir, setOutputDir } = useOutputDirCache('CoverFormatMode');
  const [quality, setQuality] = useState(90);
  const [isDragging, setIsDragging] = useState(false);

  // 进度状态
  const [progress, setProgress] = useState({ done: 0, failed: 0, total: 0 });
  const [logs, setLogs] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 添加日志
  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

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
    });

    window.api.onImageProgress((data) => {
      setProgress({ done: data.done, failed: data.failed, total: data.total });
      addLog(`进度: ${data.done}/${data.total} (失败 ${data.failed})`);

      // 更新对应文件的状态
      if (data.current) {
        setFiles(prev => prev.map(f => {
          if (f.path === data.current) {
            return { ...f, status: 'completed' };
          }
          return f;
        }));
      }
    });

    window.api.onImageFailed((data) => {
      addLog(`❌ 处理失败: ${data.current} - ${data.error}`);
      setFiles(prev => prev.map(f => {
        if (f.path === data.current) {
          return { ...f, status: 'error', error: data.error };
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

  // 选择图片文件
  const handleSelectImages = async () => {
    try {
      const selectedPaths = await window.api.pickFiles('选择图片', [
        { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'webp'] }
      ]);

      if (selectedPaths.length > 0) {
        const newFiles: ImageFile[] = selectedPaths.map(path => {
          const name = path.split('/').pop() || path.split('\\').pop() || path;
          return {
            id: Math.random().toString(36).substr(2, 9),
            path,
            name,
            size: 0, // 无法在 Electron 渲染进程获取文件大小
            status: 'pending' as const
          };
        });
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

    const newFiles: ImageFile[] = droppedPaths.map(path => {
      const name = path.split('/').pop() || path.split('\\').pop() || path;
      return {
        id: Math.random().toString(36).substr(2, 9),
        path,
        name,
        size: 0,
        status: 'pending' as const
      };
    });
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

    // 重置所有文件状态为 pending
    setFiles(prev => prev.map(f => ({ ...f, status: 'pending' as const })));

    addLog('开始封面格式转换处理...');
    addLog(`图片: ${files.length} 张`);
    addLog(`质量: ${quality}%`);

    try {
      await window.api.imageCoverFormat({
        images: files.map(f => f.path),
        quality,
        outputDir
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
        title="封面格式转换"
        icon={Image}
        iconColor="text-fuchsia-400"
        description="自动检测比例，横版转1920x1080，竖版转1080x1920"
        rightContent={
          /* 进度显示 */
          progress.total > 0 ? (
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="font-bold text-fuchsia-400">{progress.done}</span>
                <span className="text-gray-500"> / {progress.total}</span>
                {progress.failed > 0 && (
                  <span className="ml-2 text-red-400">(失败 {progress.failed})</span>
                )}
              </div>
              <div className="w-32 bg-gray-800 rounded-full h-2">
                <div
                  className="bg-fuchsia-500 h-2 rounded-full transition-all"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
            </div>
          ) : null
        }
      />

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
                ? 'border-fuchsia-500 bg-fuchsia-500/10'
                : 'border-slate-800 hover:border-fuchsia-500 hover:bg-slate-800/50'
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
              isDragging ? 'text-fuchsia-400' : 'text-slate-600 group-hover:text-fuchsia-400'
            }`} />
            <p className="text-slate-400 font-bold">点击或拖拽添加图片</p>
            <p className="text-slate-600 text-xs mt-2">支持 JPG、PNG、WEBP</p>
          </label>

          {/* 功能说明 */}
          <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
            <h3 className="text-xs font-bold text-fuchsia-400 uppercase mb-3">
              功能说明
            </h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span><span className="text-slate-300">横版图片</span> → 1920x1080</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span><span className="text-slate-300">竖版图片</span> → 1080x1920</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span><span className="text-slate-300">方形图片</span> → 800x800</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>支持批量处理，自动添加尺寸后缀</span>
              </li>
            </ul>
            <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-500 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span>图片会被拉伸填充目标尺寸，可能导致变形</span>
            </div>
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

          {/* Output Directory */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
            <OutputDirSelector
              value={outputDir}
              onChange={setOutputDir}
              disabled={isProcessing}
              themeColor="fuchsia"
            />
          </div>

          {/* Quality Setting */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
            <label className="text-sm font-bold text-slate-300 mb-3 block">输出质量</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="60"
                max="100"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="flex-1 accent-fuchsia-500"
                disabled={isProcessing}
              />
              <span className="text-sm font-mono bg-slate-800 px-3 py-1 rounded-lg w-16 text-center">
                {quality}%
              </span>
            </div>
          </div>

          {/* Start Button */}
          <button
            onClick={startProcessing}
            disabled={files.length === 0 || !outputDir || isProcessing}
            className="w-full py-4 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-fuchsia-900/20"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                处理中...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                开始处理
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
                {/* Preview Icon */}
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                  <ImageIcon className="w-5 h-5 text-slate-600" />
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate text-sm">{f.name}</p>
                  <p className="text-xs text-slate-500">{f.path}</p>
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
                    <Loader2 className="w-5 h-5 text-fuchsia-500 animate-spin" />
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

export default CoverFormatMode;
