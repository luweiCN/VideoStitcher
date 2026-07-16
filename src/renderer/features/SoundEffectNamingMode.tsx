import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AudioLines,
  CheckCircle2,
  Download,
  FileAudio,
  Loader2,
  Play,
  RotateCcw,
  Save,
  Sparkles,
  X,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import PageThemeToggle from '@/components/PageThemeToggle';
import { Button } from '@/components/Button';
import { FileSelector, type FileSelectorRef } from '@/components/FileSelector';
import { FileSelectorGroup } from '@/components/FileSelector/FileSelectorGroup';
import { useToastMessages } from '@/components/Toast';
import { useHomeSkin } from '@/hooks/useHomeSkin';
import { usePageTheme } from '@/hooks/usePageTheme';

type ModelId = 'small' | 'medium' | 'large-v3';
type NamingStatus = 'waiting' | 'queued' | 'recognizing' | 'recognized' | 'error' | 'renamed';

interface SoundFileItem {
  id: string;
  path: string;
  originalName: string;
  extension: string;
  newName: string;
  recognizedText: string;
  status: NamingStatus;
  error?: string;
}

interface SubtitleModelItem {
  id: ModelId;
  name: string;
  downloaded: boolean;
  recommended?: boolean;
}

interface SubtitleModelStatus {
  engineReady: boolean;
  models: SubtitleModelItem[];
  message: string;
}

const AUDIO_EXTENSIONS = ['wav', 'mp3', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'wma'];
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const INVALID_FILE_NAME_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f]/g;
const HAS_INVALID_FILE_NAME_CHARACTER = /[<>:"/\\|?*\u0000-\u001f]/;

const getFileName = (filePath: string) => filePath.split(/[/\\]/).pop() || filePath;

const splitFileName = (fileName: string) => {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0) return { baseName: fileName, extension: '' };
  return {
    baseName: fileName.slice(0, dotIndex),
    extension: fileName.slice(dotIndex),
  };
};

const getDirectory = (filePath: string) => {
  const slashIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return slashIndex >= 0 ? filePath.slice(0, slashIndex) : '';
};

const buildTargetPath = (sourcePath: string, targetName: string, extension: string) => {
  const slashIndex = Math.max(sourcePath.lastIndexOf('/'), sourcePath.lastIndexOf('\\'));
  const separator = sourcePath.includes('\\') ? '\\' : '/';
  const directory = slashIndex >= 0 ? sourcePath.slice(0, slashIndex) : '';
  return directory ? `${directory}${separator}${targetName}${extension}` : `${targetName}${extension}`;
};

/**
 * 把识别台词清洗为安全、易读的文件名。
 */
const sanitizeDialogueName = (value: string) => {
  const normalized = value
    .replace(/\r?\n+/g, ' ')
    .replace(INVALID_FILE_NAME_CHARACTERS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[。！？!?；;，,、\s.]+$/g, '')
    .replace(/[. ]+$/g, '')
    .slice(0, 100)
    .trim();

  return WINDOWS_RESERVED_NAME.test(normalized) ? `${normalized}_台词` : normalized;
};

const sanitizeNameInput = (value: string) => value
  .replace(INVALID_FILE_NAME_CHARACTERS, '')
  .slice(0, 100);

const getStatusLabel = (item: SoundFileItem) => {
  if (item.status === 'queued') return '等待识别';
  if (item.status === 'recognizing') return '正在识别';
  if (item.status === 'recognized') return '识别完成';
  if (item.status === 'renamed') return '已重命名';
  if (item.status === 'error') return item.error || '处理失败';
  return '等待识别';
};

