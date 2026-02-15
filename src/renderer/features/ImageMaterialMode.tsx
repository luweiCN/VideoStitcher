import React, { useState, useRef, useEffect, useCallback } from "react";
import { FolderOpen, Layers, Settings } from "lucide-react";
import PageHeader from "../components/PageHeader";
import OutputDirSelector from "../components/OutputDirSelector";
import OperationLogPanel from "../components/OperationLogPanel";
import ConcurrencySelector from "../components/ConcurrencySelector";
import { FileSelector, FileSelectorGroup } from "../components/FileSelector";
import { Button } from "../components/Button/Button";
import TaskList, { type Task, type OutputConfig } from "../components/TaskList";
import { useOutputDirCache } from "../hooks/useOutputDirCache";
import { useConcurrencyCache } from "../hooks/useConcurrencyCache";
import { useOperationLogs } from "../hooks/useOperationLogs";
import { useImageProcessingEvents } from "../hooks/useImageProcessingEvents";
import { loadImageAsElement } from "../utils/image";
import {
  LogoControls,
  PreviewModeSelector,
  ExportOptionsPanel,
  CanvasPreview,
  type PreviewSizeMode,
  type ExportOptions,
} from "./ImageMaterialMode/components";

interface ImageMaterialModeProps {
  onBack: () => void;
}

