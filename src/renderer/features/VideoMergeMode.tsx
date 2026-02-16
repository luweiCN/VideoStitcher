import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  Play,
  Settings,
  RefreshCcw,
  Maximize,
  ZoomIn,
  ZoomOut,
  Layers3,
  Loader2,
  Eye,
  ArrowDown,
  ArrowUp,
  XCircle,
} from "lucide-react";
import useEmblaCarousel from 'embla-carousel-react';
import { MaterialPositions, LayerId, LayerConfig } from "../types";
import VideoEditor from "../components/VideoEditor";
import PageHeader from "../components/PageHeader";
import OutputDirSelector from "../components/OutputDirSelector";
import ConcurrencySelector from "../components/ConcurrencySelector";
import OperationLogPanel from "../components/OperationLogPanel";
import { FileSelector, FileSelectorGroup } from "../components/FileSelector";
import { Button } from "../components/Button/Button";
import TaskList, { type Task, type OutputConfig } from "../components/TaskList";
import TaskCountSlider from "../components/TaskCountSlider";
import VideoPlayer from "../components/VideoPlayer/VideoPlayer";
import { useOutputDirCache } from "../hooks/useOutputDirCache";
import { useConcurrencyCache } from "../hooks/useConcurrencyCache";
import { useOperationLogs } from "../hooks/useOperationLogs";
import { useVideoProcessingEvents } from "../hooks/useVideoProcessingEvents";
import { useMergePreview } from "../hooks/useMergePreview";
import { setGlobalIsPlaying } from "../hooks/useStitchPreview";
import {
  getCanvasConfig,
  getInitialPositions,
  getDefaultLayerConfigs,
} from "../utils/positionCalculator";

interface VideoMergeModeProps {
  onBack: () => void;
}

