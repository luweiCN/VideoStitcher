import React, { useState, useRef, useEffect, MouseEvent, useCallback } from 'react';
import { ArrowLeft, Loader2, Image as ImageIcon, Move, FolderOpen, Layers, Check, Trash2, Settings, Eye } from 'lucide-react';
import * as Slider from '@radix-ui/react-slider';
import * as Checkbox from '@radix-ui/react-checkbox';
import PageHeader from '../components/PageHeader';
import OutputDirSelector from '../components/OutputDirSelector';
import OperationLogPanel from '../components/OperationLogPanel';
import ConcurrencySelector from '../components/ConcurrencySelector';
import { FilePreviewModal } from '../components/FilePreviewModal';
import { FileSelector, FileSelectorGroup, type FileSelectorRef, formatFileSize } from '../components/FileSelector';
import { Button } from '../components/Button/Button';
import { useOutputDirCache } from '../hooks/useOutputDirCache';
import { useConcurrencyCache } from '../hooks/useConcurrencyCache';
import { useOperationLogs } from '../hooks/useOperationLogs';
import { useImageProcessingEvents } from '../hooks/useImageProcessingEvents';

/**
 * 图片文件状态
 */
interface ImageFile {
  id: string;
  path: string;
  name: string;
  status: 'pending' | 'waiting' | 'processing' | 'completed' | 'error';
  previewUrl?: string;      // 预览图片 URL
  originalSize?: number;    // 原始文件大小（字节）
  width?: number;           // 图片宽度
  height?: number;          // 图片高度
  orientation?: string;     // 方向: portrait/landscape/square
}

/**
 * 获取图片信息
 */
const getImageInfo = async (filePath: string): Promise<{ width?: number; height?: number; orientation?: string }> => {
  try {
    const result = await window.api.getImageDimensions(filePath);
    if (result) {
      return {
        width: result.width,
        height: result.height,
        orientation: result.orientation
      };
    }
  } catch (err) {
    console.error('获取图片信息失败:', err);
  }
  return {};
};

/**
 * 获取文件大小
 */
const getFileInfo = async (filePath: string): Promise<number | undefined> => {
  try {
    const result = await window.api.getFileInfo(filePath);
    if (result.success && result.info) {
      return result.info.size;
    }
  } catch (err) {
    console.error('获取文件信息失败:', err);
  }
  return undefined;
};

/**
 * Logo 位置状态 (相对于 800x800 画布)
 */
interface LogoPosition {
  x: number;
  y: number;
}

/**
 * 导出选项
 */
interface ExportOptions {
  single: boolean;  // 导出单张完整图 (800x800)
  grid: boolean;    // 导出九宫格切片 (800x800 x9)
}

/**
 * 预览尺寸模式
 */
type PreviewSizeMode = 'cover' | 'fill' | 'inside';

interface ImageMaterialModeProps {
  onBack: () => void;
}

/**
 * 预览尺寸模式配置
 */
const PREVIEW_SIZE_MODES: Record<PreviewSizeMode, { name: string; desc: string }> = {
  cover: { name: '裁剪正方形', desc: '裁剪为800x800正方形（取中心）' },
  fill: { name: '拉伸填充', desc: '强制拉伸到800x800（可能变形）' },
  inside: { name: '保持比例', desc: '按比例缩放，留白填充' },
};

/**
 * 图片素材处理工具
 * 参考 VideoMaster 项目设计，使用 Sharp 后端处理
 */
