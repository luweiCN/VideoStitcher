import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  Download,
  Gauge,
  Gem,
  HardDrive,
  Mic2,
  PlayCircle,
  RefreshCw,
  Rocket,
  FolderOpen,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Volume2,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import PageThemeToggle from '@/components/PageThemeToggle';
import OperationLogPanel from '@/components/OperationLogPanel';
import { Button } from '@/components/Button/Button';
import { useHomeSkin } from '@/hooks/useHomeSkin';
import { useOperationLogs } from '@/hooks/useOperationLogs';
import { usePageTheme } from '@/hooks/usePageTheme';

type TtsModelId = 'piper' | 'melotts' | 'cosyvoice';
type TtsModelStatus = 'not-downloaded' | 'downloaded' | 'planned';

interface TtsModelItem {
  id: TtsModelId;
  name: string;
  levelName: string;
  level: number;
  accentClass: string;
  icon: typeof Rocket;
  description: string;
  sizeLabel: string;
  hardware: string;
  speed: string;
  quality: string;
  status: TtsModelStatus;
  recommendedFor: 'low' | 'medium' | 'high';
}

interface SystemSummary {
  cpuCores: number;
  memoryGB: string;
  recommendedModelId: TtsModelId;
  reason: string;
}

interface TtsEngineStatus {
  installed: boolean;
  engineName: string;
  message: string;
  outputDir?: string;
}

interface TtsAudioResult {
  outputPath: string;
  fileUrl: string;
  duration?: number;
}

const ttsModels: TtsModelItem[] = [
  {
    id: 'piper',
    name: '极速离线',
    levelName: '轻量',
    level: 1,
    accentClass: 'from-emerald-500 to-lime-400',
    icon: Rocket,
    description: '轻量兜底模型，适合低配电脑和批量快速生成。',
    sizeLabel: '约 50MB - 200MB',
    hardware: '无独显也可用',
    speed: '最快',
    quality: '基础自然度',
    status: 'planned',
    recommendedFor: 'low',
  },
  {
    id: 'melotts',
    name: '中文口播',
    levelName: '标准',
    level: 2,
    accentClass: 'from-blue-500 to-cyan-400',
    icon: Mic2,
    description: '默认标准模型，兼顾中文口播效果、体积和部署稳定性。',
    sizeLabel: '约 300MB - 800MB',
    hardware: '16GB 内存以上推荐',
    speed: '较快',
    quality: '标准口播',
    status: 'planned',
    recommendedFor: 'medium',
  },
  {
    id: 'cosyvoice',
    name: '高拟真配音',
    levelName: '高级',
    level: 3,
    accentClass: 'from-violet-500 to-fuchsia-400',
    icon: Gem,
    description: '高质量本地配音模型，适合短视频旁白和更自然的中文表达。',
    sizeLabel: '约 2GB - 5GB',
    hardware: 'NVIDIA 6GB 显存以上推荐',
    speed: '中等',
    quality: '高自然度',
    status: 'planned',
    recommendedFor: 'high',
  },
];

const LevelMeter: React.FC<{ level: number }> = ({ level }) => (
  <div className="flex items-center gap-1" aria-label={`等级 ${level}`}>
    {[1, 2, 3].map(item => (
      <Star
        key={item}
        className={`h-4 w-4 ${
          item <= level ? 'fill-yellow-400 text-yellow-400' : 'fill-transparent text-slate-700'
        }`}
      />
    ))}
  </div>
);

const getModelToneClass = (modelId: TtsModelId, selected: boolean) => {
  if (!selected) return 'border-slate-800/80 bg-black/20';
  if (modelId === 'piper') return 'border-emerald-500/50 bg-emerald-500/10';
  if (modelId === 'melotts') return 'border-blue-500/50 bg-blue-500/10';
  return 'border-violet-500/50 bg-violet-500/10';
};

const getBadgeClass = (modelId: TtsModelId) => {
  if (modelId === 'piper') return 'bg-emerald-500/15 text-emerald-300';
  if (modelId === 'melotts') return 'bg-blue-500/15 text-blue-300';
  return 'bg-violet-500/15 text-violet-300';
};

