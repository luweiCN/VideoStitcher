import React, { useState, useCallback } from "react";
import { Play, Layers, Settings } from "lucide-react";
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
import { QualitySelector, CoverPreview, type ImageFile } from "./CoverFormatMode/components";

interface CoverFormatModeProps {
  onBack: () => void;
}

const CoverFormatMode: React.FC<CoverFormatModeProps> = ({ onBack }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [quality, setQuality] = useState(90);
  const [tasks, setTasks] = useState<Task[]>([]);

  const { outputDir, setOutputDir } = useOutputDirCache("CoverFormatMode");
  const { concurrency, setConcurrency } = useConcurrencyCache("CoverFormatMode");

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
    moduleNameCN: "封面格式转换",
    moduleNameEN: "CoverFormat",
  });

  useImageProcessingEvents({
    onStart: (data) => {
      addLog(`开始处理: 总任务 ${data.total}, 模式: ${data.mode}`, "info");
    },
    onTaskStart: (data) => {
      addLog(`开始处理第 ${data.index + 1} 个任务`, "info");
      setTasks((prev) =>
        prev.map((t, idx) => (idx === data.index ? { ...t, status: "processing" as const } : t)),
      );
    },
    onTaskFinish: (data) => {
      addLog(`第 ${data.index + 1} 个任务完成`, "success");
      setTasks((prev) =>
        prev.map((t, idx) => (idx === data.index ? { ...t, status: "completed" as const } : t)),
      );
    },
    onProgress: (data) => {
      addLog(`进度: ${data.done}/${data.total} (失败 ${data.failed})`, "info");
    },
    onFailed: (data) => {
      addLog(`处理失败: ${data.current} - ${data.error}`, "error");
      const failedIndex = tasks.findIndex((t) => t.files?.[0]?.path === data.current);
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

  const handleImagesChange = useCallback(
    async (filePaths: string[]) => {
      if (filePaths.length === 0) return;

      addLog(`正在添加 ${filePaths.length} 张图片...`, "info");

      const newTasks: Task[] = filePaths.map((path, index) => ({
        id: `cover-${Date.now()}-${index}`,
        status: "pending" as const,
        files: [
          {
            path,
            index: index + 1,
            category: "image",
            category_name: "图片",
          },
        ],
        config: {
          quality,
        },
        outputDir,
        concurrency,
      }));

      setTasks(newTasks);
      setCurrentIndex(0);
    },
    [addLog, outputDir, concurrency, quality],
  );

  const currentTask = tasks[currentIndex];
  const currentImagePath = currentTask?.files?.[0]?.path || "";
  
  const { materials } = useImageMaterials([currentImagePath], !!currentImagePath);
  const currentMaterial = materials[0];
  
  const currentFile: ImageFile | null = currentImagePath
    ? {
        path: currentImagePath,
        name: currentImagePath.split("/").pop() || currentImagePath,
        thumbnailUrl: currentMaterial?.thumbnailUrl,
        width: currentMaterial?.width,
        height: currentMaterial?.height,
        orientation: currentMaterial?.orientation,
        aspectRatio: currentMaterial?.aspectRatio,
      }
    : null;

  const orientation = currentMaterial?.orientation;
  const resolution = orientation === "landscape" 
    ? "1920×1080 (横版)" 
    : orientation === "portrait" 
      ? "1080×1920 (竖版)" 
      : "800×800 (方形)";
  const outputConfig: OutputConfig = {
    resolution,
    format: "jpg",
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
    addLog("开始封面格式转换处理...", "info");
    addLog(`图片: ${tasks.length} 张`, "info");
    addLog(`质量: ${quality}%`, "info");
    addLog(`并发数: ${concurrency === 0 ? "自动" : concurrency}`, "info");

    setTasks((prev) => prev.map((t) => ({ ...t, status: "waiting" as const })));

    try {
      await window.api.imageCoverFormat({
        images: tasks.map((t) => t.files?.[0]?.path).filter(Boolean),
        quality,
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
        onBack={onBack}
        title="封面格式转换"
        icon={Layers}
        iconColor="text-fuchsia-400"
        description="自动检测比例，横版转1920x1080，竖版转1080x1920"
        featureInfo={{
          title: "封面格式转换",
          description: "自动检测图片比例并转换为标准尺寸，支持批量处理。",
          details: [
            "横版图片自动转为 1920×1080",
            "竖版图片自动转为 1080×1920",
            "方形图片自动转为 800×800",
            "支持批量处理，自动添加尺寸后缀到文件名",
            "图片会被拉伸填充目标尺寸，可能导致轻微变形",
          ],
          themeColor: "fuchsia",
        }}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r border-slate-800 bg-black flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          <div className="p-4 space-y-4">
            <FileSelectorGroup>
              <FileSelector
                id="coverFormatImages"
                name="图片文件"
                accept="image"
                multiple
                themeColor="fuchsia"
                directoryCache
                onChange={handleImagesChange}
                disabled={isProcessing}
              />
            </FileSelectorGroup>

            <QualitySelector
              value={quality}
              onChange={setQuality}
              disabled={isProcessing}
              themeColor="fuchsia"
            />
          </div>
        </div>

        <div className="flex-1 bg-black flex flex-col overflow-hidden min-w-0">
          <TaskList
            tasks={tasks}
            currentIndex={currentIndex}
            output={outputConfig}
            type="cover_format"
            thumbnail_source="image"
            materialsType={["image"]}
            themeColor="fuchsia"
            onTaskChange={setCurrentIndex}
            isProcessing={isProcessing}
            onLog={(message, type) => addLog(message, type)}
          />

          <CoverPreview file={currentFile} themeColor="fuchsia" />
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
                themeColor="fuchsia"
              />
              <ConcurrencySelector
                value={concurrency}
                onChange={setConcurrency}
                disabled={isProcessing}
                themeColor="fuchsia"
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
              themeColor="fuchsia"
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
              leftIcon={!isProcessing && <Play className="w-4 h-4" />}
              themeColor="fuchsia"
            >
              {isProcessing ? "处理中..." : "开始处理"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoverFormatMode;
