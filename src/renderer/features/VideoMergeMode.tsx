import React, { useState, useEffect, useMemo, useRef } from 'react';
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

  const [materials, setMaterials] = useState({
    aVideo: undefined as string | undefined,
    bVideo: undefined as string | undefined,
    bgImage: undefined as string | undefined,
    coverImage: undefined as string | undefined,
  });

  const [videos, setVideos] = useState<string[]>([]);
  const [sideAVideos, setSideAVideos] = useState<string[]>([]);
  const [covers, setCovers] = useState<string[]>([]);

  const [aVideoMetadata, setAVideoMetadata] = useState<{ width: number; height: number; duration: number } | undefined>();
  const [bVideoMetadata, setBVideoMetadata] = useState<{ width: number; height: number; duration: number } | undefined>();
  const [coverImageMetadata, setCoverImageMetadata] = useState<{ width: number; height: number } | undefined>();

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

  const layerConfigs: LayerConfig[] = useMemo(() => {
    const defaultConfigs = getDefaultLayerConfigs();
    const availableLayers: LayerConfig[] = [];
    availableLayers.push({
      ...defaultConfigs.find(l => l.id === 'bVideo')!,
      visible: true,
      locked: lockedLayers.has('bVideo'),
    });
    if (sideAVideos.length > 0) {
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
  }, [sideAVideos.length, materials.bgImage, covers.length, lockedLayers]);

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
  const [showHelp, setShowHelp] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportMultiplier, setExportMultiplier] = useState<1 | 2 | 3>(1);
  const [progress, setProgress] = useState({ done: 0, failed: 0, total: 0 });

  useEffect(() => {
    setMaterialPositions(getInitialPositions(canvasConfig));
  }, [canvasConfig]);

  // 加载全局默认配置（已移至 useConcurrencyCache hook）

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

  const handleSelectBgImage = async () => {
    try {
      const files = await window.api.pickFiles('选择背景图片', [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] },
      ], false);
      if (files.length > 0) {
        setMaterials(prev => ({ ...prev, bgImage: files[0] }));
        addLog(`已选择背景图: ${files[0]}`);
      }
    } catch (err) {
      addLog(`选择背景图失败: ${err}`);
    }
  };

  const handleSelectVideos = async () => {
    try {
      const files = await window.api.pickFiles('选择主视频 (B面)', [
        { name: 'Videos', extensions: ['mp4', 'mov', 'mkv', 'm4v', 'avi'] },
      ]);
      if (files.length > 0) {
        setVideos(files);
        addLog(`已选择 ${files.length} 个主视频`);
        try {
          const metadata = await window.api.getVideoMetadata(files[0]);
          setBVideoMetadata(metadata);
          const newPositions = getInitialPositions(canvasConfig, metadata, aVideoMetadata, coverImageMetadata);
          setMaterialPositions(prev => ({ ...prev, bVideo: newPositions.bVideo }));
          addLog(`主视频: ${metadata.width}x${metadata.height}`);
        } catch (err) {
          addLog(`无法读取视频元数据，使用默认位置`);
        }
      }
    } catch (err) {
      addLog(`选择视频失败: ${err}`);
    }
  };

  const handleSelectSideAVideos = async () => {
    try {
      const files = await window.api.pickFiles('选择A面视频', [
        { name: 'Videos', extensions: ['mp4', 'mov', 'mkv', 'm4v', 'avi'] },
      ]);
      if (files.length > 0) {
        setSideAVideos(files);
        addLog(`已选择 ${files.length} 个A面视频`);
        try {
          const metadata = await window.api.getVideoMetadata(files[0]);
          setAVideoMetadata(metadata);
          const newPositions = getInitialPositions(canvasConfig, bVideoMetadata, metadata, coverImageMetadata);
          setMaterialPositions(prev => ({ ...prev, aVideo: newPositions.aVideo }));
          addLog(`A 面视频: ${metadata.width}x${metadata.height}`);
        } catch (err) {
          addLog(`无法读取视频元数据，使用默认位置`);
        }
      }
    } catch (err) {
      addLog(`选择A面视频失败: ${err}`);
    }
  };

  const handleSelectCovers = async () => {
    try {
      const files = await window.api.pickFiles('选择封面图片', [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] },
      ]);
      if (files.length > 0) {
        setCovers(files);
        addLog(`已选择 ${files.length} 个封面`);
        try {
          const metadata = await window.api.getVideoMetadata(files[0]);
          setCoverImageMetadata({ width: metadata.width, height: metadata.height });
          const newPositions = getInitialPositions(canvasConfig, bVideoMetadata, aVideoMetadata, { width: metadata.width, height: metadata.height });
          setMaterialPositions(prev => ({ ...prev, coverImage: newPositions.coverImage }));
          addLog(`封面图: ${metadata.width}x${metadata.height}`);
        } catch (err) {
          addLog(`无法读取图片尺寸，使用默认位置`);
        }
      }
    } catch (err) {
      addLog(`选择封面失败: ${err}`);
    }
  };

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
    if (videos.length === 0) {
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
    const totalTasks = videos.length * exportMultiplier;
    const expandedAVideos: string[] = [];
    const expandedCovers: string[] = [];
    if (sideAVideos.length > 0) {
      let pool = [...sideAVideos];
      pool.sort(() => 0.5 - Math.random());
      for (let k = 0; k < totalTasks; k++) {
        if (pool.length === 0) {
          pool = [...sideAVideos];
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
    for (const video of videos) {
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
        rightContent={
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-gray-900 rounded-lg p-0.5 border border-gray-800">
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
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400"
              type="button"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        }
      />

      <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
        <div className="w-full md:w-[400px] p-6 border-r border-slate-800 flex flex-col gap-5 bg-slate-900 shadow-2xl z-20 h-full min-h-0 md:overflow-y-auto">
          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3">
            <h2 className="text-[11px] font-black text-violet-400 uppercase tracking-widest flex items-center gap-2">第一步：设置背景 (可选)</h2>
            <button onClick={handleSelectBgImage} className="group relative block w-full aspect-video rounded-xl border-2 border-dashed border-slate-800 hover:border-violet-500 transition-all overflow-hidden bg-slate-900">
              {materials.bgImage ? <img src={`preview://${encodeURIComponent(materials.bgImage)}`} alt="背景" className="w-full h-full object-cover" /> : <div className="absolute inset-0 flex flex-col items-center justify-center p-4"><ImageIcon className="w-6 h-6 mb-2 text-slate-700 group-hover:text-violet-500 transition-colors" /><span className="text-[10px] text-slate-500 font-bold text-center">点击上传背景图</span></div>}
            </button>
          </div>

          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3 flex flex-col">
            <h2 className="text-[11px] font-black text-violet-400 uppercase tracking-widest">第二步：导入b面视频 (必选)</h2>
            <button onClick={handleSelectVideos} className="group relative block w-full rounded-xl border-2 border-dashed border-slate-800 hover:border-violet-500 transition-all overflow-hidden bg-slate-900 p-6 flex flex-col items-center">
              <FileVideo className="w-8 h-8 mb-2 text-slate-700 group-hover:text-violet-500" />
              <span className="text-[11px] text-slate-500 font-bold">点击添加b面视频 (支持批量)</span>
              {videos.length > 0 && <span className="text-[10px] text-emerald-400 mt-2">已选择 {videos.length} 个视频</span>}
            </button>
          </div>

          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-black text-violet-400 uppercase tracking-widest">第三步：A面添加 (可选)</h2>
              {sideAVideos.length > 0 && <button onClick={() => setSideAVideos([])} className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1"><Trash2 className="w-3 h-3" />清空</button>}
            </div>
            <button onClick={handleSelectSideAVideos} className={`group relative block w-full p-4 rounded-xl border-2 border-dashed transition-all ${sideAVideos.length > 0 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-800 hover:border-violet-500 bg-slate-900'}`}>
              <div className="flex flex-col items-center justify-center text-center">
                {sideAVideos.length > 0 ? <><CheckCircle className="w-6 h-6 mb-2 text-emerald-500" /><span className="text-[10px] text-emerald-400 font-bold">已添加 {sideAVideos.length} 个 A 面</span></> : <><FileVideo className="w-6 h-6 mb-2 text-slate-700 group-hover:text-violet-500" /><span className="text-[10px] text-slate-500 font-bold">点击添加 A 面视频</span></>}
              </div>
            </button>
          </div>

          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-black text-violet-400 uppercase tracking-widest">第四步：视频封面 (可选)</h2>
              {covers.length > 0 && <button onClick={() => setCovers([])} className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1"><Trash2 className="w-3 h-3" />清空</button>}
            </div>
            <button onClick={handleSelectCovers} className={`group relative block w-full p-4 rounded-xl border-2 border-dashed transition-all ${covers.length > 0 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-800 hover:border-violet-500 bg-slate-900'}`}>
              <div className="flex flex-col items-center justify-center text-center">
                {covers.length > 0 ? <><CheckCircle className="w-6 h-6 mb-2 text-emerald-500" /><span className="text-[10px] text-emerald-400 font-bold">已添加 {covers.length} 张封面</span></> : <><ImageIcon className="w-6 h-6 mb-2 text-slate-700 group-hover:text-violet-500" /><span className="text-[10px] text-slate-500 font-bold">点击添加封面图片</span></>}
              </div>
            </button>
          </div>

          <div className="space-y-4 pt-2">
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
              <OutputDirSelector
                value={outputDir}
                onChange={setOutputDir}
                disabled={isProcessing}
                themeColor="violet"
              />
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
              <ConcurrencySelector
                value={concurrency}
                onChange={setConcurrency}
                disabled={isProcessing}
                themeColor="violet"
                compact
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-slate-300">导出倍数</span>
                <span className="text-[9px] text-slate-500">预计导出 {videos.length * exportMultiplier} 条</span>
              </div>
              <div className="flex gap-2">
                {[2, 3].map(m => (
                  <button key={m} onClick={() => setExportMultiplier(prev => prev === m ? 1 : m as 1|2|3)} className={`w-8 h-8 rounded-lg text-[10px] font-bold transition-all border ${exportMultiplier === m ? `bg-${primaryColor}-600 text-white` : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-violet-400'}`}>×{m}</button>
                ))}
              </div>
            </div>

            <button onClick={startProcessing} disabled={videos.length === 0 || isProcessing || !outputDir} className={`w-full py-5 bg-gradient-to-r from-${primaryColor}-600 to-${primaryColor}-700 font-black rounded-2xl transition-all flex items-center justify-center gap-3 shadow-2xl shadow-${primaryColor}-900/40 disabled:opacity-50`}>
              {isProcessing ? <><Loader2 className="w-6 h-6 animate-spin" />正在全力渲染中...</> : <><Play className="w-6 h-6 fill-current" />一键开始批量处理</>}
            </button>
          </div>

          {isProcessing && progress.total > 0 && (
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-400">处理进度</span>
                <span className={primaryColor === 'violet' ? 'text-violet-400' : 'text-indigo-400'}>{progress.done} / {progress.total}</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                <div className={`bg-${primaryColor}-600 h-full transition-all duration-500`} style={{ width: `${progressPercent}%` }} />
              </div>
              {progress.failed > 0 && <div className="text-[10px] text-red-400 font-bold">⚠️ {progress.failed} 个任务失败</div>}
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
            height="200px"
            themeColor={primaryColor === 'violet' ? 'violet' : 'indigo'}
          />
        </div>

        <main className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-8 relative overflow-hidden">
          <div className="h-full w-full flex flex-col items-center justify-center py-4">
            <div className="flex-1 w-full flex items-center justify-center min-h-0 overflow-auto">
              <VideoEditor mode={orientation} canvasWidth={canvasConfig.width} canvasHeight={canvasConfig.height} positions={materialPositions} onPositionChange={handlePositionChange} onActiveLayerChange={setActiveLayer} activeLayer={activeLayer} layerConfigs={layerConfigs} materials={materials} canvasZoom={canvasZoom} onCanvasZoomChange={setCanvasZoom} />
            </div>
            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="flex items-center gap-6 bg-slate-900/80 backdrop-blur-md px-6 py-4 rounded-2xl border border-slate-800">
                <button onClick={resetPositions} className="text-[10px] font-black text-slate-400 hover:text-white flex items-center gap-2"><RefreshCcw className="w-3 h-3" />重置框位</button>
                <div className="w-px h-4 bg-slate-800" />
                <button onClick={maximizePositions} className="text-[10px] font-black text-slate-400 hover:text-white flex items-center gap-2"><Maximize className="w-3 h-3" />铺满全屏</button>
                <div className="w-px h-4 bg-slate-800" />
                <div className="flex items-center gap-3">
                  <button onClick={() => setCanvasZoom(prev => Math.min(200, prev + 25))} className="w-7 h-7 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded flex items-center justify-center text-white"><ZoomIn className="w-3.5 h-3.5" /></button>
                  <div className="bg-slate-800 px-3 py-1 rounded border border-slate-700 min-w-[60px] text-center text-xs font-bold text-white">{canvasZoom}%</div>
                  <button onClick={() => setCanvasZoom(prev => Math.max(25, prev - 25))} className="w-7 h-7 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded flex items-center justify-center text-white"><ZoomOut className="w-3.5 h-3.5" /></button>
                </div>
                <div className="w-px h-4 bg-slate-800" />
                <p className="text-[11px] font-mono text-violet-400">分辨率: {canvasConfig.width} × {canvasConfig.height}</p>
              </div>
            </div>
          </div>
        </main>

        <div className="w-full md:w-[200px] p-4 border-l border-slate-800 bg-slate-900 shadow-2xl z-20 overflow-y-auto">
          <LayerSidebar layers={layerConfigs} activeLayer={activeLayer} onLayerSelect={setActiveLayer} onLayerVisibilityChange={handleLayerVisibilityChange} />
        </div>
      </div>

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-8 shadow-2xl relative">
            <button onClick={() => setShowHelp(false)} className="absolute top-6 right-6 p-2 text-slate-500">✕</button>
            <h3 className="text-2xl font-black mb-6 text-white italic">操作指南</h3>
            <div className="space-y-4 text-slate-300 text-sm">
              <p>1. 选择方向并上传背景</p>
              <p>2. 选中图层进行拖拽调整</p>
              <p>3. 导入视频开始批量合成</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoMergeMode;