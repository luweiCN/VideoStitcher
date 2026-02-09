import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Upload, Loader2, FolderOpen, Settings, Film, Link2,
  Eye, X, Play, Monitor, Smartphone, Plus, Trash2
} from 'lucide-react';
import PageHeader from '../components/PageHeader';

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
  // 素材状态
  const [aFiles, setAFiles] = useState<VideoFile[]>([]);
  const [bFiles, setBFiles] = useState<VideoFile[]>([]);

  // 配置状态
  const [outputDir, setOutputDir] = useState<string>('');
  const [concurrency, setConcurrency] = useState(3);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, failed: 0, total: 0 });

  // 组合项处理状态
  const [comboStatusMap, setComboStatusMap] = useState<Record<string, 'pending' | 'processing' | 'completed' | 'failed'>>({});

  // 日志状态
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

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
      const aVideo = aFiles[index % aFiles.length];
      const bVideo = bFiles[index % bFiles.length];
      const outputName = `${aVideo.name.split('.')[0]}_${bVideo.name.split('.')[0]}.mp4`;
      const comboId = `combo-${index}`;
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

  // 日志自动滚动到底部
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 加载全局默认配置
  useEffect(() => {
    const loadGlobalSettings = async () => {
      try {
        const result = await window.api.getGlobalSettings();
        if (result) {
          // 设置默认输出目录（如果有）
          if (result.defaultOutputDir) {
            setOutputDir(result.defaultOutputDir);
          }
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

  // 自动生成预览视频：当选中的组合或横竖屏变化时
  useEffect(() => {
    if (!selectedCombo) return;

    // 立即清空旧预览并显示 loading
    setPreviewVideoPath(null);
    setIsGeneratingPreview(true);

    const generatePreview = async () => {
      setLogs(prev => [...prev, `[预览] 正在生成 ${selectedCombo.outputName} 的预览视频...`]);

      try {
        const result = await window.api.generateStitchPreview({
          aPath: selectedCombo.aVideo.path,
          bPath: selectedCombo.bVideo.path,
          orientation
        });

        if (result.success && result.tempPath) {
          setPreviewVideoPath(result.tempPath);
          setLogs(prev => [...prev, `[预览] 预览视频生成完成`]);
        } else {
          setLogs(prev => [...prev, `[错误] 预览生成失败: ${result.error}`]);
        }
      } catch (err: any) {
        setLogs(prev => [...prev, `[错误] 预览生成异常: ${err.message}`]);
      } finally {
        setIsGeneratingPreview(false);
      }
    };

    generatePreview();
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

  // 拖拽处理
  const handleDragOver = useCallback((e: React.DragEvent, side: 'a' | 'b') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, side: 'a' | 'b') => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const videoFiles = files.filter(file =>
      file.type.startsWith('video/') ||
      file.name.match(/\.(mp4|mov|avi|mkv|flv|wmv)$/i)
    );
    if (videoFiles.length === 0) return;

    const newVideos: VideoFile[] = await Promise.all(videoFiles.map(async (file) => {
      return {
        id: Math.random().toString(36).substr(2, 9),
        path: file.path,
        name: file.name,
        size: file.size,
      };
    }));

    if (side === 'a') {
      setAFiles(prev => [...prev, ...newVideos]);
    } else {
      setBFiles(prev => [...prev, ...newVideos]);
    }
  }, []);

  // 文件选择处理
  const handleFileSelect = async (side: 'a' | 'b') => {
    try {
      const files = await window.api.pickFiles(
        side === 'a' ? '选择 A 面视频（前段）' : '选择 B 面视频（后段）',
        [{ name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv'] }]
      );
      if (files.length === 0) return;

      const newVideos: VideoFile[] = await Promise.all(files.map(async (filePath) => {
        const infoResult = await window.api.getFileInfo(filePath);
        return {
          id: Math.random().toString(36).substr(2, 9),
          path: filePath,
          name: filePath.split(/[/\\]/).pop() || filePath,
          size: infoResult.success && infoResult.info ? infoResult.info.size : 0,
        };
      }));

      if (side === 'a') {
        setAFiles(prev => [...prev, ...newVideos]);
      } else {
        setBFiles(prev => [...prev, ...newVideos]);
      }
    } catch (err) {
      console.error('选择文件失败:', err);
    }
  };

  // 选择输出目录
  const handleSelectOutputDir = async () => {
    try {
      const dir = await window.api.pickOutDir();
      if (dir) setOutputDir(dir);
    } catch (err) {
      console.error('选择输出目录失败:', err);
    }
  };

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

  // 监听处理进度
  useEffect(() => {
    const cleanup = () => {
      window.api.removeAllListeners('job-start');
      window.api.removeAllListeners('job-task-start');
      window.api.removeAllListeners('job-log');
      window.api.removeAllListeners('job-progress');
      window.api.removeAllListeners('job-failed');
      window.api.removeAllListeners('job-finish');
    };

    window.api.onJobStart((data) => {
      setProgress({ done: 0, failed: 0, total: data.total });
      setLogs(prev => [...prev, `开始处理 ${data.total} 个合成任务...`]);
      // 重置所有状态为 pending
      const newStatusMap: Record<string, 'pending' | 'processing' | 'completed' | 'failed'> = {};
      combinations.forEach(combo => {
        newStatusMap[combo.id] = 'pending';
      });
      setComboStatusMap(newStatusMap);
    });

    window.api.onJobTaskStart((data) => {
      setComboStatusMap(prev => ({
        ...prev,
        [`combo-${data.index}`]: 'processing'
      }));
    });

    window.api.onJobLog((data) => {
      setLogs(prev => [...prev, data.msg]);
    });

    window.api.onJobProgress((data) => {
      setProgress({ done: data.done, failed: data.failed, total: data.total });
      // 更新对应组合项的状态为 completed
      if (data.index !== undefined) {
        setComboStatusMap(prev => ({
          ...prev,
          [`combo-${data.index}`]: 'completed'
        }));
      }
    });

    window.api.onJobFailed((data) => {
      setLogs(prev => [...prev, `[错误] 任务 #${data.index + 1} 处理失败: ${data.error || '未知错误'}`]);
      setComboStatusMap(prev => ({
        ...prev,
        [`combo-${data.index}`]: 'failed'
      }));
    });

    window.api.onJobFinish((data) => {
      setIsProcessing(false);
      setLogs(prev => [...prev, `所有任务完成! 成功: ${data.done}, 失败: ${data.failed}`]);
    });

    return cleanup;
  }, [combinations]);

  // 开始合成
  const startMerge = async () => {
    if (aFiles.length === 0 || bFiles.length === 0) return;
    if (!outputDir) {
      await handleSelectOutputDir();
      if (!outputDir) return;
    }
    if (isProcessing) return;

    setIsProcessing(true);

    try {
      const aPaths = aFiles.map(f => f.path);
      const bPaths = bFiles.map(f => f.path);
      await window.api.setLibs(aPaths, bPaths, outputDir);
      await window.api.startMerge(orientation);
    } catch (err: any) {
      console.error('合成失败:', err);
      setIsProcessing(false);
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
    <div className="h-screen flex flex-col bg-[#0a0a0f] text-gray-100">
      {/* Header */}
      <PageHeader
        onBack={onBack}
        title="A+B 前后拼接"
        icon={Link2}
        iconColor="text-pink-500"
        description="将两个视频前后拼接成一个完整视频"
        rightContent={
          /* 横竖版切换 */
          <div className="flex items-center bg-gray-900 rounded-lg p-0.5 border border-gray-800">
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
        <div className="w-80 border-r border-gray-800 bg-[#12121a] flex flex-col shrink-0">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            {/* 功能说明 */}
            <div className="bg-gradient-to-br from-pink-500/5 to-violet-500/5 border border-pink-500/10 rounded-xl p-4">
              <h3 className="text-xs font-bold text-pink-400 mb-2 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" />
                功能说明
              </h3>
              <ul className="text-[10px] text-gray-400 space-y-1.5 leading-relaxed">
                <li>• 分别上传 A 面和 B 面视频作为素材库</li>
                <li>• 系统自动将两个库的视频按顺序组合</li>
                <li>• 较大的库会循环使用，确保每个素材都被处理</li>
                <li>• A 面在前，B 面在后，顺序拼接成一个完整视频</li>
                <li>• 自动调整帧率为 30fps，统一输出分辨率</li>
              </ul>
            </div>

            {/* Stats Card */}
            {stats.totalCombos > 0 && (
              <div className="bg-gradient-to-br from-pink-500/10 to-violet-500/10 border border-pink-500/20 rounded-xl p-4">
                <div className="text-2xl font-bold text-pink-400">{stats.totalCombos}</div>
                <div className="text-xs text-gray-400">个合成视频</div>
              </div>
            )}

            {/* A 面上传 */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-violet-500/20 flex items-center justify-center">
                    <Monitor className="w-3 h-3 text-violet-400" />
                  </div>
                  <span className="text-sm font-medium">A 面视频（前段）</span>
                </div>
                <span className="text-xs text-gray-500">{aFiles.length}</span>
              </div>

              <div className="p-4 space-y-3">
                  <div
                    className="border-2 border-dashed border-gray-700 rounded-lg p-4 text-center hover:border-violet-500/50 hover:bg-violet-500/5 transition-all cursor-pointer group"
                    onDragOver={(e) => handleDragOver(e, 'a')}
                    onDrop={(e) => handleDrop(e, 'a')}
                    onClick={() => handleFileSelect('a')}
                  >
                    <Upload className="w-5 h-5 text-gray-500 group-hover:text-violet-400 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">拖拽或点击上传</p>
                  </div>

                  {aFiles.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">已添加 {aFiles.length} 个</span>
                        <button
                          onClick={() => clearFiles('a')}
                          className="text-[10px] text-rose-400 hover:text-rose-300"
                        >
                          清空全部
                        </button>
                      </div>
                      <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                        {aFiles.map((file) => (
                          <div key={file.id} className="flex items-center gap-2 p-2 bg-gray-950 rounded-lg group">
                            <Film className="w-3 h-3 text-violet-400 shrink-0" />
                            <span className="text-xs text-gray-300 truncate flex-1">{file.name}</span>
                            <button
                              onClick={() => openPreviewModal(file)}
                              className="p-1 text-gray-500 hover:text-pink-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => removeFile(file.id, 'a')}
                              className="p-1 text-gray-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
            </div>

            {/* B 面上传 */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-indigo-500/20 flex items-center justify-center">
                    <Smartphone className="w-3 h-3 text-indigo-400" />
                  </div>
                  <span className="text-sm font-medium">B 面视频（后段）</span>
                </div>
                <span className="text-xs text-gray-500">{bFiles.length}</span>
              </div>

              <div className="p-4 space-y-3">
                  <div
                    className="border-2 border-dashed border-gray-700 rounded-lg p-4 text-center hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all cursor-pointer group"
                    onDragOver={(e) => handleDragOver(e, 'b')}
                    onDrop={(e) => handleDrop(e, 'b')}
                    onClick={() => handleFileSelect('b')}
                  >
                    <Upload className="w-5 h-5 text-gray-500 group-hover:text-indigo-400 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">拖拽或点击上传</p>
                  </div>

                  {bFiles.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">已添加 {bFiles.length} 个</span>
                        <button
                          onClick={() => clearFiles('b')}
                          className="text-[10px] text-rose-400 hover:text-rose-300"
                        >
                          清空全部
                        </button>
                      </div>
                      <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                        {bFiles.map((file) => (
                          <div key={file.id} className="flex items-center gap-2 p-2 bg-gray-950 rounded-lg group">
                            <Film className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span className="text-xs text-gray-300 truncate flex-1">{file.name}</span>
                            <button
                              onClick={() => openPreviewModal(file)}
                              className="p-1 text-gray-500 hover:text-pink-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => removeFile(file.id, 'b')}
                              className="p-1 text-gray-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
            </div>
          </div>
        </div>

        {/* Main Content Area - Middle (Preview + Combinations) */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Combination List */}
          <div className="h-48 border-b border-gray-800 bg-[#12121a] shrink-0">
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
                            : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
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
          <div className="flex-1 overflow-hidden bg-[#0a0a0f]">
            {selectedCombo ? (
              <div className="h-full flex">
                {/* Video Preview Canvas */}
                <div className="flex-1 flex items-center justify-center p-4">
                  <div className="relative w-full h-full flex items-center justify-center">
                    {/* Canvas Frame */}
                    <div
                      className="bg-gray-950 rounded-2xl overflow-hidden shadow-2xl border border-gray-800"
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
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900">
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
                <div className="w-64 border-l border-gray-800 bg-[#12121a] p-4 overflow-y-auto custom-scrollbar">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">合成详情</h3>

                  {/* Output Info */}
                  <div className="bg-gray-900/50 rounded-xl p-4 mb-4 border border-gray-800">
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
        <div className="w-80 border-l border-gray-800 bg-[#12121a] flex flex-col shrink-0">
          {/* Settings + Progress - Fixed at top */}
          <div className="shrink-0 p-4 space-y-4 border-b border-gray-800">
            {/* Settings */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Settings className="w-3.5 h-3.5" />
                设置
              </h3>

              <div>
                <label className="text-xs font-medium text-gray-400 mb-2 block">导出位置</label>
                <button
                  onClick={handleSelectOutputDir}
                  className="w-full py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <FolderOpen className="w-4 h-4" />
                  {outputDir ? '更换位置' : '选择位置'}
                </button>
                {outputDir && (
                  <p className="text-[10px] text-gray-500 mt-1.5 truncate" title={outputDir}>{outputDir}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400 mb-2 block">并发进程数</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={concurrency}
                    onChange={(e) => setConcurrency(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-center text-sm"
                    disabled={isProcessing}
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">同时处理的 FFmpeg 进程数</p>
              </div>
            </div>

            {/* Progress Display - Always show when processing */}
            {progress.total > 0 && (
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 space-y-3">
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
          </div>

          {/* Logs - Fill remaining space */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl m-4 p-4 flex flex-col flex-1 min-h-0">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2 shrink-0">
                <span>处理日志</span>
                {logs.length > 0 && (
                  <button
                    onClick={() => setLogs([])}
                    className="ml-auto text-[10px] text-gray-500 hover:text-gray-300"
                  >
                    清空
                  </button>
                )}
              </h3>
              <div className="flex-1 overflow-y-auto custom-scrollbar font-mono text-[10px] leading-relaxed min-h-0">
                {logs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-600">
                    <span className="text-xs">暂无日志</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {logs.map((log, index) => (
                      <div key={index} className={`break-words ${
                        log.includes('[错误]') ? 'text-rose-400' :
                        log.includes('成功') || log.includes('完成') ? 'text-green-400' :
                        'text-gray-400'
                      }`}>
                        {log}
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Start Button - Fixed at bottom */}
          <div className="shrink-0 p-4 border-t border-gray-800 bg-[#12121a]">
            <button
              onClick={startMerge}
              disabled={isProcessing || aFiles.length === 0 || bFiles.length === 0}
              className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-sm shadow-lg ${
                isProcessing
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white shadow-pink-900/20'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  开始合成
                </>
              )}
            </button>
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
            <div className="bg-[#12121a] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white truncate">{previewModalVideo.name}</h3>
                <span className="text-xs text-gray-500">原视频尺寸 · 自动播放 · 音量 10%</span>
              </div>
              <div className="p-4 bg-[#0a0a0f]">
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
