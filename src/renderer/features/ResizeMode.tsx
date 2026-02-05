import React, { useState, useEffect } from 'react';
import { FileVideo, Play, Trash2, Loader2, ArrowLeft, FolderOpen, Settings, CheckCircle, Maximize2 } from 'lucide-react';

interface ResizeModeProps {
  onBack: () => void;
}

type ResizeMode = 'siya' | 'fishing' | 'unify_h' | 'unify_v';

const MODE_CONFIG = {
  siya: { name: 'Siya模式', desc: '智能模糊背景填充，保持画面比例', targetSize: '1920x1080' },
  fishing: { name: '海外捕鱼', desc: '特定游戏画面优化', targetSize: '1920x1080' },
  unify_h: { name: '统一横屏', desc: '强制转为横屏比例', targetSize: '1920x1080' },
  unify_v: { name: '统一竖屏', desc: '强制转为竖屏比例', targetSize: '1080x1920' },
};

const ResizeMode: React.FC<ResizeModeProps> = ({ onBack }) => {
  const [videos, setVideos] = useState<string[]>([]);
  const [outputDir, setOutputDir] = useState<string>('');
  const [mode, setMode] = useState<ResizeMode>('siya');
  const [blurAmount, setBlurAmount] = useState(20);
  const [showHelp, setShowHelp] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, failed: 0, total: 0 });
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

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
  }, []);

  const handleSelectVideos = async () => {
    try {
      const files = await window.api.pickFiles('选择视频', [
        { name: 'Videos', extensions: ['mp4', 'mov', 'mkv', 'm4v', 'avi'] }
      ]);
      if (files.length > 0) {
        setVideos(files);
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
          <h1 className="text-2xl font-bold text-rose-400">智能改尺寸</h1>
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
          <h3 className="font-bold mb-2 text-rose-400">使用说明</h3>
          <ul className="text-sm text-slate-300 space-y-1">
            <li>• 智能模糊背景填充，保持画面比例不拉伸</li>
            <li>• <strong>Siya模式</strong>: 通用场景，自动适配目标尺寸</li>
            <li>• <strong>海外捕鱼</strong>: 针对捕鱼游戏画面优化</li>
            <li>• <strong>统一横屏/竖屏</strong>: 强制转换到指定比例</li>
            <li>• 模糊背景可调节强度 (1-50)</li>
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Inputs */}
        <div className="lg:col-span-2 space-y-4">
          {/* Mode Selection */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <label className="font-medium flex items-center gap-2 mb-3">
              <Maximize2 className="w-4 h-4 text-rose-400" />
              处理模式
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(MODE_CONFIG) as ResizeMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    mode === m
                      ? 'border-rose-500 bg-rose-500/20 text-rose-400'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
                  disabled={isProcessing}
                >
                  <div className="font-medium">{MODE_CONFIG[m].name}</div>
                  <div className="text-xs opacity-80 mt-1">{MODE_CONFIG[m].desc}</div>
                  <div className="text-xs font-mono opacity-60 mt-1">{MODE_CONFIG[m].targetSize}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Video Selection */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="font-medium flex items-center gap-2">
                <FileVideo className="w-4 h-4 text-rose-400" />
                选择视频 - 必填
              </label>
              <div className="flex items-center gap-2">
                {videos.length > 0 && (
                  <button
                    onClick={() => setVideos([])}
                    className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                    title="清空"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={handleSelectVideos}
                  className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-500/30 transition-colors text-sm"
                >
                  <FolderOpen className="w-4 h-4" />
                  选择视频
                </button>
              </div>
            </div>
            {videos.length > 0 && (
              <div className="text-sm text-slate-400">
                已选择 {videos.length} 个视频
              </div>
            )}
          </div>

          {/* Output Directory */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="font-medium flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-rose-400" />
                输出目录 - 必填
              </label>
              <button
                onClick={handleSelectOutputDir}
                className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-500/30 transition-colors text-sm"
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

          {/* Blur Amount */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <label className="font-medium flex items-center gap-2 mb-3">
              <Settings className="w-4 h-4 text-rose-400" />
              模糊程度
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="50"
                value={blurAmount}
                onChange={(e) => setBlurAmount(Number(e.target.value))}
                className="flex-1"
                disabled={isProcessing}
              />
              <span className="text-sm font-mono bg-slate-800 px-3 py-1 rounded-lg w-12 text-center">
                {blurAmount}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              值越大背景越模糊 (推荐: 20)
            </p>
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
                  <span className="text-3xl font-bold text-rose-400">{progress.done}</span>
                  <span className="text-slate-400"> / {progress.total}</span>
                </div>
                {progress.failed > 0 && (
                  <div className="text-center text-red-400 text-sm">
                    失败: {progress.failed}
                  </div>
                )}
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-rose-500 h-2 rounded-full transition-all"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="text-slate-500 text-center py-4">等待开始</div>
            )}
          </div>

          {/* Start Button */}
          <button
            onClick={startProcessing}
            disabled={isProcessing || videos.length === 0 || !outputDir}
            className="w-full py-4 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2"
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

export default ResizeMode;
