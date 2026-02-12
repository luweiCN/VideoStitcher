import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, Upload, Loader2, Play, Trash2, CheckCircle,
  Image as ImageIcon, XCircle, AlertCircle, Image
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import OutputDirSelector from '../components/OutputDirSelector';
import OperationLogPanel from '../components/OperationLogPanel';
import { FileSelector, FileSelectorGroup } from '../components/FileSelector';
import { useOutputDirCache } from '../hooks/useOutputDirCache';
import { useOperationLogs } from '../hooks/useOperationLogs';
import { useImageProcessingEvents } from '../hooks/useImageProcessingEvents';

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
    moduleNameCN: '封面格式化',
    moduleNameEN: 'CoverFormat',
  });

  // 使用图片处理事件 Hook
  useImageProcessingEvents({
    onStart: (data) => {
      addLog(`开始处理: 总任务 ${data.total}, 模式: ${data.mode}`, 'info');
      setProgress({ done: 0, failed: 0, total: data.total });
    },
    onProgress: (data) => {
      setProgress({ done: data.done, failed: data.failed, total: data.total });
      addLog(`进度: ${data.done}/${data.total} (失败 ${data.failed})`, 'info');
      // 更新对应文件的状态
      if (data.current) {
        setFiles(prev => prev.map(f => {
          if (f.path === data.current) {
            return { ...f, status: 'completed' };
          }
          return f;
        }));
      }
    },
    onFailed: (data) => {
      addLog(`❌ 处理失败: ${data.current} - ${data.error}`, 'error');
      setFiles(prev => prev.map(f => {
        if (f.path === data.current) {
          return { ...f, status: 'error', error: data.error };
        }
        return f;
      }));
    },
    onFinish: (data) => {
      addLog(`✅ 完成! 成功 ${data.done}, 失败 ${data.failed}`, 'success');
      setIsProcessing(false);
    },
  });

  // 选择图片文件 - 使用 FileSelector
  const handleImagesChange = useCallback((filePaths: string[]) => {
    const newFiles: ImageFile[] = filePaths.map(path => {
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
    addLog(`已添加 ${filePaths.length} 张图片`, 'info');
  }, [addLog]);

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
      addLog('⚠️ 请先添加图片', 'warning');
      return;
    }
    if (!outputDir) {
      addLog('⚠️ 请先选择输出目录', 'warning');
      return;
    }
    if (isProcessing) return;

    setIsProcessing(true);
    clearLogs();
    setProgress({ done: 0, failed: 0, total: files.length });

    // 重置所有文件状态为 pending
    setFiles(prev => prev.map(f => ({ ...f, status: 'pending' as const })));

    addLog('开始封面格式转换处理...', 'info');
    addLog(`图片: ${files.length} 张`, 'info');
    addLog(`质量: ${quality}%`, 'info');

    try {
      await window.api.imageCoverFormat({
        images: files.map(f => f.path),
        quality,
        outputDir
      });
    } catch (err: any) {
      addLog(`❌ 处理失败: ${err.message || err}`, 'error');
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
        featureInfo={{
          title: '封面格式转换',
          description: '自动检测图片比例并转换为标准尺寸，支持批量处理。',
          details: [
            '横版图片自动转为 1920×1080',
            '竖版图片自动转为 1080×1920',
            '方形图片自动转为 800×800',
            '支持批量处理，自动添加尺寸后缀到文件名',
            '图片会被拉伸填充目标尺寸，可能导致轻微变形',
          ],
          themeColor: 'fuchsia',
        }}
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
          {/* 图片文件选择器 */}
          <div className="shrink-0">
            <FileSelectorGroup>
              <FileSelector
              id="coverFormatImages"
              name="图片文件"
              accept="image"
              multiple
              showList={false}
              themeColor="fuchsia"
              directoryCache
              onChange={handleImagesChange}
              disabled={isProcessing}
            />
            </FileSelectorGroup>
          </div>

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
            themeColor="fuchsia"
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
