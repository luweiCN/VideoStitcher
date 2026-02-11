import React, { useState, useEffect, useCallback } from 'react';
import { Upload, Loader2, Grid3X3, CheckCircle, XCircle, ArrowLeft, AlertCircle, FolderOpen } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import OutputDirSelector from '../components/OutputDirSelector';
import OperationLogPanel from '../components/OperationLogPanel';
import { FileSelector, FileSelectorGroup } from '../components/FileSelector';
import { useOutputDirCache } from '../hooks/useOutputDirCache';
import { useOperationLogs } from '../hooks/useOperationLogs';
import { useImageProcessingEvents } from '../hooks/useImageProcessingEvents';

interface LosslessGridModeProps {
  onBack: () => void;
}

interface ImageFile {
  id: string;
  path: string;
  name: string;
  size: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  naturalWidth?: number;
  naturalHeight?: number;
  error?: string;
  previewUrl?: string;
}

const LosslessGridMode: React.FC<LosslessGridModeProps> = ({ onBack }) => {
  const [images, setImages] = useState<ImageFile[]>([]);
  const { outputDir, setOutputDir } = useOutputDirCache('LosslessGridMode');
  const [isProcessing, setIsProcessing] = useState(false);

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

  // 文件选择处理 - 使用 FileSelector
  const handleImagesChange = useCallback(async (filePaths: string[]) => {
    const newImages: ImageFile[] = [];

    for (const path of filePaths) {
      const name = path.split('/').pop() || path.split('\\').pop() || path;

      // 获取预览 URL
      let previewUrl: string | undefined;
      let naturalWidth: number | undefined;
      let naturalHeight: number | undefined;

      try {
        const result = await window.api.getPreviewUrl(path);
        if (result.success && result.url) {
          previewUrl = result.url;

          // 获取图片尺寸
          const img = new Image();
          await new Promise<void>((resolve) => {
            img.onload = () => {
              naturalWidth = img.naturalWidth;
              naturalHeight = img.naturalHeight;
              resolve();
            };
            img.onerror = () => resolve();
            img.src = result.url;
          });
        }
      } catch (err) {
        console.warn('获取预览失败:', path, err);
      }

      // 获取文件大小
      let size = 0;
      try {
        const fileInfo = await window.api.getFileInfo(path);
        if (fileInfo.success && fileInfo.info) {
          size = fileInfo.info.size;
        }
      } catch (err) {
        console.warn('获取文件大小失败:', path, err);
      }

      newImages.push({
        id: Math.random().toString(36).substr(2, 9),
        path,
        name,
        size,
        status: 'pending' as const,
        naturalWidth,
        naturalHeight,
        previewUrl
      });
    }

    setImages(prev => [...prev, ...newImages]);
    addLog(`已添加 ${newImages.length} 张图片`, 'info');
  }, [addLog]);

  // 移除图片
  const removeImage = (id: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img?.previewUrl) {
        URL.revokeObjectURL(img.previewUrl);
      }
      return prev.filter(img => img.id !== id);
    });
  };

  // 清空列表
  const clearImages = () => {
    setImages(prev => {
      prev.forEach(img => {
        if (img.previewUrl) {
          URL.revokeObjectURL(img.previewUrl);
        }
      });
      return [];
    });
  };

  // 组件卸载时清理所有 previewUrl
  useEffect(() => {
    return () => {
      images.forEach(img => {
        if (img.previewUrl) {
          URL.revokeObjectURL(img.previewUrl);
        }
      });
    };
  }, [images]);

  // 使用图片处理事件 Hook
  useImageProcessingEvents({
    onStart: (data) => {
      addLog(`开始处理: 总任务 ${data.total}, 模式: ${data.mode}`, 'info');
      // 处理开始时标记所有待处理图片为处理中
      setImages(prev => prev.map(img =>
        img.status === 'pending' ? { ...img, status: 'processing' } : img
      ));
    },
    onProgress: (data) => {
      addLog(`进度: ${data.done}/${data.total} (失败 ${data.failed})`, 'info');
      // 更新当前处理的图片状态
      if (data.current) {
        setImages(prev => prev.map(img => {
          if (img.path === data.current) {
            return { ...img, status: 'completed' };
          }
          return img;
        }));
      }
    },
    onFailed: (data) => {
      addLog(`❌ 处理失败: ${data.current} - ${data.error}`, 'error');
      // 标记失败的图片
      if (data.current) {
        setImages(prev => prev.map(img => {
          if (img.path === data.current) {
            return { ...img, status: 'error', error: data.error };
          }
          return img;
        }));
      }
    },
    onFinish: (data) => {
      addLog(`✅ 完成! 成功 ${data.done}, 失败 ${data.failed}`, 'success');
      setIsProcessing(false);
    },
  });

  // 开始处理
  const startProcessing = async () => {
    if (images.length === 0) {
      addLog('⚠️ 请先添加图片', 'warning');
      return;
    }
    if (!outputDir) {
      // 如果没有选择输出目录，先让用户选择
      const dir = await window.api.pickOutDir();
      if (dir) {
        setOutputDir(dir);
        addLog(`输出目录: ${dir}`, 'info');
      } else {
        return;
      }
    }
    if (isProcessing) return;

    setIsProcessing(true);
    clearLogs();
    addLog('开始九宫格切割处理...', 'info');
    addLog(`图片: ${images.length} 张`, 'info');

    try {
      const imagePaths = images.map(img => img.path);
      await window.api.imageGrid({
        images: imagePaths,
        outputDir
      });
    } catch (err: any) {
      addLog(`❌ 处理失败: ${err.message || err}`, 'error');
      setIsProcessing(false);
    }
  };

  // 格式化文件大小
  const formatSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  // 获取图片预览 URL
  const getImagePreview = (path: string) => {
    return `file://${path}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
      <PageHeader
        onBack={onBack}
        title="专业无损九宫格"
        icon={Grid3X3}
        iconColor="text-cyan-400"
        description="1:1原图，无损无压缩九宫格切割"
        featureInfo={{
          title: '专业无损九宫格',
          description: '对原图进行无损 3×3 切割，保持原始分辨率和画质。正方形图片优化：确保每个切片至少达到 800×800 分辨率；大图按原图比例无损切割。输出格式为 PNG 以保证最佳画质。',
          details: [
            '自动进行 3×3 九宫格分割，输出 9 张图片',
            '建议上传 1:1 正方形原图以获得最佳效果',
            '支持拖拽上传和批量处理',
          ],
          themeColor: 'cyan',
        }}
      />

      <main className="flex-1 p-6 flex gap-6 overflow-hidden max-h-[calc(100vh-64px)]">
        {/* Left: Input & Controls */}
        <div className="w-96 flex flex-col gap-6">
          {/* Upload Area */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Upload className="w-4 h-4" /> 图片上传
            </h3>

            <FileSelectorGroup>
              <FileSelector
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
          </div>

          {/* Output Directory */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <OutputDirSelector
              value={outputDir}
              onChange={setOutputDir}
              disabled={isProcessing}
              themeColor="cyan"
            />
          </div>

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
            themeColor="cyan"
          />

          {/* Actions */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl mt-auto">
            <div className="flex justify-between items-center mb-4">
              <span className="text-slate-400 text-sm">已选择 {images.length} 张图片</span>
              {images.length > 0 && (
                <button onClick={clearImages} className="text-xs text-rose-400 hover:text-rose-300">
                  清空列表
                </button>
              )}
            </div>
            <button
              onClick={startProcessing}
              disabled={images.length === 0 || isProcessing}
              className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-900/20"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <FolderOpen className="w-5 h-5" />}
              {isProcessing ? '正在处理...' : outputDir ? '开始处理' : '选择导出位置并开始'}
            </button>
          </div>
        </div>

        {/* Right: List & Preview */}
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 overflow-hidden flex flex-col">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
            待处理队列
          </h3>

          <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
            {images.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4">
                <Grid3X3 className="w-16 h-16 opacity-20" />
                <p>暂无图片，请在左侧上传</p>
              </div>
            ) : (
              images.map((img) => (
                <div key={img.id} className="flex items-center gap-4 p-3 bg-slate-950 rounded-xl border border-slate-800 group hover:border-slate-700 transition-colors">
                  <div className="w-12 h-12 bg-slate-900 rounded-lg overflow-hidden flex-shrink-0 border border-slate-800">
                    {img.previewUrl ? (
                      <img src={img.previewUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-800">
                        <Upload className="w-5 h-5 text-slate-600" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{img.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatSize(img.size)}
                      {img.naturalWidth && ` · ${img.naturalWidth}x${img.naturalHeight}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {img.status === 'completed' && (
                      <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold bg-emerald-950/30 px-2 py-1 rounded-full">
                        <CheckCircle className="w-3 h-3" /> 完成
                      </span>
                    )}
                    {img.status === 'processing' && (
                      <span className="flex items-center gap-1 text-amber-400 text-xs font-bold bg-amber-950/30 px-2 py-1 rounded-full">
                        <Loader2 className="w-3 h-3 animate-spin" /> 处理中
                      </span>
                    )}
                    {img.status === 'error' && (
                      <span className="flex items-center gap-1 text-rose-400 text-xs font-bold bg-rose-950/30 px-2 py-1 rounded-full" title={img.error}>
                        <AlertCircle className="w-3 h-3" /> 失败
                      </span>
                    )}
                    {img.status === 'pending' && (
                      <button
                        onClick={() => removeImage(img.id)}
                        className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default LosslessGridMode;
