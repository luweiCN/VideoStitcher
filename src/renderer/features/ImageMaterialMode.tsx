import React, { useState, useRef, useEffect, MouseEvent, useCallback } from 'react';
import { ArrowLeft, Loader2, Image as ImageIcon, Move, FolderOpen, Layers, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import OutputDirSelector from '../components/OutputDirSelector';
import OperationLogPanel from '../components/OperationLogPanel';
import { FileSelector, FileSelectorGroup } from '../components/FileSelector';
import { useOutputDirCache } from '../hooks/useOutputDirCache';
import { useOperationLogs } from '../hooks/useOperationLogs';
import { useImageProcessingEvents } from '../hooks/useImageProcessingEvents';

/**
 * 图片文件状态
 */
interface ImageFile {
  id: string;
  path: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

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

  // 预览触发器 - 用于触发重绘
  const [previewTrigger, setPreviewTrigger] = useState(0);

  /**
   * 加载指定索引的预览图片
   */
  const loadPreviewImage = async (imagePath: string) => {
    try {
      const result = await window.api.getPreviewUrl(imagePath);
      if (!result.success || !result.url) {
        addLog(`获取预览 URL 失败: ${result.error || '未知错误'}`);
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
        addLog(`加载图片失败: ${imagePath}`);
      };
    } catch (err) {
      addLog(`加载预览失败: ${err}`);
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
   * 处理素材图片选择 - 使用 FileSelector
   */
  const handleImagesChange = useCallback((files: string[]) => {
    const newImages: ImageFile[] = files.map(path => ({
      id: Math.random().toString(36).substr(2, 9),
      path,
      name: path.split('/').pop() || path,
      status: 'pending' as const
    }));

    setImages(prev => {
      const updated = [...prev, ...newImages];
      // 如果是第一批图片，加载第一张用于预览
      if (prev.length === 0 && files.length > 0) {
        setTimeout(() => {
          loadPreviewImage(files[0]);
        }, 0);
      }
      return updated;
    });

    if (newImages.length > 0) {
      addLog(`已添加 ${newImages.length} 张素材图片`);
    }
  }, [addLog]);

  /**
   * 处理 Logo 选择 - 使用 FileSelector
   */
  const handleLogoChange = useCallback(async (files: string[]) => {
    if (files.length > 0) {
      setLogoPath(files[0]);
      addLog(`已选择 Logo: ${files[0].split('/').pop()}`);

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
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, BASE_SIZE, BASE_SIZE);
      ctx.strokeStyle = '#334155';
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
      addLog(`开始处理: 总任务 ${data.total}, 模式: ${data.mode}`);
    },
    onProgress: (data) => {
      addLog(`进度: ${data.done}/${data.total} (失败 ${data.failed})`);
      setImages(prev => prev.map((img) => {
        if (img.path === data.current) {
          return { ...img, status: 'completed' };
        }
        return img;
      }));
    },
    onFailed: (data) => {
      addLog(`❌ 处理失败: ${data.current} - ${data.error}`, 'error');
      setImages(prev => prev.map((img) => {
        if (img.path === data.current) {
          return { ...img, status: 'error' };
        }
        return img;
      }));
    },
    onFinish: (data) => {
      addLog(`✅ 完成! 成功 ${data.done}, 失败 ${data.failed}`, 'success');
      setIsProcessing(false);
    },
  });

  // 开始处理
  const processImages = async () => {
    if (images.length === 0) {
      addLog('⚠️ 请先选择素材图片');
      return;
    }
    if (!outputDir) {
      addLog('⚠️ 请先选择输出目录');
      return;
    }
    if (!exportOptions.single && !exportOptions.grid) {
      addLog('⚠️ 请至少选择一种导出模式（单图或九宫格）');
      return;
    }
    if (isProcessing) return;

    setIsProcessing(true);
    clearLogs();
    addLog('开始图片素材处理...');
    addLog(`素材: ${images.length} 张`);
    addLog(`Logo: ${logoPath ? '已设置' : '无'}`);
    addLog(`预览模式: ${PREVIEW_SIZE_MODES[previewSizeMode].name}`);
    addLog(`导出选项: ${exportOptions.single ? '单图 ' : ''}${exportOptions.grid ? '九宫格' : ''}`);

    // 重置所有图片状态
    setImages(prev => prev.map(img => ({ ...img, status: 'pending' as const })));

    try {
      await window.api.imageMaterial({
        images: images.map(img => img.path),
        logoPath: logoPath || undefined,
        outputDir,
        previewSize: previewSizeMode,
        logoPosition,
        logoScale,
        exportOptions
      });
    } catch (err: any) {
      addLog(`❌ 处理失败: ${err.message || err}`);
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
    <div className="h-screen bg-slate-950 text-white flex flex-col">
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
        {/* 左侧：控制面板 */}
        <div className="w-96 border-r border-slate-800 bg-slate-900 p-6 flex flex-col gap-5 overflow-y-auto">
          {/* 文件选择器组 */}
          <FileSelectorGroup>
            <div className="space-y-5">
              {/* 素材图片 */}
              <FileSelector
                id="materialImages"
                name="素材图片"
                accept="image"
                multiple
                showList={false}
                minHeight={100}
                maxHeight={200}
                themeColor="amber"
                directoryCache
                onChange={handleImagesChange}
              />

              {/* Logo */}
              <FileSelector
                id="logoImage"
                name="Logo 水印 (可选)"
                accept="image"
                multiple={false}
                showList={false}
                                maxHeight={120}
                themeColor="amber"
                directoryCache
                onChange={handleLogoChange}
              />
            </div>
          </FileSelectorGroup>

          {/* 预览模式 */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-400 uppercase">预览模式</h3>
            <div className="space-y-2">
              {(Object.keys(PREVIEW_SIZE_MODES) as PreviewSizeMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setPreviewSizeMode(mode)}
                  className={`w-full p-3 rounded-lg border text-left transition-all text-sm ${
                    previewSizeMode === mode
                      ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-medium">{PREVIEW_SIZE_MODES[mode].name}</div>
                  <div className="text-xs opacity-70 mt-0.5">{PREVIEW_SIZE_MODES[mode].desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 导出选项 */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-400 uppercase">导出选项</h3>
            <div className="space-y-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${exportOptions.single ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-600 bg-slate-900'}`}
                  onClick={() => setExportOptions(prev => ({ ...prev, single: !prev.single }))}
                >
                  {exportOptions.single && <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={3} />}
                </div>
                <span className="text-sm text-slate-300">导出单张完整图 (800x800)</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${exportOptions.grid ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-600 bg-slate-900'}`}
                  onClick={() => setExportOptions(prev => ({ ...prev, grid: !prev.grid }))}
                >
                  {exportOptions.grid && <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={3} />}
                </div>
                <span className="text-sm text-slate-300">导出九宫格切片 (800x800 x9)</span>
              </label>
            </div>
          </div>

          {/* Logo 控制 */}
          {logoImage && (
            <div className="space-y-4 p-4 bg-slate-950 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-bold">
                <Move className="w-4 h-4" /> Logo 调整
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>缩放</span>
                  <span>{(logoScale * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={logoScale}
                  onChange={(e) => setLogoScale(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <button
                onClick={clearLogo}
                className="w-full py-2 text-xs text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
              >
                清除 Logo
              </button>
              <p className="text-xs text-slate-500 leading-relaxed">
                在预览图中拖动 Logo 可调整位置。
              </p>
            </div>
          )}

          {/* 输出目录 */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-400 uppercase">输出目录</h3>
            <OutputDirSelector
              value={outputDir}
              onChange={setOutputDir}
              disabled={isProcessing}
              themeColor="amber"
              label=""
            />
          </div>

          {/* 处理日志 */}
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
            className="flex-1"
            themeColor="pink"
          />

          {/* 开始处理按钮 */}
          <button
            onClick={processImages}
            disabled={images.length === 0 || isProcessing || !outputDir || (!exportOptions.single && !exportOptions.grid)}
            className="w-full py-4 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-900/20"
          >
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <FolderOpen className="w-5 h-5" />}
            {isProcessing ? '处理中...' : '开始处理'}
          </button>
        </div>

        {/* 中间：预览画布 */}
        <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-8 relative">
          <div className="absolute top-6 left-6 text-sm text-slate-500 font-mono">PREVIEW CANVAS</div>

          {images.length > 0 && (
            <>
              {/* 上一个/下一个按钮 */}
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2">
                <button
                  onClick={goToPrevious}
                  disabled={currentIndex === 0}
                  className="p-3 bg-slate-900 border border-slate-800 rounded-xl hover:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  title="上一张"
                >
                  <ChevronLeft className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2">
                <button
                  onClick={goToNext}
                  disabled={currentIndex >= images.length - 1}
                  className="p-3 bg-slate-900 border border-slate-800 rounded-xl hover:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  title="下一张"
                >
                  <ChevronRight className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              {/* 预览计数器 */}
              <div className="absolute top-6 right-6 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg">
                <span className="text-sm text-slate-400">
                  {currentIndex + 1} / {images.length}
                </span>
              </div>
            </>
          )}

          <div
            ref={containerRef}
            className="relative shadow-2xl shadow-black rounded-sm overflow-hidden border border-slate-800 bg-[url('https://transparenttextures.com/patterns/stardust.png')] bg-slate-900"
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
          </div>
          <div className="mt-6 text-slate-500 text-sm text-center max-w-md space-y-2">
            {images.length > 0 ? (
              <>
                <div className="break-all px-4">
                  预览: {images[currentIndex]?.name}
                </div>
                {exportOptions.grid && <div>导出时将智能切分为 9 张</div>}
                {exportOptions.single && <div>完整图将以 800x800 导出</div>}
              </>
            ) : (
              <div>请先上传图片进行预览</div>
            )}
          </div>
        </div>

        {/* 右侧：文件列表 */}
        <div className="w-72 border-l border-slate-800 bg-slate-900 flex flex-col">
          {/* 文件列表头部 */}
          <div className="p-4 border-b border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                待处理列表 ({images.length})
              </div>
              {images.length > 0 && (
                <button
                  onClick={clearImages}
                  className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                  title="清空列表"
                >
                  清空
                </button>
              )}
            </div>
          </div>

          {/* 文件列表内容 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {images.length === 0 ? (
              <div className="text-slate-500 text-sm text-center py-8">
                暂无图片
              </div>
            ) : (
              images.map((img, index) => (
                <button
                  key={img.id}
                  onClick={() => switchToPreview(index)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    index === currentIndex
                      ? 'border-amber-500 bg-amber-500/20'
                      : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-300 truncate flex-1 mr-2" title={img.name}>
                      {index + 1}. {img.name}
                    </span>
                    {img.status === 'completed' && <span className="text-emerald-500 text-xs shrink-0">✓</span>}
                    {img.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin text-amber-500 shrink-0" />}
                    {img.status === 'error' && <span className="text-red-500 text-xs shrink-0">✗</span>}
                  </div>
                  {index === currentIndex && (
                    <div className="text-xs text-amber-400">当前预览</div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageMaterialMode;
