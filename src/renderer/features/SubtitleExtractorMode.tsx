import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Captions,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileVideo,
  Loader2,
  PlayCircle,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import OperationLogPanel from '@/components/OperationLogPanel';
import { Button } from '@/components/Button/Button';
import { FileSelector, FileSelectorGroup, type FileSelectorRef } from '@/components/FileSelector';
import VideoPlayer from '@/components/VideoPlayer/VideoPlayer';
import { useOperationLogs } from '@/hooks/useOperationLogs';
import { usePageTheme } from '@/hooks/usePageTheme';
import { useToastMessages } from '@/components/Toast/Toast';
import { formatDuration } from '@/utils/format';
import PageThemeToggle from '@/components/PageThemeToggle';

type ExtractStatus = 'waiting' | 'queued' | 'pending' | 'done';
type ModelId = 'small' | 'medium' | 'large-v3';

interface SubtitleModelItem {
  id: ModelId;
  name: string;
  description: string;
  quality: string;
  speed: string;
  hardware: string;
  sizeLabel: string;
  fileName: string;
  url: string;
  path: string;
  downloaded: boolean;
  recommended?: boolean;
}

interface SubtitleModelStatus {
  usable: boolean;
  engineReady: boolean;
  engineType: 'external' | 'whisper.cpp-gpu' | 'whisper.cpp-cpu' | 'missing';
  enginePath?: string;
  models: SubtitleModelItem[];
  message: string;
}

interface SubtitleFile {
  id: string;
  path: string;
  name: string;
  status: ExtractStatus;
  text: string;
  srt: string;
  duration?: number;
  width?: number;
  height?: number;
  orientation?: 'landscape' | 'portrait' | 'square' | null;
  isLoadingInfo?: boolean;
  error?: string;
}

interface ModelDownloadProgress {
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
  status: 'downloading' | 'done' | 'error';
}

const getFileName = (path: string) => path.split(/[\\/]/).pop() || path;

const getStatusText = (file: SubtitleFile) => {
  if (file.status === 'pending') return '正在识别';
  if (file.status === 'queued') return '排队中';
  if (file.status === 'done') return '识别完成';
  return file.error || '等待识别台词';
};

const getVideoOrientationByRatio = (width?: number | null, height?: number | null): 'landscape' | 'portrait' | 'square' => {
  if (!width || !height) return 'landscape';
  const ratio = width / height;
  if (ratio > 1.2) return 'landscape';
  if (ratio < 0.8) return 'portrait';
  return 'square';
};

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const digits = unitIndex >= 2 ? 1 : 0;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
};

const formatDurationWithSeconds = (duration?: number) => {
  if (!duration) return '待读取';
  return `${duration.toFixed(1)} 秒（${formatDuration(duration)}）`;
};