const SoundEffectNamingMode: React.FC = () => {
  const { isLightTheme, togglePageTheme } = usePageTheme();
  const { isMetalSkin, workspaceSkinClassName } = useHomeSkin();
  const toast = useToastMessages();
  const fileSelectorRef = useRef<FileSelectorRef>(null);
  const [selectorVersion, setSelectorVersion] = useState(0);
  const [files, setFiles] = useState<SoundFileItem[]>([]);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [modelStatus, setModelStatus] = useState<SubtitleModelStatus | null>(null);
  const [isCheckingModel, setIsCheckingModel] = useState(true);
  const [selectedModelId, setSelectedModelId] = useState<ModelId>(() => {
    const saved = localStorage.getItem('subtitle-selected-model');
    return saved === 'small' || saved === 'medium' || saved === 'large-v3' ? saved : 'large-v3';
  });
  const [downloadingModelId, setDownloadingModelId] = useState<ModelId | null>(null);
  const [downloadPercent, setDownloadPercent] = useState(0);

  const panelClass = isLightTheme
    ? 'border-[#E7E5DF] bg-white shadow-[0_8px_24px_rgba(34,34,34,0.04)]'
    : 'border-slate-800 bg-black/50';
  const mutedTextClass = isLightTheme ? 'text-slate-500' : 'text-slate-400';
  const inputClass = isLightTheme
    ? 'border-[#DDD8CF] bg-[#F8F8F5] text-[#222222] placeholder:text-slate-400 focus:border-emerald-500'
    : 'border-slate-700 bg-black/60 text-slate-100 placeholder:text-slate-600 focus:border-emerald-500';

  const selectedModel = useMemo(
    () => modelStatus?.models.find(model => model.id === selectedModelId) || null,
    [modelStatus, selectedModelId],
  );

  const duplicateKeys = useMemo(() => {
    const counts = new Map<string, number>();
    files.forEach(file => {
      const name = file.newName.trim();
      if (!name || file.status === 'renamed') return;
      const key = `${getDirectory(file.path).toLowerCase()}|${name.toLowerCase()}${file.extension.toLowerCase()}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [files]);

  const getNameIssue = (file: SoundFileItem) => {
    const name = file.newName.trim();
    if (!name) return '请输入文件名';
    if (WINDOWS_RESERVED_NAME.test(name)) return '该名称为系统保留名称';
    if (HAS_INVALID_FILE_NAME_CHARACTER.test(name)) return '名称中含有非法字符';
    const key = `${getDirectory(file.path).toLowerCase()}|${name.toLowerCase()}${file.extension.toLowerCase()}`;
    if ((duplicateKeys.get(key) || 0) > 1) return '同一目录存在重复名称';
    return '';
  };

  const invalidCount = useMemo(
    () => files.filter(file => file.status !== 'renamed' && file.newName.trim() && getNameIssue(file)).length,
    [files, duplicateKeys],
  );

  const renameableFiles = useMemo(() => files.filter(file => {
    if (file.status === 'renamed' || getNameIssue(file)) return false;
    const currentBaseName = splitFileName(file.originalName).baseName;
    return file.newName.trim().toLowerCase() !== currentBaseName.toLowerCase();
  }), [files, duplicateKeys]);

  const refreshModelStatus = async () => {
    setIsCheckingModel(true);
    try {
      const status = await window.api.getSubtitleModelStatus();
      setModelStatus(status);
      const currentModel = status.models.find(model => model.id === selectedModelId);
      if (!currentModel?.downloaded) {
        const downloadedModel = status.models.find(model => model.downloaded);
        if (downloadedModel) setSelectedModelId(downloadedModel.id);
      }
    } catch (error) {
      toast.error(`读取识别引擎状态失败：${(error as Error).message}`, '检测失败');
    } finally {
      setIsCheckingModel(false);
    }
  };

  useEffect(() => {
    void refreshModelStatus();
  }, []);

  useEffect(() => {
    localStorage.setItem('subtitle-selected-model', selectedModelId);
  }, [selectedModelId]);

  useEffect(() => {
    if (typeof window.api.onSubtitleModelDownloadProgress !== 'function') return;
    return window.api.onSubtitleModelDownloadProgress(data => {
      if (data.modelId !== downloadingModelId) return;
      setDownloadPercent(data.percent);
      if (data.status === 'done' || data.status === 'error') setDownloadingModelId(null);
    });
  }, [downloadingModelId]);

  useEffect(() => {
    if (typeof window.api.onSubtitleExtractProgress !== 'function') return;
    return window.api.onSubtitleExtractProgress(data => {
      setFiles(currentFiles => currentFiles.map(file => {
        if (file.path !== data.path) return file;
        if (data.status === 'start') return { ...file, status: 'recognizing', error: undefined };
        if (data.status === 'error') return { ...file, status: 'error', error: data.error || '识别失败' };
        return file;
      }));
    });
  }, []);

  const handleFilesChange = (paths: string[]) => {
    const supportedPaths = paths.filter(filePath => {
      const extension = splitFileName(getFileName(filePath)).extension.slice(1).toLowerCase();
      return AUDIO_EXTENSIONS.includes(extension);
    });
    const rejectedCount = paths.length - supportedPaths.length;
    if (rejectedCount > 0) {
      toast.warning(`已跳过 ${rejectedCount} 个不支持的文件`, '格式不支持');
      setSelectorVersion(version => version + 1);
    }

    setFiles(currentFiles => supportedPaths.map((filePath, index) => {
      const existing = currentFiles.find(file => file.path === filePath);
      if (existing) return existing;
      const originalName = getFileName(filePath);
      const { extension } = splitFileName(originalName);
      return {
        id: `${filePath}-${Date.now()}-${index}`,
        path: filePath,
        originalName,
        extension,
        newName: '',
        recognizedText: '',
        status: 'waiting',
      };
    }));
  };

  const handleRemoveFile = (id: string) => {
    setFiles(currentFiles => currentFiles.filter(file => file.id !== id));
    setSelectorVersion(version => version + 1);
  };

  const handleClear = () => {
    fileSelectorRef.current?.clearFiles();
    setFiles([]);
    setSelectorVersion(version => version + 1);
  };

  const handleDownloadModel = async () => {
    setDownloadingModelId(selectedModelId);
    setDownloadPercent(0);
    try {
      const status = await window.api.downloadSubtitleModel(selectedModelId);
      setModelStatus(status);
      toast.success('识别模型下载完成', '模型已就绪');
    } catch (error) {
      toast.error((error as Error).message, '模型下载失败', 7000);
    } finally {
      setDownloadingModelId(null);
    }
  };

  const handleRecognize = async () => {
    const targets = files.filter(file => file.status !== 'renamed');
    if (targets.length === 0) {
      toast.warning('请先拖入需要命名的音效文件', '暂无音效');
      return;
    }
    if (!modelStatus?.engineReady) {
      toast.warning(modelStatus?.message || '语音识别引擎尚未准备好', '暂不可用', 7000);
      return;
    }
    if (!selectedModel?.downloaded) {
      toast.warning(`请先下载 ${selectedModel?.name || selectedModelId} 模型`, '缺少模型');
      return;
    }

    setIsRecognizing(true);
    setFiles(currentFiles => currentFiles.map((file, index) => (
      targets.some(target => target.id === file.id)
        ? { ...file, status: index === 0 ? 'recognizing' : 'queued', error: undefined }
        : file
    )));

    try {
      const result = await window.api.extractSubtitles({
        videos: targets.map(file => file.path),
        model: selectedModelId,
        language: 'zh',
        vadThresholdDb: -40,
        minSpeechDuration: 0.15,
      });

      setFiles(currentFiles => currentFiles.map(file => {
        const recognized = result.results.find(item => item.path === file.path);
        if (!recognized) return file;
        if (!recognized.success) {
          return { ...file, status: 'error', error: recognized.error || '识别失败' };
        }

        const recognizedText = recognized.text.replace(/\r?\n+/g, ' ').trim();
        const newName = sanitizeDialogueName(recognizedText);
        if (!newName) {
          return {
            ...file,
            recognizedText,
            status: 'error',
            error: '未识别出清晰台词，请手动填写名称',
          };
        }

        return {
          ...file,
          recognizedText,
          newName,
          status: 'recognized',
          error: undefined,
        };
      }));

      const successCount = result.results.filter(item => item.success && sanitizeDialogueName(item.text)).length;
      if (successCount > 0) {
        toast.success(`已识别 ${successCount} 条音效，请校对名称后保存`, '识别完成');
      } else {
        toast.warning(result.error || '没有识别出清晰台词，可手动填写名称', '识别完成');
      }
    } catch (error) {
      const message = (error as Error).message;
      setFiles(currentFiles => currentFiles.map(file => (
        file.status === 'recognizing' || file.status === 'queued'
          ? { ...file, status: 'error', error: message }
          : file
      )));
      toast.error(message, '识别失败', 7000);
    } finally {
      setIsRecognizing(false);
    }
  };

  const handleSave = async () => {
    if (invalidCount > 0) {
      toast.warning('请先处理列表中的重复或无效名称', '无法保存');
      return;
    }
    if (renameableFiles.length === 0) {
      toast.warning('没有需要重命名的文件', '暂无修改');
      return;
    }

    const operations = renameableFiles.map(file => ({
      sourcePath: file.path,
      targetName: file.newName.trim(),
    }));
    setIsRenaming(true);

    try {
      const result = await window.api.batchRenameFiles({ operations });
      const errorMap = new Map(result.errors.map(item => [item.file.toLowerCase(), item.error]));

      setFiles(currentFiles => currentFiles.map(file => {
        const operation = operations.find(item => item.sourcePath === file.path);
        if (!operation) return file;
        const error = errorMap.get(file.path.toLowerCase());
        if (error) return { ...file, status: 'error', error };

        const targetPath = buildTargetPath(file.path, operation.targetName, file.extension);
        return {
          ...file,
          path: targetPath,
          originalName: `${operation.targetName}${file.extension}`,
          recognizedText: file.recognizedText,
          status: 'renamed',
          error: undefined,
        };
      }));
      setSelectorVersion(version => version + 1);

      if (result.failed === 0) {
        toast.success(`成功重命名 ${result.success} 个音效文件`, '保存完成', 7000);
      } else {
        toast.warning(`成功 ${result.success} 个，失败 ${result.failed} 个`, '部分文件未保存', 7000);
      }
    } catch (error) {
      toast.error((error as Error).message, '重命名失败', 7000);
    } finally {
      setIsRenaming(false);
    }
  };

  return (
    <div className={`${workspaceSkinClassName} h-screen min-h-0 overflow-hidden font-sans transition-colors duration-300 ${
      isLightTheme ? 'theme-light-page bg-[#F8F8F5] text-[#222222]' : 'bg-[#181818] text-[#D1D1D1]'
    }`}>
      <div className="flex h-full min-h-0 flex-col">
        <PageHeader
          title="音效命名工具"
          icon={AudioLines}
          iconColor={isLightTheme ? 'text-emerald-600' : 'text-emerald-400'}
          description="批量识别短音效台词，校对后保存为文件名"
          featureInfo={{
            title: '音效命名工具',
            description: '复用本地语音识别引擎，为短台词音效批量生成文件名。',
            details: [
              '支持批量拖入常见音频格式',
              '识别结果逐条填入可编辑输入框',
              '保存前检查空名称、非法字符和重名',
              '保存时保留原始音频扩展名',
            ],
            themeColor: 'emerald',
          }}
          rightContent={isMetalSkin ? undefined : <PageThemeToggle isLightTheme={isLightTheme} onToggle={togglePageTheme} />}
        />

        <main className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:flex-row">
          <aside className={`metal-panel flex w-full shrink-0 flex-col gap-4 overflow-y-auto rounded-2xl border p-4 lg:w-80 ${panelClass}`}>
            <div>
              <div className="flex items-center gap-2">
                <FileAudio className="h-4 w-4 text-emerald-500" />
                <h2 className="text-sm font-bold">导入音效</h2>
              </div>
              <p className={`mt-1 text-xs leading-5 ${mutedTextClass}`}>可一次拖入多条 1～2 秒的游戏台词音效。</p>
            </div>

            <FileSelectorGroup>
              <FileSelector
                key={selectorVersion}
                ref={fileSelectorRef}
                id="sound-effect-naming-files"
                name="音效文件"
                accept={AUDIO_EXTENSIONS}
                multiple
                maxCount={1000}
                showList={false}
                initialFiles={files.map(file => file.path)}
                themeColor="emerald"
                directoryCache
                disabled={isRecognizing || isRenaming}
                onChange={handleFilesChange}
              />
            </FileSelectorGroup>

            <div className={`rounded-xl border p-3 ${isLightTheme ? 'border-[#E7E5DF] bg-[#F8F8F5]' : 'border-slate-800 bg-black/40'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold">识别模型</span>
                <span className={`text-[11px] ${modelStatus?.engineReady ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {isCheckingModel ? '检测中' : modelStatus?.engineReady ? '引擎已就绪' : '引擎未就绪'}
                </span>
              </div>

              <div className="mt-3 grid gap-2">
                {(modelStatus?.models || []).map(model => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => setSelectedModelId(model.id)}
                    disabled={isRecognizing || isRenaming || !!downloadingModelId}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                      selectedModelId === model.id
                        ? 'border-[#FF385C] bg-[#FF385C]/10 text-[#FF385C] shadow-[0_0_0_1px_rgba(255,56,92,0.08)]'
                        : isLightTheme
                          ? 'border-[#DDD8CF] bg-white text-slate-600 hover:border-[#FF385C]/60'
                          : 'border-slate-700 bg-black/40 text-slate-400 hover:border-[#FF385C]/60'
                    }`}
                  >
                    <span>{model.name}{model.recommended ? ' · 推荐' : ''}</span>
                    <span>{model.downloaded ? '已下载' : '未下载'}</span>
                  </button>
                ))}
              </div>

              {!selectedModel?.downloaded && selectedModel && (
                <Button
                  className="mt-3 w-full"
                  size="sm"
                  variant="secondary"
                  themeColor="emerald"
                  loading={downloadingModelId === selectedModelId}
                  leftIcon={<Download className="h-4 w-4" />}
                  onClick={handleDownloadModel}
                >
                  {downloadingModelId ? `下载中 ${downloadPercent.toFixed(0)}%` : `下载 ${selectedModel.name}`}
                </Button>
              )}
              {!isCheckingModel && !modelStatus?.engineReady && (
                <p className="mt-3 text-xs leading-5 text-amber-500">{modelStatus?.message}</p>
              )}
            </div>

            <div className="mt-auto grid gap-2">
              <Button
                variant="secondary"
                themeColor="emerald"
                leftIcon={<Sparkles className="h-4 w-4" />}
                loading={isRecognizing}
                disabled={files.length === 0 || isRenaming || !!downloadingModelId}
                onClick={handleRecognize}
                fullWidth
              >
                批量识别台词
              </Button>
              <Button
                leftIcon={<Save className="h-4 w-4" />}
                loading={isRenaming}
                disabled={renameableFiles.length === 0 || invalidCount > 0 || isRecognizing}
                onClick={handleSave}
                fullWidth
              >
                保存并重命名{renameableFiles.length > 0 ? `（${renameableFiles.length}）` : ''}
              </Button>
              <Button
                variant="ghost"
                leftIcon={<RotateCcw className="h-4 w-4" />}
                disabled={files.length === 0 || isRecognizing || isRenaming}
                onClick={handleClear}
                fullWidth
              >
                清空列表
              </Button>
            </div>
          </aside>

          <section className={`metal-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border ${panelClass}`}>
            <div className={`flex shrink-0 items-center justify-between border-b px-5 py-4 ${isLightTheme ? 'border-[#E7E5DF]' : 'border-slate-800'}`}>
              <div>
                <h2 className="text-sm font-bold">命名校对</h2>
                <p className={`mt-1 text-xs ${mutedTextClass}`}>识别结果会自动填入输入框，保存前可逐条修改。</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className={mutedTextClass}>共 {files.length} 条</span>
                {invalidCount > 0 && <span className="text-rose-500">{invalidCount} 条需处理</span>}
              </div>
            </div>

            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
              {files.length === 0 ? (
                <div className="flex h-full min-h-72 flex-col items-center justify-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                    <AudioLines className="h-8 w-8" />
                  </div>
                  <h3 className="mt-5 text-base font-bold">拖入音效后开始识别</h3>
                  <p className={`mt-2 max-w-sm text-sm leading-6 ${mutedTextClass}`}>支持 WAV、MP3、M4A、AAC、FLAC、OGG、OPUS 和 WMA。</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {files.map((file, index) => {
                    const issue = file.status === 'renamed' ? '' : getNameIssue(file);
                    const isBusy = file.status === 'recognizing' || file.status === 'queued';
                    return (
                      <article
                        key={file.id}
                        className={`rounded-xl border p-4 transition-colors ${
                          file.status === 'renamed'
                            ? 'border-emerald-500/40 bg-emerald-500/5'
                            : issue && file.newName.trim()
                              ? 'border-rose-500/40 bg-rose-500/5'
                              : isLightTheme
                                ? 'border-[#E7E5DF] bg-[#FDFDFC]'
                                : 'border-slate-800 bg-black/35'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            file.status === 'renamed' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-500/10 text-slate-500'
                          }`}>
                            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : file.status === 'renamed' ? <CheckCircle2 className="h-4 w-4" /> : <FileAudio className="h-4 w-4" />}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold" title={file.originalName}>#{index + 1} · {file.originalName}</p>
                                <p className={`mt-1 truncate text-[11px] ${file.status === 'error' ? 'text-rose-500' : mutedTextClass}`}>
                                  {getStatusLabel(file)}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  title="用系统播放器试听"
                                  onClick={() => window.api.openPath(file.path)}
                                  className={`rounded-lg p-2 transition-colors ${isLightTheme ? 'text-slate-500 hover:bg-slate-100 hover:text-emerald-600' : 'text-slate-500 hover:bg-slate-800 hover:text-emerald-400'}`}
                                >
                                  <Play className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  title="移除"
                                  disabled={isRecognizing || isRenaming}
                                  onClick={() => handleRemoveFile(file.id)}
                                  className={`rounded-lg p-2 transition-colors disabled:opacity-40 ${isLightTheme ? 'text-slate-400 hover:bg-rose-50 hover:text-rose-600' : 'text-slate-600 hover:bg-rose-500/10 hover:text-rose-400'}`}
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            </div>

                            {file.recognizedText && (
                              <div className={`mt-3 rounded-lg px-3 py-2 text-xs leading-5 ${isLightTheme ? 'bg-emerald-50 text-emerald-800' : 'bg-emerald-500/10 text-emerald-300'}`}>
                                识别台词：{file.recognizedText}
                              </div>
                            )}

                            <label className="mt-3 block">
                              <span className={`mb-1.5 block text-[11px] font-medium ${mutedTextClass}`}>保存后的文件名</span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={file.newName}
                                  disabled={file.status === 'renamed' || isRenaming}
                                  maxLength={100}
                                  placeholder="识别后自动填入，也可以手动输入"
                                  className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none transition-colors disabled:opacity-70 ${inputClass}`}
                                  onChange={event => {
                                    const newName = sanitizeNameInput(event.target.value);
                                    setFiles(currentFiles => currentFiles.map(current => (
                                      current.id === file.id
                                        ? { ...current, newName, status: current.status === 'renamed' ? 'renamed' : 'recognized', error: undefined }
                                        : current
                                    )));
                                  }}
                                  onBlur={() => {
                                    setFiles(currentFiles => currentFiles.map(current => (
                                      current.id === file.id
                                        ? { ...current, newName: sanitizeDialogueName(current.newName) }
                                        : current
                                    )));
                                  }}
                                />
                                <span className={`max-w-24 truncate text-xs ${mutedTextClass}`} title={file.extension}>{file.extension}</span>
                              </div>
                            </label>

                            {issue && file.newName.trim() && (
                              <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-500">
                                <AlertCircle className="h-3.5 w-3.5" />
                                {issue}
                              </div>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default SoundEffectNamingMode;
