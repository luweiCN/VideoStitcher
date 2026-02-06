import React, { useState, useEffect } from 'react';
import { FileVideo, ImageIcon, Play, Trash2, Loader2, ArrowLeft, FolderOpen, Settings, CheckCircle, AlertTriangle } from 'lucide-react';
import PreviewPanel from '../components/PreviewPanel';

const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1920;

interface VerticalModeProps {
  onBack: () => void;
}

const VerticalMode: React.FC<VerticalModeProps> = ({ onBack }) => {
  const [bgImage, setBgImage] = useState<string>('');
  const [videos, setVideos] = useState<string[]>([]);
  const [sideAVideos, setSideAVideos] = useState<string[]>([]);
  const [covers, setCovers] = useState<string[]>([]);
  const [outputDir, setOutputDir] = useState<string>('');
  const [showHelp, setShowHelp] = useState(false);
  const [showPreview, setShowPreview] = useState(true); // 控制预览面板显示

  const [isProcessing, setIsProcessing] = useState(false);
  const [concurrency, setConcurrency] = useState(3);
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

  const handleSelectBgImage = async () => {
    try {
      const files = await window.api.pickFiles('选择背景图片', [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }
      ]);
      if (files.length > 0) {
        setBgImage(files[0]);
        addLog(`已选择背景图: ${files[0]}`);
      }
    } catch (err) {
      addLog(`选择背景图失败: ${err}`);
    }
  };

  const handleSelectVideos = async () => {
    try {
      const files = await window.api.pickFiles('选择主视频', [
        { name: 'Videos', extensions: ['mp4', 'mov', 'mkv', 'm4v', 'avi'] }
      ]);
      if (files.length > 0) {
        setVideos(files);
        addLog(`已选择 ${files.length} 个主视频`);
      }
    } catch (err) {
      addLog(`选择视频失败: ${err}`);
    }
  };

  const handleSelectSideAVideos = async () => {
    try {
      const files = await window.api.pickFiles('选择A面视频', [
        { name: 'Videos', extensions: ['mp4', 'mov', 'mkv', 'm4v', 'avi'] }
      ]);
      if (files.length > 0) {
        setSideAVideos(files);
        addLog(`已选择 ${files.length} 个A面视频`);
      }
    } catch (err) {
      addLog(`选择A面视频失败: ${err}`);
    }
  };

  const handleSelectCovers = async () => {
    try {
      const files = await window.api.pickFiles('选择封面图片', [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }
      ]);
      if (files.length > 0) {
        setCovers(files);
        addLog(`已选择 ${files.length} 个封面`);
      }
    } catch (err) {
      addLog(`选择封面失败: ${err}`);
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
      addLog('⚠️ 请先选择主视频');
      return;
    }
    if (!outputDir) {
      addLog('⚠️ 请先选择输出目录');
      return;
    }
    if (isProcessing) return;

    setIsProcessing(true);
    setLogs([]);
    addLog('开始竖屏合成处理...');
    addLog(`主视频: ${videos.length} 个`);
    addLog(`A面视频: ${sideAVideos.length} 个`);
    addLog(`背景图: ${bgImage || '无'}`);
    addLog(`封面: ${covers.length} 个`);

    try {
      await window.api.videoVerticalMerge({
        mainVideos: videos,
        bgImage: bgImage || undefined,
        aVideos: sideAVideos.length > 0 ? sideAVideos : undefined,
        coverImage: covers.length > 0 ? covers[0] : undefined,
        outputDir,
        concurrency
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
          <h1 className="text-2xl font-bold text-indigo-400">竖屏极速合成</h1>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            title="帮助"
          >
            <Settings className="w-5 h-5 text-slate-400" />
          </button>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${showPreview ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}
          >
            {showPreview ? '隐藏预览' : '显示预览'}
          </button>
        </div>
      </div>

      {/* Help Panel */}
      {showHelp && (
        <div className="mb-6 p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <h3 className="font-bold mb-2 text-indigo-400">使用说明</h3>
          <ul className="text-sm text-slate-300 space-y-1">
            <li>• <strong>主视频</strong>: 主要内容，将被缩放到 1080x608 居中显示</li>
            <li>• <strong>A面视频</strong>: 可选，全屏显示在主视频之前</li>
            <li>• <strong>背景图</strong>: 可选，填充在主视频背后</li>
            <li>• <strong>封面</strong>: 可选，静态图片显示在开头</li>
            <li>• <strong>预览</strong>: 选择素材后自动生成合成预览，可点击切换查看</li>
            <li>• 输出尺寸: 1080x1920 @ 30fps</li>
          </ul>
        </div>
      )}

      <div className={`flex gap-6 ${showPreview ? 'flex-row' : 'flex-col'}`}>
        {/* 左侧：预览面板 */}
        {showPreview && (
          <div className="w-[350px] flex-shrink-0">
            <PreviewPanel
              mode="vertical"
              bgImage={bgImage}
              videos={videos}
              sideAVideos={sideAVideos}
              covers={covers}
              themeColor="indigo"
            />
          </div>
        )}
        {/* 右侧：输入和设置区域 */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* 输入区域 */}
          <div className="space-y-4">
          {/* Background Image */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="font-medium flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-400" />
                背景图 (可选)
              </label>
              <button
                onClick={handleSelectBgImage}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/30 transition-colors text-sm"
              >
                <FolderOpen className="w-4 h-4" />
                选择
              </button>
            </div>
            {bgImage && (
              <div className="text-sm text-slate-400 truncate">
                {bgImage.split('/').pop()}
              </div>
            )}
          </div>

          {/* Main Videos */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="font-medium flex items-center gap-2">
                <FileVideo className="w-4 h-4 text-indigo-400" />
                主视频 - 必填
              </label>
              <button
                onClick={handleSelectVideos}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/30 transition-colors text-sm"
              >
                <FolderOpen className="w-4 h-4" />
                选择视频
              </button>
            </div>
            {videos.length > 0 && (
              <div className="text-sm text-slate-400">
                已选择 {videos.length} 个视频
              </div>
            )}
          </div>

          {/* Side A Videos */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="font-medium flex items-center gap-2">
                <Play className="w-4 h-4 text-indigo-400" />
                A面视频 (可选)
              </label>
              <div className="flex items-center gap-2">
                {sideAVideos.length > 0 && (
                  <button
                    onClick={() => setSideAVideos([])}
                    className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                    title="清空"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={handleSelectSideAVideos}
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/30 transition-colors text-sm"
                >
                  <FolderOpen className="w-4 h-4" />
                  选择
                </button>
              </div>
            </div>
            {sideAVideos.length > 0 && (
              <div className="text-sm text-slate-400">
                已选择 {sideAVideos.length} 个A面视频
              </div>
            )}
          </div>

          {/* Covers */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="font-medium flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-400" />
                封面图片 (可选)
              </label>
              <div className="flex items-center gap-2">
                {covers.length > 0 && (
                  <button
                    onClick={() => setCovers([])}
                    className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                    title="清空"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={handleSelectCovers}
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/30 transition-colors text-sm"
                >
                  <FolderOpen className="w-4 h-4" />
                  选择
                </button>
              </div>
            </div>
            {covers.length > 0 && (
              <div className="text-sm text-slate-400">
                已选择 {covers.length} 个封面
              </div>
            )}
          </div>

          {/* Output Directory */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="font-medium flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-indigo-400" />
                输出目录 - 必填
              </label>
              <button
                onClick={handleSelectOutputDir}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/30 transition-colors text-sm"
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
        </div>

          {/* 设置和进度区域 */}
          <div className="space-y-4">
          {/* Settings */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Settings className="w-4 h-4 text-indigo-400" />
              设置
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm text-slate-400">并发数</label>
                  <span className="text-xs text-slate-600">推荐: CPU 核心数 - 1</span>
                </div>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={concurrency}
                  onChange={(e) => setConcurrency(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  disabled={isProcessing}
                />
                <p className="text-xs text-slate-500 mt-1">同时启动的 FFmpeg 进程数量</p>
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="font-medium mb-3">处理进度</h3>
            {progress.total > 0 ? (
              <div className="space-y-2">
                <div className="text-center">
                  <span className="text-3xl font-bold text-indigo-400">{progress.done}</span>
                  <span className="text-slate-400"> / {progress.total}</span>
                </div>
                {progress.failed > 0 && (
                  <div className="text-center text-red-400 text-sm">
                    失败: {progress.failed}
                  </div>
                )}
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all"
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
            className="w-full py-4 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                处理中...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                开始合成
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
    </div>
  );
};

export default VerticalMode;
