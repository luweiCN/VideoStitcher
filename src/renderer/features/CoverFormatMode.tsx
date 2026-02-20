import React, { useState, useCallback, useEffect, useRef } from "react";
import { Layers, Plus } from "lucide-react";
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
import { QualitySelector, CoverPreview, type ImageFile } from "./CoverFormatMode/components";

const CoverFormatMode: React.FC = () => {
  const navigate = useNavigate();
  const { batchCreateTasks } = useTaskContext();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCountConfirmDialog, setShowCountConfirmDialog] = useState(false);
  const [quality, setQuality] = useState(90);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const fileSelectorGroupRef = useRef<any>(null);

  const { outputDir, setOutputDir } = useOutputDirCache("CoverFormatMode");

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

  // 通过 IPC 生成任务
  const generateTasks = useCallback(async () => {
    if (images.length === 0 || !outputDir) {
      setTasks([]);
      return;
    }

    addLog(`正在生成 ${images.length} 个任务...`, "info");

    const result = await window.api.generateCoverFormatTasks({
      images,
      quality,
      outputDir,
    });

    if (result.success && result.tasks) {
      setTasks(result.tasks as Task[]);
      setCurrentIndex(0);
      addLog(`已生成 ${result.tasks.length} 个任务`, "success");
    } else {
      addLog("生成任务失败", "error");
    }
  }, [images, quality, outputDir, addLog]);

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
  const resolution =
    orientation === "landscape"
      ? "1920×1080 (横版)"
      : orientation === "portrait"
        ? "1080×1920 (竖版)"
        : "800×800 (方形)";
  const outputConfig: OutputConfig = {
    resolution,
    format: "jpg",
    nums: 1,
  };

  // 核心添加逻辑
  const doAddToTaskCenter = async () => {
    setIsAdding(true);
    addLog(`正在添加 ${tasks.length} 个任务到任务中心...`, "info");

    try {
      const tasksWithType = tasks.map((task) => ({
        ...task,
        type: "cover_format" as const,
        outputDir,
        config: {
          ...task.config,
          quality,
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
            <FileSelectorGroup ref={fileSelectorGroupRef}>
              <FileSelector
                id="coverFormatImages"
                name="图片文件"
                accept="image"
                multiple
                themeColor="fuchsia"
                directoryCache
                onChange={handleImagesChange}
                disabled={isAdding}
              />
            </FileSelectorGroup>

            <QualitySelector
              value={quality}
              onChange={setQuality}
              disabled={isAdding}
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
          />

          <CoverPreview file={currentFile} themeColor="fuchsia" />
        </div>

        <div className="w-80 border-l border-slate-800 bg-black flex flex-col shrink-0 overflow-y-hidden">
          <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            <OutputDirSelector
              value={outputDir}
              onChange={setOutputDir}
              disabled={isAdding}
              themeColor="fuchsia"
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
              themeColor="fuchsia"
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
              themeColor="fuchsia"
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

export default CoverFormatMode;
