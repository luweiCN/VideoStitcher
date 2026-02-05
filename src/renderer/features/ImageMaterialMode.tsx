import React, { useState, useEffect } from 'react';
import { ImageIcon, Stamp, Play, Trash2, Loader2, ArrowLeft, FolderOpen, Settings, CheckCircle, Layers } from 'lucide-react';

interface ImageMaterialModeProps {
  onBack: () => void;
}

type PreviewSize = 'inside' | 'cover' | 'fill';

const PREVIEW_SIZE_OPTIONS = {
  inside: { name: '保持比例', desc: '按比例缩放到800x800以内，不变形，空白区域填充白色' },
  cover: { name: '裁剪正方形', desc: '裁剪为800x800正方形' },
  fill: { name: '拉伸填充', desc: '强制拉伸到800x800，可能变形' },
};

const ImageMaterialMode: React.FC<ImageMaterialModeProps> = ({ onBack }) => {
  const [images, setImages] = useState<string[]>([]);
  const [logoPath, setLogoPath] = useState<string>('');
  const [outputDir, setOutputDir] = useState<string>('');
  const [previewSize, setPreviewSize] = useState<PreviewSize>('cover');
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
      const files = await window.api.pickFiles('选择素材图片', [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }
      ]);
      if (files.length > 0) {
        setImages(files);
        addLog(`已选择 ${files.length} 张素材图片`);
      }
    } catch (err) {
      addLog(`选择图片失败: ${err}`);
    }
  };

  const handleSelectLogo = async () => {
    try {
      const files = await window.api.pickFiles('选择 Logo 图片 (透明 PNG)', [
        { name: 'Images', extensions: ['png', 'webp'] }
      ]);
      if (files.length > 0) {
        setLogoPath(files[0]);
        addLog(`已选择 Logo: ${files[0].split('/').pop()}`);
      }
    } catch (err) {
      addLog(`选择 Logo 失败: ${err}`);
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
      addLog('⚠️ 请先选择素材图片');
      return;
    }
    if (!outputDir) {
      addLog('⚠️ 请先选择输出目录');
      return;
    }
    if (isProcessing) return;

    setIsProcessing(true);
    setLogs([]);
    addLog('开始图片素材处理...');
    addLog(`素材: ${images.length} 张`);
    addLog(`Logo: ${logoPath ? '已设置' : '无'}`);
    addLog(`预览图模式: ${PREVIEW_SIZE_OPTIONS[previewSize].name}`);

    try {
      await window.api.imageMaterial({
        images,
        logoPath: logoPath || undefined,
        outputDir,
        previewSize
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
          <h1 className="text-2xl font-bold text-amber-400">图片素材处理工具</h1>
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
          <h3 className="font-bold mb-2 text-amber-400">使用说明</h3>
          <ul className="text-sm text-slate-300 space-y-1">
            <li>• 全能素材处理工具</li>
            <li>• 先将原图裁剪为正方形 (取中心区域)</li>
            <li>• 缩放到 800x800 并添加 Logo (如果有)</li>
            <li>• <strong>对带 Logo 的图片进行九宫格切片</strong></li>
            <li>• 每张切片右下角都会有 Logo 的一部分</li>
            <li>• Logo 尺寸约 120px (800x800 的 15%)</li>
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Inputs */}
        <div className="lg:col-span-2 space-y-4">
          {/* Material Images */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="font-medium flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                素材图片 - 必填
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
                  className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors text-sm"
                >
                  <FolderOpen className="w-4 h-4" />
                  选择素材
                </button>
              </div>
            </div>
            {images.length > 0 && (
              <div className="text-sm text-slate-400">
                已选择 {images.length} 张素材图片
              </div>
            )}
          </div>

          {/* Logo Image */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="font-medium flex items-center gap-2">
                <Stamp className="w-4 h-4 text-amber-400" />
                Logo 图片 (可选)
              </label>
              <div className="flex items-center gap-2">
                {logoPath && (
                  <button
                    onClick={() => setLogoPath('')}
                    className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                    title="清空"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={handleSelectLogo}
                  className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors text-sm"
                >
                  <FolderOpen className="w-4 h-4" />
                  选择 Logo
                </button>
              </div>
            </div>
            {logoPath && (
              <div className="text-sm text-slate-400 truncate">
                {logoPath.split('/').pop()}
              </div>
            )}
          </div>

          {/* Output Directory */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="font-medium flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-amber-400" />
                输出目录 - 必填
              </label>
              <button
                onClick={handleSelectOutputDir}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors text-sm"
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

          {/* Preview Size Option */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <label className="font-medium flex items-center gap-2 mb-3">
              <Settings className="w-4 h-4 text-amber-400" />
              预览图尺寸模式
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PREVIEW_SIZE_OPTIONS) as PreviewSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => setPreviewSize(size)}
                  disabled={isProcessing}
                  className={`p-2 rounded-lg border text-left transition-all text-sm ${
                    previewSize === size
                      ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <div className="font-medium">{PREVIEW_SIZE_OPTIONS[size].name}</div>
                  <div className="text-xs opacity-70 mt-0.5">{PREVIEW_SIZE_OPTIONS[size].desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Output Structure Info */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Layers className="w-5 h-5 text-amber-400 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium mb-2">输出目录结构</h4>
                <div className="text-sm text-slate-400 space-y-1 font-mono">
                  <div>📁 output-dir/</div>
                  <div className="ml-4">📁 preview/ - 800x800 预览图</div>
                  <div className="ml-4">📁 logo/ - 带 Logo 的 800x800 图片</div>
                  <div className="ml-4">📁 grid/ - 基于 logo 图切片的九宫格 (9张)</div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  注: 九宫格切片基于带 Logo 的图片，每张右下角都有 Logo 的一部分
                </p>
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
                  <span className="text-3xl font-bold text-amber-400">{progress.done}</span>
                  <span className="text-slate-400"> / {progress.total}</span>
                </div>
                {progress.failed > 0 && (
                  <div className="text-center text-red-400 text-sm">
                    失败: {progress.failed}
                  </div>
                )}
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-amber-500 h-2 rounded-full transition-all"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500 text-center">
                  每张生成 11 个文件 (9切片+1预览+1Logo)
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
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2"
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

export default ImageMaterialMode;
