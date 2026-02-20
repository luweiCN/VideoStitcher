import React, { useState, useCallback, useEffect, useRef } from "react";
import { Grid3X3, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import OutputDirSelector from "../components/OutputDirSelector";
import OperationLogPanel from "../components/OperationLogPanel";
import { FileSelector, FileSelectorGroup } from "../components/FileSelector";
import { Button } from "../components/Button/Button";
import TaskList, { type Task, type OutputConfig } from "../components/TaskList";
import TaskAddedDialog from "../components/TaskAddedDialog";
import TaskCountConfirmDialog from "../components/TaskCountConfirmDialog";
import { useOutputDirCache } from "../hooks/useOutputDirCache";
import { useOperationLogs } from "../hooks/useOperationLogs";
import { useImageMaterials } from "../hooks/useImageMaterials";
import { useTaskContext } from "../contexts/TaskContext";
import { GridPreview } from "./LosslessGridMode/components";

const LosslessGridMode: React.FC = () => {
  const navigate = useNavigate();
  const { batchCreateTasks } = useTaskContext();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCountConfirmDialog, setShowCountConfirmDialog] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [previewSize, setPreviewSize] = useState(400);
  const fileSelectorGroupRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { outputDir, setOutputDir } = useOutputDirCache("LosslessGridMode");

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

  // 计算预览尺寸
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

  // 通过 IPC 生成任务
  const generateTasks = useCallback(async () => {
    if (images.length === 0 || !outputDir) {
      setTasks([]);
      return;
    }

    addLog(`正在生成 ${images.length} 个任务...`, "info");

    const result = await window.api.generateLosslessGridTasks({
      images,
      outputDir,
    });

    if (result.success && result.tasks) {
      setTasks(result.tasks as Task[]);
      setCurrentIndex(0);
      addLog(`已生成 ${result.tasks.length} 个任务`, "success");
    } else {
      addLog("生成任务失败", "error");
    }
  }, [images, outputDir, addLog]);

  // 参数变化时重新生成任务
  useEffect(() => {
    generateTasks();
  }, [generateTasks]);

  const handleImagesChange = useCallback(
    async (filePaths: string[]) => {
      if (filePaths.length === 0) return;
      addLog(`已选择 ${filePaths.length} 张图片`, "info");
      setImages(filePaths);
      setCurrentIndex(0);
    },
    [addLog],
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
    nums: 9,
  };

  // 核心添加逻辑
  const doAddToTaskCenter = async () => {
    setIsAdding(true);
    addLog(`正在添加 ${tasks.length} 个任务到任务中心...`, "info");

    try {
      const tasksWithType = tasks.map((task) => ({
        ...task,
        type: "lossless_grid" as const,
        outputDir,
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

  // 入口函数（含校验和二次确认）
  const addToTaskCenter = async () => {
    if (tasks.length === 0) {
      addLog("请先选择要处理的图片", "warning");
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

  // 清空编辑区域
  const clearEditor = () => {
    fileSelectorGroupRef.current?.clearAll();
    setImages([]);
    setTasks([]);
    setCurrentIndex(0);
    addLog("已清空编辑区域", "info");
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
            <FileSelectorGroup ref={fileSelectorGroupRef}>
              <FileSelector
                id="losslessGridImages"
                name="图片文件"
                accept="image"
                multiple
                themeColor="cyan"
                directoryCache
                onChange={handleImagesChange}
                disabled={isAdding}
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
          />

          <GridPreview imageInfo={imageInfo} previewSize={previewSize} />
        </div>

        <div className="w-80 border-l border-slate-800 bg-black flex flex-col shrink-0 overflow-y-hidden">
          <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            <OutputDirSelector
              value={outputDir}
              onChange={setOutputDir}
              disabled={isAdding}
              themeColor="cyan"
            />

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
              onClick={addToTaskCenter}
              disabled={tasks.length === 0 || !outputDir || isAdding}
              variant="primary"
              size="md"
              fullWidth
              loading={isAdding}
              leftIcon={!isAdding && <Plus className="w-4 h-4" />}
              themeColor="cyan"
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
          navigate("/taskCenter");
        }}
      />

      {/* 任务数量确认弹窗（超过100个时） */}
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

export default LosslessGridMode;