const SubtitleExtractorMode: React.FC = () => {
  const { isLightTheme, togglePageTheme } = usePageTheme();
  const toast = useToastMessages();
  const fileSelectorRef = useRef<FileSelectorRef>(null);
  const [files, setFiles] = useState<SubtitleFile[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [outputMode, setOutputMode] = useState<'txt' | 'srt'>('txt');
  const [modelStatus, setModelStatus] = useState<SubtitleModelStatus | null>(null);
  const [isCheckingModel, setIsCheckingModel] = useState(true);
  const [selectedModelId, setSelectedModelId] = useState<ModelId>(() => {
    const saved = localStorage.getItem('subtitle-selected-model');
    return saved === 'medium' || saved === 'large-v3' || saved === 'small' ? saved : 'large-v3';
  });
  const [downloadingModelId, setDownloadingModelId] = useState<ModelId | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, ModelDownloadProgress>>({});

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
    moduleNameCN: '视频台词识别',
    moduleNameEN: 'SubtitleExtractor',
  });

  const activeFile = useMemo(() => {
    return files.find(file => file.id === activeId) || files[0];
  }, [activeId, files]);

  const mergedText = useMemo(() => {
    return files.map(file => outputMode === 'txt' ? file.text : file.srt).filter(Boolean).join('\n\n');
  }, [files, outputMode]);

  const activeTextValue = outputMode === 'txt' ? activeFile?.text || '' : activeFile?.srt || '';

  const getFileTextValue = (file: SubtitleFile) => {
    return outputMode === 'txt' ? file.text : file.srt;
  };

  const completedCount = useMemo(() => {
    return files.filter(file => file.status === 'done').length;
  }, [files]);

  const selectedModel = useMemo(() => {
    return modelStatus?.models.find(model => model.id === selectedModelId) || null;
  }, [modelStatus?.models, selectedModelId]);

  const refreshModelStatus = async () => {
    setIsCheckingModel(true);
    try {
      const status = await window.api.getSubtitleModelStatus();
      setModelStatus(status);
    } catch (error) {
      addLog(`读取字幕模型状态失败：${(error as Error).message}`, 'error');
    } finally {
      setIsCheckingModel(false);
    }
  };

  useEffect(() => {
    refreshModelStatus();
  }, []);

  useEffect(() => {
    localStorage.setItem('subtitle-selected-model', selectedModelId);
  }, [selectedModelId]);

  useEffect(() => {
    if (typeof window.api.onSubtitleModelDownloadProgress !== 'function') return;
    return window.api.onSubtitleModelDownloadProgress((data) => {
      setDownloadProgress(prev => ({
        ...prev,
        [data.modelId]: {
          downloadedBytes: data.downloadedBytes,
          totalBytes: data.totalBytes,
          percent: data.percent,
          status: data.status,
        },
      }));
      if (data.status === 'done' || data.status === 'error') {
        setDownloadingModelId(null);
      }
    });
  }, []);

  useEffect(() => {
    if (typeof window.api.onSubtitleExtractProgress !== 'function') return;
    return window.api.onSubtitleExtractProgress((data) => {
      if (data.status === 'start') {
        setFiles(prevFiles => prevFiles.map(file => {
          if (file.path === data.path) {
            return { ...file, status: 'pending', error: undefined };
          }
          return file.status === 'pending' ? { ...file, status: 'queued' } : file;
        }));
        return;
      }

      const result = data.result;
      setFiles(prevFiles => prevFiles.map(file => {
        if (file.path !== data.path) return file;

        if (!result || !result.success) {
          return {
            ...file,
            status: 'waiting',
            error: result?.error || data.error || '识别失败',
          };
        }

        return {
          ...file,
          status: 'done',
          text: result.text,
          srt: result.srt,
          duration: result.duration ?? file.duration,
          isLoadingInfo: false,
          error: undefined,
        };
      }));
    });
  }, []);

  const handleFilesChange = (paths: string[]) => {
    const nextFiles = paths.map((path, index) => {
      const name = getFileName(path);
      const oldFile = files.find(file => file.path === path);
      return oldFile || {
        id: `${path}-${index}`,
        path,
        name,
        status: 'waiting' as ExtractStatus,
        text: '',
        srt: '',
        isLoadingInfo: true,
      };
    });

    setFiles(nextFiles);
    setActiveId(nextFiles[0]?.id || '');
    setCopied(false);
    addLog(`已载入 ${nextFiles.length} 个短视频，等待识别台词`, 'info');
  };

  useEffect(() => {
    const pendingFiles = files.filter(file => file.duration === undefined && file.isLoadingInfo);
    if (pendingFiles.length === 0) return;

    let canceled = false;

    const loadVideoInfo = async () => {
      const results = await Promise.all(pendingFiles.map(async (file) => {
        try {
          const info = await window.api.getVideoFullInfo(file.path, { thumbnailMaxSize: 0 });
          return {
            id: file.id,
            duration: info.success ? info.duration ?? undefined : undefined,
            width: info.success ? info.width ?? undefined : undefined,
            height: info.success ? info.height ?? undefined : undefined,
            orientation: info.success ? getVideoOrientationByRatio(info.width, info.height) : undefined,
            isLoadingInfo: false,
          };
        } catch {
          return {
            id: file.id,
            duration: undefined,
            isLoadingInfo: false,
          };
        }
      }));

      if (canceled) return;

      setFiles(prevFiles => prevFiles.map(file => {
        const result = results.find(item => item.id === file.id);
        return result ? {
          ...file,
          duration: result.duration,
          width: result.width,
          height: result.height,
          orientation: result.orientation,
          isLoadingInfo: result.isLoadingInfo,
        } : file;
      }));
    };

    loadVideoInfo();

    return () => {
      canceled = true;
    };
  }, [files]);

  const handleExtract = async () => {
    if (files.length === 0) {
      toast.warning('请先拖入需要提取字幕的视频', '暂无视频');
      addLog('未选择视频，无法开始提取', 'warning');
      return;
    }

    setIsExtracting(true);
    setCopied(false);
    addLog(`开始识别 ${files.length} 个视频台词`, 'info');
    addLog('处理流程：提取音频 → 降噪/人声增强 → VAD 检测 → Whisper 识别 → 输出 TXT/SRT', 'info');

    if (typeof window.api.extractSubtitles !== 'function') {
      const message = '台词识别接口尚未加载，请重启开发环境后再试';
      addLog(message, 'error');
      toast.error(message, '需要重启', 7000);
      setIsExtracting(false);
      return;
    }

    if (!selectedModel?.downloaded) {
      const message = `请先下载 ${selectedModel?.name || selectedModelId} 模型，再开始识别`;
      addLog(message, 'warning');
      toast.warning(message, '模型未下载', 7000);
      setIsExtracting(false);
      return;
    }

    if (!modelStatus?.engineReady) {
      const message = modelStatus?.message || '字幕识别引擎尚未准备好';
      addLog(message, 'warning');
      toast.warning(message, '暂不可用', 7000);
      setIsExtracting(false);
      return;
    }

    setFiles(prevFiles => prevFiles.map((file, index) => ({
      ...file,
      status: index === 0 ? 'pending' : 'queued',
      error: undefined,
    })));

    try {
      const result = await window.api.extractSubtitles({
        videos: files.map(file => file.path),
        model: selectedModelId,
        language: 'zh',
        vadThresholdDb: -35,
        minSpeechDuration: 0.6,
      });

      setFiles(prevFiles => prevFiles.map(file => {
        const item = result.results.find(current => current.path === file.path);
        if (!item) return file;

        if (!item.success) {
          addLog(`${file.name} 识别失败：${item.error || '未知错误'}`, 'error');
          return {
            ...file,
            status: 'waiting',
            error: item.error || '识别失败',
          };
        }

        addLog(`${file.name} 识别完成，语音片段 ${item.segments.length} 段`, 'success');
        return {
          ...file,
          status: 'done',
          text: item.text,
          srt: item.srt,
          duration: item.duration ?? file.duration,
          isLoadingInfo: false,
          error: undefined,
        };
      }));

      if (result.success) {
        toast.success('台词识别完成，可继续校对文案', '识别完成');
      } else {
        toast.error(result.error || '台词识别失败', '识别失败', 7000);
      }
    } catch (error) {
      const message = (error as Error).message;
      addLog(`台词识别失败：${message}`, 'error');
      toast.error(message, '识别失败', 7000);
      setFiles(prevFiles => prevFiles.map(file => ({
        ...file,
        status: file.status === 'pending' || file.status === 'queued' ? 'waiting' : file.status,
        error: message,
      })));
    } finally {
      setIsExtracting(false);
    }
  };

  const handleClear = () => {
    fileSelectorRef.current?.clearFiles();
    setFiles([]);
    setActiveId('');
    setCopied(false);
    addLog('已清空视频列表和提取结果', 'info');
  };

  const copyText = async (text: string, successMessage: string) => {
    if (!text.trim()) {
      toast.warning('当前没有可复制的文案', '暂无内容');
      return;
    }

    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(successMessage, '复制成功');
    addLog(successMessage, 'success');
    window.setTimeout(() => setCopied(false), 1800);
  };

  const downloadCurrentText = () => {
    if (!activeFile || !activeTextValue.trim()) {
      toast.warning('当前没有可导出的内容', '暂无内容');
      return;
    }

    const ext = outputMode === 'txt' ? 'txt' : 'srt';
    const baseName = activeFile.name.replace(/\.[^.]+$/, '');
    const blob = new Blob([activeTextValue], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName}.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
    addLog(`已导出 ${activeFile.name} 的 ${ext.toUpperCase()} 文件`, 'success');
  };

  const handleDownloadModel = async (modelId: ModelId) => {
    if (typeof window.api.downloadSubtitleModel !== 'function') {
      toast.error('模型下载接口尚未加载，请重启开发环境后再试', '需要重启', 7000);
      return;
    }

    setSelectedModelId(modelId);
    setDownloadingModelId(modelId);
    setDownloadProgress(prev => ({
      ...prev,
      [modelId]: {
        downloadedBytes: 0,
        totalBytes: 0,
        percent: 0,
        status: 'downloading',
      },
    }));
    const model = modelStatus?.models.find(item => item.id === modelId);
    addLog(`开始下载 ${model?.name || modelId} 字幕识别模型，请保持网络连接`, 'info');
    try {
      const status = await window.api.downloadSubtitleModel(modelId);
      setModelStatus(status);
      const downloadedModel = status.models.find(item => item.id === modelId);
      if (downloadedModel?.downloaded) {
        toast.success(`${downloadedModel.name} 模型下载完成`, '模型已就绪');
        addLog(`模型已保存到：${downloadedModel.path}`, 'success');
      } else {
        toast.warning(status.message, '模型未就绪', 7000);
      }
    } catch (error) {
      const message = (error as Error).message;
      toast.error(message, '模型下载失败', 7000);
      addLog(`模型下载失败：${message}`, 'error');
    } finally {
      setDownloadingModelId(null);
    }
  };

  const rootClass = `video-merge-metal min-h-screen flex flex-col ${
    isLightTheme ? 'theme-light-page text-slate-900' : 'text-slate-100'
  }`;

  const panelClass = isLightTheme
    ? 'metal-panel bg-white/70 border-slate-300/60 shadow-sm'
    : 'metal-panel bg-black/50 border-slate-800';

  const subtlePanelClass = isLightTheme
    ? 'metal-control bg-white/50 border-slate-300/60'
    : 'metal-control bg-neutral-950/70 border-slate-800';

  const textAreaClass = isLightTheme
    ? 'bg-white/75 text-slate-800 border-slate-300/70 placeholder:text-slate-500'
    : 'bg-black/70 text-slate-200 border-slate-800 placeholder:text-slate-600';

  return (
    <div className={rootClass}>
      <PageHeader
        title="视频台词识别"
        icon={Captions}
        description="批量拖入短视频，识别台词文案并一键复制"
        iconColor="text-cyan-400"
        rightContent={<PageThemeToggle isLightTheme={isLightTheme} onToggle={togglePageTheme} />}
        featureInfo={{
          title: '视频台词识别',
          description: '用于批量提取几十秒短视频中的字幕和口播文案。',
          details: [
            '支持批量拖入视频文件',
            '自动提取音频并做降噪、人声增强、单声道和响度标准化',
            '使用 VAD 只识别有人说话的片段',
            '调用 Whisper 输出 TXT 和 SRT',
            '提取结果按视频分组展示',
            '支持单条复制和全部复制',
          ],
          themeColor: 'cyan',
        }}
      />

      <main className="metal-workspace flex-1 overflow-hidden p-4">
        <div className="grid h-full grid-cols-1 gap-4 xl:grid-cols-[minmax(360px,460px)_1fr]">
          <section className={`metal-sidebar flex min-h-0 flex-col rounded-lg border ${panelClass}`}>
            <div className="border-b border-slate-800/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    <FileVideo className="h-4 w-4 text-cyan-400" />
                    视频列表
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">拖入几十秒短视频，后续会逐条识别台词文案。</p>
                </div>
                <span className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-400">
                  {files.length} 个
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4">
              <FileSelectorGroup>
                <FileSelector
                  ref={fileSelectorRef}
                  id="subtitle-extractor-videos"
                  name="短视频"
                  accept="video"
                  multiple
                  showList
                  minHeight={170}
                  maxHeight={260}
                  themeColor="cyan"
                  directoryCache
                  onChange={handleFilesChange}
                />
              </FileSelectorGroup>

              <div className={`metal-panel mt-4 rounded-lg border p-3 ${subtlePanelClass}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-cyan-300">模型管理 / 模型选择</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      安装包不内置模型，按需下载；已下载的模型会保存在软件数据目录，下次可直接使用。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={refreshModelStatus}
                    className="rounded-md border border-slate-800 p-2 text-slate-500 transition-colors hover:text-cyan-300"
                    title="刷新模型状态"
                  >
                    <RefreshCw className={`h-4 w-4 ${isCheckingModel ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="mt-3 rounded-md border border-slate-800/80 px-3 py-2 text-xs leading-5 text-slate-500">
                  {isCheckingModel ? '正在检测识别引擎和本地模型...' : modelStatus?.message || '模型状态未知'}
                </div>

                <div className="mt-3 grid gap-2">
                  {(modelStatus?.models || []).map(model => {
                    const isSelected = selectedModelId === model.id;
                    const isDownloading = downloadingModelId === model.id;
                    const progress = downloadProgress[model.id];
                    const progressPercent = progress?.percent || 0;
                    const statusLabel = isDownloading
                      ? `下载中 ${progressPercent.toFixed(0)}%`
                      : isSelected && model.downloaded
                        ? '当前使用中'
                        : model.downloaded
                          ? '已下载'
                          : '未下载';

                    return (
                      <div
                        key={model.id}
                        className={`metal-control rounded-lg border p-3 transition-colors ${
                          isSelected
                            ? 'border-cyan-500/50 bg-cyan-500/10'
                            : 'border-slate-800/80 bg-black/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => setSelectedModelId(model.id)}
                            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-sm font-semibold ${isLightTheme ? 'text-slate-900' : 'text-slate-100'}`}>{model.name}</span>
                              {model.recommended && (
                                <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-medium text-cyan-300">推荐默认</span>
                              )}
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                model.downloaded ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-400'
                              }`}>
                                {statusLabel}
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-slate-500">{model.description}</p>
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                              <span>体积：{model.sizeLabel}</span>
                              <span>速度：{model.speed}</span>
                              <span>质量：{model.quality}</span>
                              <span>配置：{model.hardware}</span>
                            </div>
                          </button>

                          <Button
                            size="sm"
                            variant={model.downloaded ? 'ghost' : 'secondary'}
                            themeColor="cyan"
                            className={model.downloaded ? 'metal-control' : 'metal-primary'}
                            loading={isDownloading}
                            onClick={() => model.downloaded ? setSelectedModelId(model.id) : handleDownloadModel(model.id)}
                            disabled={!!downloadingModelId && downloadingModelId !== model.id}
                          >
                            {model.downloaded ? '选择' : '下载'}
                          </Button>
                        </div>

                        {isDownloading && (
                          <div className="mt-3 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span>
                                {progress?.totalBytes
                                  ? `${formatBytes(progress.downloadedBytes)} / ${formatBytes(progress.totalBytes)}`
                                  : `正在连接模型下载源，预计大小 ${model.sizeLabel}`}
                              </span>
                              <span>{progressPercent.toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                              <div
                                className="h-full rounded-full bg-cyan-400 transition-all"
                                style={{ width: `${Math.max(3, progressPercent)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {files.length === 0 ? (
                  <div className={`rounded-lg border border-dashed p-6 text-center ${subtlePanelClass}`}>
                    <Captions className="mx-auto h-8 w-8 text-slate-500" />
                    <p className="mt-3 text-sm font-medium text-slate-400">还没有待处理视频</p>
                    <p className="mt-1 text-xs text-slate-600">把视频拖到上方区域即可开始整理任务。</p>
                  </div>
                ) : (
                  files.map(file => (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => setActiveId(file.id)}
                      className={`metal-control w-full rounded-lg border p-3 text-left transition-colors ${
                        activeFile?.id === file.id
                          ? 'border-cyan-500/50 bg-cyan-500/10'
                          : `${subtlePanelClass} hover:border-cyan-500/30`
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-400">
                          {file.status === 'done' ? <CheckCircle2 className="h-4 w-4" /> : <FileVideo className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{file.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {getStatusText(file)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-slate-800/80 p-4">
              <Button
                variant="secondary"
                themeColor="cyan"
                className="metal-primary"
                leftIcon={isExtracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                onClick={handleExtract}
                disabled={isExtracting || !!downloadingModelId}
              >
                {isExtracting ? '识别中' : '开始提取'}
              </Button>
              <Button
                variant="ghost"
                className="metal-control"
                leftIcon={<Trash2 className="h-4 w-4" />}
                onClick={handleClear}
                disabled={files.length === 0}
              >
                清空
              </Button>
            </div>
          </section>

          <section className="grid min-h-0 grid-rows-[minmax(0,1fr)_280px] gap-4">
            <div className={`metal-panel flex min-h-0 flex-col rounded-lg border ${panelClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 p-4">
                <div>
                  <h2 className="text-base font-semibold">文案结果</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    已完成 {completedCount}/{files.length} 个，后台智能排队逐条识别
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    className="metal-primary"
                    leftIcon={<ClipboardCopy className="h-4 w-4" />}
                    onClick={() => copyText(mergedText, '已复制全部视频文案')}
                    disabled={!mergedText}
                  >
                    复制全部{outputMode.toUpperCase()}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="metal-control"
                    leftIcon={<Download className="h-4 w-4" />}
                    onClick={downloadCurrentText}
                    disabled={!activeTextValue}
                  >
                    导出选中{outputMode.toUpperCase()}
                  </Button>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col p-4">
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">批量文案结果</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        每个视频独立文本框，识别完成后可逐条校对。
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex rounded-lg border border-slate-800 p-1">
                        <button
                          type="button"
                          onClick={() => setOutputMode('txt')}
                          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${outputMode === 'txt' ? 'bg-cyan-500 text-black' : 'text-slate-500 hover:text-slate-200'}`}
                        >
                          TXT
                        </button>
                        <button
                          type="button"
                          onClick={() => setOutputMode('srt')}
                          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${outputMode === 'srt' ? 'bg-cyan-500 text-black' : 'text-slate-500 hover:text-slate-200'}`}
                        >
                          SRT
                        </button>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        themeColor="cyan"
                        className="metal-primary"
                        leftIcon={<ClipboardCopy className="h-4 w-4" />}
                        onClick={() => copyText(activeTextValue, `已复制当前文本框 ${outputMode.toUpperCase()} 文案`)}
                        disabled={!activeTextValue}
                      >
                        {copied ? '已复制' : '复制选中文本框'}
                      </Button>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
                    {files.length === 0 ? (
                      <div className={`flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed text-center ${subtlePanelClass}`}>
                        <Captions className="h-10 w-10 text-slate-600" />
                        <p className="mt-3 text-sm font-medium text-slate-500">暂无文案结果</p>
                        <p className="mt-1 text-xs text-slate-600">拖入视频后，这里会按视频逐条生成可编辑文本框。</p>
                      </div>
                    ) : (
                      files.map((file, index) => {
                        const textValue = getFileTextValue(file);
                        const isActive = activeFile?.id === file.id;
                        const previewOrientation = file.orientation ?? getVideoOrientationByRatio(file.width, file.height);
                        const bodyGridClass = previewOrientation === 'portrait'
                          ? 'xl:grid-cols-[240px_minmax(0,1fr)]'
                          : previewOrientation === 'square'
                            ? 'xl:grid-cols-[260px_minmax(0,1fr)]'
                            : 'xl:grid-cols-[360px_minmax(0,1fr)]';
                        const previewAspectClass = previewOrientation === 'portrait'
                          ? 'aspect-[9/16]'
                          : previewOrientation === 'square'
                            ? 'aspect-square'
                            : 'aspect-video';
                        return (
                          <div
                            key={file.id}
                            className={`result-item ${previewOrientation} metal-control rounded-lg border p-3 transition-colors ${
                              isActive ? 'border-cyan-500/60 bg-cyan-500/10' : subtlePanelClass
                            }`}
                          >
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                              <button
                                type="button"
                                onClick={() => setActiveId(file.id)}
                                className="min-w-0 border-0 bg-transparent p-0 text-left"
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  {file.status === 'pending' ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                                  ) : file.status === 'done' ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                  ) : (
                                    <PlayCircle className="h-4 w-4 text-slate-500" />
                                  )}
                                  <span className="text-xs text-slate-500">#{index + 1}</span>
                                  <span className="truncate text-sm font-semibold">{file.name}</span>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">{getStatusText(file)}</p>
                              </button>

                              <Button
                                size="sm"
                                variant="ghost"
                                className="metal-control"
                                leftIcon={<ClipboardCopy className="h-4 w-4" />}
                                onClick={() => copyText(textValue, `已复制 ${file.name} 的 ${outputMode.toUpperCase()} 文案`)}
                                disabled={!textValue}
                              >
                                复制
                              </Button>
                            </div>
                            <div className={`result-item-body grid items-stretch gap-4 ${bodyGridClass}`}>
                              <div
                                className={`video-preview-wrapper relative overflow-hidden rounded-lg border bg-black ${previewAspectClass} ${
                                  isActive ? 'border-cyan-500/60' : 'border-slate-800'
                                }`}
                                onFocusCapture={() => setActiveId(file.id)}
                                onClick={() => setActiveId(file.id)}
                              >
                                <VideoPlayer
                                  key={`card-player-${file.path}`}
                                  src={file.path}
                                  title={file.name}
                                  showTitle={false}
                                  muted
                                  minimal
                                  paused
                                  themeColor="cyan"
                                  className="h-full w-full rounded-lg"
                                />
                                <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-[11px] text-slate-300">
                                  {file.isLoadingInfo ? '读取中...' : formatDurationWithSeconds(file.duration)}
                                </div>
                                {isActive && (
                                  <div className="pointer-events-none absolute right-2 top-2 rounded bg-cyan-500 px-1.5 py-0.5 text-[10px] font-medium text-black">
                                    预览中
                                  </div>
                                )}
                              </div>

                              <div className="result-text-wrapper flex min-h-0 min-w-0 flex-col">
                                <div className="hidden">
                                  <button
                                    type="button"
                                    onClick={() => setActiveId(file.id)}
                                    className="min-w-0 border-0 bg-transparent p-0 text-left"
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      {file.status === 'pending' ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                                      ) : file.status === 'done' ? (
                                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                      ) : (
                                        <PlayCircle className="h-4 w-4 text-slate-500" />
                                      )}
                                      <span className="text-xs text-slate-500">#{index + 1}</span>
                                      <span className="truncate text-sm font-semibold">{file.name}</span>
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500">{getStatusText(file)}</p>
                                  </button>

                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    leftIcon={<ClipboardCopy className="h-4 w-4" />}
                                    onClick={() => copyText(textValue, `已复制 ${file.name} 的 ${outputMode.toUpperCase()} 文案`)}
                                    disabled={!textValue}
                                  >
                                    复制
                                  </Button>
                                </div>

                                <textarea
                                  className={`result-textarea h-full min-h-0 w-full flex-1 resize-none rounded-lg border p-3 text-sm leading-7 outline-none transition-colors focus:border-cyan-500/60 ${textAreaClass}`}
                                  value={textValue}
                                  onFocus={() => setActiveId(file.id)}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setFiles(prevFiles => prevFiles.map(current => (
                                      current.id === file.id
                                        ? {
                                            ...current,
                                            [outputMode === 'txt' ? 'text' : 'srt']: value,
                                            status: value.trim() ? 'done' : 'waiting',
                                          }
                                        : current
                                    )));
                                  }}
                                  placeholder={
                                    file.status === 'pending'
                                      ? '正在识别这条视频...'
                                      : file.status === 'queued'
                                        ? '已加入队列，前面的视频完成后会继续识别这一条。'
                                        : '识别结果会显示在这里，可直接编辑校对。'
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
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
              variant="compact"
              themeColor="cyan"
              className="metal-panel"
              height="280px"
            />
          </section>
        </div>
      </main>
    </div>
  );
};

export default SubtitleExtractorMode;