const ImageMaterialMode: React.FC<ImageMaterialModeProps> = ({ onBack }) => {
  // 素材图片列表 - 保留原有的 ImageFile 结构以支持状态跟踪
  const [images, setImages] = useState<ImageFile[]>([]);

  // 当前预览索引
  const [currentIndex, setCurrentIndex] = useState(0);

  // Logo 相关状态
  const [logoPath, setLogoPath] = useState<string>('');
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);

  // Logo 位置和缩放 (相对于 800x800 画布)
  const [logoPosition, setLogoPosition] = useState<LogoPosition>({ x: 50, y: 50 });
  const [logoScale, setLogoScale] = useState(1); // 1 = 原始大小

  // 拖动状态
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // 处理状态
  const [isProcessing, setIsProcessing] = useState(false);

  // 并发线程数 - 使用缓存
  const { concurrency, setConcurrency } = useConcurrencyCache('ImageMaterialMode');

  // 导出选项
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    single: true,
    grid: true
  });

  // 预览尺寸模式
  const [previewSizeMode, setPreviewSizeMode] = useState<PreviewSizeMode>('cover');

  // 输出目录
  const { outputDir, setOutputDir } = useOutputDirCache('ImageMaterialMode');

  // 使用日志 Hook
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
    moduleNameCN: '图片素材',
    moduleNameEN: 'ImageMaterial',
  });

  // 常量
  const PREVIEW_SIZE = 400; // 显示大小 (像素)
  const BASE_SIZE = 800;    // 逻辑尺寸 (编辑和单图导出)

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewImageRef = useRef<HTMLImageElement | null>(null);
  const fileSelectorRef = useRef<FileSelectorRef>(null);

  // 预览触发器 - 用于触发重绘
  const [previewTrigger, setPreviewTrigger] = useState(0);

  // 预览弹窗状态
  const [showPreview, setShowPreview] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  /**
   * 加载指定索引的预览图片
   */
  const loadPreviewImage = async (imagePath: string) => {
    try {
      const result = await window.api.getPreviewUrl(imagePath);
      if (!result.success || !result.url) {
        addLog(`获取预览 URL 失败: ${result.error || '未知错误'}`, 'error');
        return;
      }
      const img = new Image();
      img.src = result.url;
      img.onload = () => {
        previewImageRef.current = img;
        // 触发重绘
        setPreviewTrigger(prev => prev + 1);
      };
      img.onerror = () => {
        addLog(`加载图片失败: ${imagePath}`, 'error');
      };
    } catch (err) {
      addLog(`加载预览失败: ${err}`, 'error');
    }
  };

  /**
   * 切换到指定索引的图片预览
   */
  const switchToPreview = (index: number) => {
    if (index < 0 || index >= images.length) return;
    setCurrentIndex(index);
    const imagePath = images[index]?.path;
    if (imagePath) {
      loadPreviewImage(imagePath);
    }
  };

  // 上一张
  const goToPrevious = () => {
    if (currentIndex > 0) {
      switchToPreview(currentIndex - 1);
    }
  };

  // 下一张
  const goToNext = () => {
    if (currentIndex < images.length - 1) {
      switchToPreview(currentIndex + 1);
    }
  };

  /**
   * 打开任务列表预览
   */
  const handleOpenPreview = (index: number) => {
    setPreviewIndex(index);
    setShowPreview(true);
  };

  // 关闭预览
  const handleClosePreview = () => {
    setShowPreview(false);
  };

  // 上一张预览
  const handlePreviousPreview = () => {
    if (previewIndex > 0) {
      setPreviewIndex(previewIndex - 1);
    }
  };

  // 下一张预览
  const handleNextPreview = () => {
    if (previewIndex < images.length - 1) {
      setPreviewIndex(previewIndex + 1);
    }
  };

  /**
   * 处理素材图片选择 - 使用 FileSelector
   */
  const handleImagesChange = useCallback(async (files: string[]) => {
    // 如果是空数组（来自 clearFiles 触发的 onChange），不处理
    if (files.length === 0) {
      return;
    }

    const newImages: ImageFile[] = files.map(path => ({
      id: Math.random().toString(36).substr(2, 9),
      path,
      name: path.split('/').pop() || path,
      status: 'pending' as const,
      previewUrl: undefined
    }));

    // 为新图片加载预览 URL 和图片信息
    const imagesWithInfo = await Promise.all(
      newImages.map(async (img) => {
        try {
          // 并行加载预览 URL、尺寸信息和文件大小
          const [result, info, fileInfo] = await Promise.all([
            window.api.getPreviewUrl(img.path),
            getImageInfo(img.path),
            getFileInfo(img.path)
          ]);
          return {
            ...img,
            previewUrl: result.success && result.url ? result.url : undefined,
            originalSize: fileInfo,
            ...info
          };
        } catch (err) {
          console.error('加载预览失败:', err);
        }
        return img;
      })
    );

    setImages(prev => {
      const updated = [...prev, ...imagesWithInfo];
      // 如果是第一批图片，加载第一张用于 Canvas 预览
      if (prev.length === 0 && files.length > 0) {
        setTimeout(() => {
          loadPreviewImage(files[0]);
        }, 0);
      }
      return updated;
    });

    if (newImages.length > 0) {
      addLog(`已添加 ${newImages.length} 张素材图片`, 'info');
    }

    // 延迟清空 FileSelector 内部列表，避免 onChange 触发死循环
    setTimeout(() => {
      fileSelectorRef.current?.clearFiles();
    }, 0);
  }, [addLog]);

  /**
   * 处理 Logo 选择 - 使用 FileSelector
   */
  const handleLogoChange = useCallback(async (files: string[]) => {
    if (files.length > 0) {
      setLogoPath(files[0]);
      addLog(`已选择 Logo: ${files[0].split('/').pop()}`, 'info');

      // 加载 Logo 图片
      const result = await window.api.getPreviewUrl(files[0]);
      if (result.success && result.url) {
        const img = new Image();
        img.src = result.url;
        img.onload = () => {
          setLogoImage(img);
          // 重置位置和缩放
          setLogoPosition({ x: 50, y: 50 });
          setLogoScale(1);
        };
      }
    } else {
      // 清空 Logo
      clearLogo();
    }
  }, [addLog]);

  /**
   * 清空 Logo
   */
  const clearLogo = () => {
    setLogoPath('');
    setLogoImage(null);
    setLogoPosition({ x: 50, y: 50 });
    setLogoScale(1);
    drawPreview();
  };

  /**
   * 绘制预览画布
   */
  const drawPreview = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.clearRect(0, 0, BASE_SIZE, BASE_SIZE);

    // 绘制背景图片
    if (previewImageRef.current) {
      const img = previewImageRef.current;

      // 根据预览模式绘制图片
      if (previewSizeMode === 'fill') {
        // 拉伸填充 - 直接拉伸到 800x800
        ctx.drawImage(img, 0, 0, BASE_SIZE, BASE_SIZE);
      } else if (previewSizeMode === 'cover') {
        // 裁剪正方形 - 取中心区域
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, BASE_SIZE, BASE_SIZE);
      } else {
        // inside - 保持比例，居中，留白
        const scale = Math.min(BASE_SIZE / img.width, BASE_SIZE / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (BASE_SIZE - w) / 2;
        const y = (BASE_SIZE - h) / 2;

        // 白色背景
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, BASE_SIZE, BASE_SIZE);
        ctx.drawImage(img, x, y, w, h);
      }
    } else {
      // 占位背景
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, BASE_SIZE, BASE_SIZE);
      ctx.strokeStyle = '#1e293b';
      ctx.strokeRect(0, 0, BASE_SIZE, BASE_SIZE);
    }

    // 绘制网格辅助线 (如果启用九宫格导出)
    if (exportOptions.grid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      // 垂直线
      ctx.moveTo(BASE_SIZE / 3, 0);
      ctx.lineTo(BASE_SIZE / 3, BASE_SIZE);
      ctx.moveTo(BASE_SIZE * 2 / 3, 0);
      ctx.lineTo(BASE_SIZE * 2 / 3, BASE_SIZE);
      // 水平线
      ctx.moveTo(0, BASE_SIZE / 3);
      ctx.lineTo(BASE_SIZE, BASE_SIZE / 3);
      ctx.moveTo(0, BASE_SIZE * 2 / 3);
      ctx.lineTo(BASE_SIZE, BASE_SIZE * 2 / 3);
      ctx.stroke();
    }

    // 绘制 Logo
    if (logoImage) {
      const w = logoImage.width * logoScale;
      const h = logoImage.height * logoScale;

      ctx.save();
      // 绘制选中边框
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(logoPosition.x, logoPosition.y, w, h);

      ctx.drawImage(logoImage, logoPosition.x, logoPosition.y, w, h);
      ctx.restore();
    }
  };

  // 依赖变化时重绘
  useEffect(() => {
    drawPreview();
  }, [logoImage, logoPosition, logoScale, exportOptions, previewSizeMode, previewTrigger]);

  // 鼠标拖动处理
  const handleMouseDown = (e: MouseEvent) => {
    if (!logoImage) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleFactor = BASE_SIZE / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleFactor;
    const mouseY = (e.clientY - rect.top) * scaleFactor;

    const w = logoImage.width * logoScale;
    const h = logoImage.height * logoScale;

    if (mouseX >= logoPosition.x && mouseX <= logoPosition.x + w &&
        mouseY >= logoPosition.y && mouseY <= logoPosition.y + h) {
      setIsDragging(true);
      setDragStart({ x: mouseX - logoPosition.x, y: mouseY - logoPosition.y });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !logoImage) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleFactor = BASE_SIZE / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleFactor;
    const mouseY = (e.clientY - rect.top) * scaleFactor;

    setLogoPosition({
      x: mouseX - dragStart.x,
      y: mouseY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 使用图片处理事件 Hook
  useImageProcessingEvents({
    onStart: (data) => {
      addLog(`开始处理: 总任务 ${data.total}, 模式: ${data.mode}`, 'info');
    },
    onTaskStart: (data) => {
      // 记录当前处理第几个任务
      addLog(`开始处理第 ${data.index + 1} 个任务`, 'info');
      // 更新对应任务为处理中状态
      setImages(prev => {
        const fileIndex = data.index;
        let found = false;
        return prev.map((f, idx) => {
          if (idx === fileIndex && !found) {
            found = true;
            return { ...f, status: 'processing' as const };
          }
          return f;
        });
      });
    },
    onTaskFinish: (data) => {
      // 记录第几个任务完成
      addLog(`第 ${data.index + 1} 个任务完成`, 'success');
      // 更新对应任务为完成状态
      setImages(prev => {
        const fileIndex = data.index;
        let found = false;
        return prev.map((f, idx) => {
          if (idx === fileIndex && !found) {
            found = true;
            return { ...f, status: 'completed' as const };
          }
          return f;
        });
      });
    },
    onProgress: (data) => {
      addLog(`进度: ${data.done}/${data.total} (失败 ${data.failed})`, 'info');
    },
    onFailed: (data) => {
      addLog(`❌ 处理失败: ${data.current} - ${data.error}`, 'error');
      // 找到对应的任务并更新为失败状态
      const failedIndex = images.findIndex(img => img.path === data.current);
      if (failedIndex >= 0) {
        setImages(prev => prev.map((img, idx) => {
          if (idx === failedIndex) {
            return { ...img, status: 'error' as const };
          }
          return img;
        }));
      }
    },
    onFinish: (data) => {
      addLog(`✅ 完成! 成功 ${data.done}, 失败 ${data.failed}`, 'success');
      setIsProcessing(false);
    },
  });

  // 开始处理
  const processImages = async () => {
    if (images.length === 0) {
      addLog('⚠️ 请先选择素材图片', 'warning');
      return;
    }
    if (!outputDir) {
      addLog('⚠️ 请先选择输出目录', 'warning');
      return;
    }
    if (!exportOptions.single && !exportOptions.grid) {
      addLog('⚠️ 请至少选择一种导出模式（单图或九宫格）', 'warning');
      return;
    }
    if (isProcessing) return;

    setIsProcessing(true);
    clearLogs();
    addLog('开始图片素材处理...', 'info');
    addLog(`素材: ${images.length} 张`, 'info');
    addLog(`Logo: ${logoPath ? '已设置' : '无'}`, 'info');
    addLog(`预览模式: ${PREVIEW_SIZE_MODES[previewSizeMode].name}`, 'info');
    addLog(`导出选项: ${exportOptions.single ? '单图 ' : ''}${exportOptions.grid ? '九宫格' : ''}`, 'info');

    // 重置所有图片状态为 waiting（等待处理）
    setImages(prev => prev.map(img => ({ ...img, status: 'waiting' as const })));

    try {
      await window.api.imageMaterial({
        images: images.map(img => img.path),
        logoPath: logoPath || undefined,
        outputDir,
        previewSize: previewSizeMode,
        logoPosition,
        logoScale,
        exportOptions,
        concurrency: concurrency === 0 ? undefined : concurrency,
      });
    } catch (err: any) {
      addLog(`❌ 处理失败: ${err.message || err}`, 'error');
      setIsProcessing(false);
    }
  };

  // 当视频列表或模式改变时，重新生成预览
  useEffect(() => {
    if (images.length > 0 && currentIndex < images.length) {
      // 预览会在 switchToPreview 中加载
    } else {
      // 清空预览
      previewImageRef.current = null;
    }
  }, [images, currentIndex]);

  // 清空图片列表
  const clearImages = () => {
    setImages([]);
    setCurrentIndex(0);
    previewImageRef.current = null;
    drawPreview();
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
          title: '图片素材处理',
          description: '批量为图片添加 Logo 水印，支持导出九宫格切片和预览图。',
          details: [
            '支持批量上传图片，自动添加 Logo 水印',
            'Logo 可拖动调整位置，支持缩放大小',
            '三种预览模式：裁剪正方形、拉伸填充、保持比例',
            '导出选项：单张完整图（800×800）、九宫格切片（9张）',
            '实时预览效果，所见即所得',
          ],
          themeColor: 'amber',
        }}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：文件选择 + 基础设置 */}
        <div className="w-96 border-r border-slate-800 bg-black flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          <div className="p-4 space-y-4">
            {/* 文件选择器组 */}
            <FileSelectorGroup>
              {/* 素材图片 */}
              <FileSelector
                ref={fileSelectorRef}
                id="materialImages"
                name="素材图片"
                accept="image"
                multiple
                showList={false}
                themeColor="amber"
                directoryCache
                onChange={handleImagesChange}
              />

              {/* Logo 水印 */}
              <FileSelector
                id="logoImage"
                name="Logo 水印 (可选)"
                accept="image"
                multiple={false}
                showList={false}
                themeColor="amber"
                directoryCache
                onChange={handleLogoChange}
              />
            </FileSelectorGroup>

            {/* Logo 控制 */}
            {logoImage && (
              <div className="bg-black/50 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold uppercase tracking-wider">
                    <Move className="w-3 h-3" /> Logo 调整
                  </div>
                  <span className="text-xs text-amber-400 font-mono">{(logoScale * 100).toFixed(0)}%</span>
                </div>
                {/* Radix UI Slider */}
                <Slider.Root
                  className="relative flex items-center select-none touch-none h-4"
                  value={[logoScale]}
                  onValueChange={([value]) => setLogoScale(value)}
                  min={0.1}
                  max={3}
                  step={0.1}
                >
                  <Slider.Track className="bg-slate-800 relative grow rounded-full h-1.5">
                    <Slider.Range className="absolute h-full rounded-full bg-amber-500" />
                  </Slider.Track>
                  <Slider.Thumb
                    className="block w-3 h-3 rounded-full bg-amber-500 hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all cursor-grab active:cursor-grabbing"
                    aria-label="Logo 缩放"
                  />
                </Slider.Root>
              </div>
            )}

            {/* 预览模式 */}
            <div className="bg-black/50 border border-slate-800 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">预览模式</h3>
              <div className="space-y-2">
                {(Object.keys(PREVIEW_SIZE_MODES) as PreviewSizeMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setPreviewSizeMode(mode)}
                    className={`w-full p-3 rounded-lg border text-left transition-all text-sm ${
                      previewSizeMode === mode
                        ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                        : 'border-slate-800 bg-black/50 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-medium">{PREVIEW_SIZE_MODES[mode].name}</div>
                    <div className="text-xs opacity-70 mt-0.5">{PREVIEW_SIZE_MODES[mode].desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 导出选项 */}
            <div className="bg-black/50 border border-slate-800 rounded-xl p-3 space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">导出选项</h3>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Checkbox.Root
                  className="w-4 h-4 rounded flex items-center justify-center border transition-all cursor-pointer data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 data-[state=unchecked]:border-slate-600 data-[state=unchecked]:bg-black/50"
                  checked={exportOptions.single}
                  onCheckedChange={(checked: boolean) => setExportOptions(prev => ({ ...prev, single: checked }))}
                >
                  <Checkbox.Indicator className="text-white">
                    <Check className="w-3 h-3" strokeWidth={3} />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                <span className="text-sm text-slate-300">单张完整图</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Checkbox.Root
                  className="w-4 h-4 rounded flex items-center justify-center border transition-all cursor-pointer data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 data-[state=unchecked]:border-slate-600 data-[state=unchecked]:bg-black/50"
                  checked={exportOptions.grid}
                  onCheckedChange={(checked: boolean) => setExportOptions(prev => ({ ...prev, grid: checked }))}
                >
                  <Checkbox.Indicator className="text-white">
                    <Check className="w-3 h-3" strokeWidth={3} />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                <span className="text-sm text-slate-300">九宫格切片</span>
              </label>
            </div>
          </div>
        </div>

        {/* 中间：任务列表 + 预览 */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* 任务列表 */}
          <div className="flex-shrink-0 border-b border-slate-800 bg-black/50">
            <div className="px-4 py-3 flex items-center justify-between">
              <h2 className="font-bold text-sm text-slate-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                任务列表
              </h2>
              <span className="bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded-full">{images.length}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-1 gap-3">
              {images.map((img, index) => (
                <div
                  key={img.id}
                  className={`bg-black/50 border rounded-xl p-4 flex items-center gap-4 transition-all ${
                    img.status === 'error'
                      ? 'border-red-500/50'
                      : img.status === 'completed'
                      ? 'border-emerald-500/50'
                      : img.status === 'waiting'
                      ? 'border-amber-500/30'
                      : img.status === 'processing'
                      ? 'border-amber-500/50'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* 缩略图 */}
                  <div
                    className="relative w-16 h-16 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden group cursor-pointer"
                    onClick={() => switchToPreview(index)}
                  >
                    {img.previewUrl ? (
                      <img src={img.previewUrl} alt={img.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-600" />
                    )}
                    {/* 悬浮眼睛图标 */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="w-6 h-6 text-white" />
                    </div>
                    {/* 状态图标 */}
                    {img.status === 'processing' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                      </div>
                    )}
                    {img.status === 'completed' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Check className="w-5 h-5 text-emerald-500" />
                      </div>
                    )}
                    {img.status === 'error' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <span className="text-red-500 text-sm">✗</span>
                      </div>
                    )}
                    {img.status === 'waiting' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <div className="w-4 h-4 rounded-full bg-amber-500/50" />
                      </div>
                    )}
                  </div>

                  {/* 文件信息 */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate text-sm text-slate-100">{img.name}</p>
                    <p className="text-xs text-slate-500 truncate">{img.path}</p>
                    {/* 文件大小和尺寸 */}
                    <div className="flex items-center gap-3 mt-1">
                      {img.originalSize && (
                        <p className="text-sm text-slate-400">{formatFileSize(img.originalSize)}</p>
                      )}
                      {img.width && img.height && (
                        <p className="text-xs text-slate-500">{img.width}×{img.height}</p>
                      )}
                      {img.orientation && (
                        <p className="text-xs text-slate-500 px-1.5 py-0.5 bg-slate-800 rounded">
                          {img.orientation === 'portrait' ? '竖版' : img.orientation === 'landscape' ? '横版' : '方版'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 状态和操作 */}
                  <div className="flex items-center gap-2 shrink-0">
                    {index === currentIndex && (
                      <span className="text-xs text-amber-400 px-2 py-1 bg-amber-500/10 rounded-lg">当前预览</span>
                    )}
                    <button
                      onClick={() => removeImage(img.id)}
                      className="p-2 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {images.length === 0 && (
                <div className="text-center text-slate-500 py-12 flex items-center justify-center">
                  <p className="text-sm">暂无任务</p>
                </div>
              )}
            </div>
          </div>

          {/* 预览画布 */}
          <div className="flex-1 flex flex-col flex-shrink-0 border-t border-slate-800 bg-black p-4 min-h-0">
            <div className="flex-1 flex items-center justify-center">
              <div
                ref={containerRef}
                className="relative shadow-2xl shadow-black rounded-sm overflow-hidden border border-slate-800 bg-black"
                style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
              >
                <canvas
                  ref={canvasRef}
                  width={BASE_SIZE}
                  height={BASE_SIZE}
                  style={{ width: '100%', height: '100%', cursor: logoImage ? 'move' : 'default' }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                />
                {/* 预览标签 */}
                {images.length > 0 && (
                  <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-xs text-white">
                    预览: {images[currentIndex]?.name}
                  </div>
                )}
              </div>
            </div>
            {images.length > 0 && (
              <div className="text-center mt-3 text-xs text-slate-500">
                {exportOptions.grid && <span className="mr-3">九宫格切片导出</span>}
                {exportOptions.single && <span>800x800 完整图</span>}
              </div>
            )}
          </div>
        </div>

        {/* 右侧：设置 + 日志 + 按钮 */}
        <div className="w-80 border-l border-slate-800 bg-black flex flex-col shrink-0 overflow-y-hidden">
          <div className="flex flex-col flex-1 overflow-y-auto p-4 space-y-4">
            {/* 输出目录 */}
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

              {/* 并发线程数 */}
              <ConcurrencySelector
                id="image-material-concurrency"
                value={concurrency}
                onChange={setConcurrency}
                disabled={isProcessing}
                themeColor="amber"
                compact
              />
            </div>

            {/* 日志面板 */}
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

          {/* 开始处理按钮 */}
          <div className="p-4 border-t border-slate-800 bg-black/50">
            <Button
              onClick={processImages}
              disabled={images.length === 0 || isProcessing || !outputDir || (!exportOptions.single && !exportOptions.grid)}
              variant="primary"
              size="md"
              fullWidth
              loading={isProcessing}
              leftIcon={!isProcessing && <FolderOpen className="w-4 h-4" />}
              themeColor="amber"
            >
              {isProcessing ? '处理中...' : '开始处理'}
            </Button>
          </div>
        </div>

        {/* 预览弹窗 */}
        {showPreview && images[previewIndex] && (
          <FilePreviewModal
            file={{
              path: images[previewIndex].path,
              name: images[previewIndex].name,
              type: 'image'
            }}
            visible={showPreview}
            onClose={handleClosePreview}
            allFiles={images.map(img => ({
              path: img.path,
              name: img.name,
              type: 'image' as const,
            }))}
            currentIndex={previewIndex}
            onPrevious={handlePreviousPreview}
            onNext={handleNextPreview}
            themeColor="amber"
          />
        )}
      </div>
    </div>
  );
};

export default ImageMaterialMode;
