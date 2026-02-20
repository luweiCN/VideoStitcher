import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FolderOpen, Layers, Plus } from "lucide-react";
import PageHeader from "../components/PageHeader";
import OutputDirSelector from "../components/OutputDirSelector";
import OperationLogPanel from "../components/OperationLogPanel";
import TaskAddedDialog from "../components/TaskAddedDialog";
import TaskCountConfirmDialog from "../components/TaskCountConfirmDialog";
import { FileSelector, FileSelectorGroup, type FileSelectorGroupRef } from "../components/FileSelector";
import { Button } from "../components/Button/Button";
import TaskList, { type Task, type OutputConfig } from "../components/TaskList";
import { useOutputDirCache } from "../hooks/useOutputDirCache";
import { useOperationLogs } from "../hooks/useOperationLogs";
import { useTaskContext } from "../contexts/TaskContext";
import { loadImageAsElement } from "../utils/image";
import {
  LogoControls,
  PreviewModeSelector,
  ExportOptionsPanel,
  CanvasPreview,
  type PreviewSizeMode,
  type ExportOptions,
} from "./ImageMaterialMode/components";

const ImageMaterialMode: React.FC = () => {
  const PREVIEW_SIZE = 400;
  const BASE_SIZE = 800;

  const navigate = useNavigate();
  const fileSelectorGroupRef = useRef<FileSelectorGroupRef>(null);

  // 配置状态
  const { outputDir, setOutputDir } = useOutputDirCache("ImageMaterialMode");
  const [logoPath, setLogoPath] = useState<string>("");
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  // 用于任务生成的值（松开时才更新）
  const [logoPosition, setLogoPosition] = useState({ x: 50, y: 50 });
  const [logoScale, setLogoScale] = useState(1);
  // 用于实时预览的值（拖动时更新）
  const [pendingLogoPosition, setPendingLogoPosition] = useState({ x: 50, y: 50 });
  const [pendingLogoScale, setPendingLogoScale] = useState(1);
  const [previewSizeMode, setPreviewSizeMode] = useState<PreviewSizeMode>("cover");
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    single: true,
    grid: true,
  });

  // 任务中心相关
  const { batchCreateTasks } = useTaskContext();
  const [isAdding, setIsAdding] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCountConfirmDialog, setShowCountConfirmDialog] = useState(false);

  // 任务列表状态
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedImagePaths, setSelectedImagePaths] = useState<string[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);

  // Logo 拖动状态
  const [previewImageKey, setPreviewImageKey] = useState(0);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewImageRef = useRef<HTMLImageElement | null>(null);

  // 日志管理
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
    moduleNameCN: "图片素材",
    moduleNameEN: "ImageMaterial",
  });

  // 输出配置
  const outputConfig = useMemo((): OutputConfig => {
    const modes: string[] = [];
    if (exportOptions.single) modes.push("单图 800×800");
    if (exportOptions.grid) modes.push("九宫格切片");

    return {
      resolution: modes.join(" + ") || "无",
      format: "jpg",
      nums: modes.length,
    };
  }, [exportOptions]);

  // 绘制预览
  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, BASE_SIZE, BASE_SIZE);

    if (previewImageRef.current) {
      const img = previewImageRef.current;
      if (previewSizeMode === "fill") {
        ctx.drawImage(img, 0, 0, BASE_SIZE, BASE_SIZE);
      } else if (previewSizeMode === "cover") {
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, BASE_SIZE, BASE_SIZE);
      } else {
        const scale = Math.min(BASE_SIZE / img.width, BASE_SIZE / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (BASE_SIZE - w) / 2;
        const y = (BASE_SIZE - h) / 2;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, BASE_SIZE, BASE_SIZE);
        ctx.drawImage(img, x, y, w, h);
      }
    } else {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, BASE_SIZE, BASE_SIZE);
      ctx.strokeStyle = "#1e293b";
      ctx.strokeRect(0, 0, BASE_SIZE, BASE_SIZE);
    }

    if (exportOptions.grid) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(BASE_SIZE / 3, 0);
      ctx.lineTo(BASE_SIZE / 3, BASE_SIZE);
      ctx.moveTo((BASE_SIZE * 2) / 3, 0);
      ctx.lineTo((BASE_SIZE * 2) / 3, BASE_SIZE);
      ctx.moveTo(0, BASE_SIZE / 3);
      ctx.lineTo(BASE_SIZE, BASE_SIZE / 3);
      ctx.moveTo(0, (BASE_SIZE * 2) / 3);
      ctx.lineTo(BASE_SIZE, (BASE_SIZE * 2) / 3);
      ctx.stroke();
    }

    if (logoImage) {
      const w = logoImage.width * pendingLogoScale;
      const h = logoImage.height * pendingLogoScale;
      ctx.save();
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.strokeRect(pendingLogoPosition.x, pendingLogoPosition.y, w, h);
      ctx.drawImage(logoImage, pendingLogoPosition.x, pendingLogoPosition.y, w, h);
      ctx.restore();
    }
  }, [logoImage, pendingLogoPosition, pendingLogoScale, exportOptions.grid, previewSizeMode]);

  // 切换任务时重绘
  useEffect(() => {
    drawPreview();
  }, [previewImageKey]);

  useEffect(() => {
    drawPreview();
  }, [logoImage, pendingLogoPosition, pendingLogoScale, exportOptions, previewSizeMode]);

  /**
   * 生成任务列表（通过 IPC 调用主进程）
   */
  const generateTasks = useCallback(async () => {
    if (selectedImagePaths.length === 0) {
      setTasks([]);
      return;
    }

    setIsGeneratingTasks(true);

    await new Promise(resolve => setTimeout(resolve, 0));

    const result = await window.api.generateImageMaterialTasks({
      images: selectedImagePaths,
      logoPath: logoPath || undefined,
      previewSizeMode,
      logoPosition,
      logoScale,
      exportOptions,
      outputDir,
    });

    if (result.success && result.tasks) {
      await new Promise(resolve => setTimeout(resolve, 0));
      setTasks(result.tasks as Task[]);
      setCurrentIndex(0);
    } else {
      setTasks([]);
    }

    setIsGeneratingTasks(false);
  }, [selectedImagePaths, logoPath, previewSizeMode, logoPosition, logoScale, exportOptions, outputDir]);

  // 当参数变化时重新生成任务
  useEffect(() => {
    generateTasks();
  }, [selectedImagePaths.length, logoPath, previewSizeMode, logoPosition, logoScale, exportOptions.single, exportOptions.grid, outputDir]);

  // 加载当前任务的预览图
  useEffect(() => {
    if (tasks.length > 0 && currentIndex >= 0 && currentIndex < tasks.length) {
      const task = tasks[currentIndex];
      const filePath = task.files?.[0]?.path;
      if (filePath) {
        requestAnimationFrame(async () => {
          try {
            const img = await loadImageAsElement(filePath);
            if (img) {
              previewImageRef.current = img;
              setPreviewImageKey(k => k + 1);
            }
          } catch (err) {
            addLog(`加载预览失败: ${err}`, "error");
          }
        });
      }
    } else {
      previewImageRef.current = null;
    }
  }, [currentIndex, tasks.length]);

  /**
   * 处理图片选择
   */
  const handleImagesChange = useCallback(async (files: string[]) => {
    setSelectedImagePaths(files);
    if (files.length > 0) {
      addLog(`已选择 ${files.length} 张图片`, "info");
    }
  }, [addLog]);

  /**
   * 处理 Logo 选择
   */
  const handleLogoChange = useCallback(async (files: string[]) => {
    if (files.length > 0) {
      const file = files[0];
      setLogoPath(file);
      addLog(`已选择 Logo: ${file.split("/").pop()}`, "info");
      const img = await loadImageAsElement(file);
      if (img) {
        setLogoImage(img);
        // 同步更新位置和缩放
        setLogoPosition({ x: 50, y: 50 });
        setPendingLogoPosition({ x: 50, y: 50 });
        setLogoScale(1);
        setPendingLogoScale(1);
      }
    } else {
      setLogoPath("");
      setLogoImage(null);
    }
  }, [addLog]);

  // Logo 拖动处理
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!logoImage || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleFactor = BASE_SIZE / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleFactor;
    const mouseY = (e.clientY - rect.top) * scaleFactor;
    const w = logoImage.width * pendingLogoScale;
    const h = logoImage.height * pendingLogoScale;
    if (mouseX >= pendingLogoPosition.x && mouseX <= pendingLogoPosition.x + w &&
        mouseY >= pendingLogoPosition.y && mouseY <= pendingLogoPosition.y + h) {
      setIsDraggingLogo(true);
      setDragOffset({ x: mouseX - pendingLogoPosition.x, y: mouseY - pendingLogoPosition.y });
    }
  }, [logoImage, pendingLogoScale, pendingLogoPosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingLogo || !logoImage || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleFactor = BASE_SIZE / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleFactor;
    const mouseY = (e.clientY - rect.top) * scaleFactor;
    // 只更新预览位置，不触发任务生成
    setPendingLogoPosition({ x: mouseX - dragOffset.x, y: mouseY - dragOffset.y });
  }, [isDraggingLogo, logoImage, dragOffset]);

  const handleMouseUp = useCallback(() => {
    if (isDraggingLogo) {
      // 松开时提交位置，触发任务生成
      setLogoPosition(pendingLogoPosition);
    }
    setIsDraggingLogo(false);
  }, [isDraggingLogo, pendingLogoPosition]);

  const handleMouseLeave = useCallback(() => {
    if (isDraggingLogo) {
      // 离开时也提交位置
      setLogoPosition(pendingLogoPosition);
    }
    setIsDraggingLogo(false);
  }, [isDraggingLogo, pendingLogoPosition]);

  /**
   * 核心添加逻辑
   */
  const doAddToTaskCenter = async () => {
    setIsAdding(true);
    addLog(`正在添加 ${tasks.length} 个任务到任务中心...`, "info");

    try {
      const tasksWithType = tasks.map((task) => ({
        ...task,
        type: 'image_material' as const,
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
      addLog("请先选择素材图片", "warning");
      return;
    }
    if (!outputDir) {
      addLog("请先选择输出目录", "warning");
      return;
    }
    if (!exportOptions.single && !exportOptions.grid) {
      addLog("请至少选择一种导出模式（单图或九宫格）", "warning");
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
    setSelectedImagePaths([]);
    setLogoPath("");
    setLogoImage(null);
    setTasks([]);
    setCurrentIndex(0);
    addLog("已清空编辑区域", "info");
  };

  return (
    <div className="h-screen bg-black text-slate-100 flex flex-col">
      <PageHeader
        title="图片素材处理"
        icon={Layers}
        iconColor="text-amber-400"
        description="批量加Logo，导出九宫格切片和预览图"
        featureInfo={{
          title: "图片素材处理",
          description: "批量为图片添加 Logo 水印，支持导出九宫格切片和预览图。",
          details: [
            "支持批量上传图片，自动添加 Logo 水印",
            "Logo 可拖动调整位置，支持缩放大小",
            "三种预览模式：裁剪正方形、拉伸填充、保持比例",
            "导出选项：单张完整图（800×800）、九宫格切片（9张）",
            "实时预览效果，所见即所得",
          ],
          themeColor: "amber",
        }}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="w-96 border-r border-slate-800 bg-black flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          <div className="p-4 space-y-4">
            <FileSelectorGroup ref={fileSelectorGroupRef}>
              <FileSelector
                id="materialImages"
                name="素材图片"
                accept="image"
                multiple
                themeColor="amber"
                onChange={handleImagesChange}
                disabled={isAdding}
              />
              <FileSelector
                id="logoImage"
                name="Logo 水印 (可选)"
                accept="image"
                themeColor="amber"
                onChange={handleLogoChange}
                disabled={isAdding}
              />
            </FileSelectorGroup>

            <LogoControls
              logoImage={logoImage}
              logoScale={pendingLogoScale}
              onScaleChange={setPendingLogoScale}
              onScaleCommit={setLogoScale}
            />

            <PreviewModeSelector
              value={previewSizeMode}
              onChange={setPreviewSizeMode}
            />

            <ExportOptionsPanel
              value={exportOptions}
              onChange={setExportOptions}
            />
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {isGeneratingTasks ? (
            <div className="h-[164px] flex items-center justify-center border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-slate-400 text-sm">正在生成任务...</span>
              </div>
            </div>
          ) : (
            <TaskList
              tasks={tasks}
              currentIndex={currentIndex}
              output={outputConfig}
              type="image_material"
              thumbnail_source="image"
              materialsType={['image']}
              themeColor="amber"
              onTaskChange={setCurrentIndex}
            />
          )}

          <div className="flex-1 flex flex-col flex-shrink-0 border-t border-slate-800 bg-black p-4 min-h-0">
            <CanvasPreview
              canvasRef={canvasRef}
              previewSize={PREVIEW_SIZE}
              baseSize={BASE_SIZE}
              hasLogo={!!logoImage}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
            />
            {tasks.length > 0 && (
              <div className="text-center mt-3 text-xs text-slate-500">
                {exportOptions.grid && <span className="mr-3">九宫格切片导出</span>}
                {exportOptions.single && <span>800x800 完整图</span>}
              </div>
            )}
          </div>
        </div>

        <div className="w-80 border-l border-slate-800 bg-black flex flex-col shrink-0 overflow-y-hidden">
          <div className="flex flex-col flex-1 overflow-y-auto p-4 space-y-4">
            {/* 输出目录 */}
            <OutputDirSelector
              value={outputDir}
              onChange={setOutputDir}
              disabled={isAdding}
              themeColor="amber"
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
                themeColor="amber"
              />
            </div>

            {/* Add to Task Center Button */}
            <Button
              onClick={addToTaskCenter}
              disabled={
                tasks.length === 0 ||
                isAdding ||
                !outputDir ||
                (!exportOptions.single && !exportOptions.grid)
              }
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

export default ImageMaterialMode;
