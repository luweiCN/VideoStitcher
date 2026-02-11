import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  FileVideo, ImageIcon, Play, Trash2, Loader2,
  Settings, CheckCircle, RefreshCcw, Maximize, Monitor, ZoomIn, ZoomOut, Layers
} from 'lucide-react';
import { MaterialPositions, LayerId, LayerConfig } from '../types';
import VideoEditor from '../components/VideoEditor';
import LayerSidebar from '../components/LayerSidebar';
import PageHeader from '../components/PageHeader';
import OutputDirSelector from '../components/OutputDirSelector';
import ConcurrencySelector from '../components/ConcurrencySelector';
import OperationLogPanel from '../components/OperationLogPanel';
import { FileSelector, FileSelectorGroup } from '../components/FileSelector';
import { useOutputDirCache } from '../hooks/useOutputDirCache';
import { useConcurrencyCache } from '../hooks/useConcurrencyCache';
import { useOperationLogs } from '../hooks/useOperationLogs';
import { useVideoProcessingEvents } from '../hooks/useVideoProcessingEvents';
import { getCanvasConfig, getInitialPositions, getDefaultLayerConfigs } from '../utils/positionCalculator';

interface VideoMergeModeProps {
  onBack: () => void;
}

const VideoMergeMode: React.FC<VideoMergeModeProps> = ({ onBack }) => {
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const canvasConfig = useMemo(() => getCanvasConfig(orientation), [orientation]);

  // 文件状态
  const [bgImages, setBgImages] = useState<string[]>([]);
  const [bVideos, setBVideos] = useState<string[]>([]);
  const [aVideos, setAVideos] = useState<string[]>([]);
  const [covers, setCovers] = useState<string[]>([]);

  // 元数据状态
  const [aVideoMetadata, setAVideoMetadata] = useState<{ width: number; height: number; duration: number } | undefined>();
  const [bVideoMetadata, setBVideoMetadata] = useState<{ width: number; height: number; duration: number } | undefined>();
  const [coverImageMetadata, setCoverImageMetadata] = useState<{ width: number; height: number } | undefined>();

  // 素材位置状态
  const [materialPositions, setMaterialPositions] = useState<MaterialPositions>(() =>
    getInitialPositions(canvasConfig)
  );

  const lockedLayers = useMemo(() => new Set<LayerId>(['aVideo', 'bgImage', 'coverImage']), []);
  const [canvasZoom, setCanvasZoom] = useState<number>(100);

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
    moduleNameCN: '视频合成',
    moduleNameEN: 'VideoMerge',
  });

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -10 : 10;
      setCanvasZoom(prev => Math.max(25, Math.min(200, prev + delta)));
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  // 构建 materials 对象
  const materials = useMemo(() => ({
    aVideo: aVideos.length > 0 ? aVideos[0] : undefined,
    bVideo: bVideos.length > 0 ? bVideos[0] : undefined,
    bgImage: bgImages.length > 0 ? bgImages[0] : undefined,
    coverImage: covers.length > 0 ? covers[0] : undefined,
  }), [aVideos, bVideos, bgImages, covers]);

  const layerConfigs: LayerConfig[] = useMemo(() => {
    const defaultConfigs = getDefaultLayerConfigs();
    const availableLayers: LayerConfig[] = [];
    availableLayers.push({
      ...defaultConfigs.find(l => l.id === 'bVideo')!,
      visible: true,
      locked: lockedLayers.has('bVideo'),
    });
    if (aVideos.length > 0) {
      availableLayers.push({
        ...defaultConfigs.find(l => l.id === 'aVideo')!,
        visible: true,
        locked: lockedLayers.has('aVideo'),
      });
    }
    if (materials.bgImage) {
      availableLayers.push({
        ...defaultConfigs.find(l => l.id === 'bgImage')!,
        visible: true,
        locked: lockedLayers.has('bgImage'),
      });
    }
    if (covers.length > 0) {
      availableLayers.push({
        ...defaultConfigs.find(l => l.id === 'coverImage')!,
        visible: true,
        locked: lockedLayers.has('coverImage'),
      });
    }
    return availableLayers;
  }, [aVideos.length, materials.bgImage, covers.length, lockedLayers]);

  const [activeLayer, setActiveLayer] = useState<LayerId>('bVideo');

  useEffect(() => {
    const availableLayerIds = layerConfigs.map(l => l.id);
    if (!availableLayerIds.includes(activeLayer)) {
      if (availableLayerIds.length > 0) {
        setActiveLayer(availableLayerIds[0] as LayerId);
      }
    }
  }, [layerConfigs, activeLayer]);

  const { outputDir, setOutputDir } = useOutputDirCache('VideoMergeMode');
  const { concurrency, setConcurrency } = useConcurrencyCache('VideoMergeMode');
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportMultiplier, setExportMultiplier] = useState<1 | 2 | 3>(1);
  const [progress, setProgress] = useState({ done: 0, failed: 0, total: 0 });

  useEffect(() => {
    setMaterialPositions(getInitialPositions(canvasConfig));
  }, [canvasConfig]);

  // 使用视频处理事件 Hook
  useVideoProcessingEvents({
    onStart: (data) => {
      addLog(`开始处理: 总任务 ${data.total}, 并发 ${data.concurrency}`);
      setProgress({ done: 0, failed: 0, total: data.total });
    },
    onProgress: (data) => {
      setProgress({ done: data.done, failed: data.failed, total: data.total });
      addLog(`进度: ${data.done}/${data.total} (失败 ${data.failed})`);
    },
    onFailed: (data) => {
      addLog(`❌ 任务 ${data.index + 1} 失败: ${data.error}`, 'error');
    },
    onFinish: (data) => {
      addLog(`✅ 完成! 成功 ${data.done}, 失败 ${data.failed}`, 'success');
      setIsProcessing(false);
    },
    onLog: (data) => {
      addLog(`[任务 ${data.index + 1}] ${data.message}`);
    },
  });

  /**
   * 获取视频元数据并更新位置
   */
  const fetchVideoMetadata = useCallback(async (filePath: string) => {
    try {
      const metadata = await window.api.getVideoMetadata(filePath);
      return metadata;
    } catch (err) {
      addLog(`无法读取视频元数据: ${filePath}`);
      return null;
    }
  }, [addLog]);

  /**
   * 获取图片尺寸并更新位置
   */
  const fetchImageSize = useCallback(async (filePath: string) => {
    try {
      const metadata = await window.api.getVideoMetadata(filePath);
      return { width: metadata.width, height: metadata.height };
    } catch (err) {
      addLog(`无法读取图片尺寸: ${filePath}`);
      return null;
    }
  }, [addLog]);

  /**
   * B 面视频变化处理
   */
  const handleBVideosChange = useCallback(async (files: string[]) => {
    setBVideos(files);
    if (files.length > 0) {
      addLog(`已选择 ${files.length} 个主视频`);
      const metadata = await fetchVideoMetadata(files[0]);
      if (metadata) {
        setBVideoMetadata(metadata);
        const newPositions = getInitialPositions(canvasConfig, metadata, aVideoMetadata, coverImageMetadata);
        setMaterialPositions(prev => ({ ...prev, bVideo: newPositions.bVideo }));
        addLog(`主视频: ${metadata.width}x${metadata.height}`);
      }
    }
  }, [fetchVideoMetadata, canvasConfig, aVideoMetadata, coverImageMetadata, addLog]);

  /**
   * A 面视频变化处理
   */
  const handleAVideosChange = useCallback(async (files: string[]) => {
    setAVideos(files);
    if (files.length > 0) {
      addLog(`已选择 ${files.length} 个A面视频`);
      const metadata = await fetchVideoMetadata(files[0]);
      if (metadata) {
        setAVideoMetadata(metadata);
        const newPositions = getInitialPositions(canvasConfig, bVideoMetadata, metadata, coverImageMetadata);
        setMaterialPositions(prev => ({ ...prev, aVideo: newPositions.aVideo }));
        addLog(`A 面视频: ${metadata.width}x${metadata.height}`);
      }
    }
  }, [fetchVideoMetadata, canvasConfig, bVideoMetadata, coverImageMetadata, addLog]);

  /**
   * 背景图变化处理
   */
  const handleBgImagesChange = useCallback(async (files: string[]) => {
    setBgImages(files);
    if (files.length > 0) {
      addLog(`已选择背景图: ${files[0]}`);
    }
  }, [addLog]);

  /**
   * 封面图变化处理
   */
  const handleCoversChange = useCallback(async (files: string[]) => {
    setCovers(files);
    if (files.length > 0) {
      addLog(`已选择 ${files.length} 个封面`);
      const size = await fetchImageSize(files[0]);
      if (size) {
        setCoverImageMetadata(size);
        const newPositions = getInitialPositions(canvasConfig, bVideoMetadata, aVideoMetadata, size);
        setMaterialPositions(prev => ({ ...prev, coverImage: newPositions.coverImage }));
        addLog(`封面图: ${size.width}x${size.height}`);
      }
    }
  }, [fetchImageSize, canvasConfig, bVideoMetadata, aVideoMetadata, addLog]);

  const handlePositionChange = (id: LayerId, position: { x: number; y: number; width: number; height: number }) => {
    setMaterialPositions(prev => ({ ...prev, [id]: position }));
  };

  const handleLayerVisibilityChange = (id: LayerId, visible: boolean) => {};

  const resetPositions = () => {
    const defaults = getInitialPositions(canvasConfig, bVideoMetadata, aVideoMetadata, coverImageMetadata);
    setMaterialPositions(defaults);
    addLog('已重置素材位置');
  };

  const maximizePositions = () => {
    const maxPosition = { x: 0, y: 0, width: canvasConfig.width, height: canvasConfig.height };
    setMaterialPositions({
      bgImage: { ...maxPosition },
      aVideo: { ...maxPosition },
      bVideo: { ...maxPosition },
      coverImage: { ...maxPosition },
    });
    addLog('已设置素材铺满全屏');
  };

  const startProcessing = async () => {
    if (bVideos.length === 0) {
      addLog('⚠️ 请先选择主视频');
      return;
    }
    if (!outputDir) {
      addLog('⚠️ 请先选择输出目录');
      return;
    }
    if (isProcessing) return;
    setIsProcessing(true);
    setLogs([]);
    const modeText = orientation === 'horizontal' ? '横屏' : '竖屏';
    addLog(`开始${modeText}合成处理...`);
    const totalTasks = bVideos.length * exportMultiplier;
    const expandedAVideos: string[] = [];
    const expandedCovers: string[] = [];
    if (aVideos.length > 0) {
      let pool = [...aVideos];
      pool.sort(() => 0.5 - Math.random());
      for (let k = 0; k < totalTasks; k++) {
        if (pool.length === 0) {
          pool = [...aVideos];
          pool.sort(() => 0.5 - Math.random());
        }
        expandedAVideos.push(pool.pop()!);
      }
    }
    if (covers.length > 0) {
      for (let k = 0; k < totalTasks; k++) {
        const randomCover = covers[Math.floor(Math.random() * covers.length)];
        expandedCovers.push(randomCover);
      }
    }
    const expandedBVideos: string[] = [];
    for (const video of bVideos) {
      for (let m = 0; m < exportMultiplier; m++) {
        expandedBVideos.push(video);
      }
    }
    try {
      if (orientation === 'horizontal') {
        await window.api.videoHorizontalMerge({
          aVideos: expandedAVideos,
          bVideos: expandedBVideos,
          bgImage: materials.bgImage,
          coverImages: expandedCovers.length > 0 ? expandedCovers : undefined,
          outputDir,
          concurrency,
          aPosition: materialPositions.aVideo,
          bPosition: materialPositions.bVideo,
          bgPosition: materialPositions.bgImage,
          coverPosition: materialPositions.coverImage,
        });
      } else {
        await window.api.videoVerticalMerge({
          mainVideos: expandedBVideos,
          bgImage: materials.bgImage,
          aVideos: expandedAVideos.length > 0 ? expandedAVideos : undefined,
          coverImages: expandedCovers.length > 0 ? expandedCovers : undefined,
          outputDir,
          concurrency,
          aPosition: materialPositions.aVideo,
          bPosition: materialPositions.bVideo,
          bgPosition: materialPositions.bgImage,
          coverPosition: materialPositions.coverImage,
        });
      }
    } catch (err: any) {
      addLog(`❌ 处理失败: ${err.message || err}`);
      setIsProcessing(false);
    }
  };

  const modeText = orientation === 'horizontal' ? '横屏' : '竖屏';
  const primaryColor = orientation === 'horizontal' ? 'violet' : 'indigo';
  const progressPercent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 font-sans overflow-hidden">
      <PageHeader
        onBack={onBack}
        title="极速合成"
        icon={Layers}
        iconColor="text-violet-400"
        description="横竖屏一体，图层管理，所有素材独立位置调整"
        featureInfo={{
          title: '极速合成',
          description: '支持横竖屏一体化的视频合成工具，可添加多种素材进行视频合成。',
          details: [
            '支持横屏（1920×1080）和竖屏（1080×1920）两种输出尺寸',
            '支持四种素材：背景图、B面视频（必选）、A面视频、封面图',
            '在预览区拖拽调整素材位置，支持重置框位和铺满全屏',
            '支持导出倍数批量处理（×2、×3）',
            '实时预览合成效果，所见即所得',
          ],
          themeColor: 'violet',
        }}
        rightContent={
          <div className="flex items-center bg-black rounded-lg p-0.5 border border-slate-800">
            <button
              onClick={() => setOrientation('horizontal')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                orientation === 'horizontal' ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/20' : 'text-gray-400 hover:text-white'
              }`}
              type="button"
            >
              横屏
            </button>
            <button
              onClick={() => setOrientation('vertical')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                orientation === 'vertical' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-gray-400 hover:text-white'
              }`}
              type="button"
            >
              竖屏
            </button>
          </div>
        }
      />

      <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
        <div className="w-full md:w-[400px] p-6 border-r border-slate-800 flex flex-col gap-5 bg-slate-900 shadow-2xl z-20 h-full min-h-0 md:overflow-y-auto">
          {/* 文件选择器组 */}
          <FileSelectorGroup>
            <div className="space-y-5">
              {/* 背景图 */}
              <FileSelector
                id="bgImage"
                name="背景图 (可选)"
                accept="image"
                multiple={false}
                showList
                themeColor={primaryColor}
                directoryCache
                onChange={handleBgImagesChange}
              />

              {/* B 面视频 - 必选 */}
              <FileSelector
                id="bVideo"
                name="主视频 (B面 - 必选)"
                accept="video"
                multiple
                showList
                themeColor={primaryColor}
                directoryCache
                required
                onChange={handleBVideosChange}
              />

              {/* A 面视频 - 可选 */}
              <FileSelector
                id="aVideo"
                name="A 面视频 (可选)"
                accept="video"
                multiple
                showList
                themeColor={primaryColor}
                directoryCache
                onChange={handleAVideosChange}
              />

              {/* 封面图 - 可选 */}
              <FileSelector
                id="cover"
                name="封面图 (可选)"
                accept="image"
                multiple
                showList
                themeColor={primaryColor}
                directoryCache
                onChange={handleCoversChange}
              />
            </div>
          </FileSelectorGroup>

          {/* 其他设置 */}
          <div className="space-y-4 pt-2">
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
              <OutputDirSelector
                value={outputDir}
                onChange={setOutputDir}
                disabled={isProcessing}
                themeColor={primaryColor}
              />
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
              <ConcurrencySelector
                value={concurrency}
                onChange={setConcurrency}
                disabled={isProcessing}
                themeColor={primaryColor}
                compact
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-slate-300">导出倍数</span>
                <span className="text-[9px] text-slate-500">预计导出 {bVideos.length * exportMultiplier} 条</span>
              </div>
              <div className="flex gap-2">
                {[2, 3].map(m => (
                  <button
                    key={m}
                    onClick={() => setExportMultiplier(prev => prev === m ? 1 : m as 1|2|3)}
                    className={`w-8 h-8 rounded-lg text-[10px] font-bold transition-all border ${
                      exportMultiplier === m
                        ? `bg-${primaryColor}-600 text-white`
                        : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-violet-400'
                    }`}
                  >
                    ×{m}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={startProcessing}
              disabled={bVideos.length === 0 || isProcessing || !outputDir}
              className={`w-full py-5 bg-gradient-to-r from-${primaryColor}-600 to-${primaryColor}-700 font-black rounded-2xl transition-all flex items-center justify-center gap-3 shadow-2xl shadow-${primaryColor}-900/40 disabled:opacity-50`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  正在全力渲染中...
                </>
              ) : (
                <>
                  <Play className="w-6 h-6 fill-current" />
                  一键开始批量处理
                </>
              )}
            </button>
          </div>

          {isProcessing && progress.total > 0 && (
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-400">处理进度</span>
                <span className={primaryColor === 'violet' ? 'text-violet-400' : 'text-indigo-400'}>
                  {progress.done} / {progress.total}
                </span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                <div
                  className={`bg-${primaryColor}-600 h-full transition-all duration-500`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              {progress.failed > 0 && (
                <div className="text-[10px] text-red-400 font-bold">
                  ⚠️ {progress.failed} 个任务失败
                </div>
              )}
            </div>
          )}

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
            themeColor={primaryColor === 'violet' ? 'violet' : 'indigo'}
          />
        </div>

        <main className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-8 relative overflow-hidden">
          <div className="h-full w-full flex flex-col items-center justify-center py-4">
            <div className="flex-1 w-full flex items-center justify-center min-h-0 overflow-auto">
              <VideoEditor
                mode={orientation}
                canvasWidth={canvasConfig.width}
                canvasHeight={canvasConfig.height}
                positions={materialPositions}
                onPositionChange={handlePositionChange}
                onActiveLayerChange={setActiveLayer}
                activeLayer={activeLayer}
                layerConfigs={layerConfigs}
                materials={materials}
                canvasZoom={canvasZoom}
                onCanvasZoomChange={setCanvasZoom}
              />
            </div>
            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="flex items-center gap-6 bg-slate-900/80 backdrop-blur-md px-6 py-4 rounded-2xl border border-slate-800">
                <button
                  onClick={resetPositions}
                  className="text-[10px] font-black text-slate-400 hover:text-white flex items-center gap-2"
                >
                  <RefreshCcw className="w-3 h-3" />
                  重置框位
                </button>
                <div className="w-px h-4 bg-slate-800" />
                <button
                  onClick={maximizePositions}
                  className="text-[10px] font-black text-slate-400 hover:text-white flex items-center gap-2"
                >
                  <Maximize className="w-3 h-3" />
                  铺满全屏
                </button>
                <div className="w-px h-4 bg-slate-800" />
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCanvasZoom(prev => Math.min(200, prev + 25))}
                    className="w-7 h-7 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded flex items-center justify-center text-white"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <div className="bg-slate-800 px-3 py-1 rounded border border-slate-700 min-w-[60px] text-center text-xs font-bold text-white">
                    {canvasZoom}%
                  </div>
                  <button
                    onClick={() => setCanvasZoom(prev => Math.max(25, prev - 25))}
                    className="w-7 h-7 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded flex items-center justify-center text-white"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="w-px h-4 bg-slate-800" />
                <p className="text-[11px] font-mono text-violet-400">
                  分辨率: {canvasConfig.width} × {canvasConfig.height}
                </p>
              </div>
            </div>
          </div>
        </main>

        <div className="w-full md:w-[200px] p-4 border-l border-slate-800 bg-slate-900 shadow-2xl z-20 overflow-y-auto">
          <LayerSidebar
            layers={layerConfigs}
            activeLayer={activeLayer}
            onLayerSelect={setActiveLayer}
            onLayerVisibilityChange={handleLayerVisibilityChange}
          />
        </div>
      </div>
    </div>
  );
};

export default VideoMergeMode;