const VideoMergeMode: React.FC<VideoMergeModeProps> = ({ onBack }) => {
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">(
    "horizontal",
  );
  const canvasConfig = useMemo(
    () => getCanvasConfig(orientation),
    [orientation],
  );

  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [taskCount, setTaskCount] = useState(1);
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);

  // 轮播状态：0 = 编辑视图，1 = 预览视图
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    axis: 'y',
    loop: false,
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: false,
    duration: 20,
    watchDrag: false, // 禁用手动滚动，避免与 canvas 编辑冲突
  });
  const [activeView, setActiveView] = useState(0);

  // 切换视图
  const toggleView = useCallback(() => {
    if (emblaApi) {
      const newIndex = activeView === 0 ? 1 : 0;
      emblaApi.scrollTo(newIndex);
      setActiveView(newIndex);
    }
  }, [emblaApi, activeView]);

  // 监听轮播变化
  useEffect(() => {
    if (!emblaApi) return;
    
    const onSelect = () => {
      const newView = emblaApi.selectedScrollSnap();
      setActiveView(newView);
      
      // 切换到预览视图时自动播放，切换回编辑视图时暂停
      if (newView === 1) {
        setGlobalIsPlaying(true);
      } else {
        setGlobalIsPlaying(false);
      }
    };
    
    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);

  const [bgImages, setBgImages] = useState<string[]>([]);
  const [bVideos, setBVideos] = useState<string[]>([]);
  const [aVideos, setAVideos] = useState<string[]>([]);
  const [covers, setCovers] = useState<string[]>([]);

  const maxCombinations = useMemo(() => {
    return (
      bVideos.length *
      (covers.length > 0 ? covers.length : 1) *
      (aVideos.length > 0 ? aVideos.length : 1)
    );
  }, [bVideos.length, covers.length, aVideos.length]);

  const taskSources = useMemo(
    () => [
      {
        name: "B",
        count: bVideos.length,
        color: "violet" as const,
        required: true,
      },
      {
        name: "A",
        count: aVideos.length,
        color: "indigo" as const,
        required: false,
      },
      {
        name: "封面",
        count: covers.length,
        color: "amber" as const,
        required: false,
      },
    ],
    [bVideos.length, aVideos.length, covers.length],
  );

  const [bVideoMetadata, setBVideoMetadata] = useState<
    { width: number; height: number; duration: number } | undefined
  >();

  const [materialPositions, setMaterialPositions] = useState<MaterialPositions>(
    () => getInitialPositions(canvasConfig),
  );

  const lockedLayers = useMemo(
    () => new Set<LayerId>(["aVideo", "bgImage", "coverImage"]),
    [],
  );
  const [canvasZoom, setCanvasZoom] = useState<number>(100);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const { outputDir, setOutputDir } = useOutputDirCache("VideoMergeMode");
  const { concurrency, setConcurrency } = useConcurrencyCache("VideoMergeMode");
  const [isProcessing, setIsProcessing] = useState(false);

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
    moduleNameCN: "视频合成",
    moduleNameEN: "VideoMerge",
  });

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -5 : 5;
      setCanvasZoom((prev) => Math.max(10, Math.min(200, prev + delta)));
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  const materials = useMemo(
    () => ({
      aVideo: aVideos.length > 0 ? aVideos[0] : undefined,
      bVideo: bVideos.length > 0 ? bVideos[0] : undefined,
      bgImage: bgImages.length > 0 ? bgImages[0] : undefined,
      coverImage: covers.length > 0 ? covers[0] : undefined,
    }),
    [aVideos, bVideos, bgImages, covers],
  );

  // 当前任务的素材（用于预览）
  const currentTaskMaterials = useMemo(() => {
    const task = tasks[currentIndex];
    if (!task) return materials;

    const getFileByCategory = (category: string) => {
      const file = task.files?.find(f => f.category === category);
      return file?.path;
    };

    return {
      aVideo: getFileByCategory('A'),
      bVideo: getFileByCategory('B') || materials.bVideo,
      bgImage: getFileByCategory('bg') || materials.bgImage,
      coverImage: getFileByCategory('cover'),
    };
  }, [tasks, currentIndex, materials]);

  // 预览配置 - 使用当前任务的素材和位置
  const previewConfig = useMemo(() => {
    if (!currentTaskMaterials.bVideo) return null;
    return {
      bVideo: currentTaskMaterials.bVideo,
      aVideo: currentTaskMaterials.aVideo,
      bgImage: currentTaskMaterials.bgImage,
      coverImage: currentTaskMaterials.coverImage,
      orientation,
      aPosition: materialPositions.aVideo,
      bPosition: materialPositions.bVideo,
      coverPosition: materialPositions.coverImage,
    };
  }, [currentTaskMaterials, orientation, materialPositions]);

  // 预览 hook - 只有在预览视图时才启用
  const {
    previewPath,
    isGenerating: isGeneratingPreview,
    error: previewError,
    muted,
    setMuted,
    isPlaying,
    setIsPlaying,
  } = useMergePreview(previewConfig, activeView === 1 && !!currentTaskMaterials.bVideo, {
    onLog: (message, type) => addLog(message, type),
  });

  const layerConfigs: LayerConfig[] = useMemo(() => {
    const defaultConfigs = getDefaultLayerConfigs();
    const availableLayers: LayerConfig[] = [];
    availableLayers.push({
      ...defaultConfigs.find((l) => l.id === "bVideo")!,
      visible: true,
      locked: lockedLayers.has("bVideo"),
    });
    if (aVideos.length > 0) {
      availableLayers.push({
        ...defaultConfigs.find((l) => l.id === "aVideo")!,
        visible: true,
        locked: lockedLayers.has("aVideo"),
      });
    }
    if (materials.bgImage) {
      availableLayers.push({
        ...defaultConfigs.find((l) => l.id === "bgImage")!,
        visible: true,
        locked: lockedLayers.has("bgImage"),
      });
    }
    if (covers.length > 0) {
      availableLayers.push({
        ...defaultConfigs.find((l) => l.id === "coverImage")!,
        visible: true,
        locked: lockedLayers.has("coverImage"),
      });
    }
    return availableLayers;
  }, [aVideos.length, materials.bgImage, covers.length, lockedLayers]);

  const [activeLayer, setActiveLayer] = useState<LayerId>("bVideo");

  useEffect(() => {
    const availableLayerIds = layerConfigs.map((l) => l.id);
    if (!availableLayerIds.includes(activeLayer)) {
      if (availableLayerIds.length > 0) {
        setActiveLayer(availableLayerIds[0] as LayerId);
      }
    }
  }, [layerConfigs, activeLayer]);

  useEffect(() => {
    setMaterialPositions(getInitialPositions(canvasConfig));
  }, [canvasConfig]);

  useEffect(() => {
    const calculateBestFitZoom = () => {
      if (!previewContainerRef.current) return;

      const container = previewContainerRef.current;
      const parentWidth = container.clientWidth;
      const parentHeight = container.clientHeight;

      const padding = 10;
      const controlBarHeight = 100;
      const availableWidth = parentWidth - padding * 2;
      const availableHeight = parentHeight - padding * 2 - controlBarHeight;

      const zoomByWidth = (availableWidth / parentWidth) * 100;
      const scaledHeightAt100 = (parentWidth / canvasConfig.width) * canvasConfig.height;
      const zoomByHeight = (availableHeight / scaledHeightAt100) * 100;

      const targetZoom = Math.min(zoomByWidth, zoomByHeight);

      const clampedZoom = Math.max(10, Math.min(200, Math.ceil(targetZoom) - 5));
      setCanvasZoom(clampedZoom);
    };
    const timer = setTimeout(calculateBestFitZoom, 100);
    return () => clearTimeout(timer);
  }, [canvasConfig, tasks]);

  useVideoProcessingEvents({
    onStart: (data) => {
      addLog(
        `开始处理: 总任务 ${data.total}, 并发 ${data.concurrency}`,
        "info",
      );
    },
    onTaskStart: (data) => {
      setTasks((prev) =>
        prev.map((t, i) =>
          i === data.index ? { ...t, status: "processing" as const } : t
        )
      );
    },
    onProgress: (data) => {
      setTasks((prev) =>
        prev.map((t, i) =>
          i === data.index ? { ...t, status: "completed" as const } : t
        )
      );
      addLog(`进度: ${data.done}/${data.total} (失败 ${data.failed})`, "info");
    },
    onFailed: (data) => {
      setTasks((prev) =>
        prev.map((t, i) =>
          i === data.index ? { ...t, status: "error" as const, error: data.error } : t
        )
      );
      addLog(`任务 ${data.index + 1} 失败: ${data.error}`, "error");
    },
    onFinish: (data) => {
      const timeInfo = data.elapsed ? ` (耗时 ${data.elapsed}秒)` : '';
      addLog(`完成! 成功 ${data.done}, 失败 ${data.failed}${timeInfo}`, "success");
      setIsProcessing(false);
    },
    onLog: (data) => {
      addLog(`[任务 ${data.index + 1}] ${data.message}`, "info");
    },
  });

  const fetchVideoMetadata = useCallback(
    async (filePath: string) => {
      try {
        return await window.api.getVideoMetadata(filePath);
      } catch (err) {
        addLog(`无法读取视频元数据: ${filePath}`, "error");
        return null;
      }
    },
    [addLog],
  );

  const handleBVideosChange = useCallback(
    async (files: string[]) => {
      setBVideos(files);
      if (files.length > 0) {
        addLog(`已选择 ${files.length} 个主视频`, "info");
        const metadata = await fetchVideoMetadata(files[0]);
        if (metadata) {
          setBVideoMetadata(metadata);
          const newPositions = getInitialPositions(
            canvasConfig,
            metadata,
          );
          setMaterialPositions((prev) => ({
            ...prev,
            bVideo: newPositions.bVideo,
          }));
        }
        const newMax =
          files.length *
          (covers.length > 0 ? covers.length : 1) *
          (aVideos.length > 0 ? aVideos.length : 1);
        if (newMax > 0) {
          setTaskCount(Math.min(newMax, 100));
        }
      }
    },
    [
      fetchVideoMetadata,
      canvasConfig,
      addLog,
      covers.length,
      aVideos.length,
    ],
  );

  const handleAVideosChange = useCallback(
    async (files: string[]) => {
      setAVideos(files);
      if (files.length > 0) {
        addLog(`已选择 ${files.length} 个A面视频`, "info");
      }
      const newMax =
        bVideos.length *
        (covers.length > 0 ? covers.length : 1) *
        (files.length > 0 ? files.length : 1);
      if (newMax > 0) {
        setTaskCount(Math.min(newMax, 100));
      }
    },
    [
      addLog,
      bVideos.length,
      covers.length,
    ],
  );

  const handleBgImagesChange = useCallback(
    async (files: string[]) => {
      setBgImages(files);
      if (files.length > 0) {
        addLog(`已选择背景图: ${files[0]}`, "info");
      }
    },
    [addLog],
  );

  const handleCoversChange = useCallback(
    async (files: string[]) => {
      setCovers(files);
      if (files.length > 0) {
        addLog(`已选择 ${files.length} 个封面`, "info");
      }
      const newMax =
        bVideos.length *
        (files.length > 0 ? files.length : 1) *
        (aVideos.length > 0 ? aVideos.length : 1);
      if (newMax > 0) {
        setTaskCount(Math.min(newMax, 100));
      }
    },
    [
      addLog,
      bVideos.length,
      aVideos.length,
    ],
  );

  const handlePositionChange = (
    id: LayerId,
    position: { x: number; y: number; width: number; height: number },
  ) => {
    setMaterialPositions((prev) => ({ ...prev, [id]: position }));
  };

  const resetPositions = () => {
    const defaults = getInitialPositions(
      canvasConfig,
      bVideoMetadata,
    );
    setMaterialPositions(defaults);
    addLog("已重置素材位置", "info");
  };

  const maximizePositions = () => {
    const maxPosition = {
      x: 0,
      y: 0,
      width: canvasConfig.width,
      height: canvasConfig.height,
    };
    setMaterialPositions({
      bgImage: { ...maxPosition },
      aVideo: { ...maxPosition },
      bVideo: { ...maxPosition },
      coverImage: { ...maxPosition },
    });
    addLog("已设置素材铺满全屏", "info");
  };

  /**
   * 生成任务列表（通过 IPC 调用主进程）
   */
  const generateTasks = useCallback(async () => {
    if (bVideos.length === 0) {
      setTasks([]);
      return;
    }

    setIsGeneratingTasks(true);
    addLog(`正在生成 ${taskCount} 个任务...`, "info");

    // 使用 setTimeout 让 UI 有机会更新
    await new Promise(resolve => setTimeout(resolve, 0));

    // 调用主进程生成任务
    const result = await window.api.generateMergeTasks({
      bVideos,
      aVideos: aVideos.length > 0 ? aVideos : undefined,
      covers: covers.length > 0 ? covers : undefined,
      bgImages: bgImages.length > 0 ? bgImages : undefined,
      count: taskCount,
      outputDir,
      concurrency,
      orientation,
    });

    if (result.success && result.tasks) {
      // 再次使用 setTimeout 让 UI 有机会更新
      await new Promise(resolve => setTimeout(resolve, 0));
      setTasks(result.tasks as Task[]);
      setCurrentIndex(0);
      addLog(`已生成 ${result.tasks.length} 个任务`, "success");
    } else {
      setTasks([]);
      setCurrentIndex(0);
      addLog("任务生成失败", "error");
    }

    setIsGeneratingTasks(false);
  }, [
    bVideos,
    aVideos,
    covers,
    bgImages,
    taskCount,
    orientation,
    outputDir,
    concurrency,
    addLog,
  ]);

  /**
   * 重新生成任务（不重置索引）- 通过 IPC 调用主进程
   */
  const regenerateTasksWithoutIndexReset = useCallback(async () => {
    if (bVideos.length === 0) {
      setTasks([]);
      return;
    }

    setIsGeneratingTasks(true);

    // 调用主进程生成任务
    const result = await window.api.generateMergeTasks({
      bVideos,
      aVideos: aVideos.length > 0 ? aVideos : undefined,
      covers: covers.length > 0 ? covers : undefined,
      bgImages: bgImages.length > 0 ? bgImages : undefined,
      count: taskCount,
      outputDir,
      concurrency,
      orientation,
    });

    if (result.success && result.tasks) {
      await new Promise(resolve => setTimeout(resolve, 0));
      setTasks(result.tasks as Task[]);
    } else {
      setTasks([]);
    }

    setIsGeneratingTasks(false);
  }, [
    bVideos,
    aVideos,
    covers,
    bgImages,
    taskCount,
    orientation,
    outputDir,
    concurrency,
  ]);

  useEffect(() => {
    generateTasks();
  }, [
    bVideos.length,
    aVideos.length,
    covers.length,
    bgImages.length,
    taskCount,
  ]);

  useEffect(() => {
    if (tasks.length > 0) {
      regenerateTasksWithoutIndexReset();
    }
  }, [orientation]);

  const outputConfig: OutputConfig = useMemo(() => {
    const resolution = orientation === "horizontal" ? "1920×1080" : "1080×1920";
    return {
      resolution,
      format: "mp4",
      nums: 1,
    };
  }, [orientation]);

  const materialsType = useMemo(() => {
    const types: ('video' | 'image')[] = [];
    if (covers.length > 0) types.push('image');
    if (aVideos.length > 0) types.push('video');
    types.push('video');
    if (bgImages.length > 0) types.push('image');
    return types;
  }, [covers.length, aVideos.length, bgImages.length]);

  const thumbnailSource = useMemo(() => {
    if (covers.length > 0) return 'cover';
    if (aVideos.length > 0) return 'A';
    return 'B';
  }, [covers.length, aVideos.length]);

  const startProcessing = async () => {
    if (bVideos.length === 0) {
      addLog("请先选择主视频", "warning");
      return;
    }
    if (!outputDir) {
      addLog("请先选择输出目录", "warning");
      return;
    }
    if (isProcessing) return;
    console.log("startProcessing - tasks:", tasks.length, tasks);
    if (tasks.length === 0) {
      addLog("没有可处理的任务", "warning");
      return;
    }

    setIsProcessing(true);
    const modeText = orientation === "horizontal" ? "横屏" : "竖屏";
    addLog(`开始${modeText}合成处理...`, "info");

    setTasks((prev) => prev.map((t) => ({ ...t, status: "waiting" as const })));

    try {
      const tasksWithConfig = tasks.map((task) => ({
        ...task,
        config: {
          orientation,
          aPosition: materialPositions.aVideo,
          bPosition: materialPositions.bVideo,
          bgPosition: materialPositions.bgImage,
          coverPosition: materialPositions.coverImage,
        },
        outputDir,
        concurrency,
      }));
      await window.api.videoMerge(tasksWithConfig);
    } catch (err: any) {
      addLog(`处理失败: ${err.message || err}`, "error");
      setIsProcessing(false);
    }
  };

  const primaryColor = "violet";

  return (
    <div className="h-screen flex flex-col bg-black text-slate-100 font-sans overflow-hidden">
      <PageHeader
        onBack={onBack}
        title="极速合成"
        icon={Layers3}
        iconColor="text-violet-400"
        description="横竖屏一体，图层管理，所有素材独立位置调整"
        featureInfo={{
          title: "极速合成",
          description:
            "支持横竖屏一体化的视频合成工具，采用SmartBlend™智能均衡算法，确保素材组合的最大多样性。",
          details: [
            "支持横屏（1920×1080）和竖屏（1080×1920）两种输出尺寸",
            "支持四种素材：背景图，B面视频（必选）、A面视频、封面图",
            "在预览区拖拽调整素材位置，支持重置框位和铺满全屏",
            "采用SmartBlend™智能均衡算法，均匀分配素材组合，确保每个素材都被充分利用",
            "实时预览合成效果，所见即所得",
          ],
          themeColor: "violet",
        }}
        rightContent={
          <div className="flex items-center bg-black rounded-lg p-0.5 border border-slate-800">
            <button
              onClick={() => setOrientation("horizontal")}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                orientation === "horizontal"
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-900/20"
                  : "text-slate-400 hover:text-white"
              }`}
              type="button"
            >
              横屏
            </button>
            <button
              onClick={() => setOrientation("vertical")}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                orientation === "vertical"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20"
                  : "text-slate-400 hover:text-white"
              }`}
              type="button"
            >
              竖屏
            </button>
          </div>
        }
      />

      <main className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r border-slate-800 bg-black flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            <TaskCountSlider
              value={taskCount}
              max={maxCombinations}
              onChange={setTaskCount}
              sources={taskSources}
              themeColor={primaryColor}
            />

            <FileSelectorGroup>
              <div className="space-y-4">
                <FileSelector
                  id="bgImage"
                  name="背景图 (可选)"
                  accept="image"
                  multiple={false}
                  showList
                  themeColor={primaryColor}
                  directoryCache
                  onChange={handleBgImagesChange}
                />

                <FileSelector
                  id="bVideo"
                  name="主视频 (B面 - 必选)"
                  accept="video"
                  multiple
                  showList
                  themeColor={primaryColor}
                  directoryCache
                  required
                  onChange={handleBVideosChange}
                />

                <FileSelector
                  id="aVideo"
                  name="A 面视频 (可选)"
                  accept="video"
                  multiple
                  showList
                  themeColor={primaryColor}
                  directoryCache
                  onChange={handleAVideosChange}
                />

                <FileSelector
                  id="cover"
                  name="封面图 (可选)"
                  accept="image"
                  multiple
                  showList
                  themeColor={primaryColor}
                  directoryCache
                  onChange={handleCoversChange}
                />
              </div>
            </FileSelectorGroup>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-black">
          {isGeneratingTasks ? (
            <div className="h-[164px] flex items-center justify-center border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
                <span className="text-slate-400 text-sm">正在生成任务...</span>
              </div>
            </div>
          ) : (
            <TaskList
              tasks={tasks}
              currentIndex={currentIndex}
              output={outputConfig}
              type="video_merge"
              thumbnail_source={thumbnailSource}
              materialsType={materialsType}
              themeColor={primaryColor}
              onTaskChange={setCurrentIndex}
              isProcessing={isProcessing}
              onLog={(message, type) => addLog(message, type)}
            />
          )}

          {/* 轮播容器：编辑视图 / 预览视图 */}
          <div className="flex-1 relative overflow-hidden">
            {/* 右上角切换按钮 */}
            {materials.bVideo && (
              <button
                onClick={toggleView}
                className="absolute top-4 right-4 z-20 flex items-center gap-2 px-3 py-2 bg-black/80 backdrop-blur-sm border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
              >
                {activeView === 0 ? (
                  <>
                    <ArrowDown className="w-4 h-4 text-violet-400" />
                    <span className="text-xs text-slate-300">查看预览</span>
                  </>
                ) : (
                  <>
                    <ArrowUp className="w-4 h-4 text-violet-400" />
                    <span className="text-xs text-slate-300">返回编辑</span>
                  </>
                )}
              </button>
            )}

            {/* Embla 轮播 */}
            <div className="h-full overflow-hidden" ref={emblaRef}>
              <div className="flex flex-col h-full">
                {/* Slide 1: 编辑视图 */}
                <div className="flex-[0_0_100%] min-h-0 flex flex-col overflow-hidden">
                  <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
                    <div className="h-full w-full flex flex-col items-center justify-center py-4">
                      <div
                        ref={previewContainerRef}
                        className="flex-1 w-full flex items-center justify-center min-h-0 overflow-auto"
                      >
                        <VideoEditor
                          mode={orientation}
                          canvasWidth={canvasConfig.width}
                          canvasHeight={canvasConfig.height}
                          positions={materialPositions}
                          onPositionChange={handlePositionChange}
                          onActiveLayerChange={setActiveLayer}
                          activeLayer={activeLayer}
                          layerConfigs={layerConfigs}
                          materials={materials}
                          canvasZoom={canvasZoom}
                          onCanvasZoomChange={setCanvasZoom}
                        />
                      </div>
                      <div className="mt-8 flex flex-col items-center gap-4">
                        <div className="flex items-center gap-6 bg-slate-900/80 backdrop-blur-sm border border-slate-800 px-6 py-4 rounded-xl">
                          <button
                            onClick={resetPositions}
                            className="text-[10px] font-black text-slate-400 hover:text-white flex items-center gap-2"
                          >
                            <RefreshCcw className="w-3 h-3" />
                            重置框位
                          </button>
                          <div className="w-px h-4 bg-slate-800" />
                          <button
                            onClick={maximizePositions}
                            className="text-[10px] font-black text-slate-400 hover:text-white flex items-center gap-2"
                          >
                            <Maximize className="w-3 h-3" />
                            铺满全屏
                          </button>
                          <div className="w-px h-4 bg-slate-800" />
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() =>
                                setCanvasZoom((prev) => Math.max(10, prev - 5))
                              }
                              className="w-7 h-7 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded flex items-center justify-center text-white"
                            >
                              <ZoomOut className="w-3.5 h-3.5" />
                            </button>
                            <div className="bg-slate-800 px-3 py-1 rounded border border-slate-700 min-w-[60px] text-center text-xs font-bold text-white">
                              {canvasZoom}%
                            </div>
                            <button
                              onClick={() =>
                                setCanvasZoom((prev) => Math.min(200, prev + 5))
                              }
                              className="w-7 h-7 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded flex items-center justify-center text-white"
                            >
                              <ZoomIn className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="w-px h-4 bg-slate-800" />
                          <p className="text-[11px] font-mono text-violet-400">
                            分辨率: {canvasConfig.width} × {canvasConfig.height}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Slide 2: 预览视图 */}
                <div className="flex-[0_0_100%] min-h-0 flex flex-col overflow-hidden">
                  <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
                    {!currentTaskMaterials.bVideo ? (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center text-slate-500">
                          <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p className="text-sm">选择视频后显示预览</p>
                        </div>
                      </div>
                    ) : isGeneratingPreview ? (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                          <Loader2 className="w-8 h-8 mx-auto mb-3 text-violet-400 animate-spin" />
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
                        <p className="text-xs text-slate-500 mb-2">
                          {currentTaskMaterials.coverImage && currentTaskMaterials.aVideo 
                            ? '封面 + A前5秒 + A后5秒 + B前5秒'
                            : currentTaskMaterials.aVideo 
                              ? 'A后5秒 + B前5秒'
                              : 'B前5秒'}
                        </p>
                        <div
                          className="bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800"
                          style={orientation === 'horizontal'
                            ? { width: '640px', maxHeight: '100%', aspectRatio: '16/9' }
                            : { height: '480px', maxWidth: '100%', aspectRatio: '9/16' }
                          }
                        >
                          <VideoPlayer
                            key={`${orientation}-${previewPath}`}
                            src={`preview://${encodeURIComponent(previewPath)}`}
                            loop
                            muted={muted}
                            paused={!isPlaying}
                            themeColor="violet"
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
            </div>
          </div>
        </div>

        <div className="w-80 border-l border-slate-800 bg-black flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            <div className="bg-black/50 border border-slate-800 rounded-xl p-4 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Settings className="w-3.5 h-3.5" />
                设置
              </h3>

              <OutputDirSelector
                value={outputDir}
                onChange={setOutputDir}
                disabled={isProcessing}
                themeColor={primaryColor}
              />

              <ConcurrencySelector
                value={concurrency}
                onChange={setConcurrency}
                disabled={isProcessing}
                themeColor={primaryColor}
                compact
              />
            </div>

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
              themeColor={primaryColor}
            />
          </div>

          <div className="p-4 border-t border-slate-800 bg-black/50">
            <Button
              onClick={startProcessing}
              disabled={tasks.length === 0 || isProcessing || !outputDir}
              variant="primary"
              size="md"
              fullWidth
              loading={isProcessing}
              leftIcon={!isProcessing && <Play className="w-4 h-4" />}
            >
              {isProcessing ? "处理中..." : "开始处理"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default VideoMergeMode;
