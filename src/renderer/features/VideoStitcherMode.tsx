import React, { useState, useEffect } from 'react';
import { Film, FolderOpen, Play, Settings, Loader2, ArrowLeft } from 'lucide-react';

interface VideoStitcherModeProps {
  onBack: () => void;
}

type Orientation = 'landscape' | 'portrait';

const VideoStitcherMode: React.FC<VideoStitcherModeProps> = ({ onBack }) => {
  const [aFiles, setAFiles] = useState<string[]>([]);
  const [bFiles, setBFiles] = useState<string[]>([]);
  const [outDir, setOutDir] = useState<string>('');
  const [concurrency, setConcurrency] = useState(3);
  const [actualConcurrency, setActualConcurrency] = useState(3);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, failed: 0, total: 0 });
  const [status, setStatus] = useState('等待开始');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, msg]);
  };

  useEffect(() => {
    const cleanup = () => {
      window.api.removeAllListeners('job-start');
      window.api.removeAllListeners('job-log');
      window.api.removeAllListeners('job-progress');
      window.api.removeAllListeners('job-failed');
      window.api.removeAllListeners('job-finish');
    };

    window.api.onJobStart((data) => {
      setStatus(`开始合成：总任务 ${data.total} | 并发 ${data.concurrency} | 模式 ${data.orientation}`);
      addLog(`\n===== JOB START total=${data.total} concurrency=${data.concurrency} mode=${data.orientation} =====\n`);
      setProgress({ done: 0, failed: 0, total: data.total });
    });

    window.api.onJobLog((data) => {
      addLog(data.msg);
    });

    window.api.onJobProgress((data) => {
      setStatus(`进度：${data.done}/${data.total}（失败 ${data.failed}）`);
      setProgress({ done: data.done, failed: data.failed, total: data.total });
    });

    window.api.onJobFailed((data) => {
      setStatus(`进度：${data.done}/${data.total}（失败 ${data.failed}）`);
      addLog(`\n[FAILED] index=${data.index}\n${data.error}\n`);
    });

    window.api.onJobFinish((data) => {
      setStatus(`完成：成功 ${data.done} / 总 ${data.total}（失败 ${data.failed}）`);
      addLog(`\n===== JOB FINISH done=${data.done} failed=${data.failed} total=${data.total} =====\n`);
      setIsProcessing(false);
    });

    return cleanup;
  }, []);

  const handleSelectA = async () => {
    try {
      const files = await window.api.pickFiles('选择 A面库视频', [
        { name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv'] }
      ]);
      if (files.length > 0) {
        setAFiles(files);
        addLog(`已选择 A 面：${files.length} 个视频`);
      }
    } catch (err) {
      addLog(`选择 A 面失败: ${err}`);
    }
  };

  const handleSelectB = async () => {
    try {
      const files = await window.api.pickFiles('选择 素材库B视频', [
        { name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv'] }
      ]);
      if (files.length > 0) {
        setBFiles(files);
        addLog(`已选择 B 面：${files.length} 个视频`);
      }
    } catch (err) {
      addLog(`选择 B 面失败: ${err}`);
    }
  };

  const handleSelectOutDir = async () => {
    try {
      const dir = await window.api.pickOutDir();
      if (dir) {
        setOutDir(dir);
        addLog(`输出目录：${dir}`);
      }
    } catch (err) {
      addLog(`选择输出目录失败: ${err}`);
    }
  };

  const handleApplyConcurrency = async () => {
    try {
      const result = await window.api.setConcurrency(concurrency);
      setActualConcurrency(result.concurrency);
      addLog(`并发数设置为：${result.concurrency}`);
    } catch (err) {
      addLog(`设置并发数失败: ${err}`);
    }
  };

  const startMerge = async (orientation: Orientation) => {
    if (aFiles.length === 0 || bFiles.length === 0) {
      addLog('⚠️ 请先选择 A 面和 B 面视频');
      return;
    }
    if (!outDir) {
      addLog('⚠️ 请先选择输出目录');
      return;
    }
    if (isProcessing) return;

    setIsProcessing(true);
    setLogs([]);
    addLog(`开始${orientation === 'landscape' ? '横版' : '竖版'}合成...`);

    try {
      // 先设置文件和输出目录
      await window.api.setLibs(aFiles, bFiles, outDir);
      // 开始合成
      await window.api.startMerge(orientation);
    } catch (err: any) {
      addLog(`❌ 合成失败: ${err.message || err}`);
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          返回
        </button>
        <h1 className="text-2xl font-bold text-violet-400">A+B 前后拼接</h1>
        <div className="w-20"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
        {/* Left Panel - Settings */}
        <div className="lg:col-span-2 space-y-4">
          {/* A 面库 */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="font-medium flex items-center gap-2">
                <Film className="w-4 h-4 text-violet-400" />
                A 面库视频
              </label>
              <div className="flex items-center gap-2">
                {aFiles.length > 0 && (
                  <span className="text-sm text-slate-400">{aFiles.length} 个视频</span>
                )}
                <button
                  onClick={handleSelectA}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-500/20 text-violet-400 rounded-xl hover:bg-violet-500/30 transition-colors text-sm font-medium"
                >
                  <FolderOpen className="w-4 h-4" />
                  选择 A 面
                </button>
              </div>
            </div>
          </div>

          {/* B 面库 */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="font-medium flex items-center gap-2">
                <Film className="w-4 h-4 text-indigo-400" />
                素材库 B 视频
              </label>
              <div className="flex items-center gap-2">
                {bFiles.length > 0 && (
                  <span className="text-sm text-slate-400">{bFiles.length} 个视频</span>
                )}
                <button
                  onClick={handleSelectB}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-500/20 text-indigo-400 rounded-xl hover:bg-indigo-500/30 transition-colors text-sm font-medium"
                >
                  <FolderOpen className="w-4 h-4" />
                  选择 B 面
                </button>
              </div>
            </div>
          </div>

          {/* 输出目录 */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="font-medium flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-emerald-400" />
                输出目录
              </label>
              <button
                onClick={handleSelectOutDir}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/30 transition-colors text-sm font-medium"
              >
                选择目录
              </button>
            </div>
            {outDir && (
              <div className="text-sm text-slate-400 truncate">{outDir}</div>
            )}
          </div>

          {/* 并发设置 */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="font-medium flex items-center gap-2">
                <Settings className="w-4 h-4 text-amber-400" />
                并发数
              </label>
            </div>
            <p className="text-sm text-slate-500 mb-3">
              同时启动的 FFmpeg 进程数量。数值越大处理越快，但会占用更多 CPU 资源。
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={concurrency}
                  onChange={(e) => setConcurrency(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-center"
                  disabled={isProcessing}
                />
                <button
                  onClick={handleApplyConcurrency}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-xl hover:bg-amber-500/30 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  应用
                </button>
                {actualConcurrency > 0 && (
                  <span className="text-sm text-slate-400">当前：{actualConcurrency}</span>
                )}
              </div>
              <span className="text-xs text-slate-600">推荐：CPU 核心数 - 1</span>
            </div>
          </div>

          {/* 合成按钮 */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => startMerge('landscape')}
              disabled={isProcessing}
              className="py-4 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  合成中...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  合成横版
                </>
              )}
            </button>
            <button
              onClick={() => startMerge('portrait')}
              disabled={isProcessing}
              className="py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  合成中...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  合成竖版
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Panel - Status & Logs */}
        <div className="space-y-4">
          {/* 状态 */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="font-medium mb-3">状态</h3>
            {progress.total > 0 ? (
              <div className="space-y-3">
                <div className="text-center">
                  <span className="text-3xl font-bold text-violet-400">{progress.done}</span>
                  <span className="text-slate-400"> / {progress.total}</span>
                </div>
                {progress.failed > 0 && (
                  <div className="text-center text-red-400 text-sm">
                    失败: {progress.failed}
                  </div>
                )}
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-violet-500 h-2 rounded-full transition-all"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-slate-500">{status}</div>
            )}
          </div>

          {/* 日志 */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="font-medium mb-3">处理日志</h3>
            <div className="h-80 overflow-y-auto text-xs font-mono bg-slate-950 rounded-xl p-3 text-green-400">
              {logs.length === 0 ? (
                <div className="text-slate-600 text-center py-4">暂无日志</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="whitespace-pre-wrap break-words">{log}</div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoStitcherMode;