const ImageMaterialMode: React.FC<ImageMaterialModeProps> = ({ onBack }) => {
  const PREVIEW_SIZE = 400;
  const BASE_SIZE = 800;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [logoPath, setLogoPath] = useState<string>("");
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  const [logoPosition, setLogoPosition] = useState({ x: 50, y: 50 });
  const [logoScale, setLogoScale] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewSizeMode, setPreviewSizeMode] = useState<PreviewSizeMode>("cover");
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    single: true,
    grid: true,
  });
  const [selectedImagePaths, setSelectedImagePaths] = useState<string[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [previewImageKey, setPreviewImageKey] = useState(0);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewImageRef = useRef<HTMLImageElement | null>(null);

  const { outputDir, setOutputDir } = useOutputDirCache("ImageMaterialMode");
  const { concurrency, setConcurrency } = useConcurrencyCache("ImageMaterialMode");

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
      const w = logoImage.width * logoScale;
      const h = logoImage.height * logoScale;
      ctx.save();
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.strokeRect(logoPosition.x, logoPosition.y, w, h);
      ctx.drawImage(logoImage, logoPosition.x, logoPosition.y, w, h);
      ctx.restore();
    }
  }, [previewImageRef.current, logoImage, logoPosition, logoScale, exportOptions.grid, previewSizeMode]);

  // 切换任务时重绘
  useEffect(() => {
    drawPreview();
  }, [previewImageKey]);

  useEffect(() => {
    drawPreview();
  }, [logoImage, logoPosition, logoScale, exportOptions, previewSizeMode]);

  useEffect(() => {
    if (selectedImagePaths.length === 0) {
      setTasks([]);
      return;
    }

    const newTasks: Task[] = selectedImagePaths.map((path, index) => {
      const files = [
        {
          path,
          index: index + 1,
          category: 'image',
          category_name: '图片',
        }
      ];

      if (logoPath) {
        files.push({
          path: logoPath,
          index: 1,
          category: 'logo',
          category_name: 'Logo',
        });
      }

      return {
        id: `image-${Date.now()}-${index}`,
        status: 'pending' as const,
        files,
        config: {
          previewSizeMode,
          logoPosition,
          logoScale,
          exportOptions,
        },
        outputDir,
        concurrency,
      };
    });

    setTasks(newTasks);
    setCurrentIndex(0);
  }, [selectedImagePaths, logoPath, previewSizeMode, logoPosition, logoScale, exportOptions, outputDir, concurrency]);

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

  const handleImagesChange = useCallback(async (files: string[]) => {
    setSelectedImagePaths(files);
  }, []);

  const handleLogoChange = useCallback(async (files: string[]) => {
    if (files.length > 0) {
      const file = files[0];
      setLogoPath(file);
      addLog(`已选择 Logo: ${file.split("/").pop()}`, "info");
      const img = await loadImageAsElement(file);
      if (img) {
        setLogoImage(img);
        setLogoPosition({ x: 50, y: 50 });
        setLogoScale(1);
      }
    } else {
      setLogoPath("");
      setLogoImage(null);
    }
  }, [addLog]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!logoImage || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleFactor = BASE_SIZE / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleFactor;
    const mouseY = (e.clientY - rect.top) * scaleFactor;
    const w = logoImage.width * logoScale;
    const h = logoImage.height * logoScale;
    if (mouseX >= logoPosition.x && mouseX <= logoPosition.x + w &&
        mouseY >= logoPosition.y && mouseY <= logoPosition.y + h) {
      setIsDraggingLogo(true);
      setDragOffset({ x: mouseX - logoPosition.x, y: mouseY - logoPosition.y });
    }
  }, [logoImage, logoScale, logoPosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingLogo || !logoImage || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleFactor = BASE_SIZE / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleFactor;
    const mouseY = (e.clientY - rect.top) * scaleFactor;
    setLogoPosition({ x: mouseX - dragOffset.x, y: mouseY - dragOffset.y });
  }, [isDraggingLogo, logoImage, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDraggingLogo(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDraggingLogo(false);
  }, []);

  const outputConfig = useCallback((): OutputConfig => {
    const modes: string[] = [];
    if (exportOptions.single) modes.push("单图 800×800");
    if (exportOptions.grid) modes.push("九宫格切片");
    
    return {
      resolution: modes.join(" + ") || "无",
      format: "jpg",
      nums: modes.length,
    };
  }, [exportOptions])();

  useImageProcessingEvents({
    onStart: (data) => {
      addLog(`开始处理: 总任务 ${data.total}, 模式: ${data.mode}`, "info");
    },
    onTaskStart: (data) => {
      addLog(`开始处理第 ${data.index + 1} 个任务`, "info");
      setTasks((prev) => prev.map((f, idx) => 
        idx === data.index ? { ...f, status: "processing" as const } : f
      ));
    },
    onTaskFinish: (data) => {
      addLog(`第 ${data.index + 1} 个任务完成`, "success");
      setTasks((prev) => prev.map((f, idx) => 
        idx === data.index ? { ...f, status: "completed" as const } : f
      ));
    },
    onProgress: (data) => {
      addLog(`进度: ${data.done}/${data.total} (失败 ${data.failed})`, "info");
    },
    onFailed: (data) => {
      addLog(`处理失败: ${data.current} - ${data.error}`, "error");
      const failedIndex = tasks.findIndex((t) => t.files?.[0]?.path === data.current);
      if (failedIndex >= 0) {
        setTasks((prev) => prev.map((t, idx) => 
          idx === failedIndex ? { ...t, status: "error" as const } : t
        ));
      }
    },
    onFinish: (data) => {
      addLog(`完成! 成功 ${data.done}, 失败 ${data.failed}`, "success");
      setIsProcessing(false);
    },
  });

  const processImages = async () => {
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
    if (isProcessing) return;

    setIsProcessing(true);
    addLog("开始图片素材处理...", "info");
    addLog(`素材: ${tasks.length} 张`, "info");
    addLog(`Logo: ${logoPath ? "已设置" : "无"}`, "info");

    setTasks((prev) => prev.map((img) => ({ ...img, status: "waiting" as const })));

    try {
      await window.api.imageMaterial({
        images: tasks.map((t) => t.files?.[0]?.path).filter(Boolean),
        logoPath: logoPath || undefined,
        outputDir,
        previewSize: previewSizeMode,
        logoPosition,
        logoScale,
        exportOptions,
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
            <FileSelectorGroup>
              <FileSelector
                id="materialImages"
                name="素材图片"
                accept="image"
                multiple
                themeColor="amber"
                onChange={handleImagesChange}
              />
              <FileSelector
                id="logoImage"
                name="Logo 水印 (可选)"
                accept="image"
                themeColor="amber"
                onChange={handleLogoChange}
              />
            </FileSelectorGroup>

            <LogoControls
              logoImage={logoImage}
              logoScale={logoScale}
              onScaleChange={setLogoScale}
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
          <TaskList
            tasks={tasks}
            currentIndex={currentIndex}
            output={outputConfig}
            type="image_material"
            thumbnail_source="image"
            materialsType={['image']}
            themeColor="amber"
            onTaskChange={setCurrentIndex}
            isProcessing={isProcessing}
            onLog={(message, type) => addLog(message, type)}
          />

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
            <div className="bg-black/50 border border-slate-800 rounded-xl p-4 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Settings className="w-3.5 h-3.5" />
                设置
              </h3>
              <OutputDirSelector
                value={outputDir}
                onChange={setOutputDir}
                disabled={isProcessing}
                themeColor="amber"
              />
              <ConcurrencySelector
                value={concurrency}
                onChange={setConcurrency}
                disabled={isProcessing}
                themeColor="amber"
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
              themeColor="amber"
            />
          </div>

          <div className="p-4 border-t border-slate-800 bg-black/50">
            <Button
              onClick={processImages}
              disabled={
                tasks.length === 0 ||
                isProcessing ||
                !outputDir ||
                (!exportOptions.single && !exportOptions.grid)
              }
              variant="primary"
              size="md"
              fullWidth
              loading={isProcessing}
              leftIcon={!isProcessing && <FolderOpen className="w-4 h-4" />}
              themeColor="amber"
            >
              {isProcessing ? "处理中..." : "开始处理"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageMaterialMode;
