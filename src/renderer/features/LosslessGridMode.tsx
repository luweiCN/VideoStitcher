import React, { useState, useEffect } from 'react';
import { ImageIcon, Play, Trash2, Loader2, ArrowLeft, FolderOpen, Settings, CheckCircle, Grid3X3 } from 'lucide-react';

interface LosslessGridModeProps {
  onBack: () => void;
}

const LosslessGridMode: React.FC<LosslessGridModeProps> = ({ onBack }) => {
  const [images, setImages] = useState<string[]>([]);
  const [outputDir, setOutputDir] = useState<string>('');
  const [showHelp, setShowHelp] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, failed: 0, total: 0 });
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

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
    });

    window.api.onImageFailed((data) => {
      addLog(`❌ 处理失败: ${data.current} - ${data.error}`);
    });

    window.api.onImageFinish((data) => {
      addLog(`✅ 完成! 成功 ${data.done}, 失败 ${data.failed}`);
      setIsProcessing(false);
    });

    return cleanup;
  }, []);

  const handleSelectImages = async () => {
    try {
      const files = await window.api.pickFiles('选择图片 (推荐1:1比例)', [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }
      ]);
      if (files.length > 0) {
        setImages(files);
        addLog(`已选择 ${files.length} 张图片`);
      }
    } catch (err) {
      addLog(`选择图片失败: ${err}`);
    }
  };

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

  const startProcessing = async () => {
    if (images.length === 0) {
      addLog('⚠️ 请先选择图片');
      return;
    }
    if (!outputDir) {
      addLog('⚠️ 请先选择输出目录');
      return;
    }
    if (isProcessing) return;

    setIsProcessing(true);
    setLogs([]);
    addLog('开始无损九宫格处理...');
    addLog(`图片: ${images.length} 张`);

    try {
      await window.api.imageGrid({
        images,
        outputDir
      });
    } catch (err: any) {
      addLog(`❌ 处理失败: ${err.message || err}`);
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          返回
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-cyan-400">专业无损九宫格</h1>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            title="帮助"
          >
            <Settings className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Help Panel */}
      {showHelp && (
        <div className="mb-6 p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <h3 className="font-bold mb-2 text-cyan-400">使用说明</h3>
          <ul className="text-sm text-slate-300 space-y-1">
            <li>• 专业用途工具,批量处理 1:1 原图</li>
            <li>• 无损、无压缩九宫格切割</li>
            <li>• 每张图切成 3x3 = 9 张切片</li>
            <li>• 输出高质量 JPEG (质量 95%)</li>
            <li>• 命名格式: 原文件名_1.jpg, 原文件名_2.jpg...</li>
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Inputs */}
        <div className="lg:col-span-2 space-y-4">
          {/* Image Selection */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="font-medium flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-cyan-400" />
                选择图片 - 必填
              </label>
              <div className="flex items-center gap-2">
                {images.length > 0 && (
                  <button
                    onClick={() => setImages([])}
                    className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                    title="清空"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={handleSelectImages}
                  className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors text-sm"
                >
                  <FolderOpen className="w-4 h-4" />
                  选择图片
                </button>
              </div>
            </div>
            {images.length > 0 && (
              <div className="text-sm text-slate-400">
                已选择 {images.length} 张图片
              </div>
            )}
          </div>

          {/* Output Directory */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="font-medium flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-cyan-400" />
                输出目录 - 必填
              </label>
              <button
                onClick={handleSelectOutputDir}
                className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors text-sm"
              >
                选择目录
              </button>
            </div>
            {outputDir && (
              <div className="text-sm text-slate-400 truncate">
                {outputDir}
              </div>
            )}
          </div>

          {/* Info Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Grid3X3 className="w-5 h-5 text-cyan-400 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium mb-2">输出说明</h4>
                <ul className="text-sm text-slate-400 space-y-1">
                  <li>• 每张图片将生成 9 个切片文件</li>
                  <li>• 切片顺序: 从左到右,从上到下</li>
                  <li>• 文件命名: 原文件名_1.jpg ~ 原文件名_9.jpg</li>
                  <li>• 切片质量: 95% (接近无损)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Progress & Logs */}
        <div className="space-y-4">
          {/* Progress */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="font-medium mb-3">处理进度</h3>
            {progress.total > 0 ? (
              <div className="space-y-2">
                <div className="text-center">
                  <span className="text-3xl font-bold text-cyan-400">{progress.done}</span>
                  <span className="text-slate-400"> / {progress.total}</span>
                </div>
                {progress.failed > 0 && (
                  <div className="text-center text-red-400 text-sm">
                    失败: {progress.failed}
                  </div>
                )}
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-cyan-500 h-2 rounded-full transition-all"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500 text-center">
                  将生成 {progress.done * 9} 个切片文件
                </div>
              </div>
            ) : (
              <div className="text-slate-500 text-center py-4">等待开始</div>
            )}
          </div>

          {/* Start Button */}
          <button
            onClick={startProcessing}
            disabled={isProcessing || images.length === 0 || !outputDir}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                处理中...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                开始切割
              </>
            )}
          </button>

          {/* Logs */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="font-medium mb-3">处理日志</h3>
            <div className="h-48 overflow-y-auto text-xs font-mono space-y-1">
              {logs.length === 0 ? (
                <div className="text-slate-500 text-center py-4">暂无日志</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className={log.includes('❌') ? 'text-red-400' : log.includes('✅') ? 'text-green-400' : 'text-slate-300'}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LosslessGridMode;
