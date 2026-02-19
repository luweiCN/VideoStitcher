import React, { useState, useCallback, useMemo } from 'react';
import * as Slider from '@radix-ui/react-slider';
import {
  Settings, Loader2, Eye, Maximize2
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import OutputDirSelector from '@/components/OutputDirSelector';
import ConcurrencySelector from '@/components/ConcurrencySelector';
import OperationLogPanel from '@/components/OperationLogPanel';
import { FileSelector, FileSelectorGroup } from '@/components/FileSelector';
import { Button } from '@/components/Button/Button';
import TaskList, { type Task, type OutputConfig } from '@/components/TaskList';
import { useOutputDirCache } from '@/hooks/useOutputDirCache';
import { useConcurrencyCache } from '@/hooks/useConcurrencyCache';
import { useOperationLogs } from '@/hooks/useOperationLogs';
import { useVideoProcessingEvents } from '@/hooks/useVideoProcessingEvents';
import { useVideoVolumeCache } from '@/hooks/useVideoVolumeCache';
import useVideoMaterials from '@/hooks/useVideoMaterials';
import { PreviewArea } from './ResizeMode/components/PreviewArea';

type ResizeMode = 'siya' | 'fishing' | 'unify_h' | 'unify_v';

const MODE_CONFIG = {
  siya: { name: 'Siya模式', desc: '竖屏转横屏/方形', outputs: [{ width: 1920, height: 1080, label: '1920x1080' }, { width: 1920, height: 1920, label: '1920x1920' }] },
  fishing: { name: '海外捕鱼', desc: '横屏转竖屏/方形', outputs: [{ width: 1080, height: 1920, label: '1080x1920' }, { width: 1920, height: 1920, label: '1920x1920' }] },
  unify_h: { name: '统一横屏', desc: '强制转为横屏比例', outputs: [{ width: 1920, height: 1080, label: '1920x1080' }] },
  unify_v: { name: '统一竖屏', desc: '强制转为竖屏比例', outputs: [{ width: 1080, height: 1920, label: '1080x1920' }] },
};

const ResizeMode: React.FC = () => {
  // 任务列表状态（使用 TaskList 组件的格式）
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 使用 hook 加载视频素材（带缓存）
  const { outputDir, setOutputDir } = useOutputDirCache('ResizeMode');
  const { concurrency, setConcurrency } = useConcurrencyCache('ResizeMode');
  const [mode, setMode] = useState<ResizeMode>('siya');
  const [blurAmount, setBlurAmount] = useState(20);

  // 处理状态
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, failed: 0, total: 0 });

  // 使用音量缓存 Hook
  const { volume, isMuted, setVolume, setIsMuted } = useVideoVolumeCache('resize');

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
    moduleNameCN: '智能改尺寸',
    moduleNameEN: 'Resize',
  });

  // 输出配置
  const outputConfig = useMemo((): OutputConfig => ({
    fps: '30fps',
    resolution: MODE_CONFIG[mode].outputs.map(o => o.label).join(' / '),
    codec: 'H.264',
    format: 'mp4',
    nums: MODE_CONFIG[mode].outputs.length,
  }), [mode]);

  // 使用视频处理事件 Hook
  useVideoProcessingEvents({
    onStart: (data) => {
      addLog(`开始处理: 总任务 ${data.total}, 并发 ${data.concurrency}`, 'info');
      setProgress({ done: 0, failed: 0, total: data.total });
      // 所有任务设为等待状态
      setTasks(prev => prev.map(t => ({ ...t, status: 'waiting' as const })));
    },
    onTaskStart: (data) => {
      // 直接使用后端传来的 videoIndex
      if (data.videoIndex !== undefined) {
        setTasks(prev => prev.map((t, idx) =>
          idx === data.videoIndex ? { ...t, status: 'processing' as const } : t
        ));
      }
    },
    onProgress: (data) => {
      setProgress({ done: data.done, failed: data.failed, total: data.total });

      // 后端确保该视频的所有输出都完成时才发送 progress 事件
      // 使用 index 直接匹配视频数组
      setTasks(prev => prev.map((t, idx) =>
        idx === data.index ? { ...t, status: 'completed' as const } : t
      ));
      addLog(`进度: ${data.done}/${data.total} (失败 ${data.failed})`, 'info');
    },
    onFailed: (data) => {
      // 任务失败时，标记对应视频为错误
      setTasks(prev => prev.map((t, idx) =>
        idx === data.index ? { ...t, status: 'error' as const, error: data.error } : t
      ));
      addLog(`❌ 任务失败: ${data.error}`, 'error');
    },
    onFinish: (data) => {
      const timeInfo = data.elapsed ? ` (耗时 ${data.elapsed}秒)` : '';
      addLog(`✅ 完成! 成功 ${data.done}, 失败 ${data.failed}${timeInfo}`, 'success');
      setIsProcessing(false);
    },
    onLog: (data) => {
      addLog(`[${data.videoId || data.index + 1}] ${data.message}`, 'info');
    },
  });

  /**
   * 生成任务列表
   */
  const generateTasks = useCallback((filePaths: string[]) => {
    if (filePaths.length === 0) {
      setTasks([]);
      setCurrentIndex(0);
      return;
    }

    const newTasks: Task[] = filePaths.map((path, index) => ({
      id: `resize-${Date.now()}-${index}`,
      status: 'pending' as const,
      files: [{
        path,
        index: index + 1,
        category: 'V',
        category_name: '视频',
      }],
      config: {
        mode,
        blurAmount,
      },
      outputDir,
      concurrency,
    }));

    setTasks(newTasks);
    setCurrentIndex(0);
  }, [mode, blurAmount, outputDir, concurrency]);

  /**
   * 处理视频选择
   */
  const handleVideosChange = useCallback((filePaths: string[]) => {
    generateTasks(filePaths);
  }, [generateTasks]);

  /**
   * 开始处理
   */
  const startProcessing = async () => {
    if (tasks.length === 0) {
      addLog('⚠️ 请先选择视频', 'warning');
      return;
    }
    if (!outputDir) {
      addLog('⚠️ 请先选择输出目录', 'warning');
      return;
    }
    if (isProcessing) return;

    setIsProcessing(true);
    // 不再自动清空日志，保留历史记录
    setProgress({ done: 0, failed: 0, total: tasks.length });

    // 所有任务设为等待状态
    setTasks(prev => prev.map(t => ({ ...t, status: 'waiting' as const })));

    addLog('开始智能改尺寸处理...', 'info');
    addLog(`视频: ${tasks.length} 个`, 'info');
    addLog(`模式: ${MODE_CONFIG[mode].name}`, 'info');
    addLog(`输出: ${MODE_CONFIG[mode].outputs.map(o => o.label).join(', ')}`, 'info');
    addLog(`模糊程度: ${blurAmount}`, 'info');

    try {
      await window.api.videoResize({
        videos: tasks.map(t => ({ id: t.id, path: t.files[0].path })),
        mode,
        blurAmount,
        outputDir,
        concurrency
      });
    } catch (err: any) {
      addLog(`❌ 处理失败: ${err.message || err}`, 'error');
      setIsProcessing(false);
    }
  };

  /**
   * 计算预览容器的宽高比和前景尺寸
   */
  const getPreviewStyle = (outputWidth: number, outputHeight: number, originalWidth: number, originalHeight: number) => {
    const originalAspect = originalWidth / originalHeight;
    const targetAspect = outputWidth / outputHeight;

    let displayWidth, displayHeight;

    if (originalAspect > targetAspect) {
      displayWidth = outputWidth;
      displayHeight = outputWidth / originalAspect;
    } else {
      displayHeight = outputHeight;
      displayWidth = outputHeight * originalAspect;
    }

    const offsetX = (outputWidth - displayWidth) / 2;
    const offsetY = (outputHeight - displayHeight) / 2;

    const widthPercent = (displayWidth / outputWidth) * 100;
    const heightPercent = (displayHeight / outputHeight) * 100;
    const leftPercent = (offsetX / outputWidth) * 100;
    const topPercent = (offsetY / outputHeight) * 100;

    return {
      containerAspectRatio: outputWidth / outputHeight,
      widthPercent,
      heightPercent,
      leftPercent,
      topPercent,
    };
  };

  // 当前选中的任务
  const currentTask = tasks[currentIndex];

  // 使用 useVideoMaterials 加载当前任务的素材信息
  const currentFilePath = currentTask?.files[0]?.path;
  const { materials: currentMaterials } = useVideoMaterials(
    currentFilePath ? [currentFilePath] : [],
    !!currentFilePath
  );
  const currentMaterial = currentMaterials[0];

  // 视频信息
  const videoInfo = currentMaterial?.isLoaded ? {
    previewUrl: currentMaterial.previewUrl,
    width: currentMaterial.width,
    height: currentMaterial.height,
    duration: currentMaterial.duration,
  } : null;

  return (
    <div className="h-screen bg-black text-slate-100 flex flex-col overflow-hidden">
      <PageHeader
        title="智能改尺寸"
        icon={Maximize2}
        iconColor="text-rose-400"
        description="Siya/海外捕鱼/尺寸统一，智能模糊背景填充"
        featureInfo={{
          title: '智能改尺寸',
          description: '支持四种视频尺寸转换模式，使用模糊背景填充适配目标尺寸。',
          details: [
            'Siya模式：竖屏视频转为横屏（1920×1080）或方形（1920×1920）',
            '海外捕鱼模式：横屏视频转为竖屏（1080×1920）或方形（1920×1920）',
            '统一横屏：强制所有视频转为横屏比例（1920×1080）',
            '统一竖屏：强制所有视频转为竖屏比例（1080×1920）',
            '可调整模糊程度，实时预览转换效果',
          ],
          themeColor: 'rose',
        }}
      />

      {/* Main Content - 三栏布局 */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - File Selection */}
        <div className="w-80 border-r border-slate-800 bg-black flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          <div className="p-4 space-y-4">
            {/* Mode Selection */}
            <div className="bg-black/50 border border-slate-800 rounded-xl p-3">
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
                        : 'border-slate-700 bg-black/50 text-slate-400 hover:border-slate-600'
                    }`}
                    disabled={isProcessing}
                  >
                    <div className="font-medium">{MODE_CONFIG[m].name}</div>
                    <div className="text-[10px] opacity-80 mt-0.5">{MODE_CONFIG[m].desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Video Selection */}
            <FileSelectorGroup>
              <FileSelector
                id="resizeVideos"
                name="视频文件"
                accept="video"
                multiple
                showList={true}
                themeColor="rose"
                directoryCache
                onChange={handleVideosChange}
                disabled={isProcessing}
              />
            </FileSelectorGroup>


            {/* Blur Amount */}
            <div className="bg-black/50 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Settings className="w-3 h-3" />
                  模糊程度
                </label>
                <span className="px-3 py-1.5 rounded-lg font-mono font-bold text-lg bg-gradient-to-r from-rose-500 to-red-500 bg-clip-text text-transparent">
                  {blurAmount}
                </span>
              </div>
              {/* Radix UI Slider */}
              <Slider.Root
                className="relative flex items-center select-none touch-none h-5"
                value={[blurAmount]}
                onValueChange={(values) => setBlurAmount(values[0])}
                max={50}
                min={0}
                step={1}
                disabled={isProcessing}
              >
                <Slider.Track className="bg-neutral-900 relative grow rounded-full h-2 shadow-inner">
                  <Slider.Range className="absolute h-full rounded-full bg-gradient-to-r from-rose-500 to-red-500 relative">
                    {/* 光晕效果 */}
                    <div className="absolute inset-0 bg-gradient-to-r from-rose-500 to-red-500 blur-sm opacity-50" />
                  </Slider.Range>
                </Slider.Track>
                <Slider.Thumb
                  className="block w-3 h-3 rounded-full bg-rose-500 shadow-lg shadow-rose-500/30 hover:scale-125 focus:outline-none focus:scale-125 active:scale-110 transition-transform duration-150 cursor-grab active:cursor-grabbing"
                  aria-label="模糊程度"
                />
              </Slider.Root>
              <div className="relative text-[9px] font-mono">
                <span className="absolute left-0 text-slate-600">0</span>
                <span className="absolute left-[40%] -translate-x-1/2 text-rose-400 font-bold">20 推荐</span>
                <span className="absolute right-0 text-rose-400 font-medium">50</span>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Panel - flex-1 with vertical layout */}
        <div className="flex-1 bg-black flex flex-col overflow-hidden min-w-0">
          {/* 使用通用 TaskList 组件 */}
          <TaskList
            tasks={tasks}
            currentIndex={currentIndex}
            output={outputConfig}
            type="video_resize"
            thumbnail_source="V"
            materialsType={['video']}
            themeColor="rose"
            onTaskChange={setCurrentIndex}
            isProcessing={isProcessing}
            onLog={(message, type) => addLog(message, type)}
          />

          {/* Bottom: Preview Area - 使用 TaskList 加载的素材 */}
          <div className="flex-1 overflow-hidden p-4 min-h-0">
            {tasks.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-slate-500">
                  <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">选择视频后显示预览</p>
                </div>
              </div>
            ) : !currentTask || !videoInfo ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 mx-auto mb-3 text-rose-400 animate-spin" />
                  <p className="text-sm text-slate-400">加载视频中...</p>
                </div>
              </div>
            ) : (
              <PreviewArea
                mode={mode}
                currentVideo={{
                  id: currentTask.id,
                  path: currentTask.files[0].path,
                  name: currentTask.files[0].path.split('/').pop() || '',
                  status: currentTask.status,
                  previewUrl: videoInfo?.previewUrl,
                  width: videoInfo?.width,
                  height: videoInfo?.height,
                }}
                blurAmount={blurAmount}
                volume={volume}
                isMuted={isMuted}
                onVolumeChange={setVolume}
                onMuteChange={setIsMuted}
                isProcessing={isProcessing}
                getPreviewStyle={getPreviewStyle}
              />
            )}
          </div>
        </div>

        {/* Right Sidebar - Settings + Logs + Button */}
        <div className="w-80 border-l border-slate-800 bg-black flex flex-col shrink-0 overflow-y-hidden">
          <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            {/* Settings */}
            <div className="bg-black/50 border border-slate-800 rounded-xl p-4 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Settings className="w-3.5 h-3.5" />
                设置
              </h3>
              <OutputDirSelector
                value={outputDir}
                onChange={setOutputDir}
                disabled={isProcessing}
                themeColor="rose"
              />
              <ConcurrencySelector
                value={concurrency}
                onChange={setConcurrency}
                disabled={isProcessing}
                themeColor="rose"
              />
            </div>

            {/* Progress Display */}
            {progress.total > 0 && (
              <div className="bg-black/50 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">处理进度</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">已完成</span>
                  <span className="text-rose-400 font-bold">{progress.done}/{progress.total}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-rose-500 h-2 rounded-full transition-all"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                  />
                </div>
                {progress.failed > 0 && (
                  <div className="text-xs text-rose-400">失败: {progress.failed}</div>
                )}
              </div>
            )}

            {/* Logs */}
            <div className="flex-1 min-h-[300px]">
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
                themeColor="rose"
              />
            </div>

            {/* Start Button */}
            <Button
              onClick={startProcessing}
              disabled={isProcessing || tasks.length === 0 || !outputDir}
              variant="primary"
              size="md"
            fullWidth
              loading={isProcessing}
            >
              {isProcessing ? '处理中...' : '开始处理'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResizeMode;
