import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Slider from '@radix-ui/react-slider';
import {
  Loader2, Eye, Maximize2, Plus
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import OutputDirSelector from '@/components/OutputDirSelector';
import OperationLogPanel from '@/components/OperationLogPanel';
import TaskAddedDialog from '@/components/TaskAddedDialog';
import TaskCountConfirmDialog from '@/components/TaskCountConfirmDialog';
import { FileSelector, FileSelectorGroup, type FileSelectorGroupRef } from '@/components/FileSelector';
import { Button } from '@/components/Button/Button';
import TaskList, { type Task, type OutputConfig } from '@/components/TaskList';
import { useOutputDirCache } from '@/hooks/useOutputDirCache';
import { useOperationLogs } from '@/hooks/useOperationLogs';
import { useVideoVolumeCache } from '@/hooks/useVideoVolumeCache';
import { useTaskContext } from '@/contexts/TaskContext';
import useVideoMaterials from '@/hooks/useVideoMaterials';
import { PreviewArea } from './ResizeMode/components/PreviewArea';

type ResizeModeType = 'siya' | 'fishing' | 'unify_h' | 'unify_v';

const MODE_CONFIG = {
  siya: { name: 'Siya模式', desc: '竖屏转横屏/方形', outputs: [{ width: 1920, height: 1080, label: '1920x1080' }, { width: 1920, height: 1920, label: '1920x1920' }] },
  fishing: { name: '海外捕鱼', desc: '横屏转竖屏/方形', outputs: [{ width: 1080, height: 1920, label: '1080x1920' }, { width: 1920, height: 1920, label: '1920x1920' }] },
  unify_h: { name: '统一横屏', desc: '强制转为横屏比例', outputs: [{ width: 1920, height: 1080, label: '1920x1080' }] },
  unify_v: { name: '统一竖屏', desc: '强制转为竖屏比例', outputs: [{ width: 1080, height: 1920, label: '1080x1920' }] },
};

const ResizeMode: React.FC = () => {
  const navigate = useNavigate();
  const fileSelectorGroupRef = useRef<FileSelectorGroupRef>(null);

  // 视频文件列表
  const [videos, setVideos] = useState<string[]>([]);
  
  // 任务列表状态
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);

  // 使用 hook 加载视频素材（带缓存）
  const { outputDir, setOutputDir } = useOutputDirCache('ResizeMode');
  const [mode, setMode] = useState<ResizeModeType>('siya');
  const [blurAmount, setBlurAmount] = useState(20);
  const [pendingBlurAmount, setPendingBlurAmount] = useState(20); // 拖动中的临时值

  // 任务中心相关
  const { batchCreateTasks } = useTaskContext();
  const [isAdding, setIsAdding] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCountConfirmDialog, setShowCountConfirmDialog] = useState(false);

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

  /**
   * 生成任务列表（通过 IPC 调用主进程）
   */
  const generateTasks = useCallback(async () => {
    if (videos.length === 0) {
      setTasks([]);
      setCurrentIndex(0);
      return;
    }

    if (!outputDir) {
      setTasks([]);
      return;
    }

    setIsGeneratingTasks(true);

    // 使用 setTimeout 让 UI 有机会更新
    await new Promise(resolve => setTimeout(resolve, 0));

    // 调用主进程生成任务
    const result = await window.api.generateResizeTasks({
      videos,
      mode,
      blurAmount,
      outputDir,
    });

    if (result.success && result.tasks) {
      await new Promise(resolve => setTimeout(resolve, 0));
      setTasks(result.tasks as Task[]);
      setCurrentIndex(0);
    } else {
      setTasks([]);
      setCurrentIndex(0);
    }

    setIsGeneratingTasks(false);
  }, [videos, mode, blurAmount, outputDir]);

  /**
   * 当素材或参数变化时重新生成任务
   */
  useEffect(() => {
    generateTasks();
  }, [videos.length, mode, blurAmount, outputDir]);

  /**
   * 处理视频选择
   */
  const handleVideosChange = useCallback((filePaths: string[]) => {
    setVideos(filePaths);
    if (filePaths.length > 0) {
      addLog(`已选择 ${filePaths.length} 个视频`, 'info');
    }
  }, [addLog]);

  /**
   * 核心添加逻辑
   */
  const doAddToTaskCenter = async () => {
    setIsAdding(true);
    addLog(`正在添加 ${tasks.length} 个任务到任务中心...`, "info");

    try {
      const tasksWithType = tasks.map((task) => ({
        ...task,
        type: 'video_resize' as const,
      }));

      const result = await batchCreateTasks(tasksWithType);

      if (result.successCount > 0) {
        addLog(`成功添加 ${result.successCount} 个任务到任务中心`, "success");
        setShowConfirmDialog(true);
      }
      if (result.failCount > 0) {
        addLog(`${result.failCount} 个任务添加失败`, "warning");
      }
    } catch (err: any) {
      addLog(`添加任务失败: ${err.message || err}`, "error");
    } finally {
      setIsAdding(false);
    }
  };

  /**
   * 添加任务到任务中心（入口函数）
   */
  const addToTaskCenter = async () => {
    if (tasks.length === 0) {
      addLog("请先选择视频文件", "warning");
      return;
    }
    if (!outputDir) {
      addLog("请先选择输出目录", "warning");
      return;
    }

    // 任务数量超过100时显示确认弹窗
    if (tasks.length > 100) {
      setShowCountConfirmDialog(true);
    } else {
      await doAddToTaskCenter();
    }
  };

  /**
   * 清空编辑区域
   */
  const clearEditor = () => {
    fileSelectorGroupRef.current?.clearAll();
    setVideos([]);
    setTasks([]);
    setCurrentIndex(0);
    addLog("已清空编辑区域", "info");
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
                {(Object.keys(MODE_CONFIG) as ResizeModeType[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`w-full p-2 rounded-lg border text-left transition-all text-xs ${
                      mode === m
                        ? 'border-rose-500 bg-rose-500/20 text-rose-400'
                        : 'border-slate-700 bg-black/50 text-slate-400 hover:border-slate-600'
                    }`}
                    disabled={isAdding}
                  >
                    <div className="font-medium">{MODE_CONFIG[m].name}</div>
                    <div className="text-[10px] opacity-80 mt-0.5">{MODE_CONFIG[m].desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Video Selection */}
            <FileSelectorGroup ref={fileSelectorGroupRef}>
              <FileSelector
                id="resizeVideos"
                name="视频文件"
                accept="video"
                multiple
                showList={true}
                themeColor="rose"
                directoryCache
                onChange={handleVideosChange}
                disabled={isAdding}
              />
            </FileSelectorGroup>

            {/* Blur Amount */}
            <div className="bg-black/50 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  模糊程度
                </label>
                <span className="px-3 py-1.5 rounded-lg font-mono font-bold text-lg bg-gradient-to-r from-rose-500 to-red-500 bg-clip-text text-transparent">
                  {pendingBlurAmount}
                </span>
              </div>
              {/* Radix UI Slider */}
              <Slider.Root
                className="relative flex items-center select-none touch-none h-5"
                value={[pendingBlurAmount]}
                onValueChange={(values) => {
                  // 拖动时只更新临时值，用于实时显示
                  setPendingBlurAmount(values[0]);
                }}
                onValueCommit={(values) => {
                  // 松开鼠标时更新真正的 blurAmount，触发任务生成
                  setBlurAmount(values[0]);
                }}
                max={50}
                min={0}
                step={1}
                disabled={isAdding}
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
          {isGeneratingTasks ? (
            <div className="h-[164px] flex items-center justify-center border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-rose-400 animate-spin" />
                <span className="text-slate-400 text-sm">正在生成任务...</span>
              </div>
            </div>
          ) : (
            <TaskList
              tasks={tasks}
              currentIndex={currentIndex}
              output={outputConfig}
              type="video_resize"
              thumbnail_source="V"
              materialsType={['video']}
              themeColor="rose"
              onTaskChange={setCurrentIndex}
            />
          )}

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
                  id: String(currentTask.id),
                  path: currentTask.files[0].path,
                  name: currentTask.files[0].path.split('/').pop() || '',
                  status: (currentTask.status === 'failed' ? 'error' : currentTask.status === 'running' ? 'processing' : currentTask.status === 'cancelled' ? 'pending' : currentTask.status) as 'pending' | 'completed' | 'error' | 'processing' | 'waiting',
                  previewUrl: videoInfo?.previewUrl,
                  width: videoInfo?.width,
                  height: videoInfo?.height,
                }}
                blurAmount={pendingBlurAmount}
                volume={volume}
                isMuted={isMuted}
                onVolumeChange={setVolume}
                onMuteChange={setIsMuted}
                isProcessing={false}
                getPreviewStyle={getPreviewStyle}
              />
            )}
          </div>
        </div>

        {/* Right Sidebar - Logs + Button */}
        <div className="w-80 border-l border-slate-800 bg-black flex flex-col shrink-0 overflow-y-hidden">
          <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            {/* 输出目录 */}
            <OutputDirSelector
              value={outputDir}
              onChange={setOutputDir}
              disabled={isAdding}
              themeColor="rose"
            />

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

            {/* Add to Task Center Button */}
            <Button
              onClick={addToTaskCenter}
              disabled={tasks.length === 0 || isAdding || !outputDir}
              variant="primary"
              size="md"
              fullWidth
              loading={isAdding}
              leftIcon={!isAdding && <Plus className="w-4 h-4" />}
            >
              {isAdding ? "添加中..." : "添加到任务中心"}
            </Button>
          </div>
        </div>
      </div>

      {/* 任务添加成功弹窗 */}
      <TaskAddedDialog
        open={showConfirmDialog}
        taskCount={tasks.length}
        onClear={() => {
          clearEditor();
          setShowConfirmDialog(false);
        }}
        onKeep={() => setShowConfirmDialog(false)}
        onTaskCenter={() => {
          setShowConfirmDialog(false);
          navigate('/taskCenter');
        }}
      />

      {/* 任务数量确认弹窗 */}
      <TaskCountConfirmDialog
        open={showCountConfirmDialog}
        taskCount={tasks.length}
        onConfirm={() => {
          setShowCountConfirmDialog(false);
          doAddToTaskCenter();
        }}
        onCancel={() => setShowCountConfirmDialog(false)}
      />
    </div>
  );
};

export default ResizeMode;
