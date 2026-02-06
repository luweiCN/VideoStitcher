import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileVideo, Play, Trash2, Loader2, ArrowLeft, FolderOpen, Settings, CheckCircle, Maximize2, Eye, ChevronLeft, ChevronRight } from 'lucide-react';

interface ResizeModeProps {
  onBack: () => void;
}

type ResizeMode = 'siya' | 'fishing' | 'unify_h' | 'unify_v';

// 预览图片数据结构
interface PreviewImage {
  url: string;
  width: number;
  height: number;
  label: string;
}

const MODE_CONFIG = {
  siya: { name: 'Siya模式', desc: '竖屏转横屏/方形', outputs: [{ width: 1920, height: 1080, label: '1920x1080' }, { width: 1920, height: 1920, label: '1920x1920' }] },
  fishing: { name: '海外捕鱼', desc: '横屏转竖屏/方形', outputs: [{ width: 1080, height: 1920, label: '1080x1920' }, { width: 1920, height: 1920, label: '1920x1920' }] },
  unify_h: { name: '统一横屏', desc: '强制转为横屏比例', outputs: [{ width: 1920, height: 1080, label: '1920x1080' }] },
  unify_v: { name: '统一竖屏', desc: '强制转为竖屏比例', outputs: [{ width: 1080, height: 1920, label: '1080x1920' }] },
};

