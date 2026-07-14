import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, Plus, Trash2 } from "lucide-react";
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
import { usePageTheme } from "../hooks/usePageTheme";
import { useHomeSkin } from "../hooks/useHomeSkin";
import PageThemeToggle from "../components/PageThemeToggle";
import { loadImageAsElement } from "../utils/image";
import ImageWorkshopModeSwitcher from "./ImageWorkshopModeSwitcher";
import {
  LogoControls,
  PreviewModeSelector,
  ExportOptionsPanel,
  CanvasPreview,
  type PreviewSizeMode,
  type ExportOptions,
} from "./ImageMaterialMode/components";

type LogoResizeCorner = "nw" | "ne" | "sw" | "se";

interface LogoPreviewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LogoResizeHandle {
  corner: LogoResizeCorner;
  x: number;
  y: number;
  cursor: "nwse-resize" | "nesw-resize";
}

interface LogoResizeState {
  corner: LogoResizeCorner;
  anchor: { x: number; y: number };
  startVector: { x: number; y: number };
  startScale: number;
}

const LOGO_MIN_SCALE = 0.1;
const LOGO_MAX_SCALE = 3;
const LOGO_RESIZE_HANDLE_SIZE = 7;
const LOGO_RESIZE_HANDLE_HIT_RADIUS = 12;

/**
 * 获取 Logo 四角的缩放拖点
 */
function getLogoResizeHandles(rect: LogoPreviewRect): LogoResizeHandle[] {
  return [
    { corner: "nw", x: rect.x, y: rect.y, cursor: "nwse-resize" },
    { corner: "ne", x: rect.x + rect.width, y: rect.y, cursor: "nesw-resize" },
    { corner: "sw", x: rect.x, y: rect.y + rect.height, cursor: "nesw-resize" },
    { corner: "se", x: rect.x + rect.width, y: rect.y + rect.height, cursor: "nwse-resize" },
  ];
}

/**
 * 获取缩放拖点对应的固定对角
 */
function getResizeAnchor(rect: LogoPreviewRect, corner: LogoResizeCorner): { x: number; y: number } {
  const anchors: Record<LogoResizeCorner, { x: number; y: number }> = {
    nw: { x: rect.x + rect.width, y: rect.y + rect.height },
    ne: { x: rect.x, y: rect.y + rect.height },
    sw: { x: rect.x + rect.width, y: rect.y },
    se: { x: rect.x, y: rect.y },
  };
  return anchors[corner];
}

