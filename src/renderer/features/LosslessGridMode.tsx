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
  const [previewRect, setPreviewRect] = useState({ width: 400, height: 400 });
  const [horizontalLines, setHorizontalLines] = useState<number[]>([1 / 3, 2 / 3]);
  const [verticalLines, setVerticalLines] = useState<number[]>([1 / 3, 2 / 3]);
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
    moduleNameCN: "专业无损多宫格",
    moduleNameEN: "LosslessMultiGrid",
  });

  const currentImagePath = images[currentIndex] || "";

  const { materials } = useImageMaterials(
    [currentImagePath],
    !!currentImagePath,
  );
  const currentMaterial = materials[0];

  useEffect(() => {
    const calculatePreviewSize = () => {
      if (!containerRef.current) return;
      const container = containerRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const padding = 64; 
      const infoHeight = 40;
      
      const availableWidth = containerWidth - padding;
      const availableHeight = containerHeight - padding - infoHeight;

      if (currentMaterial?.width && currentMaterial?.height) {
        const imgRatio = currentMaterial.width / currentMaterial.height;
        const containerRatio = availableWidth / availableHeight;

        let w, h;
        if (imgRatio > containerRatio) {
          w = availableWidth;
          h = availableWidth / imgRatio;
        } else {
          h = availableHeight;
          w = availableHeight * imgRatio;
        }
        setPreviewRect({ width: Math.max(100, w), height: Math.max(100, h) });
      } else {
        const size = Math.min(availableWidth, availableHeight, 400);
        setPreviewRect({ width: size, height: size });
      }
    };

    const timer = setTimeout(calculatePreviewSize, 100);
    window.addEventListener("resize", calculatePreviewSize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", calculatePreviewSize);
    };
  }, [currentMaterial?.width, currentMaterial?.height]);

  const generateTasks = useCallback(async () => {
    if (images.length === 0 || !outputDir) {
      setTasks([]);
      return;
    }

    const result = await window.api.generateLosslessGridTasks({
      images,
      outputDir,
      config: {
        horizontalLines,
        verticalLines,
      },
    });

    if (result.success && result.tasks) {
      setTasks(result.tasks as Task[]);
    }
  }, [images, outputDir, horizontalLines, verticalLines]);

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

  const imageInfo =
    currentImagePath && currentMaterial
      ? {
          path: currentImagePath,
          name: currentImagePath.split("/").pop() || currentImagePath,
          thumbnailUrl: currentMaterial.previewUrl || currentMaterial.thumbnailUrl,
          width: currentMaterial.width,
          height: currentMaterial.height,
          horizontalLines,
          verticalLines,
        }
      : null;

  const tileCount = (horizontalLines.length + 1) * (verticalLines.length + 1);
  
  const resolution =
    currentMaterial?.width && currentMaterial?.height
      ? `多尺寸 × ${tileCount}张`
      : "自动";

  const outputConfig: OutputConfig = {
    resolution,
    format: "png",
    nums: tileCount,
  };

  // 添加横线并等距排列
  const addHorizontalLine = () => {
    const nextCount = horizontalLines.length + 1;
    const newLines = [];
    for (let i = 1; i <= nextCount; i++) {
      newLines.push(i / (nextCount + 1));
    }
    setHorizontalLines(newLines);
    addLog(`横向切割增加至 ${nextCount + 1} 段`, "info");
  };

  // 减少横线并等距排列
  const removeHorizontalLine = () => {
    if (horizontalLines.length === 0) return;
    const nextCount = horizontalLines.length - 1;
    const newLines = [];
    for (let i = 1; i <= nextCount; i++) {
      newLines.push(i / (nextCount + 1));
    }
    setHorizontalLines(newLines);
    addLog(`横向切割减少至 ${nextCount + 1} 段`, "info");
  };

  // 添加竖线并等距排列
  const addVerticalLine = () => {
    const nextCount = verticalLines.length + 1;
    const newLines = [];
    for (let i = 1; i <= nextCount; i++) {
      newLines.push(i / (nextCount + 1));
    }
    setVerticalLines(newLines);
    addLog(`纵向切割增加至 ${nextCount + 1} 段`, "info");
  };

  // 减少竖线并等距排列
  const removeVerticalLine = () => {
    if (verticalLines.length === 0) return;
    const nextCount = verticalLines.length - 1;
    const newLines = [];
    for (let i = 1; i <= nextCount; i++) {
      newLines.push(i / (nextCount + 1));
    }
    setVerticalLines(newLines);
    addLog(`纵向切割减少至 ${nextCount + 1} 段`, "info");
  };

  const clearLines = () => {
    setHorizontalLines([]);
    setVerticalLines([]);
    addLog("已清空切割线", "info");
  };

  const resetToNineGrid = () => {
    setHorizontalLines([1 / 3, 2 / 3]);
    setVerticalLines([1 / 3, 2 / 3]);
    addLog("已恢复九宫格设置", "info");
  };

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
    } catch (err: any) {
      addLog(`添加任务失败: ${err.message || err}`, "error");
    } finally {
      setIsAdding(false);
    }
  };

  const addToTaskCenter = async () => {
    if (images.length === 0) {
      addLog("请先选择要处理的图片", "warning");
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
        title="专业无损多宫格"
        icon={Grid3X3}
        iconColor="text-cyan-400"
        description="自定义横竖线条，自由裁切图片"
        featureInfo={{
          title: "专业无损多宫格",
          description: "根据自定义线条对原图进行无损切割，支持任意横竖线排列。",
          details: [
            "支持自由添加横向和纵向切割线",
            "自动计算每一块的像素尺寸",
            "不局限于正方形，适配任意比例矩形图片",
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

            <div className="pt-4 border-t border-slate-800 space-y-3">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                切割线控制
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={addHorizontalLine}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    themeColor="cyan"
                  >
                    加横线
                  </Button>
                  <Button
                    onClick={removeHorizontalLine}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    themeColor="cyan"
                    disabled={horizontalLines.length === 0}
                  >
                    减横线
                  </Button>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    onClick={addVerticalLine}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    themeColor="cyan"
                  >
                    加竖线
                  </Button>
                  <Button
                    onClick={removeVerticalLine}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    themeColor="cyan"
                    disabled={verticalLines.length === 0}
                  >
                    减竖线
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={resetToNineGrid}
                  variant="outline"
                  size="sm"
                  className="w-full text-slate-400"
                  themeColor="cyan"
                >
                  恢复九宫格
                </Button>
                <Button
                  onClick={clearLines}
                  variant="outline"
                  size="sm"
                  className="w-full text-red-400 border-red-900/30"
                  themeColor="cyan"
                >
                  清空线段
                </Button>
              </div>
              
              <div className="bg-slate-900/30 rounded p-3 border border-slate-800/50">
                <div className="text-[10px] text-slate-500 mb-1">当前切割</div>
                <div className="text-sm font-bold text-cyan-400">
                  {horizontalLines.length + 1} 行 × {verticalLines.length + 1} 列
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  总计 {tileCount} 张图片
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          ref={containerRef}
          className="flex-1 bg-black flex flex-col overflow-hidden min-w-0"
        >
          <TaskList
            tasks={tasks.length > 0 ? tasks : (images.map((img, i) => ({ id: i, status: 'pending', files: [{ path: img, category: 'image', category_name: '图片' }], config: {}, outputDir: '' })) as any)}
            currentIndex={currentIndex}
            output={outputConfig}
            type="lossless_grid"
            thumbnail_source="image"
            materialsType={["image"]}
            themeColor="cyan"
            onTaskChange={setCurrentIndex}
          />

          <GridPreview 
            imageInfo={imageInfo} 
            previewRect={previewRect} 
            onHorizontalLinesChange={setHorizontalLines}
            onVerticalLinesChange={setVerticalLines}
          />
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
              disabled={images.length === 0 || !outputDir || isAdding}
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
