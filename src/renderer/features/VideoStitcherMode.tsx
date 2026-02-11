import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Upload, Loader2, Settings, Film, Link2,
  Eye, X, Play, Monitor, Smartphone, Plus, Trash2
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import OutputDirSelector from '../components/OutputDirSelector';
import ConcurrencySelector from '../components/ConcurrencySelector';
import OperationLogPanel from '../components/OperationLogPanel';
import { FileSelector, FileSelectorGroup } from '../components/FileSelector';
import { Button } from '../components/Button/Button';
import { useOutputDirCache } from '../hooks/useOutputDirCache';
import { useConcurrencyCache } from '../hooks/useConcurrencyCache';
import { useOperationLogs } from '../hooks/useOperationLogs';
import { useVideoProcessingEvents } from '../hooks/useVideoProcessingEvents';

interface VideoStitcherModeProps {
  onBack: () => void;
}

type Orientation = 'landscape' | 'portrait';

interface VideoFile {
  id: string;
  path: string;
  name: string;
  size: number;
  duration?: number;
}

interface CombinationItem {
  id: string;
  aVideo: VideoFile;
  bVideo: VideoFile;
  outputName: string;
  index: number;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
}

const VideoStitcherMode: React.FC<VideoStitcherModeProps> = ({ onBack }) => {
  // 素材状态 - 改为存储文件路径
  const [aFiles, setAFiles] = useState<string[]>([]);
  const [bFiles, setBFiles] = useState<string[]>([]);

  // 配置状态
  const { outputDir, setOutputDir } = useOutputDirCache('VideoStitcherMode');
  const { concurrency, setConcurrency } = useConcurrencyCache('VideoStitcherMode');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, failed: 0, total: 0 });

  // 组合项处理状态
  const [comboStatusMap, setComboStatusMap] = useState<Record<string, 'pending' | 'processing' | 'completed' | 'failed'>>({});

  // 日志管理
  const {
    logs,
    addLog,
    clearLogs,
    copyLogs,
    downloadLogs,
    logsEndRef,
    logsContainerRef,

    // 自动滚动相关
    autoScrollEnabled,
    setAutoScrollEnabled,
    autoScrollPaused,
    resumeAutoScroll,
    scrollToBottom,
    scrollToTop,
    onUserInteractStart,
  } = useOperationLogs({
    moduleNameCN: 'A+B前后拼接',
    moduleNameEN: 'VideoStitcher',
  });

  // 预览相关
  const [orientation, setOrientation] = useState<Orientation>('landscape');
  const [selectedComboIndex, setSelectedComboIndex] = useState<number>(0);
  const [previewModalVideo, setPreviewModalVideo] = useState<VideoFile | null>(null);
  const modalVideoRef = useRef<HTMLVideoElement>(null);

  // 拼接预览相关状态 - 简化版：生成预览视频后播放
  const [previewVideoPath, setPreviewVideoPath] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // 画布配置
  const canvasConfig = useMemo(() => {
    return orientation === 'landscape'
      ? { width: 1920, height: 1080, label: '1920×1080', aspectRatio: '16/9' }
      : { width: 1080, height: 1920, label: '1080×1920', aspectRatio: '9/16' };
  }, [orientation]);

  // 计算合成视频列表
  // 规则：每个素材都要被使用，循环使用数量较少的库
  const combinations: CombinationItem[] = useMemo(() => {
    if (aFiles.length === 0 || bFiles.length === 0) return [];
    const totalCount = Math.max(aFiles.length, bFiles.length);
    return Array.from({ length: totalCount }, (_, index) => {
      const aPath = aFiles[index % aFiles.length];
      const bPath = bFiles[index % bFiles.length];
      const aName = aPath.split(/[/\\]/).pop() || aPath;
      const bName = bPath.split(/[/\\]/).pop() || bPath;
      const outputName = `${aName.split('.')[0]}_${bName.split('.')[0]}.mp4`;
      const comboId = `combo-${index}`;
      // 创建临时的 VideoFile 对象用于组合项
      const aVideo: VideoFile = {
        id: `a-${index}`,
        path: aPath,
        name: aName,
        size: 0,
      };
      const bVideo: VideoFile = {
        id: `b-${index}`,
        path: bPath,
        name: bName,
        size: 0,
      };
      return {
        id: comboId,
        aVideo,
        bVideo,
        outputName,
        index,
        status: comboStatusMap[comboId] || 'pending'
      };
    });
  }, [aFiles, bFiles, comboStatusMap]);

  // 加载全局默认配置
  useEffect(() => {
    const loadGlobalSettings = async () => {
      try {
        const result = await window.api.getGlobalSettings();
        if (result) {
          // 设置默认线程数量
          if (result.defaultConcurrency) {
            setConcurrency(result.defaultConcurrency);
          }
        }
      } catch (err) {
        console.error('加载全局配置失败:', err);
      }
    };

    loadGlobalSettings();
  }, []); // 只在组件挂载时加载一次

  // 当组合变化时，确保选中的索引有效
  useEffect(() => {
    if (combinations.length > 0 && selectedComboIndex >= combinations.length) {
      setSelectedComboIndex(0);
    }
  }, [combinations, selectedComboIndex]);

  const selectedCombo = combinations[selectedComboIndex];

  // 记录当前正在生成的预览标识（基于文件路径和方向，更稳定）
  const currentPreviewKeyRef = useRef<string>('');
  // 取消标记：用于标记预览生成是否被取消
  const isPreviewCancelledRef = useRef(false);

  // 自动生成预览视频：当选中的组合或横竖屏变化时
  useEffect(() => {
    if (!selectedCombo) return;

    // 使用文件路径和方向作为唯一标识，更稳定
    const previewKey = `${selectedCombo.aVideo.path}-${selectedCombo.bVideo.path}-${orientation}`;

    // 如果是同一个预览，跳过
    if (currentPreviewKeyRef.current === previewKey) {
      return;
    }

    currentPreviewKeyRef.current = previewKey;
    isPreviewCancelledRef.current = false; // 重置取消标记

    // 立即清空旧预览并显示 loading
    setPreviewVideoPath(null);
    setIsGeneratingPreview(true);

    // 防抖延迟 - 避免快速切换时频繁触发
    const debounceTimer = setTimeout(async () => {
      addLog(`[预览] 正在生成 ${selectedCombo.outputName} 的预览视频 (${orientation === 'landscape' ? '横屏' : '竖屏'})`);

      try {
        const result = await window.api.generateStitchPreview({
          aPath: selectedCombo.aVideo.path,
          bPath: selectedCombo.bVideo.path,
          orientation
        });

        // 检查是否还是当前预览或已被取消
        if (isPreviewCancelledRef.current || currentPreviewKeyRef.current !== previewKey) {
          // 已经切换到其他预览，删除这个临时文件
          if (result.tempPath) {
            window.api.deleteTempPreview(result.tempPath);
          }
          addLog(`[预览] 已切换，忽略 ${selectedCombo.outputName} 的预览结果`, 'warning');
          return;
        }

        if (result.success && result.tempPath) {
          setPreviewVideoPath(result.tempPath);
          addLog(`[预览] ${selectedCombo.outputName} 预览视频生成完成`, 'success');
        } else {
          addLog(`[错误] 预览生成失败: ${result.error}`, 'error');
        }
      } catch (err: any) {
        addLog(`[错误] 预览生成异常: ${err.message}`, 'error');
      } finally {
        // 只有未取消的任务才更新状态
        if (!isPreviewCancelledRef.current) {
          setIsGeneratingPreview(false);
        }
      }
    }, 300); // 300ms 防抖延迟

    // 清理函数：取消预览生成
    return () => {
      clearTimeout(debounceTimer);
      isPreviewCancelledRef.current = true; // 标记为已取消
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCombo, orientation]);

  // 预览视频加载完成后自动播放并设置音量
  useEffect(() => {
    const video = previewVideoRef.current;
    if (video && previewVideoPath) {
      video.volume = 0.1;
      video.play().catch(() => {
        console.log('[预览] 自动播放被阻止，静音播放');
        video.muted = true;
        video.play().catch(() => {});
      });
    }
  }, [previewVideoPath]);

  // 清理预览视频（组件卸载或切换时删除旧预览）
  useEffect(() => {
    return () => {
      if (previewVideoPath) {
        window.api.deleteTempPreview(previewVideoPath);
      }
    };
  }, [previewVideoPath]);

  // 格式化文件大小
  const formatSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  // 格式化时长
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 格式化时间显示（分:秒）
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 文件选择处理 - 使用 FileSelector
  const handleAFilesChange = useCallback((files: string[]) => {
    setAFiles(files);
  }, []);

  const handleBFilesChange = useCallback((files: string[]) => {
    setBFiles(files);
  }, []);

  // 删除文件
  const removeFile = (id: string, side: 'a' | 'b') => {
    if (side === 'a') {
      setAFiles(prev => prev.filter(f => f.id !== id));
    } else {
      setBFiles(prev => prev.filter(f => f.id !== id));
    }
  };

  // 清空文件
  const clearFiles = (side: 'a' | 'b') => {
    if (side === 'a') {
      setAFiles([]);
    } else {
      setBFiles([]);
    }
    setSelectedComboIndex(0);
  };

  // 监听 A+B 前后拼接任务事件
  useVideoProcessingEvents({
    onStart: (data) => {
      setProgress({ done: 0, failed: 0, total: data.total });
      addLog(`开始处理 ${data.total} 个合成任务...`);
      // 重置所有状态为 pending
      const newStatusMap: Record<string, 'pending' | 'processing' | 'completed' | 'failed'> = {};
      combinations.forEach(combo => {
        newStatusMap[combo.id] = 'pending';
      });
      setComboStatusMap(newStatusMap);
    },
    onTaskStart: (data) => {
      setComboStatusMap(prev => ({
        ...prev,
        [`combo-${data.index}`]: 'processing'
      }));
    },
    onLog: (data) => {
      addLog(data.message);
    },
    onProgress: (data) => {
      setProgress({ done: data.done, failed: data.failed, total: data.total });
      // 更新对应组合项的状态为 completed
      if (data.index !== undefined) {
        setComboStatusMap(prev => ({
          ...prev,
          [`combo-${data.index}`]: 'completed'
        }));
      }
    },
    onFailed: (data) => {
      addLog(`[错误] 任务 #${data.index + 1} 处理失败: ${data.error || '未知错误'}`, 'error');
      setComboStatusMap(prev => ({
        ...prev,
        [`combo-${data.index}`]: 'failed'
      }));
    },
    onFinish: (data) => {
      setIsProcessing(false);
      addLog(`所有任务完成! 成功: ${data.done}, 失败: ${data.failed}`, 'success');
    },
  });

  // 开始合成
  const startMerge = async () => {
    if (aFiles.length === 0 || bFiles.length === 0) return;
    if (!outputDir) {
      const dir = await window.api.pickOutDir();
      if (dir) {
        setOutputDir(dir);
      } else {
        return;
      }
    }
    if (isProcessing) return;

    setIsProcessing(true);
    clearLogs();

    try {
      const aPaths = aFiles.map(f => f.path);
      const bPaths = bFiles.map(f => f.path);
      await window.api.videoStitchAB({
        aFiles: aPaths,
        bFiles: bPaths,
        outputDir,
        orientation,
        concurrency: concurrency === 0 ? undefined : concurrency
      });
    } catch (err: any) {
      console.error('合成失败:', err);
      setIsProcessing(false);
      addLog(`❌ 合成失败: ${err.message || err}`, 'error');
    }
  };

  // 获取预览 URL
  const getPreviewUrl = (path: string) => {
    return `preview://${encodeURIComponent(path)}`;
  };

  // 打开预览弹窗
  const openPreviewModal = (video: VideoFile) => {
    setPreviewModalVideo(video);
  };

  // 关闭预览弹窗
  const closePreviewModal = () => {
    setPreviewModalVideo(null);
    if (modalVideoRef.current) {
      modalVideoRef.current.pause();
    }
  };

  // 弹窗打开时自动播放并设置音量
  useEffect(() => {
    if (previewModalVideo && modalVideoRef.current) {
      modalVideoRef.current.volume = 0.1;
      modalVideoRef.current.play().catch(() => {
        if (modalVideoRef.current) {
          modalVideoRef.current.muted = true;
          modalVideoRef.current.play();
        }
      });
    }
  }, [previewModalVideo]);

  // 统计信息
  const stats = useMemo(() => ({
    totalCombos: combinations.length,
  }), [combinations]);

  return (
    <div className="h-screen flex flex-col bg-black text-gray-100">
      {/* Header */}
      <PageHeader
        onBack={onBack}
        title="A+B 前后拼接"
        icon={Link2}
        iconColor="text-pink-500"
        description="将两个视频前后拼接成一个完整视频"
        featureInfo={{
          title: 'A+B 前后拼接',
          description: '将两个视频素材库按顺序前后拼接，A 面在前、B 面在后，自动生成完整的拼接视频。',
          details: [
            '分别上传 A 面和 B 面视频作为素材库',
            '系统自动将两个库的视频按顺序组合',
            '较大的库会循环使用，确保每个素材都被处理',
            'A 面在前，B 面在后，顺序拼接成一个完整视频',
            '自动调整帧率为 30fps，统一输出分辨率',
          ],
          themeColor: 'pink',
        }}
        rightContent={
          /* 横竖版切换 */
          <div className="flex items-center bg-black rounded-lg p-0.5 border border-slate-800">
            <button
              onClick={() => setOrientation('landscape')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                orientation === 'landscape'
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/20'
                  : 'text-gray-400 hover:text-white'
              }`}
              type="button"
            >
              <Monitor className="w-3.5 h-3.5" />
              横版
            </button>
            <button
              onClick={() => setOrientation('portrait')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                orientation === 'portrait'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20'
                  : 'text-gray-400 hover:text-white'
              }`}
              type="button"
            >
              <Smartphone className="w-3.5 h-3.5" />
              竖版
            </button>
          </div>
        }
      />

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Upload */}
        <div className="w-80 border-r border-slate-800 bg-black flex flex-col shrink-0">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            {/* Stats Card */}
            {stats.totalCombos > 0 && (
              <div className="bg-gradient-to-br from-pink-500/10 to-violet-500/10 border border-pink-500/20 rounded-xl p-4">
                <div className="text-2xl font-bold text-pink-400">{stats.totalCombos}</div>
                <div className="text-xs text-gray-400">个合成视频</div>
              </div>
            )}

            {/* 文件选择器组 - 启用拖放和粘贴分配 */}
            <FileSelectorGroup>
              <div className="space-y-4">
                {/* A 面视频选择器 */}
                <FileSelector
                  id="videoStitcherA"
                  name="A 面视频（前段）"
                  accept="video"
                  multiple
                  showList
                  maxHeight={200}
                  themeColor="violet"
                  directoryCache
                  onChange={handleAFilesChange}
                  disabled={isProcessing}
                />

                {/* B 面视频选择器 */}
                <FileSelector
                  id="videoStitcherB"
                  name="B 面视频（后段）"
                  accept="video"
                  multiple
                  showList
                  maxHeight={200}
                  themeColor="indigo"
                  directoryCache
                  onChange={handleBFilesChange}
                  disabled={isProcessing}
                />
              </div>
            </FileSelectorGroup>
          </div>
        </div>

        {/* Main Content Area - Middle (Preview + Combinations) */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Combination List */}
          <div className="h-48 border-b border-slate-800 bg-black shrink-0">
            <div className="h-full flex items-center px-4">
              <div className="flex-1 overflow-x-auto custom-scrollbar">
                <div className="flex gap-2 py-2">
                  {combinations.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                      <div className="text-center">
                        <Link2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">添加 A/B 面视频生成合成列表</p>
                      </div>
                    </div>
                  ) : (
                    combinations.map((combo, index) => (
                      <div
                        key={combo.id}
                        onClick={() => setSelectedComboIndex(index)}
                        className={`shrink-0 w-48 p-3 rounded-xl border-2 cursor-pointer transition-all relative ${
                          selectedComboIndex === index
                            ? 'bg-pink-500/10 border-pink-500'
                            : combo.status === 'processing'
                            ? 'bg-blue-500/10 border-blue-500'
                            : combo.status === 'completed'
                            ? 'bg-green-500/10 border-green-500'
                            : combo.status === 'failed'
                            ? 'bg-rose-500/10 border-rose-500'
                            : 'bg-black/50 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {/* Status Icon Overlay */}
                        {combo.status === 'processing' && (
                          <div className="absolute top-2 right-2">
                            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                          </div>
                        )}
                        {combo.status === 'completed' && (
                          <div className="absolute top-2 right-2">
                            <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-green-400" />
                            </div>
                          </div>
                        )}
                        {combo.status === 'failed' && (
                          <div className="absolute top-2 right-2">
                            <div className="w-4 h-4 rounded-full bg-rose-500/20 flex items-center justify-center">
                              <X className="w-2.5 h-2.5 text-rose-400" />
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                            combo.status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                            combo.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            combo.status === 'failed' ? 'bg-rose-500/20 text-rose-400' :
                            'bg-pink-500/20 text-pink-400'
                          }`}>
                            {index + 1}
                          </div>
                          <span className="text-xs text-gray-400 truncate flex-1">{combo.outputName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-violet-500/20 flex items-center justify-center text-[8px] text-violet-400">A</div>
                            <span className="truncate max-w-[60px]" title={combo.aVideo.name}>{combo.aVideo.name.split('.')[0]}</span>
                          </div>
                          <span>+</span>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-indigo-500/20 flex items-center justify-center text-[8px] text-indigo-400">B</div>
                            <span className="truncate max-w-[60px]" title={combo.bVideo.name}>{combo.bVideo.name.split('.')[0]}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Preview Area */}
          <div className="flex-1 overflow-hidden bg-black">
            {selectedCombo ? (
              <div className="h-full flex">
                {/* Video Preview Canvas */}
                <div className="flex-1 flex items-center justify-center p-4">
                  <div className="relative w-full h-full flex items-center justify-center">
                    {/* Canvas Frame */}
                    <div
                      className="bg-gray-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800"
                      style={orientation === 'landscape'
                        ? { width: '640px', maxHeight: '100%', aspectRatio: '16/9' }
                        : { height: '640px', maxWidth: '100%', aspectRatio: '9/16' }
                      }
                    >
                      {/* 简化的预览区域 - 生成预览按钮或播放预览视频 */}
                      <div className="w-full h-full relative group">
                        {previewVideoPath ? (
                          // 显示生成的预览视频
                          <video
                            ref={previewVideoRef}
                            src={`preview://${encodeURIComponent(previewVideoPath)}`}
                            className="w-full h-full object-cover"
                            controls
                            autoPlay
                            loop
                            playsInline
                          />
                        ) : (
                          // 显示生成预览状态
                          <div className="w-full h-full flex flex-col items-center justify-center bg-black">
                            {isGeneratingPreview ? (
                              <>
                                <Loader2 className="w-12 h-12 text-pink-500 animate-spin mb-4" />
                                <p className="text-sm text-gray-400">正在生成预览视频...</p>
                              </>
                            ) : (
                              <>
                                <Loader2 className="w-12 h-12 text-gray-600 mb-4" />
                                <p className="text-sm text-gray-500">准备生成预览...</p>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Sidebar */}
                <div className="w-64 border-l border-slate-800 bg-black p-4 overflow-y-auto custom-scrollbar min-h-0">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">合成详情</h3>

                  {/* Output Info */}
                  <div className="bg-black/50 rounded-xl p-4 mb-4 border border-slate-800">
                    <div className="space-y-3">
                      <div>
                        <div className="text-[10px] text-gray-500 mb-1">输出文件名</div>
                        <div className="text-sm text-white truncate" title={selectedCombo.outputName}>{selectedCombo.outputName}</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] text-gray-500">输出分辨率</div>
                        <div className="text-sm text-pink-400 font-medium">{canvasConfig.label}</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] text-gray-500">输出帧率</div>
                        <div className="text-sm text-white">30 fps</div>
                      </div>
                    </div>
                  </div>

                  {/* Source Info */}
                  <div className="space-y-3">
                    <div className="bg-violet-500/5 rounded-xl p-3 border border-violet-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded bg-violet-500/20 flex items-center justify-center">
                          <Monitor className="w-3 h-3 text-violet-400" />
                        </div>
                        <span className="text-xs font-medium text-violet-400">A 面视频</span>
                      </div>
                      <p className="text-sm text-gray-300 truncate" title={selectedCombo.aVideo.name}>{selectedCombo.aVideo.name}</p>
                    </div>

                    <div className="bg-indigo-500/5 rounded-xl p-3 border border-indigo-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded bg-indigo-500/20 flex items-center justify-center">
                          <Smartphone className="w-3 h-3 text-indigo-400" />
                        </div>
                        <span className="text-xs font-medium text-indigo-400">B 面视频</span>
                      </div>
                      <p className="text-sm text-gray-300 truncate" title={selectedCombo.bVideo.name}>{selectedCombo.bVideo.name}</p>
                    </div>
                  </div>

                  {/* Preview Buttons */}
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <button
                      onClick={() => openPreviewModal(selectedCombo.aVideo)}
                      className="py-2 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 rounded-lg text-xs text-violet-400 transition-colors"
                    >
                      <Eye className="w-3 h-3 inline mr-1" />
                      预览 A 面
                    </button>
                    <button
                      onClick={() => openPreviewModal(selectedCombo.bVideo)}
                      className="py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg text-xs text-indigo-400 transition-colors"
                    >
                      <Eye className="w-3 h-3 inline mr-1" />
                      预览 B 面
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-600">
                  <Link2 className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium mb-2">开始创建你的合成视频</p>
                  <p className="text-sm">在左侧添加 A 面和 B 面视频，系统将自动计算所有组合</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Settings + Logs + Start Button */}
        <div className="w-80 border-l border-slate-800 bg-black flex flex-col shrink-0 overflow-y-hidden">
          <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            {/* Settings */}
            <div className="bg-black/50 border border-slate-800 rounded-xl p-4 space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Settings className="w-3.5 h-3.5" />
                设置
              </h3>

              <OutputDirSelector
                value={outputDir}
                onChange={setOutputDir}
                disabled={isProcessing}
                themeColor="pink"
              />

              <ConcurrencySelector
                value={concurrency}
                onChange={setConcurrency}
                disabled={isProcessing}
                themeColor="pink"
                compact
              />
            </div>

            {/* Progress Display - Always show when processing */}
            {progress.total > 0 && (
              <div className="bg-black/50 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">处理进度</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">已完成</span>
                  <span className="text-pink-400 font-bold">{progress.done}/{progress.total}</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-violet-500 to-pink-500 h-2 rounded-full transition-all"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                  />
                </div>
                {progress.failed > 0 && (
                  <div className="text-xs text-rose-400">失败: {progress.failed}</div>
                )}
              </div>
            )}

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
                // 自动滚动相关
                autoScrollEnabled={autoScrollEnabled}
                setAutoScrollEnabled={setAutoScrollEnabled}
                autoScrollPaused={autoScrollPaused}
                resumeAutoScroll={resumeAutoScroll}
                scrollToBottom={scrollToBottom}
                scrollToTop={scrollToTop}
                onUserInteractStart={onUserInteractStart}
                themeColor="pink"
              />
            </div>

            {/* Start Button */}
            <Button
              onClick={startMerge}
              disabled={isProcessing || aFiles.length === 0 || bFiles.length === 0}
              variant="primary"
              size="md"
              fullWidth
              loading={isProcessing}
              leftIcon={!isProcessing && <Play className="w-4 h-4" />}
            >
              {isProcessing ? '处理中...' : '开始合成'}
            </Button>
          </div>
        </div>
      </main>

      {/* Preview Modal */}
      {previewModalVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm" onClick={closePreviewModal}>
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={closePreviewModal}
              className="absolute -top-10 right-0 p-2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="bg-black border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white truncate">{previewModalVideo.name}</h3>
                <span className="text-xs text-gray-500">原视频尺寸 · 自动播放 · 音量 10%</span>
              </div>
              <div className="p-4 bg-black">
                <video
                  ref={modalVideoRef}
                  src={getPreviewUrl(previewModalVideo.path)}
                  className="w-full max-h-[70vh] mx-auto rounded-lg"
                  controls
                  autoPlay
                  loop
                  playsInline
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoStitcherMode;