const recommendModel = (memoryGB: number, cpuCores: number): Pick<SystemSummary, 'recommendedModelId' | 'reason'> => {
  if (memoryGB >= 24 && cpuCores >= 12) {
    return {
      recommendedModelId: 'cosyvoice',
      reason: '内存和 CPU 线程数较充足，后续检测到 6GB 以上 NVIDIA 显卡时优先使用高拟真配音。',
    };
  }

  if (memoryGB >= 16) {
    return {
      recommendedModelId: 'melotts',
      reason: '内存达到标准档要求，适合优先使用中文口播模型。',
    };
  }

  return {
    recommendedModelId: 'piper',
    reason: '当前配置更适合轻量模型，保证低占用和快速生成。',
  };
};

const TextToSpeechMode: React.FC = () => {
  const { isLightTheme, togglePageTheme } = usePageTheme();
  const { isMetalSkin, workspaceSkinClassName } = useHomeSkin();
  const [selectedModelId, setSelectedModelId] = useState<TtsModelId>('melotts');
  const [systemSummary, setSystemSummary] = useState<SystemSummary>({
    cpuCores: navigator.hardwareConcurrency || 0,
    memoryGB: '检测中',
    recommendedModelId: 'melotts',
    reason: '正在读取本机基础配置。',
  });
  const [voiceText, setVoiceText] = useState('这里输入需要生成配音的文本。后续接入本地语音包后，可以批量生成短视频口播音频。');
  const [speed, setSpeed] = useState(1);
  const [pitch, setPitch] = useState(0);
  const [ttsStatus, setTtsStatus] = useState<TtsEngineStatus | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioResult, setAudioResult] = useState<TtsAudioResult | null>(null);

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
    moduleNameCN: 'AI文本配音',
    moduleNameEN: 'TextToSpeech',
  });

  useEffect(() => {
    let mounted = true;

    const loadSystemSummary = async () => {
      try {
        const memory = await window.api.getSystemMemory();
        const memoryValue = Number(memory.totalGB);
        const cpuCores = memory.cpuCount || navigator.hardwareConcurrency || 0;
        const recommendation = recommendModel(memoryValue, cpuCores);

        if (!mounted) return;

        setSystemSummary({
          cpuCores,
          memoryGB: `${memory.totalGB} GB`,
          recommendedModelId: recommendation.recommendedModelId,
          reason: recommendation.reason,
        });
        setSelectedModelId(recommendation.recommendedModelId);
        addLog(`已读取本机配置：${cpuCores || '-'} 线程，内存 ${memory.totalGB} GB`, 'info');
        addLog(`当前 UI 推荐模型：${ttsModels.find(model => model.id === recommendation.recommendedModelId)?.name}`, 'success');
      } catch (error) {
        const cpuCores = navigator.hardwareConcurrency || 0;
        const recommendation = recommendModel(0, cpuCores);

        if (!mounted) return;

        setSystemSummary({
          cpuCores,
          memoryGB: '未知',
          recommendedModelId: recommendation.recommendedModelId,
          reason: '暂未读取到内存信息，先按轻量模型推荐。',
        });
        addLog(`读取系统配置失败：${(error as Error).message}`, 'warning');
      }
    };

    loadSystemSummary();

    return () => {
      mounted = false;
    };
  }, [addLog]);

  const refreshTtsStatus = async () => {
    try {
      if (typeof window.api.getTtsEngineStatus !== 'function') {
        const message = '需要重启应用窗口后，才能加载本地配音接口。';
        setTtsStatus({
          installed: false,
          engineName: '高拟真配音',
          message,
        });
        addLog(message, 'warning');
        return;
      }

      const status = await window.api.getTtsEngineStatus();
      setTtsStatus(status);
      addLog(status.message, status.installed ? 'success' : 'warning');
    } catch (error) {
      addLog(`读取高拟真语音包状态失败：${(error as Error).message}`, 'error');
    }
  };

  useEffect(() => {
    refreshTtsStatus();
  }, []);

  const selectedModel = useMemo(() => {
    return ttsModels.find(model => model.id === selectedModelId) || ttsModels[1];
  }, [selectedModelId]);

  const panelClass = isLightTheme
    ? 'border-[#E7E5DF] bg-white text-[#222222] shadow-[0_12px_32px_rgba(34,34,34,0.06)]'
    : 'border-slate-800 bg-black/35 text-slate-100';
  const subtlePanelClass = isLightTheme
    ? 'border-[#E7E5DF] bg-[#F8F8F5] text-slate-700'
    : 'border-slate-800 bg-neutral-950/70 text-slate-300';
  const inputClass = isLightTheme
    ? 'border-[#E7E5DF] bg-white text-slate-900 placeholder:text-slate-400'
    : 'border-slate-800 bg-black/50 text-slate-100 placeholder:text-slate-600';

  const getModelStatusLabel = (model: TtsModelItem) => {
    if (model.id === 'cosyvoice') {
      return ttsStatus?.installed ? '已就绪' : '待安装';
    }

    return model.status === 'downloaded' ? '已下载' : '往后排';
  };

  const getModelActionLabel = (model: TtsModelItem) => {
    if (model.id === 'cosyvoice') {
      return ttsStatus?.installed ? '选择' : '检查';
    }

    return '稍后接入';
  };

  const handleModelDownload = async (model: TtsModelItem) => {
    setSelectedModelId(model.id);

    if (model.id === 'cosyvoice') {
      await refreshTtsStatus();
      return;
    }

    addLog(`${model.name} 先往后排，当前优先优化高拟真配音。`, 'info');
  };

  const handleGenerate = async () => {
    if (selectedModelId !== 'cosyvoice') {
      addLog('当前先开放高拟真配音试听，请先选择高拟真配音。', 'warning');
      return;
    }

    if (!ttsStatus?.installed) {
      addLog('高拟真语音包尚未就绪，请先检查本地安装状态。', 'warning');
      await refreshTtsStatus();
      return;
    }

    if (typeof window.api.generateTtsPreview !== 'function') {
      addLog('本地配音接口尚未加载，请重启应用窗口后再试。', 'warning');
      return;
    }

    const text = voiceText.trim();
    if (!text) {
      addLog('请输入需要生成配音的文本。', 'warning');
      return;
    }

    try {
      setIsGenerating(true);
      setAudioResult(null);
      addLog('开始生成高拟真配音试听，首次加载可能需要几十秒。', 'info');

      const result = await window.api.generateTtsPreview({
        text,
        voicePackageId: 'cosyvoice',
      });

      if (!result.success || !result.outputPath || !result.fileUrl) {
        addLog(result.error || '生成配音失败。', 'error');
        return;
      }

      setAudioResult({
        outputPath: result.outputPath,
        fileUrl: result.fileUrl,
        duration: result.duration,
      });
      addLog(`配音生成完成：${result.outputPath}`, 'success');
    } catch (error) {
      addLog(`生成配音失败：${(error as Error).message}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={`${workspaceSkinClassName} h-screen flex flex-col ${
      isLightTheme ? 'theme-light-page bg-[#F8F8F5] text-[#222222]' : 'bg-[#181818] text-[#D1D1D1]'
    }`}>
      <PageHeader
        title="AI文本配音"
        icon={Mic2}
        iconColor={isLightTheme ? 'text-blue-600' : 'text-blue-400'}
        description="本地语音包按需下载，初始安装包不内置语音包"
        featureInfo={{
          title: 'AI文本配音',
          description: '按电脑配置选择三档本地语音包，用户只需要选择适合自己的效果档位。',
          details: [
            '极速离线：适合低配和兜底',
            '中文口播：适合默认标准配音',
            '高拟真配音：适合高配显卡和更自然的口播',
            '当前版本先搭建 UI，不内置真实语音包',
          ],
          themeColor: 'blue',
        }}
        rightContent={isMetalSkin ? undefined : <PageThemeToggle isLightTheme={isLightTheme} onToggle={togglePageTheme} />}
      />

      <main className="metal-workspace flex-1 overflow-hidden p-4">
        <div className="grid h-full grid-cols-1 gap-4 xl:grid-cols-[minmax(390px,480px)_1fr]">
          <section className={`metal-sidebar flex min-h-0 flex-col rounded-lg border ${panelClass}`}>
            <div className="border-b border-slate-800/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    <Settings2 className="h-4 w-4 text-blue-400" />
                    本地语音包方案
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    语音包按需下载到本机，不占用初始安装包体积。
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-md border border-slate-800 p-2 text-slate-500 transition-colors hover:text-blue-300"
                  title="刷新配置检测"
                  onClick={refreshTtsStatus}
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4">
              <div className={`metal-panel rounded-lg border p-3 ${subtlePanelClass}`}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    isLightTheme ? 'bg-slate-100 text-slate-950' : 'bg-blue-500/15 text-slate-100'
                  }`}>
                    <Cpu className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">电脑配置推荐</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      CPU 线程：{systemSummary.cpuCores || '未知'} · 内存：{systemSummary.memoryGB}
                    </p>
                  </div>
                </div>
                <div className={`mt-3 rounded-md border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs leading-5 ${
                  isLightTheme ? 'text-slate-950' : 'text-slate-100'
                }`}>
                  推荐：{ttsModels.find(model => model.id === systemSummary.recommendedModelId)?.name || '中文口播'}。{systemSummary.reason}
                </div>
                <p className="mt-2 text-[11px] leading-5 text-slate-500">
                  注：GPU 显存检测后续在主进程接入，检测到 RTX 3060 / 4060 级别显卡时会优先推荐高拟真配音。
                </p>
              </div>

              <div className="mt-4 grid gap-3">
                {ttsModels.map(model => {
                  const isSelected = selectedModelId === model.id;
                  const isRecommended = systemSummary.recommendedModelId === model.id;
                  const statusLabel = getModelStatusLabel(model);
                  const ModelIcon = model.icon;

                  return (
                    <div
                      key={model.id}
                      className={`metal-control overflow-hidden rounded-lg border transition-colors ${getModelToneClass(model.id, isSelected)}`}
                    >
                      <div className={`h-1.5 bg-gradient-to-r ${model.accentClass}`} />
                      <div className="flex items-start justify-between gap-3 p-3">
                        <button
                          type="button"
                          onClick={() => setSelectedModelId(model.id)}
                          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left"
                        >
                          <div className="flex items-start gap-3">
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${model.accentClass} text-white shadow-lg shadow-black/20`}>
                              <ModelIcon className="h-6 w-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold">{model.name}</span>
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${getBadgeClass(model.id)}`}>
                                  {model.levelName}档
                                </span>
                                {isRecommended && (
                                  <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-medium text-cyan-300">当前推荐</span>
                                )}
                                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                                  {statusLabel}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-3">
                                <LevelMeter level={model.level} />
                                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                                  <Gauge className="h-3.5 w-3.5" />
                                  {model.level === 1 ? '低占用' : model.level === 2 ? '均衡推荐' : '高质量'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <p className="mt-3 text-xs leading-5 text-slate-500">{model.description}</p>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                            <span>体积：{model.sizeLabel}</span>
                            <span>速度：{model.speed}</span>
                            <span>质量：{model.quality}</span>
                            <span>配置：{model.hardware}</span>
                          </div>
                        </button>

                        <Button
                          size="sm"
                          variant={model.status === 'downloaded' ? 'ghost' : 'secondary'}
                          themeColor="blue"
                          className={model.id === 'cosyvoice' && ttsStatus?.installed ? 'metal-control' : 'metal-primary'}
                          leftIcon={model.id === 'cosyvoice' && ttsStatus?.installed ? <CheckCircle2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                          onClick={() => handleModelDownload(model)}
                        >
                          {getModelActionLabel(model)}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="grid min-h-0 grid-rows-[minmax(0,1fr)_280px] gap-4">
            <div className={`metal-panel flex min-h-0 flex-col rounded-lg border ${panelClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 p-4">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    <Volume2 className="h-4 w-4 text-blue-400" />
                    配音编辑台
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    当前选择：{selectedModel.name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="metal-control"
                    leftIcon={<Trash2 className="h-4 w-4" />}
                    onClick={() => setVoiceText('')}
                  >
                    清空
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    className="metal-primary"
                    leftIcon={<Sparkles className="h-4 w-4" />}
                    onClick={handleGenerate}
                    disabled={!voiceText.trim() || isGenerating}
                  >
                    {isGenerating ? '生成中...' : '生成配音'}
                  </Button>
                </div>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="flex min-h-0 flex-col">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">文本内容</h3>
                      <p className="mt-1 text-xs text-slate-500">后续支持批量导入字幕、分段生成和输出 WAV / MP3。</p>
                    </div>
                    <span className="rounded-md border border-slate-800 px-2.5 py-1 text-xs text-slate-500">
                      {voiceText.length} 字
                    </span>
                  </div>
                  <textarea
                    value={voiceText}
                    onChange={(event) => setVoiceText(event.target.value)}
                    className={`min-h-0 flex-1 resize-none rounded-lg border p-4 text-sm leading-7 outline-none transition-colors focus:border-blue-500/60 ${inputClass}`}
                    placeholder="输入要转成语音的文案..."
                  />
                </div>

                <div className="space-y-4 overflow-auto">
                  <div className={`rounded-lg border p-4 ${subtlePanelClass}`}>
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <SlidersHorizontal className="h-4 w-4 text-blue-400" />
                      音频参数
                    </h3>
                    <div className="mt-4 space-y-4">
                      <label className="block">
                        <div className="mb-2 flex items-center justify-between text-xs">
                          <span className="text-slate-500">语速</span>
                          <span className="font-mono text-blue-300">{speed.toFixed(1)}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.6"
                          max="1.6"
                          step="0.1"
                          value={speed}
                          onChange={(event) => setSpeed(Number(event.target.value))}
                          className="w-full accent-blue-500"
                        />
                      </label>

                      <label className="block">
                        <div className="mb-2 flex items-center justify-between text-xs">
                          <span className="text-slate-500">音调</span>
                          <span className="font-mono text-blue-300">{pitch > 0 ? `+${pitch}` : pitch}</span>
                        </div>
                        <input
                          type="range"
                          min="-6"
                          max="6"
                          step="1"
                          value={pitch}
                          onChange={(event) => setPitch(Number(event.target.value))}
                          className="w-full accent-blue-500"
                        />
                      </label>
                    </div>
                  </div>

                  <div className={`rounded-lg border p-4 ${subtlePanelClass}`}>
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <HardDrive className="h-4 w-4 text-blue-400" />
                      输出设置
                    </h3>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <button type="button" className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-blue-200">
                        WAV
                      </button>
                      <button type="button" className="rounded-lg border border-slate-800 bg-black/20 px-3 py-2 text-slate-500">
                        MP3
                      </button>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      当前先输出 WAV 试听文件，后续再开放 MP3 和批量导出。
                    </p>
                  </div>

                  <div className={`rounded-lg border border-dashed p-6 text-center ${subtlePanelClass}`}>
                    <PlayCircle className="mx-auto h-9 w-9 text-slate-500" />
                    <p className="mt-3 text-sm font-medium text-slate-400">
                      {audioResult ? '试听已生成' : isGenerating ? '正在生成试听' : '暂无音频预览'}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      {audioResult
                        ? `时长：${audioResult.duration ? `${audioResult.duration} 秒` : '已生成'}`
                        : '生成后这里会显示试听播放器和保存路径。'}
                    </p>
                    {audioResult && (
                      <div className="mt-4 space-y-3 text-left">
                        <audio controls src={audioResult.fileUrl} className="w-full" />
                        <div className="break-all rounded-md border border-slate-800 bg-black/20 px-3 py-2 text-[11px] leading-5 text-slate-500">
                          {audioResult.outputPath}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="metal-control w-full"
                          leftIcon={<FolderOpen className="h-4 w-4" />}
                          onClick={() => {
                            if (typeof window.api.openTtsOutput === 'function') {
                              window.api.openTtsOutput(audioResult.outputPath);
                            }
                          }}
                        >
                          打开文件位置
                        </Button>
                      </div>
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
              themeColor="blue"
              className="metal-panel"
              height="280px"
            />
          </section>
        </div>
      </main>
    </div>
  );
};

export default TextToSpeechMode;
