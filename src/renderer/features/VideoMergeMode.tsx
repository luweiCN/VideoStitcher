import React, { useState, useEffect, useMemo } from 'react';
import {
  FileVideo, ImageIcon, Play, Trash2, Loader2, ArrowLeft, FolderOpen,
  Settings, CheckCircle, RefreshCcw, Maximize, Monitor, ZoomIn, ZoomOut
} from 'lucide-react';
import { MaterialPositions, LayerId, LayerConfig } from '../types';
import VideoEditor from '../components/VideoEditor';
import LayerSidebar from '../components/LayerSidebar';
import { getCanvasConfig, getInitialPositions, getDefaultLayerConfigs } from '../utils/positionCalculator';

interface VideoMergeModeProps {
  onBack: () => void;
}

/**
 * 统一的视频极速合成模式
 *
 * 功能：
 * - 支持横屏和竖屏两种画布方向
 * - 支持 A 面 + B 面视频合成
 * - 支持背景图和封面图独立位置调整
 * - 交互式编辑器支持拖拽和缩放
 * - 批量处理支持
 * - 图层侧边栏管理所有素材
 */
const VideoMergeMode: React.FC<VideoMergeModeProps> = ({ onBack }) => {
  // 画布方向状态
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');

  // 画布配置（根据方向动态计算）
  const canvasConfig = useMemo(() => getCanvasConfig(orientation), [orientation]);

  // 素材路径
  const [materials, setMaterials] = useState({
    aVideo: undefined as string | undefined,
    bVideo: undefined as string | undefined,
    bgImage: undefined as string | undefined,
    coverImage: undefined as string | undefined,
  });

  // 视频和素材列表
  const [videos, setVideos] = useState<string[]>([]);
  const [sideAVideos, setSideAVideos] = useState<string[]>([]);
  const [covers, setCovers] = useState<string[]>([]);

  // 视频元数据缓存（用于切换方向时重新计算位置）
  const [aVideoMetadata, setAVideoMetadata] = useState<{ width: number; height: number; duration: number } | undefined>();
  const [bVideoMetadata, setBVideoMetadata] = useState<{ width: number; height: number; duration: number } | undefined>();
  const [coverImageMetadata, setCoverImageMetadata] = useState<{ width: number; height: number } | undefined>();

  // 素材位置（统一管理）
  const [materialPositions, setMaterialPositions] = useState<MaterialPositions>(() =>
    getInitialPositions(canvasConfig)
  );

  // 图层配置：A面、背景图、封面图始终锁定，只有B面可编辑
  const lockedLayers = useMemo(() => new Set<LayerId>(['aVideo', 'bgImage', 'coverImage']), []);

  // 画布缩放状态
  const [canvasZoom, setCanvasZoom] = useState<number>(100);

  // 鼠标滚轮缩放画布
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // 只在按住 Ctrl 键时响应缩放
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -10 : 10;
      setCanvasZoom(prev => Math.max(25, Math.min(200, prev + delta)));
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  // 动态生成图层配置 - 只显示用户上传了对应素材的图层
  const layerConfigs: LayerConfig[] = useMemo(() => {
    const defaultConfigs = getDefaultLayerConfigs();
    const availableLayers: LayerConfig[] = [];

    // B面视频（主视频）始终显示
    availableLayers.push({
      ...defaultConfigs.find(l => l.id === 'bVideo')!,
      visible: true,
      locked: lockedLayers.has('bVideo'),
    });

    // A面视频 - 如果上传了才显示
    if (sideAVideos.length > 0) {
      availableLayers.push({
        ...defaultConfigs.find(l => l.id === 'aVideo')!,
        visible: true,
        locked: lockedLayers.has('aVideo'),
      });
    }

    // 背景图 - 如果上传了才显示
    if (materials.bgImage) {
      availableLayers.push({
        ...defaultConfigs.find(l => l.id === 'bgImage')!,
        visible: true,
        locked: lockedLayers.has('bgImage'),
      });
    }

    // 封面图 - 如果上传了才显示
    if (covers.length > 0) {
      availableLayers.push({
        ...defaultConfigs.find(l => l.id === 'coverImage')!,
        visible: true,
        locked: lockedLayers.has('coverImage'),
      });
    }

    return availableLayers;
  }, [sideAVideos.length, materials.bgImage, covers.length, lockedLayers]);

  // 激活图层 - 当当前激活的图层不在可用图层中时，自动切换到 B 面视频
  const [activeLayer, setActiveLayer] = useState<LayerId>('bVideo');

  // 当可用图层变化时，确保当前激活图层仍然可用
  useEffect(() => {
    const availableLayerIds = layerConfigs.map(l => l.id);
    if (!availableLayerIds.includes(activeLayer)) {
      // 如果当前激活的图层不可用了，切换到第一个可用图层
      if (availableLayerIds.length > 0) {
        setActiveLayer(availableLayerIds[0] as LayerId);
      }
    }
  }, [layerConfigs, activeLayer]);

  // 其他状态
  const [outputDir, setOutputDir] = useState<string>('');
  const [showHelp, setShowHelp] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [concurrency, setConcurrency] = useState(3);
  const [exportMultiplier, setExportMultiplier] = useState<1 | 2 | 3>(1);
  const [progress, setProgress] = useState({ done: 0, failed: 0, total: 0 });
  const [logs, setLogs] = useState<string[]>([]);

  // 当画布方向改变时，重置为该方向的默认位置（不使用元数据，确保切换时立即生效）
  useEffect(() => {
    setMaterialPositions(getInitialPositions(canvasConfig));
  }, [canvasConfig]);

  // 添加日志
  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // 监听视频处理事件
  useEffect(() => {
    const cleanup = () => {
      window.api.removeAllListeners('video-start');
      window.api.removeAllListeners('video-progress');
      window.api.removeAllListeners('video-failed');
      window.api.removeAllListeners('video-finish');
      window.api.removeAllListeners('video-log');
    };

    window.api.onVideoStart((data) => {
      addLog(`开始处理: 总任务 ${data.total}, 并发 ${data.concurrency}`);
      setProgress({ done: 0, failed: 0, total: data.total });
    });

    window.api.onVideoProgress((data) => {
      setProgress({ done: data.done, failed: data.failed, total: data.total });
      addLog(`进度: ${data.done}/${data.total} (失败 ${data.failed})`);
    });

    window.api.onVideoFailed((data) => {
      addLog(`❌ 任务 ${data.index + 1} 失败: ${data.error}`);
    });

    window.api.onVideoFinish((data) => {
      addLog(`✅ 完成! 成功 ${data.done}, 失败 ${data.failed}`);
      setIsProcessing(false);
    });

    window.api.onVideoLog((data) => {
      addLog(`[任务 ${data.index + 1}] ${data.message}`);
    });

    return cleanup;
  }, []);

  // 选择背景图（单张）
  const handleSelectBgImage = async () => {
    try {
      const files = await window.api.pickFiles('选择背景图片', [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] },
      ], false); // 限制只能选一张
      if (files.length > 0) {
        setMaterials(prev => ({ ...prev, bgImage: files[0] }));
        addLog(`已选择背景图: ${files[0]}`);
      }
    } catch (err) {
      addLog(`选择背景图失败: ${err}`);
    }
  };

  // 选择主视频
  const handleSelectVideos = async () => {
    try {
      const files = await window.api.pickFiles('选择主视频 (B面)', [
        { name: 'Videos', extensions: ['mp4', 'mov', 'mkv', 'm4v', 'avi'] },
      ]);
      if (files.length > 0) {
        setVideos(files);
        addLog(`已选择 ${files.length} 个主视频`);

        // 获取第一个视频的元数据并更新 B 面控件位置
        try {
          const metadata = await window.api.getVideoMetadata(files[0]);
          setBVideoMetadata(metadata); // 缓存元数据
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

  // 选择 A 面视频
  const handleSelectSideAVideos = async () => {
    try {
      const files = await window.api.pickFiles('选择A面视频', [
        { name: 'Videos', extensions: ['mp4', 'mov', 'mkv', 'm4v', 'avi'] },
      ]);
      if (files.length > 0) {
        setSideAVideos(files);
        addLog(`已选择 ${files.length} 个A面视频`);

        // 获取第一个视频的元数据并更新 A 面控件位置
        try {
          const metadata = await window.api.getVideoMetadata(files[0]);
          setAVideoMetadata(metadata); // 缓存元数据
          const newPositions = getInitialPositions(canvasConfig, bVideoMetadata, metadata, coverImageMetadata);
          console.log('[DEBUG A面视频] 原始尺寸:', metadata.width, 'x', metadata.height);
          console.log('[DEBUG A面视频] 计算后的控件位置:', newPositions.aVideo);
          setMaterialPositions(prev => ({ ...prev, aVideo: newPositions.aVideo }));
          addLog(`A 面视频: ${metadata.width}x${metadata.height}, 控件: ${Math.round(newPositions.aVideo.width)}x${Math.round(newPositions.aVideo.height)}`);
        } catch (err) {
          addLog(`无法读取视频元数据，使用默认位置`);
        }
      }
    } catch (err) {
      addLog(`选择A面视频失败: ${err}`);
    }
  };

  // 选择封面
  const handleSelectCovers = async () => {
    try {
      const files = await window.api.pickFiles('选择封面图片', [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] },
      ]);
      if (files.length > 0) {
        setCovers(files);
        addLog(`已选择 ${files.length} 个封面`);

        // 获取第一张图片的元数据并更新封面图控件位置
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

  // 选择输出目录
  const handleSelectOutputDir = async () => {
    try {
      const dir = await window.api.pickOutDir();
      if (dir) {
        setOutputDir(dir);
        addLog(`输出目录: ${dir}`);
      }
    } catch (err) {
      addLog(`选择输出目录失败: ${err}`);
    }
  };

  // 处理位置变化
  const handlePositionChange = (id: LayerId, position: { x: number; y: number; width: number; height: number }) => {
    setMaterialPositions(prev => ({
      ...prev,
      [id]: position,
    }));
  };

  // 处理图层可见性变化（暂时禁用，因为可见性由素材是否存在决定）
  const handleLayerVisibilityChange = (id: LayerId, visible: boolean) => {
    // 暂时不做任何操作，可见性由素材上传状态决定
    // 如果需要，可以添加额外的状态来控制可见性
  };

  // 重置位置
  const resetPositions = () => {
    const defaults = getInitialPositions(canvasConfig, bVideoMetadata, aVideoMetadata, coverImageMetadata);
    setMaterialPositions(defaults);
    addLog('已重置素材位置');
  };

  // 铺满全屏
  const maximizePositions = () => {
    const maxPosition = {
      x: 0,
      y: 0,
      width: canvasConfig.width,
      height: canvasConfig.height,
    };
    setMaterialPositions({
      bgImage: { ...maxPosition },
      aVideo: { ...maxPosition },
      bVideo: { ...maxPosition },
      coverImage: { ...maxPosition },
    });
    addLog('已设置素材铺满全屏');
  };

  // 开始处理
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
    addLog(`导出倍数: ×${exportMultiplier}`);
    addLog(`主视频: ${videos.length} 个`);
    addLog(`预计生成: ${videos.length * exportMultiplier} 个视频`);
    addLog(`A面视频: ${sideAVideos.length} 个`);
    addLog(`背景图: ${materials.bgImage ? '已设置' : '无'}`);
    addLog(`封面: ${covers.length} 个`);
    addLog(`A面位置: x=${Math.round(materialPositions.aVideo.x)}, y=${Math.round(materialPositions.aVideo.y)}, size=${Math.round(materialPositions.aVideo.width)}x${Math.round(materialPositions.aVideo.height)}`);
    addLog(`B面位置: x=${Math.round(materialPositions.bVideo.x)}, y=${Math.round(materialPositions.bVideo.y)}, size=${Math.round(materialPositions.bVideo.width)}x${Math.round(materialPositions.bVideo.height)}`);
    addLog(`背景位置: x=${Math.round(materialPositions.bgImage.x)}, y=${Math.round(materialPositions.bgImage.y)}, size=${Math.round(materialPositions.bgImage.width)}x${Math.round(materialPositions.bgImage.height)}`);
    addLog(`封面位置: x=${Math.round(materialPositions.coverImage.x)}, y=${Math.round(materialPositions.coverImage.y)}, size=${Math.round(materialPositions.coverImage.width)}x${Math.round(materialPositions.coverImage.height)}`);

    // 根据导出倍数扩展素材列表
    // 参考 VideoMaster 的扑克牌发牌算法
    const totalTasks = videos.length * exportMultiplier;
    const expandedAVideos: string[] = [];
    const expandedCovers: string[] = [];

    // 扩展 A 面视频（如果有）
    if (sideAVideos.length > 0) {
      let pool = [...sideAVideos];
      pool.sort(() => 0.5 - Math.random()); // 初始打乱

      for (let k = 0; k < totalTasks; k++) {
        if (pool.length === 0) {
          // 池子空了，重新填充并打乱
          pool = [...sideAVideos];
          pool.sort(() => 0.5 - Math.random());
        }
        expandedAVideos.push(pool.pop()!);
      }
    }

    // 扩展封面图（如果有）
    if (covers.length > 0) {
      for (let k = 0; k < totalTasks; k++) {
        const randomCover = covers[Math.floor(Math.random() * covers.length)];
        expandedCovers.push(randomCover);
      }
    }

    // 扩展 B 面视频（每个原视频重复 exportMultiplier 次）
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

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          返回首页
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-black flex items-center gap-2 text-white">
            极速合成
          </h1>
          {/* 画布方向切换 */}
          <div className="flex items-center bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setOrientation('horizontal')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                orientation === 'horizontal'
                  ? `bg-${primaryColor}-600 text-white`
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              横屏
            </button>
            <button
              onClick={() => setOrientation('vertical')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                orientation === 'vertical'
                  ? `bg-${primaryColor}-600 text-white`
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              竖屏
            </button>
          </div>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* 左侧侧边栏 */}
        <div className="w-full md:w-[400px] p-6 border-r border-slate-800 flex flex-col gap-5 bg-slate-900 shadow-2xl z-20 overflow-y-auto">
          {/* 背景图 */}
          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3">
            <h2 className="text-[11px] font-black text-violet-400 uppercase tracking-widest flex items-center gap-2">
              第一步：设置背景 (可选)
            </h2>
            <button
              onClick={handleSelectBgImage}
              className="group relative block w-full aspect-video rounded-xl border-2 border-dashed border-slate-800 hover:border-violet-500 transition-all overflow-hidden bg-slate-900"
            >
              {materials.bgImage ? (
                <img
                  src={`preview://${encodeURIComponent(materials.bgImage)}`}
                  alt="背景"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                  <ImageIcon className="w-6 h-6 mb-2 text-slate-700 group-hover:text-violet-500 transition-colors" />
                  <span className="text-[10px] text-slate-500 font-bold text-center">
                    点击上传背景图
                  </span>
                </div>
              )}
            </button>
          </div>

          {/* 主视频 */}
          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3 flex flex-col">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-black text-violet-400 uppercase tracking-widest flex items-center gap-2">
                第二步：导入b面视频 (必选)
              </h2>
            </div>

            <div className="flex-1 flex flex-col justify-center min-h-[120px]">
              <button
                onClick={handleSelectVideos}
                className="group relative block w-full rounded-xl border-2 border-dashed border-slate-800 hover:border-violet-500 transition-all overflow-hidden bg-slate-900"
              >
                <div className="flex flex-col items-center justify-center p-6">
                  <FileVideo className="w-8 h-8 mb-2 text-slate-700 group-hover:text-violet-500 transition-colors" />
                  <span className="text-[11px] text-slate-500 font-bold text-center">
                    点击添加b面视频 (支持批量)
                  </span>
                  {videos.length > 0 && (
                    <span className="text-[10px] text-emerald-400 mt-2">
                      已选择 {videos.length} 个视频
                    </span>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* A面视频 */}
          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-black text-violet-400 uppercase tracking-widest flex items-center gap-2">
                第三步：A面添加 (可选)
              </h2>
              {sideAVideos.length > 0 && (
                <button
                  onClick={() => setSideAVideos([])}
                  className="text-[10px] text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  清空
                </button>
              )}
            </div>

            <button
              onClick={handleSelectSideAVideos}
              className={`group relative block w-full p-4 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                sideAVideos.length > 0
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-slate-800 hover:border-violet-500 bg-slate-900'
              }`}
            >
              <div className="flex flex-col items-center justify-center text-center">
                {sideAVideos.length > 0 ? (
                  <>
                    <CheckCircle className="w-6 h-6 mb-2 text-emerald-500" />
                    <span className="text-[10px] text-emerald-400 font-bold">
                      已添加 {sideAVideos.length} 个 A 面素材
                    </span>
                    <span className="text-[9px] text-emerald-600 mt-1">
                      将在生成时随机抽取拼接到片头
                    </span>
                  </>
                ) : (
                  <>
                    <FileVideo className="w-6 h-6 mb-2 text-slate-700 group-hover:text-violet-500 transition-colors" />
                    <span className="text-[10px] text-slate-500 font-bold">
                      点击添加 A 面视频 (支持批量)
                    </span>
                    <span className="text-[9px] text-slate-600 mt-1">
                      如果不添加，则按原逻辑仅生成第二步视频
                    </span>
                  </>
                )}
              </div>
            </button>
          </div>

          {/* 封面 */}
          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-black text-violet-400 uppercase tracking-widest flex items-center gap-2">
                第四步：视频封面 (可选)
              </h2>
              {covers.length > 0 && (
                <button
                  onClick={() => setCovers([])}
                  className="text-[10px] text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  清空
                </button>
              )}
            </div>

            <button
              onClick={handleSelectCovers}
              className={`group relative block w-full p-4 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                covers.length > 0
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-slate-800 hover:border-violet-500 bg-slate-900'
              }`}
            >
              <div className="flex flex-col items-center justify-center text-center">
                {covers.length > 0 ? (
                  <>
                    <CheckCircle className="w-6 h-6 mb-2 text-emerald-500" />
                    <span className="text-[10px] text-emerald-400 font-bold">
                      已添加 {covers.length} 张封面
                    </span>
                    <span className="text-[9px] text-emerald-600 mt-1">
                      随机选取并设为视频第一帧
                    </span>
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-6 h-6 mb-2 text-slate-700 group-hover:text-violet-500 transition-colors" />
                    <span className="text-[10px] text-slate-500 font-bold">
                      点击添加封面图片 (支持批量)
                    </span>
                    <span className="text-[9px] text-slate-600 mt-1">
                      如果不添加，则默认为视频第一帧
                    </span>
                  </>
                )}
              </div>
            </button>
          </div>

          {/* 控制与设置 */}
          <div className="space-y-4 pt-2">
            {/* 输出目录 */}
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div className="flex flex-col min-w-0 mr-2">
                <span className="text-[11px] font-bold text-slate-300">导出位置</span>
                <span className="text-[9px] text-slate-500 truncate" title={outputDir || '默认下载文件夹'}>
                  {outputDir ? `📂 ${outputDir.split('/').pop()}` : '默认下载文件夹'}
                </span>
              </div>
              <button
                onClick={handleSelectOutputDir}
                className="px-3 py-1.5 bg-slate-900 hover:bg-violet-600/20 hover:text-violet-400 border border-slate-700 hover:border-violet-500/50 rounded-lg text-[10px] font-bold transition-all flex items-center gap-2 shrink-0"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                选择文件夹
              </button>
            </div>

            {/* 导出倍数 */}
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-slate-300">导出倍数</span>
                <span className="text-[9px] text-slate-500">
                  预计导出 <span className={`font-bold ${exportMultiplier > 1 ? 'text-violet-400' : ''}`}>{videos.length * exportMultiplier}</span> 条视频
                </span>
              </div>
              <div className="flex gap-2">
                {[2, 3].map(m => (
                  <button
                    key={m}
                    onClick={() => setExportMultiplier(prev => prev === m ? 1 : m as 1 | 2 | 3)}
                    className={`w-8 h-8 rounded-lg text-[10px] font-bold transition-all border ${
                      exportMultiplier === m
                        ? `bg-${primaryColor}-600 border-${primaryColor}-500 text-white shadow-[0_0_10px_rgba(139,92,246,0.5)]`
                        : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-violet-500/50 hover:text-violet-400'
                    }`}
                    disabled={isProcessing}
                  >
                    ×{m}
                  </button>
                ))}
              </div>
            </div>

            {/* 并发数 */}
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-slate-300">并发数</span>
                <span className="text-[9px] text-slate-500">推荐: CPU 核心数 - 1</span>
              </div>
              <input
                type="number"
                min="1"
                max="8"
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white text-center text-sm"
                disabled={isProcessing}
              />
            </div>

            {/* 开始按钮 */}
            <button
              onClick={startProcessing}
              disabled={videos.length === 0 || isProcessing || !outputDir}
              className={`w-full py-5 bg-gradient-to-r from-${primaryColor}-600 to-${primaryColor}-700 hover:from-${primaryColor}-500 hover:to-${primaryColor}-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 font-black rounded-2xl transition-all flex items-center justify-center gap-3 shadow-2xl shadow-${primaryColor}-900/40`}
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

          {/* 处理日志 */}
          <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
            <h3 className="text-[10px] font-bold text-slate-400 mb-2">处理日志</h3>
            <div className="h-32 overflow-y-auto text-[9px] font-mono space-y-0.5">
              {logs.length === 0 ? (
                <div className="text-slate-600 text-center py-4">暂无日志</div>
              ) : (
                logs.map((log, i) => (
                  <div
                    key={i}
                    className={
                      log.includes('❌')
                        ? 'text-red-400'
                        : log.includes('✅')
                        ? 'text-green-400'
                        : 'text-slate-400'
                    }
                  >
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 主画布区域 */}
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

            {/* 底部控制栏 */}
            <div className="mt-8 flex flex-col items-center gap-4">
              {/* 第一行：操作按钮和缩放 */}
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

                {/* 缩放控制 */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCanvasZoom(prev => Math.min(200, prev + 25))}
                    className="w-7 h-7 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded flex items-center justify-center text-white transition-colors"
                    title="放大"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <div className="bg-slate-800 px-3 py-1 rounded border border-slate-700 min-w-[60px] text-center">
                    <span className="text-xs font-bold text-white">{canvasZoom}%</span>
                  </div>
                  <button
                    onClick={() => setCanvasZoom(prev => Math.max(25, prev - 25))}
                    className="w-7 h-7 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded flex items-center justify-center text-white transition-colors"
                    title="缩小"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="w-px h-4 bg-slate-800" />
                <p className="text-[11px] font-mono text-violet-400">
                  分辨率: {canvasConfig.width} × {canvasConfig.height} ({modeText}标准)
                </p>
              </div>

              {/* 第二行：键盘操作提示 */}
              <div className="bg-slate-900/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-slate-700">
                <p className="text-[10px] text-slate-400 flex items-center justify-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="font-mono">↑↓←→</span>
                    <span>方向键移动</span>
                  </span>
                  <span className="text-slate-700">|</span>
                  <span className="flex items-center gap-1">
                    <span className="font-mono">Shift + 方向键</span>
                    <span>快速移动</span>
                  </span>
                  <span className="text-slate-700">|</span>
                  <span className="flex items-center gap-1">
                    <span className="font-mono">Ctrl + 滚轮</span>
                    <span>缩放画布</span>
                  </span>
                </p>
              </div>
            </div>
          </div>
        </main>

        {/* 右侧图层侧边栏 */}
        <div className="w-full md:w-[200px] p-4 border-l border-slate-800 bg-slate-900 shadow-2xl z-20 overflow-y-auto">
          <LayerSidebar
            layers={layerConfigs}
            activeLayer={activeLayer}
            onLayerSelect={setActiveLayer}
            onLayerVisibilityChange={handleLayerVisibilityChange}
          />
        </div>
      </div>

      {/* 帮助弹窗 */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-8 shadow-2xl relative">
            <button
              onClick={() => setShowHelp(false)}
              className="absolute top-6 right-6 p-2 text-slate-500"
            >
              ✕
            </button>
            <h3 className="text-2xl font-black mb-6 text-white italic">最快操作指南 🚀</h3>
            <div className="space-y-5">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center shrink-0 font-black">
                  1
                </div>
                <p className="text-slate-300 text-sm">
                  选择画布方向（横屏或竖屏），上传对应尺寸的背景图。
                </p>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center shrink-0 font-black">
                  2
                </div>
                <p className="text-slate-300 text-sm">
                  在左侧图层栏中选中要调整的素材图层。
                </p>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center shrink-0 font-black">
                  3
                </div>
                <p className="text-slate-300 text-sm">
                  <strong>按住中间</strong>拖动位置，<strong>拉动右下角</strong>调整大小。
                </p>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center shrink-0 font-black">
                  4
                </div>
                <p className="text-slate-300 text-sm">点"添加视频"选好所有想处理的视频。</p>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center shrink-0 font-black">
                  5
                </div>
                <p className="text-slate-300 text-sm">
                  点底部的<strong>紫色大按钮</strong>，剩下的就交给电脑显卡，它会一个接一个帮你做好！
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoMergeMode;
