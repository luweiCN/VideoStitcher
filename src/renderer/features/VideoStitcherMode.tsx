import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, Link2,
  Eye, Plus, Monitor, Smartphone, XCircle
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import OutputDirSelector from '@/components/OutputDirSelector';
import OperationLogPanel from '@/components/OperationLogPanel';
import FilePreviewModal from '@/components/FilePreviewModal';
import TaskAddedDialog from '@/components/TaskAddedDialog';
import TaskCountConfirmDialog from '@/components/TaskCountConfirmDialog';
import { FileSelector, FileSelectorGroup, type FileSelectorRef, type FileSelectorGroupRef } from '@/components/FileSelector';
import { Button } from '@/components/Button/Button';
import TaskCountSlider, { type TaskSource } from '@/components/TaskCountSlider';
import VideoPlayer from '@/components/VideoPlayer/VideoPlayer';
import TaskList, { type Task, type OutputConfig } from '@/components/TaskList';
import { useOutputDirCache } from '@/hooks/useOutputDirCache';
import { useOperationLogs } from '@/hooks/useOperationLogs';
import { useTaskContext } from '@/contexts/TaskContext';
import useVideoMaterials, { type VideoMaterial } from '@/hooks/useVideoMaterials';
import useStitchPreview from '@/hooks/useStitchPreview';

type Orientation = 'landscape' | 'portrait';

const VideoStitcherMode: React.FC = () => {
  const navigate = useNavigate();
  const fileSelectorGroupRef = useRef<FileSelectorGroupRef>(null);

  // 配置状态
  const { outputDir, setOutputDir } = useOutputDirCache('VideoStitcherMode');
  const [orientation, setOrientation] = useState<Orientation>('landscape');

  // 任务中心相关
  const { batchCreateTasks } = useTaskContext();
  const [isAdding, setIsAdding] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCountConfirmDialog, setShowCountConfirmDialog] = useState(false);

  // 任务列表状态
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 原始素材池（用于任务生成）
  const [aFiles, setAFiles] = useState<string[]>([]);
  const [bFiles, setBFiles] = useState<string[]>([]);

  // 使用 hook 加载视频素材（带全局缓存）
  const { materials: aMaterials, isLoading: isLoadingA } = useVideoMaterials(aFiles, true, {
    onLog: (message, type) => addLog(`[A面] ${message}`, type),
  });
  const { materials: bMaterials, isLoading: isLoadingB } = useVideoMaterials(bFiles, true, {
    onLog: (message, type) => addLog(`[B面] ${message}`, type),
  });
  const isLoadingMaterials = isLoadingA || isLoadingB;

  // 稳定的路径字符串，用于依赖检查
  const aPathsKey = useMemo(() => aFiles.join(','), [aFiles]);
  const bPathsKey = useMemo(() => bFiles.join(','), [bFiles]);

  // 任务数量控制
  const [taskCount, setTaskCount] = useState(1);
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);

  // 计算最大组合数
  const maxCombinations = useMemo(() => {
    return aFiles.length * bFiles.length;
  }, [aFiles.length, bFiles.length]);

  // 任务数量源配置
  const taskSources: TaskSource[] = useMemo(() => [
    { name: 'A', count: aFiles.length, color: 'violet', required: true },
    { name: 'B', count: bFiles.length, color: 'indigo', required: true },
  ], [aFiles.length, bFiles.length]);

  // 画布配置
  const canvasConfig = useMemo(() => {
    return orientation === 'landscape'
      ? { width: 1920, height: 1080, label: '1920×1080', aspectRatio: '16/9' }
      : { width: 1080, height: 1920, label: '1080×1920', aspectRatio: '9/16' };
  }, [orientation]);

  // 输出配置
  const outputConfig = useMemo((): OutputConfig => ({
    fps: '30fps',
    resolution: canvasConfig.label.replace('×', 'x'),
    codec: 'H.264',
    format: 'mp4',
    nums: 1,
  }), [canvasConfig.label]);

  // 日志管理
  const {
    logs,
    addLog,
    clearLogs,
    copyLogs,
    downloadLogs,
    logsEndRef,
    logsContainerRef,
    autoScrollEnabled,
    setAutoScrollEnabled,
    autoScrollPaused,
    resumeAutoScroll,
    scrollToBottom,
    scrollToTop,
    onUserInteractStart,
  } = useOperationLogs({
    moduleNameCN: 'A+B前后拼接',
    moduleNameEN: 'VideoStitcher',
  });

  // 当前选中的任务
  const currentTask = tasks[currentIndex];
  const currentAFile = currentTask?.files[0];
  const currentBFile = currentTask?.files[1];

  // 加载当前任务的素材信息
  const { materials: currentMaterials } = useVideoMaterials(
    currentTask ? [currentAFile?.path, currentBFile?.path].filter(Boolean) as string[] : [],
    !!currentTask
  );
  const currentAMaterial = currentMaterials[0];
  const currentBMaterial = currentMaterials[1];

  // 预览弹窗状态
  const [showPreview, setShowPreview] = useState(false);
  const [previewType, setPreviewType] = useState<'a' | 'b'>('a');

  // 预览视频
  const previewConfig = currentAMaterial && currentBMaterial ? {
    aPath: currentAMaterial.path,
    bPath: currentBMaterial.path,
    orientation,
    aDuration: currentAMaterial.duration,
    bDuration: currentBMaterial.duration,
  } : null;

  const {
    previewPath,
    isGenerating,
    error: previewError,
    volume,
    setVolume,
    muted,
    setMuted,
    isPlaying,
    setIsPlaying,
  } = useStitchPreview(previewConfig, !!currentTask, {
    onLog: (message, type) => addLog(message, type),
  });

  /**
   * 生成任务列表（通过 IPC 调用主进程）
   */
  const generateTasks = useCallback(async (
    aMatList: VideoMaterial[],
    bMatList: VideoMaterial[],
    count: number
  ) => {
    if (aMatList.length === 0 || bMatList.length === 0 || count <= 0) {
      setTasks([]);
      setCurrentIndex(0);
      return;
    }

    setIsGeneratingTasks(true);
    addLog(`正在生成 ${count} 个任务...`, 'info');

    await new Promise(resolve => setTimeout(resolve, 0));

    const aPaths = aMatList.map(m => m.path);
    const bPaths = bMatList.map(m => m.path);

    const result = await window.api.generateStitchTasks({
      aPaths,
      bPaths,
      count,
      outputDir,
      orientation,
    });

    if (result.success && result.tasks) {
      await new Promise(resolve => setTimeout(resolve, 0));
      setTasks(result.tasks as Task[]);
      setCurrentIndex(0);
      addLog(`已生成 ${result.tasks.length} 个任务`, 'success');
    } else {
      setTasks([]);
      setCurrentIndex(0);
      addLog('任务生成失败', 'error');
    }

    setIsGeneratingTasks(false);
  }, [orientation, outputDir, addLog]);

  /**
   * 重新生成任务（不重置索引）
   */
  const regenerateTasksWithoutIndexReset = useCallback(async () => {
    if (aMaterials.length === 0 || bMaterials.length === 0) {
      return;
    }

    setIsGeneratingTasks(true);

    const result = await window.api.generateStitchTasks({
      aPaths: aMaterials.map(m => m.path),
      bPaths: bMaterials.map(m => m.path),
      count: taskCount,
      outputDir,
      orientation,
    });

    if (result.success && result.tasks) {
      await new Promise(resolve => setTimeout(resolve, 0));
      setTasks(result.tasks as Task[]);
    } else {
      setTasks([]);
    }

    setIsGeneratingTasks(false);
  }, [aMaterials, bMaterials, taskCount, outputDir, orientation]);

  /**
   * A 面文件变化处理
   */
  const handleAFilesChange = useCallback((files: string[]) => {
    setAFiles(files);
    if (files.length > 0) {
      addLog(`已选择 ${files.length} 个 A 面视频`, 'info');
    }
    // 文件变化时重置 taskCount 为最大值
    const newMax = files.length * bFiles.length;
    if (newMax > 0) {
      setTaskCount(newMax);
    }
  }, [addLog, bFiles.length]);

  /**
   * B 面文件变化处理
   */
  const handleBFilesChange = useCallback((files: string[]) => {
    setBFiles(files);
    if (files.length > 0) {
      addLog(`已选择 ${files.length} 个 B 面视频`, 'info');
    }
    // 文件变化时重置 taskCount 为最大值
    const newMax = aFiles.length * files.length;
    if (newMax > 0) {
      setTaskCount(newMax);
    }
  }, [addLog, aFiles.length]);

  /**
   * 处理任务数量变化
   */
  const handleTaskCountChange = useCallback((count: number) => {
    setTaskCount(count);
  }, []);

  // 当素材数据变化时，重新生成任务
  useEffect(() => {
    if (aMaterials.length > 0 && bMaterials.length > 0 && taskCount > 0 && !isLoadingMaterials) {
      generateTasks(aMaterials, bMaterials, taskCount);
    } else if (aMaterials.length === 0 || bMaterials.length === 0) {
      setTasks([]);
      setCurrentIndex(0);
    }
  }, [aPathsKey, bPathsKey, aMaterials.length, bMaterials.length, taskCount, isLoadingMaterials, generateTasks]);

  // 当方向变化时，重新生成任务（不重置索引）
  useEffect(() => {
    if (tasks.length > 0) {
      regenerateTasksWithoutIndexReset();
    }
  }, [orientation]);

  // 确保选中的索引有效
  useEffect(() => {
    if (tasks.length > 0 && currentIndex >= tasks.length) {
      setCurrentIndex(0);
    }
  }, [tasks, currentIndex]);

  /**
   * 核心添加逻辑
   */
  const doAddToTaskCenter = async () => {
    setIsAdding(true);
    addLog(`正在添加 ${tasks.length} 个任务到任务中心...`, "info");

    try {
      const tasksWithType = tasks.map((task) => ({
        ...task,
        type: 'video_stitch' as const,
        config: {
          ...task.config,
          orientation,
        },
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
      addLog("请先选择视频", "warning");
      return;
    }
    if (!outputDir) {
      addLog("请先选择输出目录", "warning");
      return;
    }

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
    setAFiles([]);
    setBFiles([]);
    setTasks([]);
    setCurrentIndex(0);
    addLog("已清空编辑区域", "info");
  };

  /**
   * 关闭预览弹窗
   */
  const handleClosePreview = useCallback(() => {
    setShowPreview(false);
  }, []);

  // 预览弹窗使用的文件信息
  const previewFile = previewType === 'a' ? currentAMaterial : currentBMaterial;

  return (
    <div className="h-screen flex flex-col bg-black text-slate-100">
      {/* Header */}
      <PageHeader
        title="A+B 前后拼接"
        icon={Link2}
        iconColor="text-pink-500"
        description="将两个视频前后拼接成一个完整视频"
        featureInfo={{
          title: 'A+B 前后拼接',
          description: '将两个视频素材库按顺序前后拼接，采用SmartBlend™智能均衡算法，自动生成完整的拼接视频。',
          details: [
            '分别上传 A 面和 B 面视频作为素材库',
            '采用SmartBlend™智能均衡算法，均匀分配素材组合',
            '确保每个素材都被充分利用，避免重复和遗漏',
            'A 面在前，B 面在后，顺序拼接成一个完整视频',
            '自动调整帧率为 30fps，统一输出分辨率',
          ],
          themeColor: 'pink',
        }}
        rightContent={
          <div className="flex items-center bg-black rounded-lg p-0.5 border border-slate-800">
            <button
              onClick={() => setOrientation('landscape')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                orientation === 'landscape'
                  ? 'bg-pink-600 text-white shadow-lg shadow-pink-900/20'
                  : 'text-slate-400 hover:text-white'
              }`}
              type="button"
            >
              <Monitor className="w-3.5 h-3.5" />
              横版
            </button>
            <button
              onClick={() => setOrientation('portrait')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                orientation === 'portrait'
                  ? 'bg-pink-600 text-white shadow-lg shadow-pink-900/20'
                  : 'text-slate-400 hover:text-white'
              }`}
              type="button"
            >
              <Smartphone className="w-3.5 h-3.5" />
              竖版
            </button>
          </div>
        }
      />

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - File Selectors */}
        <div className="w-80 border-r border-slate-800 bg-black flex flex-col shrink-0">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            {/* 任务数量选择器 */}
            <TaskCountSlider
              value={taskCount}
              max={maxCombinations}
              onChange={handleTaskCountChange}
              sources={taskSources}
              themeColor="rose"
              disabled={isAdding}
            />

            {/* 文件选择器组 */}
            <FileSelectorGroup ref={fileSelectorGroupRef}>
              <div className="space-y-4">
                {/* A 面视频选择器 */}
                <FileSelector
                  id="videoStitcherA"
                  name="A 面视频（前段）"
                  accept="video"
                  multiple
                  showList
                  maxHeight={200}
                  themeColor="rose"
                  directoryCache
                  onChange={handleAFilesChange}
                  disabled={isAdding}
                />

                {/* B 面视频选择器 */}
                <FileSelector
                  id="videoStitcherB"
                  name="B 面视频（后段）"
                  accept="video"
                  multiple
                  showList
                  maxHeight={200}
                  themeColor="rose"
                  directoryCache
                  onChange={handleBFilesChange}
                  disabled={isAdding}
                />
              </div>
            </FileSelectorGroup>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-black">
          {/* 任务列表区域 */}
          {isGeneratingTasks ? (
            <div className="h-[164px] flex items-center justify-center border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-pink-400 animate-spin" />
                <span className="text-slate-400 text-sm">正在生成任务...</span>
              </div>
            </div>
          ) : (
            <TaskList
              tasks={tasks}
              currentIndex={currentIndex}
              output={outputConfig}
              type="video_stitch"
              thumbnail_source="A"
              materialsType={['video', 'video']}
              themeColor="rose"
              onTaskChange={setCurrentIndex}
            />
          )}

          {/* 预览区域 */}
          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* 视频预览 */}
            <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
              {tasks.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-slate-500">
                    <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">选择视频后显示预览</p>
                  </div>
                </div>
              ) : isGenerating ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 mx-auto mb-3 text-pink-400 animate-spin" />
                    <p className="text-sm text-slate-400">正在生成预览视频...</p>
                  </div>
                </div>
              ) : previewError ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <XCircle className="w-8 h-8 mx-auto mb-3 text-red-400" />
                    <p className="text-sm text-slate-400">预览生成失败</p>
                    <p className="text-xs text-slate-500 mt-1">{previewError}</p>
                  </div>
                </div>
              ) : previewPath ? (
                <div className="relative w-full h-full flex flex-col items-center justify-center">
                  <p className="text-xs text-slate-500 mb-2">截取 A 最后 5 秒 + B 前 5 秒</p>
                  <div
                    className="bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800"
                    style={orientation === 'landscape'
                      ? { width: '640px', maxHeight: '100%', aspectRatio: '16/9' }
                      : { height: '640px', maxWidth: '100%', aspectRatio: '9/16' }
                    }
                  >
                    <VideoPlayer
                      key={`${orientation}-${previewPath}`}
                      src={`preview://${encodeURIComponent(previewPath)}`}
                      loop
                      muted={muted}
                      paused={!isPlaying}
                      themeColor="rose"
                      minimal
                      onPlayStateChange={(playing) => {
                        setIsPlaying(playing);
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Eye className="w-8 h-8 mx-auto mb-3 text-slate-500" />
                    <p className="text-sm text-slate-400">准备生成预览...</p>
                  </div>
                </div>
              )}
            </div>
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
      </main>

      {/* 视频预览弹窗 */}
      {showPreview && previewFile && (
        <FilePreviewModal
          file={{
            path: previewFile.path,
            name: previewFile.name,
            type: 'video',
          }}
          visible={showPreview}
          onClose={handleClosePreview}
          allFiles={[]}
          currentIndex={0}
          onPrevious={undefined}
          onNext={undefined}
          themeColor={previewType === 'a' ? 'violet' : 'fuchsia'}
        />
      )}

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

export default VideoStitcherMode;