const ImageMaterialMode: React.FC = () => {
  const PREVIEW_SIZE = 1200;
  const BASE_SIZE = 800;

  const navigate = useNavigate();
  const fileSelectorGroupRef = useRef<FileSelectorGroupRef>(null);
  const metalRootRef = useRef<HTMLDivElement>(null);
  const { isLightTheme, togglePageTheme } = usePageTheme();
  const { isMetalSkin, workspaceSkinClassName } = useHomeSkin();

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
  const taskGenerationRequestRef = useRef(0);
  const previewLoadRequestRef = useRef(0);

  // Logo 拖动状态
  const [previewImageKey, setPreviewImageKey] = useState(0);
  const [previewCanvasSize, setPreviewCanvasSize] = useState({
    width: BASE_SIZE,
    height: BASE_SIZE,
    isSquare: true,
  });
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [logoResizeState, setLogoResizeState] = useState<LogoResizeState | null>(null);
  const [canvasCursor, setCanvasCursor] = useState("default");
  const [isLogoHovered, setIsLogoHovered] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewImageRef = useRef<HTMLImageElement | null>(null);
  const taskSettingsRef = useRef({
    previewSizeMode,
    logoPosition,
    logoScale,
    exportOptions,
    outputDir,
  });
  taskSettingsRef.current = {
    previewSizeMode,
    logoPosition,
    logoScale,
    exportOptions,
    outputDir,
  };

  /**
   * 计算 Logo 在当前预览画布中的实际位置和尺寸
   */
  const getLogoPreviewRect = useCallback((
    position: { x: number; y: number },
    scale: number,
  ) => {
    if (!logoImage) return null;

    // 100% 直接对应 Logo 原始尺寸
    const width = logoImage.width * scale;
    const height = logoImage.height * scale;
    const isDefaultPosition = position.x === 50 && position.y === 50;
    const x = isDefaultPosition
      ? previewCanvasSize.width - width
      : position.x;
    const y = isDefaultPosition
      ? previewCanvasSize.height - height
      : position.y;

    return { x, y, width, height };
  }, [logoImage, previewCanvasSize]);

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
    if (exportOptions.single) modes.push("正方图 800×800");
    if (exportOptions.grid) modes.push("正方图九宫格");
    modes.push("横竖图原比例 Logo 图");

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

    const canvasWidth = previewCanvasSize.width;
    const canvasHeight = previewCanvasSize.height;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (previewImageRef.current) {
      const img = previewImageRef.current;
      if (!previewCanvasSize.isSquare) {
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
      } else if (previewSizeMode === "fill") {
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

    if (exportOptions.grid && previewCanvasSize.isSquare) {
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
      const logoRect = getLogoPreviewRect(pendingLogoPosition, pendingLogoScale);
      if (!logoRect) return;
      ctx.drawImage(logoImage, logoRect.x, logoRect.y, logoRect.width, logoRect.height);

      if (isLogoHovered || isDraggingLogo || logoResizeState) {
        // 悬停编辑态：使用轻量选框和小型方形拖点
        ctx.save();
        ctx.strokeStyle = "rgba(255, 56, 92, 0.9)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(logoRect.x, logoRect.y, logoRect.width, logoRect.height);

        for (const handle of getLogoResizeHandles(logoRect)) {
          const halfSize = LOGO_RESIZE_HANDLE_SIZE / 2;
          ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
          ctx.fillRect(
            handle.x - halfSize,
            handle.y - halfSize,
            LOGO_RESIZE_HANDLE_SIZE,
            LOGO_RESIZE_HANDLE_SIZE,
          );
          ctx.strokeStyle = "#FF385C";
          ctx.lineWidth = 1.25;
          ctx.strokeRect(
            handle.x - halfSize,
            handle.y - halfSize,
            LOGO_RESIZE_HANDLE_SIZE,
            LOGO_RESIZE_HANDLE_SIZE,
          );
        }
        ctx.restore();
      }
    }
  }, [logoImage, pendingLogoPosition, pendingLogoScale, exportOptions.grid, previewSizeMode, previewCanvasSize, getLogoPreviewRect, isLogoHovered, isDraggingLogo, logoResizeState]);

  // 切换任务时重绘
  useEffect(() => {
    drawPreview();
  }, [previewImageKey]);

  useEffect(() => {
    drawPreview();
  }, [logoImage, pendingLogoPosition, pendingLogoScale, exportOptions, previewSizeMode, isLogoHovered, isDraggingLogo, logoResizeState]);

  /**
   * 生成任务列表（通过 IPC 调用主进程）
   */
  const generateTasks = useCallback(async () => {
    const requestId = ++taskGenerationRequestRef.current;
    if (selectedImagePaths.length === 0) {
      setTasks([]);
      setIsGeneratingTasks(false);
      return;
    }

    setIsGeneratingTasks(true);
    const settings = taskSettingsRef.current;

    try {
      const result = await window.api.generateImageMaterialTasks({
        images: selectedImagePaths,
        logoPath: logoPath || undefined,
        ...settings,
      });

      if (requestId !== taskGenerationRequestRef.current) return;

      if (result.success && result.tasks) {
        const latestSettings = taskSettingsRef.current;
        const generatedTasks = (result.tasks as Task[]).map((task) => ({
          ...task,
          config: {
            ...task.config,
            previewSizeMode: latestSettings.previewSizeMode,
            logoPosition: latestSettings.logoPosition,
            logoScale: latestSettings.logoScale,
            exportOptions: latestSettings.exportOptions,
          },
          outputDir: latestSettings.outputDir,
        }));
        setTasks(generatedTasks);
        setCurrentIndex(0);
      } else {
        setTasks([]);
      }
    } catch (err) {
      if (requestId === taskGenerationRequestRef.current) {
        setTasks([]);
        addLog(`生成任务失败: ${err}`, "error");
      }
    } finally {
      if (requestId === taskGenerationRequestRef.current) {
        setIsGeneratingTasks(false);
      }
    }
  }, [selectedImagePaths, logoPath, addLog]);

  // 只有素材文件发生变化时才重新生成任务结构
  useEffect(() => {
    generateTasks();
  }, [generateTasks]);

  // Logo 位置、大小等纯配置直接同步到现有任务，避免拖动后重建任务列表造成画面抖动
  useEffect(() => {
    setTasks((currentTasks) => currentTasks.map((task) => ({
      ...task,
      config: {
        ...task.config,
        previewSizeMode,
        logoPosition,
        logoScale,
        exportOptions,
      },
      outputDir,
    })));
  }, [previewSizeMode, logoPosition, logoScale, exportOptions, outputDir]);

  const currentPreviewPath = tasks[currentIndex]?.files?.[0]?.path;

  // 加载当前任务的预览图
  useEffect(() => {
    const requestId = ++previewLoadRequestRef.current;

    if (!currentPreviewPath) {
      previewImageRef.current = null;
      setPreviewCanvasSize({ width: BASE_SIZE, height: BASE_SIZE, isSquare: true });
      setPreviewImageKey((key) => key + 1);
      return;
    }

    requestAnimationFrame(async () => {
      try {
        const img = await loadImageAsElement(currentPreviewPath);
        if (img && requestId === previewLoadRequestRef.current) {
          previewImageRef.current = img;
          const longestSide = Math.max(img.naturalWidth, img.naturalHeight);
          const previewScale = BASE_SIZE / longestSide;
          setPreviewCanvasSize({
            width: Math.max(1, Math.round(img.naturalWidth * previewScale)),
            height: Math.max(1, Math.round(img.naturalHeight * previewScale)),
            isSquare: img.naturalWidth === img.naturalHeight,
          });
          setPreviewImageKey((key) => key + 1);
        }
      } catch (err) {
        if (requestId === previewLoadRequestRef.current) {
          addLog(`加载预览失败: ${err}`, "error");
        }
      }
    });
  }, [currentPreviewPath, addLog]);

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

  /**
   * 将指针坐标换算到 800 基准画布坐标系
   */
  const getCanvasPointerPosition = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  /**
   * 查找指针命中的 Logo 缩放拖点
   */
  const findResizeHandle = useCallback((
    pointer: { x: number; y: number },
    logoRect: LogoPreviewRect,
  ) => getLogoResizeHandles(logoRect).find((handle) => (
    Math.hypot(pointer.x - handle.x, pointer.y - handle.y) <= LOGO_RESIZE_HANDLE_HIT_RADIUS
  )), []);

  // Logo 移动与缩放处理
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!logoImage || !canvasRef.current) return;
    const pointer = getCanvasPointerPosition(e);
    const logoRect = getLogoPreviewRect(pendingLogoPosition, pendingLogoScale);
    if (!pointer || !logoRect) return;

    const resizeHandle = findResizeHandle(pointer, logoRect);
    if (resizeHandle) {
      const anchor = getResizeAnchor(logoRect, resizeHandle.corner);
      e.currentTarget.setPointerCapture(e.pointerId);
      setLogoResizeState({
        corner: resizeHandle.corner,
        anchor,
        startVector: {
          x: resizeHandle.x - anchor.x,
          y: resizeHandle.y - anchor.y,
        },
        startScale: pendingLogoScale,
      });
      setIsDraggingLogo(false);
      setIsLogoHovered(true);
      setCanvasCursor(resizeHandle.cursor);
      return;
    }

    if (pointer.x >= logoRect.x && pointer.x <= logoRect.x + logoRect.width &&
        pointer.y >= logoRect.y && pointer.y <= logoRect.y + logoRect.height) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDraggingLogo(true);
      setIsLogoHovered(true);
      setDragOffset({ x: pointer.x - logoRect.x, y: pointer.y - logoRect.y });
      setCanvasCursor("move");
    }
  }, [logoImage, pendingLogoScale, pendingLogoPosition, getCanvasPointerPosition, getLogoPreviewRect, findResizeHandle]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!logoImage || !canvasRef.current) return;
    const pointer = getCanvasPointerPosition(e);
    const logoRect = getLogoPreviewRect(pendingLogoPosition, pendingLogoScale);
    if (!pointer || !logoRect) return;

    if (logoResizeState) {
      setIsLogoHovered(true);
      const currentVector = {
        x: pointer.x - logoResizeState.anchor.x,
        y: pointer.y - logoResizeState.anchor.y,
      };
      const startLengthSquared =
        logoResizeState.startVector.x ** 2 + logoResizeState.startVector.y ** 2;
      const scaleRatio = startLengthSquared > 0
        ? (
            currentVector.x * logoResizeState.startVector.x +
            currentVector.y * logoResizeState.startVector.y
          ) / startLengthSquared
        : 1;
      const nextScale = Math.min(
        LOGO_MAX_SCALE,
        Math.max(LOGO_MIN_SCALE, logoResizeState.startScale * scaleRatio),
      );
      const nextWidth = logoImage.width * nextScale;
      const nextHeight = logoImage.height * nextScale;
      let nextX = logoResizeState.anchor.x;
      let nextY = logoResizeState.anchor.y;

      if (logoResizeState.corner === "nw" || logoResizeState.corner === "sw") {
        nextX -= nextWidth;
      }
      if (logoResizeState.corner === "nw" || logoResizeState.corner === "ne") {
        nextY -= nextHeight;
      }

      setPendingLogoPosition({ x: nextX, y: nextY });
      setPendingLogoScale(nextScale);
      return;
    }

    if (isDraggingLogo) {
      setIsLogoHovered(true);
      // 只更新预览位置，不触发任务生成
      setPendingLogoPosition({
        x: pointer.x - dragOffset.x,
        y: pointer.y - dragOffset.y,
      });
      return;
    }

    const resizeHandle = findResizeHandle(pointer, logoRect);
    if (resizeHandle) {
      setIsLogoHovered(true);
      setCanvasCursor(resizeHandle.cursor);
    } else if (pointer.x >= logoRect.x && pointer.x <= logoRect.x + logoRect.width &&
               pointer.y >= logoRect.y && pointer.y <= logoRect.y + logoRect.height) {
      setIsLogoHovered(true);
      setCanvasCursor("move");
    } else {
      setIsLogoHovered(false);
      setCanvasCursor("default");
    }
  }, [logoImage, logoResizeState, isDraggingLogo, dragOffset, pendingLogoPosition, pendingLogoScale, getCanvasPointerPosition, getLogoPreviewRect, findResizeHandle]);

  const commitLogoInteraction = useCallback(() => {
    if (isDraggingLogo) {
      setLogoPosition(pendingLogoPosition);
    }
    if (logoResizeState) {
      setLogoPosition(pendingLogoPosition);
      setLogoScale(pendingLogoScale);
    }
    setIsDraggingLogo(false);
    setLogoResizeState(null);
    setCanvasCursor(logoImage ? "move" : "default");
  }, [isDraggingLogo, logoResizeState, logoImage, pendingLogoPosition, pendingLogoScale]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    commitLogoInteraction();
  }, [commitLogoInteraction]);

  const handlePointerCancel = useCallback(() => {
    commitLogoInteraction();
  }, [commitLogoInteraction]);

  const handlePointerLeave = useCallback(() => {
    if (!isDraggingLogo && !logoResizeState) {
      setIsLogoHovered(false);
      setCanvasCursor("default");
    }
  }, [isDraggingLogo, logoResizeState]);

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
    // 使仍在执行的任务生成和预览加载结果立即失效
    taskGenerationRequestRef.current += 1;
    previewLoadRequestRef.current += 1;
    fileSelectorGroupRef.current?.clearAll();
    setSelectedImagePaths([]);
    setLogoPath("");
    setLogoImage(null);
    setTasks([]);
    setCurrentIndex(0);
    setIsGeneratingTasks(false);
    previewImageRef.current = null;
    setPreviewCanvasSize({ width: BASE_SIZE, height: BASE_SIZE, isSquare: true });
    setPreviewImageKey((key) => key + 1);
    setLogoPosition({ x: 50, y: 50 });
    setPendingLogoPosition({ x: 50, y: 50 });
    setLogoScale(1);
    setPendingLogoScale(1);
    setIsDraggingLogo(false);
    setLogoResizeState(null);
    setIsLogoHovered(false);
    setCanvasCursor("default");
    addLog("已一键清除全部素材", "info");
  };

  const handleMetalMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const root = metalRootRef.current;
    if (!root) return;

    root.style.setProperty("--metal-glint-x", `${event.clientX}px`);
    root.style.setProperty("--metal-glint-y", `${event.clientY}px`);
  }, []);

  return (
    <div
      ref={metalRootRef}
      onMouseMove={handleMetalMouseMove}
      className={`${workspaceSkinClassName} h-screen flex flex-col overflow-hidden font-sans transition-colors duration-300 ${
      isLightTheme ? "theme-light-page bg-[#F8F8F5] text-[#222222]" : "bg-[#181818] text-[#D1D1D1]"
    }`}
    >
      <PageHeader
        backPath="/"
        title="图片素材工坊 · 标准素材"
        icon={Layers}
        iconColor={isLightTheme ? "text-amber-600" : "text-amber-400"}
        description="方图标准化生产，横竖图原比例批量加 Logo"
        featureInfo={{
          title: "图片素材处理",
          description: "自动识别图片版式：方图按标准素材规则处理，横竖图保留原比例批量添加 Logo。",
          details: [
            "支持批量上传图片，自动添加 Logo 水印",
            "横版、竖版图片自动跳过裁切并保留原始尺寸",
            "Logo 可拖动调整位置，支持缩放大小",
            "正方形素材支持裁剪、拉伸填充、保持比例三种模式",
            "正方形素材可导出 800×800 完整图和九宫格切片",
            "实时预览效果，所见即所得",
          ],
          themeColor: "amber",
        }}
        rightContent={
          <div className="flex items-center gap-2">
            <ImageWorkshopModeSwitcher mode="standard" />
            {!isMetalSkin && <PageThemeToggle isLightTheme={isLightTheme} onToggle={togglePageTheme} />}
          </div>
        }
      />

      <div className="flex-1 flex overflow-hidden gap-2 p-2 min-h-0">
        <div className="metal-panel metal-sidebar w-96 border border-slate-800 rounded-2xl flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
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

            <Button
              onClick={clearEditor}
              disabled={isAdding || (selectedImagePaths.length === 0 && !logoPath)}
              variant="secondary"
              size="sm"
              themeColor="rose"
              fullWidth
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              一键清除所有素材
            </Button>

            <LogoControls
              logoImage={logoImage}
              logoScale={pendingLogoScale}
              onScaleChange={setPendingLogoScale}
              onScaleCommit={setLogoScale}
            />

            <PreviewModeSelector
              value={previewSizeMode}
              onChange={setPreviewSizeMode}
              isBypassed={!previewCanvasSize.isSquare}
            />

            <ExportOptionsPanel
              value={exportOptions}
              onChange={setExportOptions}
            />
          </div>
        </div>

        <div className="metal-panel metal-workspace flex-1 flex flex-col overflow-hidden min-w-0 border border-slate-800 rounded-2xl">
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

          <div className="flex-1 flex flex-col flex-shrink-0 border-t border-slate-800 p-4 min-h-0">
            <CanvasPreview
              canvasRef={canvasRef}
              previewSize={PREVIEW_SIZE}
              baseWidth={previewCanvasSize.width}
              baseHeight={previewCanvasSize.height}
              hasLogo={!!logoImage}
              cursor={canvasCursor}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onPointerLeave={handlePointerLeave}
            />
            {tasks.length > 0 && (
              <div className="text-center mt-3 text-xs text-slate-500">
                {!previewCanvasSize.isSquare ? (
                  <span className="text-amber-400">横竖图：保留原尺寸，仅导出加 Logo 完整图</span>
                ) : (
                  <>
                    {exportOptions.grid && <span className="mr-3">九宫格切片导出</span>}
                    {exportOptions.single && <span>800x800 完整图</span>}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="metal-panel metal-sidebar w-80 border border-slate-800 rounded-2xl flex flex-col shrink-0 overflow-y-hidden">
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
              className="metal-cta-button"
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