const ResizeMode: React.FC<ResizeModeProps> = ({ onBack }) => {
  const [videos, setVideos] = useState<string[]>([]);
  const [outputDir, setOutputDir] = useState<string>('');
  const [mode, setMode] = useState<ResizeMode>('siya');
  const [blurAmount, setBlurAmount] = useState(20);
  const [showHelp, setShowHelp] = useState(false);

  // 预览相关状态
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [originalVideoUrl, setOriginalVideoUrl] = useState<string | null>(null);
  const [originalVideoSize, setOriginalVideoSize] = useState({ width: 1920, height: 1080 });

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, failed: 0, total: 0 });
  const [logs, setLogs] = useState<string[]>([]);

  // 添加日志
  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  // 获取视频预览 URL 和元数据
  const generatePreviews = useCallback(async () => {
    if (videos.length === 0 || currentVideoIndex >= videos.length) return;

    setIsGeneratingPreview(true);
    setPreviewError(null);

    // 清理旧的预览
    previewImages.forEach(p => URL.revokeObjectURL(p.url));
    setPreviewImages([]);

    try {
      const videoPath = videos[currentVideoIndex];
      addLog(`生成预览: ${videoPath.split('/').pop()}`);

      // 使用 Electron 的预览 URL API
      const previewResult = await window.api.getPreviewUrl(videoPath);
      if (!previewResult.success || !previewResult.url) {
        throw new Error(previewResult.error || '获取预览 URL 失败');
      }

      // 获取视频元数据
      const metadata = await window.api.getVideoMetadata(videoPath);

      // 存储原始视频 URL
      setOriginalVideoUrl(previewResult.url);
      setOriginalVideoSize({ width: metadata.width, height: metadata.height });

      // 为每个输出尺寸创建预览配置
      const outputs = MODE_CONFIG[mode].outputs;
      const previews: PreviewImage[] = [];

      for (const output of outputs) {
        previews.push({
          url: previewResult.url, // 所有预览使用同一视频源
          width: output.width,
          height: output.height,
          label: output.label,
        });
      }

      setPreviewImages(previews);
      addLog(`预览准备完成: ${previews.length} 个版本`);
    } catch (err: any) {
      setPreviewError(err.message || '生成预览失败');
      addLog(`预览生成异常: ${err.message}`);
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [videos, currentVideoIndex, mode, previewImages, addLog]);

  // 监听视频处理事件
  useEffect(() => {
    const cleanup = () => {
      window.api.removeAllListeners('video-start');
      window.api.removeAllListeners('video-progress');
      window.api.removeAllListeners('video-failed');
      window.api.removeAllListeners('video-finish');
      window.api.removeAllListeners('video-log');
    };

    window.api.onVideoStart((data) => {
      addLog(`开始处理: 总任务 ${data.total}, 并发 ${data.concurrency}`);
      setProgress({ done: 0, failed: 0, total: data.total });
    });

    window.api.onVideoProgress((data) => {
      setProgress({ done: data.done, failed: data.failed, total: data.total });
      addLog(`进度: ${data.done}/${data.total} (失败 ${data.failed})`);
    });

    window.api.onVideoFailed((data) => {
      addLog(`❌ 任务 ${data.index + 1} 失败: ${data.error}`);
    });

    window.api.onVideoFinish((data) => {
      addLog(`✅ 完成! 成功 ${data.done}, 失败 ${data.failed}`);
      setIsProcessing(false);
    });

    window.api.onVideoLog((data) => {
      addLog(`[任务 ${data.index + 1}] ${data.message}`);
    });

    return cleanup;
  }, [addLog]);

  // 当视频列表或模式改变时，重新生成预览
  useEffect(() => {
    if (videos.length > 0 && currentVideoIndex < videos.length) {
      generatePreviews();
    } else {
      // 清空预览
      setPreviewImages([]);
      setPreviewError(null);
      setOriginalVideoUrl(null);
    }
  }, [videos, currentVideoIndex, mode, generatePreviews]);

  const handleSelectVideos = async () => {
    try {
      const files = await window.api.pickFiles('选择视频', [
        { name: 'Videos', extensions: ['mp4', 'mov', 'mkv', 'm4v', 'avi'] }
      ]);
      if (files.length > 0) {
        setVideos(files);
        setCurrentVideoIndex(0);
        addLog(`已选择 ${files.length} 个视频`);
      }
    } catch (err) {
      addLog(`选择视频失败: ${err}`);
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

  const handlePrevVideo = () => {
    if (currentVideoIndex > 0) {
      setCurrentVideoIndex(currentVideoIndex - 1);
    }
  };

  const handleNextVideo = () => {
    if (currentVideoIndex < videos.length - 1) {
      setCurrentVideoIndex(currentVideoIndex + 1);
    }
  };

  const startProcessing = async () => {
    if (videos.length === 0) {
      addLog('⚠️ 请先选择视频');
      return;
    }
    if (!outputDir) {
      addLog('⚠️ 请先选择输出目录');
      return;
    }
    if (isProcessing) return;

    setIsProcessing(true);
    setLogs([]);
    addLog('开始智能改尺寸处理...');
    addLog(`视频: ${videos.length} 个`);
    addLog(`模式: ${MODE_CONFIG[mode].name}`);
    addLog(`输出: ${MODE_CONFIG[mode].outputs.map(o => o.label).join(', ')}`);
    addLog(`模糊程度: ${blurAmount}`);

    try {
      await window.api.videoResize({
        videos,
        mode,
        blurAmount,
        outputDir,
        concurrency: 3
      });
    } catch (err: any) {
      addLog(`❌ 处理失败: ${err.message || err}`);
      setIsProcessing(false);
    }
  };

  // 计算预览容器的宽高比和前景尺寸
  const getPreviewStyle = (outputWidth: number, outputHeight: number, originalWidth: number, originalHeight: number) => {
    // 计算原图在输出尺寸中的显示尺寸（保持比例）
    const originalAspect = originalWidth / originalHeight;
    const targetAspect = outputWidth / outputHeight;

    let displayWidth, displayHeight;

    if (originalAspect > targetAspect) {
      // 原图更宽：按宽度适配
      displayWidth = outputWidth;
      displayHeight = outputWidth / originalAspect;
    } else {
      // 原图更高：按高度适配
      displayHeight = outputHeight;
      displayWidth = outputHeight * originalAspect;
    }

    // 计算居中位置
    const offsetX = (outputWidth - displayWidth) / 2;
    const offsetY = (outputHeight - displayHeight) / 2;

    return {
      containerAspectRatio: outputWidth / outputHeight,
      displayWidth,
      displayHeight,
      offsetX,
      offsetY,
    };
  };

  return (
    <div className="h-screen bg-slate-950 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-slate-800 flex items-center px-4 bg-slate-900/50 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mr-4"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
        <h1 className="text-lg font-bold text-rose-400">智能改尺寸</h1>
        <div className="ml-auto flex items-center gap-2">
          {videos.length > 0 && (
            <span className="text-sm text-slate-400">
              {currentVideoIndex + 1} / {videos.length}
            </span>
          )}
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            title="帮助"
          >
            <Settings className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Help Panel */}
      {showHelp && (
        <div className="p-4 bg-slate-900/50 border-b border-slate-800 shrink-0">
          <div className="max-w-4xl mx-auto">
            <h3 className="font-bold mb-2 text-rose-400 text-sm">使用说明</h3>
            <div className="grid grid-cols-2 gap-4 text-xs text-slate-300">
              <div>
                <strong className="text-rose-300">Siya模式</strong>: 竖屏转横屏/方形
              </div>
              <div>
                <strong className="text-rose-300">海外捕鱼</strong>: 横屏转竖屏/方形
              </div>
              <div>
                <strong className="text-rose-300">统一横屏</strong>: 强制转横屏
              </div>
              <div>
                <strong className="text-rose-300">统一竖屏</strong>: 强制转竖屏
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Preview */}
        <div className="w-[400px] bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-800 shrink-0">
            <h2 className="font-medium flex items-center gap-2 text-sm text-slate-300">
              <Eye className="w-4 h-4 text-rose-400" />
              效果预览
            </h2>
            {previewImages.length > 0 && (
              <span className="text-xs text-slate-500 ml-auto">实时预览</span>
            )}
          </div>

          <div className="flex-1 p-4 overflow-y-auto">
            {videos.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>选择视频后生成预览</p>
              </div>
            ) : isGeneratingPreview ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 mx-auto mb-3 text-rose-400 animate-spin" />
                <p className="text-sm text-slate-400">生成预览中...</p>
              </div>
            ) : previewError ? (
              <div className="text-center py-12">
                <p className="text-sm text-red-400">{previewError}</p>
              </div>
            ) : previewImages.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                暂无预览
              </div>
            ) : (
              <div className="space-y-4">
                {previewImages.map((preview, index) => {
                  const style = getPreviewStyle(
                    preview.width,
                    preview.height,
                    originalVideoSize.width,
                    originalVideoSize.height
                  );

                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-slate-400">{preview.label}</span>
                        <span className="text-[10px] text-slate-500">实时预览</span>
                      </div>
                      <div
                        className="bg-black rounded-lg overflow-hidden border border-slate-800 relative group"
                        style={{
                          aspectRatio: style.containerAspectRatio,
                        }}
                      >
                        {/* 背景层（模糊视频） */}
                        <video
                          src={preview.url}
                          className="absolute inset-0 w-full h-full object-cover"
                          style={{
                            filter: `blur(${blurAmount}px)`,
                            transform: 'scale(1.1)',
                          }}
                          muted
                          loop
                          autoPlay
                          playsInline
                        />
                        {/* 遮罩层 */}
                        <div className="absolute inset-0 bg-black/30" />
                        {/* 前景层（清晰视频，可播放） */}
                        <video
                          src={preview.url}
                          className="absolute inset-0 bg-transparent"
                          style={{
                            width: `${style.displayWidth}px`,
                            height: `${style.displayHeight}px`,
                            left: `${style.offsetX}px`,
                            top: `${style.offsetY}px`,
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                          }}
                          controls
                          playsInline
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Video Navigation */}
          {videos.length > 1 && (
            <div className="p-4 border-t border-slate-800 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={handlePrevVideo}
                  disabled={currentVideoIndex === 0 || isGeneratingPreview}
                  className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 rounded-lg text-sm transition-colors flex items-center justify-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  上一个
                </button>
                <button
                  onClick={handleNextVideo}
                  disabled={currentVideoIndex === videos.length - 1 || isGeneratingPreview}
                  className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 rounded-lg text-sm transition-colors flex items-center justify-center gap-1"
                >
                  下一个
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Middle Panel - Controls */}
        <div className="w-[320px] bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Mode Selection */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <label className="font-medium flex items-center gap-2 mb-2 text-xs">
                <Maximize2 className="w-3 h-3 text-rose-400" />
                处理模式
              </label>
              <div className="space-y-2">
                {(Object.keys(MODE_CONFIG) as ResizeMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`w-full p-2 rounded-lg border text-left transition-all text-xs ${
                      mode === m
                        ? 'border-rose-500 bg-rose-500/20 text-rose-400'
                        : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                    }`}
                    disabled={isProcessing || isGeneratingPreview}
                  >
                    <div className="font-medium">{MODE_CONFIG[m].name}</div>
                    <div className="text-[10px] opacity-80 mt-0.5">{MODE_CONFIG[m].desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Video Selection */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="font-medium flex items-center gap-2 text-xs">
                  <FileVideo className="w-3 h-3 text-rose-400" />
                  选择视频
                </label>
                {videos.length > 0 && (
                  <button
                    onClick={() => setVideos([])}
                    className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                    title="清空"
                    disabled={isProcessing || isGeneratingPreview}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              <button
                onClick={handleSelectVideos}
                disabled={isProcessing || isGeneratingPreview}
                className="w-full py-2 px-3 bg-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-500/30 transition-colors text-xs flex items-center justify-center gap-2"
              >
                <FolderOpen className="w-3 h-3" />
                选择视频文件
              </button>
              {videos.length > 0 && (
                <div className="mt-2 text-xs text-slate-400">已选择 {videos.length} 个</div>
              )}
            </div>

            {/* Output Directory */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="font-medium flex items-center gap-2 text-xs">
                  <FolderOpen className="w-3 h-3 text-rose-400" />
                  输出目录
                </label>
              </div>
              <button
                onClick={handleSelectOutputDir}
                disabled={isProcessing || isGeneratingPreview}
                className="w-full py-2 px-3 bg-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-500/30 transition-colors text-xs flex items-center justify-center gap-2"
              >
                <FolderOpen className="w-3 h-3" />
                选择输出目录
              </button>
              {outputDir && (
                <div className="mt-2 text-xs text-slate-400 truncate" title={outputDir}>
                  {outputDir.split('/').pop()}
                </div>
              )}
            </div>

            {/* Blur Amount */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="font-medium flex items-center gap-2 text-xs">
                  <Settings className="w-3 h-3 text-rose-400" />
                  模糊程度
                </label>
                <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                  {blurAmount}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={blurAmount}
                onChange={(e) => setBlurAmount(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500 hover:accent-rose-400 transition-all"
                disabled={isProcessing || isGeneratingPreview}
              />
              <p className="text-[10px] text-slate-500 mt-2">
                实时预览，值越大背景越模糊 (推荐: 20)
              </p>
            </div>

            {/* Start Button */}
            <button
              onClick={startProcessing}
              disabled={isProcessing || isGeneratingPreview || videos.length === 0 || !outputDir}
              className="w-full py-3 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  开始处理
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Panel - Video List & Logs */}
        <div className="flex-1 bg-slate-950 flex flex-col overflow-hidden">
          {/* Video List */}
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="font-medium mb-3 text-sm text-slate-300 flex items-center gap-2">
              <FileVideo className="w-4 h-4" />
              视频列表 ({videos.length})
            </h3>
            {videos.length === 0 ? (
              <div className="text-center py-12 text-slate-600 text-sm">
                暂无视频
              </div>
            ) : (
              <div className="space-y-2">
                {videos.map((video, index) => (
                  <div
                    key={video}
                    className={`p-3 rounded-lg border flex items-center gap-3 transition-colors ${
                      index === currentVideoIndex
                        ? 'border-rose-500 bg-rose-500/10'
                        : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center shrink-0">
                      <Play className="w-3 h-3 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate text-slate-300">{video.split('/').pop()}</p>
                      <p className="text-[10px] text-slate-500">{video}</p>
                    </div>
                    <button
                      onClick={() => setCurrentVideoIndex(index)}
                      disabled={isGeneratingPreview || isProcessing}
                      className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded transition-colors"
                      title="预览此视频"
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Logs */}
          <div className="h-48 border-t border-slate-800 bg-slate-900">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-medium text-xs text-slate-300">处理日志</h3>
              {logs.length > 0 && (
                <button
                  onClick={() => setLogs([])}
                  className="text-[10px] text-slate-500 hover:text-slate-300"
                >
                  清空
                </button>
              )}
            </div>
            <div className="h-36 overflow-y-auto p-3 text-[10px] font-mono space-y-0.5">
              {logs.length === 0 ? (
                <div className="text-slate-600 text-center">暂无日志</div>
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

export default ResizeMode;
