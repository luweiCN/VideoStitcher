/**
 * A面视频生产 - 主页面
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, ListOrdered, ChevronRight, AlertCircle } from 'lucide-react';
import { useASideStore } from '../../stores/asideStore';
import { useToastMessages } from '../../components/Toast/Toast';
import PageHeader from '../../components/PageHeader';
import { StyleSelector } from './components/StyleSelector';
import { ConfigPanel } from './components/ConfigPanel';
import { ScriptList } from './components/ScriptList';
import { ProductionQueue } from './components/ProductionQueue';
import { StyleSelectorSkeleton } from '../../components/Skeleton/Skeleton';
import type { StyleTemplate } from './types';

const ASidePage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToastMessages();

  // 状态管理
  const {
    currentStep,
    selectedStyle,
    config,
    scripts,
    isGeneratingScripts,
    queueItems,
    setCurrentStep,
    selectStyle,
    setConfig,
    addScripts,
    updateScript,
    removeScript,
    setScripts,
    addToQueue,
    removeFromQueue,
    updateQueuePriority,
    clearQueue,
    setGeneratingScripts,
  } = useASideStore();

  // 本地状态
  const [styleTemplates, setStyleTemplates] = useState<StyleTemplate[]>([]);
  const [isLoadingStyles, setIsLoadingStyles] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 加载风格模板
  useEffect(() => {
    loadStyleTemplates();
  }, []);

  // 从后端加载风格模板
  const loadStyleTemplates = async () => {
    try {
      setIsLoadingStyles(true);
      setLoadError(null);

      // TODO: 替换为真实的 IPC 调用
      // const templates = await window.api.loadStyleTemplates();
      // setStyleTemplates(templates);

      // 临时使用 Mock 数据
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockTemplates: StyleTemplate[] = [
        {
          id: 'humor-1',
          name: '幽默搞笑',
          description: '轻松幽默的风格，适合娱乐内容',
          thumbnail: 'https://via.placeholder.com/400x225?text=Humor',
          category: '热门',
          tags: ['搞笑', '轻松', '娱乐'],
          config: {
            colorTone: 'vibrant',
            transitionStyle: 'dynamic',
            textAnimation: 'bounce',
            cameraMovement: 'dynamic',
            shotDuration: 3,
            bgmStyle: 'funny',
            bgmVolume: 70,
            voiceVolume: 100,
          },
        },
      ];

      setStyleTemplates(mockTemplates);
    } catch (error) {
      console.error('加载风格模板失败:', error);
      const errorMessage = error instanceof Error ? error.message : '加载风格模板失败';
      setLoadError(errorMessage);
      toast.error(errorMessage, '加载失败');
    } finally {
      setIsLoadingStyles(false);
    }
  };

  const canGenerate = selectedStyle && config.region && config.productName;

  // 生成脚本
  const handleGenerateScripts = async () => {
    if (!canGenerate) return;

    try {
      setGeneratingScripts(true);
      setCurrentStep('scripts');
      setLoadError(null);

      // TODO: 替换为真实的 IPC 调用
      // const newScripts = await window.api.generateScripts({
      //   style: selectedStyle,
      //   config: config
      // });
      // setScripts([...scripts, ...newScripts]);

      // 临时使用 Mock 数据
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const newScripts = Array.from({ length: config.batchSize }, (_, index) => ({
        id: `script-${Date.now()}-${index}`,
        title: `${config.productName} - ${selectedStyle!.name}风格 #${index + 1}`,
        scenes: [
          {
            id: `scene-${Date.now()}-${index}-1`,
            sequence: 1,
            content: `开场：介绍${config.productName}`,
            duration: 5,
          },
        ],
        totalDuration: 15,
        createdAt: new Date(),
      }));

      setScripts([...scripts, ...newScripts]);
      toast.success(`成功生成 ${newScripts.length} 条脚本`, '生成完成');
    } catch (error) {
      console.error('生成脚本失败:', error);
      const errorMessage = error instanceof Error ? error.message : '生成脚本失败';
      setLoadError(errorMessage);
      toast.error(errorMessage, '生成失败');
    } finally {
      setGeneratingScripts(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col">
      {/* 导航栏 */}
      <nav data-testid="main-nav" className="bg-slate-900 border-b border-slate-800">
        <PageHeader
          title="A 面视频生产"
          subtitle="AI 驱动的营销视频批量生产"
          icon={<Sparkles className="w-5 h-5 text-white" />}
          iconGradient="from-pink-600 to-violet-600"
          extraContent={
            <button
              onClick={() => setCurrentStep('queue')}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg hover:border-amber-500 transition-colors"
            >
              <ListOrdered className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-slate-300">待产库</span>
              {queueItems.length > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded-full">
                  {queueItems.length}
                </span>
              )}
            </button>
          }
        />
      </nav>

      {/* 主内容区域 */}
      <main data-testid="main-content" className="flex-1 overflow-y-auto">
        {/* 步骤指示器 */}
        <div data-testid="step-indicator" className="px-8 py-4 border-b border-slate-800">
          <div className="flex items-center gap-4">
            {['style', 'config', 'scripts', 'queue'].map((step, index) => (
              <React.Fragment key={step}>
                <button
                  onClick={() => setCurrentStep(step as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    currentStep === step
                      ? 'bg-violet-500/10 text-violet-400 border border-violet-500'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium">
                    {step === 'style' && '选择风格'}
                    {step === 'config' && '配置参数'}
                    {step === 'scripts' && '脚本生成'}
                    {step === 'queue' && '待产库'}
                  </span>
                </button>
                {index < 3 && <ChevronRight className="w-4 h-4 text-slate-600" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* 风格选择 */}
        {currentStep === 'style' && (
          <div data-testid="style-selector" className="p-8">
            {/* 加载状态 - 骨架屏 */}
            {isLoadingStyles && <StyleSelectorSkeleton />}

            {/* 错误提示 */}
            {loadError && !isLoadingStyles && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-red-400 font-medium mb-1">加载失败</h3>
                  <p className="text-red-300 text-sm">{loadError}</p>
                  <button
                    onClick={loadStyleTemplates}
                    className="mt-3 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm transition-colors"
                  >
                    重试
                  </button>
                </div>
              </div>
            )}

            {/* 风格列表 */}
            {!isLoadingStyles && !loadError && (
              <StyleSelector
                styles={styleTemplates}
                selectedStyle={selectedStyle}
                onSelect={(template) => {
                  selectStyle(template);
                  setCurrentStep('config');
                }}
              />
            )}
          </div>
        )}

        {/* 参数配置 */}
        {currentStep === 'config' && (
          <div data-testid="config-form" className="p-8 max-w-2xl">
            <ConfigPanel
              config={config}
              onUpdate={(updates) => setConfig({ ...config, ...updates })}
              onGenerate={handleGenerateScripts}
              isGenerating={isGeneratingScripts}
              canGenerate={canGenerate}
            />
          </div>
        )}

        {/* 脚本生成 */}
        {currentStep === 'scripts' && (
          <div data-testid="script-list" className="p-8">
            <ScriptList
              scripts={scripts}
              isGenerating={isGeneratingScripts}
              onEdit={updateScript}
              onRemove={removeScript}
              onRegenerate={(scriptId) => {
                // TODO: 实现重新生成逻辑
                console.log('重新生成脚本:', scriptId);
              }}
              onAddToQueue={(scriptId) => {
                const script = scripts.find(s => s.id === scriptId);
                if (script) {
                  addToQueue({ script, priority: queueItems.length + 1 });
                }
              }}
            />
          </div>
        )}

        {/* 待产库 */}
        {currentStep === 'queue' && (
          <div className="p-8">
            <ProductionQueue
              items={queueItems}
              onRemove={removeFromQueue}
              onUpdatePriority={updateQueuePriority}
              onClear={clearQueue}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default ASidePage;
