import React, { useState, useCallback, useEffect, useRef } from "react";
import { Grid3X3, Settings, FolderOpen } from "lucide-react";
import PageHeader from "../components/PageHeader";
import OutputDirSelector from "../components/OutputDirSelector";
import ConcurrencySelector from "../components/ConcurrencySelector";
import OperationLogPanel from "../components/OperationLogPanel";
import { FileSelector, FileSelectorGroup } from "../components/FileSelector";
import { Button } from "../components/Button/Button";
import TaskList, { type Task, type OutputConfig } from "../components/TaskList";
import { useOutputDirCache } from "../hooks/useOutputDirCache";
import { useConcurrencyCache } from "../hooks/useConcurrencyCache";
import { useOperationLogs } from "../hooks/useOperationLogs";
import { useImageProcessingEvents } from "../hooks/useImageProcessingEvents";
import { useImageMaterials } from "../hooks/useImageMaterials";
import { GridPreview } from "./LosslessGridMode/components";

const LosslessGridMode: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [previewSize, setPreviewSize] = useState(400);

  const containerRef = useRef<HTMLDivElement>(null);

  const { outputDir, setOutputDir } = useOutputDirCache("LosslessGridMode");
  const { concurrency, setConcurrency } =
    useConcurrencyCache("LosslessGridMode");

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
    moduleNameCN: "专业无损九宫格",
    moduleNameEN: "LosslessGrid",
  });

  useImageProcessingEvents({
    onStart: (data) => {
      addLog(`开始处理: 总任务 ${data.total}, 模式: ${data.mode}`, "info");
    },
    onTaskStart: (data) => {
      addLog(`开始处理第 ${data.index + 1} 个任务`, "info");
      setTasks((prev) =>
        prev.map((t, idx) =>
          idx === data.index ? { ...t, status: "processing" as const } : t,
        ),
      );
    },
    onTaskFinish: (data) => {
      addLog(`第 ${data.index + 1} 个任务完成`, "success");
      setTasks((prev) =>
        prev.map((t, idx) =>
          idx === data.index ? { ...t, status: "completed" as const } : t,
        ),
      );
    },
    onProgress: (data) => {
      addLog(`进度: ${data.done}/${data.total} (失败 ${data.failed})`, "info");
    },
    onFailed: (data) => {
      addLog(`处理失败: ${data.current} - ${data.error}`, "error");
      const failedIndex = tasks.findIndex(
        (t) => t.files?.[0]?.path === data.current,
      );
      if (failedIndex >= 0) {
        setTasks((prev) =>
          prev.map((t, idx) =>
            idx === failedIndex ? { ...t, status: "error" as const } : t,
          ),
        );
      }
    },
    onFinish: (data) => {
      addLog(`完成! 成功 ${data.done}, 失败 ${data.failed}`, "success");
      setIsProcessing(false);
    },
  });

  useEffect(() => {
    const calculatePreviewSize = () => {
      if (!containerRef.current) return;
      const container = containerRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const padding = 32;
      const infoHeight = 28;
      const availableWidth = containerWidth - padding * 2;
      const availableHeight = containerHeight - padding * 2 - infoHeight;
      const maxSize = Math.min(availableWidth, availableHeight);
      const size = Math.max(200, Math.min(800, maxSize));
      setPreviewSize(size);
    };

    const timer = setTimeout(calculatePreviewSize, 100);
    window.addEventListener("resize", calculatePreviewSize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", calculatePreviewSize);
    };
  }, []);

  const handleImagesChange = useCallback(
    async (filePaths: string[]) => {
      if (filePaths.length === 0) return;

      addLog(`正在添加 ${filePaths.length} 张图片...`, "info");

      const newTasks: Task[] = filePaths.map((path, index) => ({
        id: `grid-${Date.now()}-${index}`,
        status: "pending" as const,
        files: [
          {
            path,
            index: index + 1,
            category: "image",
            category_name: "图片",
          },
        ],
        config: {},
        outputDir,
        concurrency,
      }));

      setTasks(newTasks);
      setCurrentIndex(0);
      addLog(`已添加 ${filePaths.length} 张图片`, "info");
    },
    [addLog, outputDir, concurrency],
  );

  const currentTask = tasks[currentIndex];
  const currentImagePath = currentTask?.files?.[0]?.path || "";

  const { materials } = useImageMaterials(
    [currentImagePath],
    !!currentImagePath,
  );
  const currentMaterial = materials[0];

  const imageInfo =
    currentImagePath && currentMaterial
      ? {
          path: currentImagePath,
          name: currentImagePath.split("/").pop() || currentImagePath,
          thumbnailUrl: currentMaterial.thumbnailUrl,
          width: currentMaterial.width,
          height: currentMaterial.height,
        }
      : null;

  const resolution =
    currentMaterial?.width && currentMaterial?.height
      ? `${Math.floor(currentMaterial.width / 3)}×${Math.floor(
          currentMaterial.height / 3,
        )} × 9张`
      : "自动";

  const outputConfig: OutputConfig = {
    resolution,
    format: "png",
    nums: 1,
  };

  const startProcessing = async () => {
    if (tasks.length === 0) {
      addLog("请先添加图片", "warning");
      return;
    }
    if (!outputDir) {
      addLog("请先选择输出目录", "warning");
      return;
    }
    if (isProcessing) return;

    setIsProcessing(true);
    addLog("开始九宫格切割处理...", "info");
    addLog(`图片: ${tasks.length} 张`, "info");
    addLog(`并发数: ${concurrency === 0 ? "自动" : concurrency}`, "info");

    setTasks((prev) => prev.map((t) => ({ ...t, status: "waiting" as const })));

    try {
      await window.api.imageGrid({
        images: tasks.map((t) => t.files?.[0]?.path).filter(Boolean),
        outputDir,
        concurrency: concurrency === 0 ? undefined : concurrency,
      });
    } catch (err: any) {
      addLog(`处理失败: ${err.message || err}`, "error");
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-screen bg-black text-slate-100 flex flex-col">
      <PageHeader
        title="专业无损九宫格"
        icon={Grid3X3}
        iconColor="text-cyan-400"
        description="1:1原图，无损无压缩九宫格切割"
        featureInfo={{
          title: "专业无损九宫格",
          description: "对原图进行无损 3×3 切割，保持原始分辨率和画质。",
          details: [
            "自动进行 3×3 九宫格分割，输出 9 张图片",
            "建议上传 1:1 正方形原图以获得最佳效果",
            "支持批量处理，PNG 格式输出保证最佳画质",
          ],
          themeColor: "cyan",
        }}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r border-slate-800 bg-black flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          <div className="p-4 space-y-4">
            <FileSelectorGroup>
              <FileSelector
                id="losslessGridImages"
                name="图片文件"
                accept="image"
                multiple
                themeColor="cyan"
                directoryCache
                onChange={handleImagesChange}
                disabled={isProcessing}
              />
            </FileSelectorGroup>
          </div>
        </div>

        <div
          ref={containerRef}
          className="flex-1 bg-black flex flex-col overflow-hidden min-w-0"
        >
          <TaskList
            tasks={tasks}
            currentIndex={currentIndex}
            output={outputConfig}
            type="lossless_grid"
            thumbnail_source="image"
            materialsType={["image"]}
            themeColor="cyan"
            onTaskChange={setCurrentIndex}
            isProcessing={isProcessing}
            onLog={(message, type) => addLog(message, type)}
          />

          <GridPreview imageInfo={imageInfo} previewSize={previewSize} />
        </div>

        <div className="w-80 border-l border-slate-800 bg-black flex flex-col shrink-0 overflow-y-hidden">
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
                themeColor="cyan"
              />
              <ConcurrencySelector
                value={concurrency}
                onChange={setConcurrency}
                disabled={isProcessing}
                themeColor="cyan"
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
              themeColor="cyan"
            />
          </div>

          <div className="p-4 border-t border-slate-800 bg-black/50">
            <Button
              onClick={startProcessing}
              disabled={tasks.length === 0 || !outputDir || isProcessing}
              variant="primary"
              size="md"
              fullWidth
              loading={isProcessing}
              leftIcon={!isProcessing && <FolderOpen className="w-4 h-4" />}
              themeColor="cyan"
            >
              {isProcessing ? "处理中..." : "开始处理"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LosslessGridMode;
