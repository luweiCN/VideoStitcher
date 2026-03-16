/**
 * A面视频生产 - 主页面
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, ListOrdered, ChevronRight } from 'lucide-react';
import { useASideStore } from '../../stores/asideStore';
import PageHeader from '../../components/PageHeader';
import { StyleSelector } from './components/StyleSelector';
import { ConfigPanel } from './components/ConfigPanel';
import { ScriptList } from './components/ScriptList';
import { ProductionQueue } from './components/ProductionQueue';
import type { StyleTemplate } from './types';

// Mock 数据：风格模板
const MOCK_STYLE_TEMPLATES: StyleTemplate[] = [
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
  {
    id: 'suspense-1',
    name: '悬疑惊悚',
    description: '紧张刺激的氛围，适合剧情内容',
    thumbnail: 'https://via.placeholder.com/400x225?text=Suspense',
    category: '热门',
    tags: ['悬疑', '紧张', '剧情'],
    config: {
      colorTone: 'cool',
      transitionStyle: 'smooth',
      textAnimation: 'fade',
      cameraMovement: 'slowPan',
      shotDuration: 5,
      bgmStyle: 'suspense',
      bgmVolume: 60,
      voiceVolume: 100,
    },
  },
  {
    id: 'tutorial-1',
    name: '教学解说',
    description: '清晰专业的讲解风格',
    thumbnail: 'https://via.placeholder.com/400x225?text=Tutorial',
    category: '经典',
    tags: ['教学', '专业', '清晰'],
    config: {
      colorTone: 'neutral',
      transitionStyle: 'minimal',
      textAnimation: 'typewriter',
      cameraMovement: 'static',
      shotDuration: 6,
      bgmStyle: 'ambient',
      bgmVolume: 30,
      voiceVolume: 100,
    },
  },
  {
    id: 'emotional-1',
    name: '情感共鸣',
    description: '温馨感人的情感表达',
    thumbnail: 'https://via.placeholder.com/400x225?text=Emotional',
    category: '经典',
    tags: ['情感', '温馨', '感人'],
    config: {
      colorTone: 'warm',
      transitionStyle: 'smooth',
      textAnimation: 'fade',
      cameraMovement: 'slowPan',
      shotDuration: 5,
      bgmStyle: 'emotional',
      bgmVolume: 50,
      voiceVolume: 100,
    },
  },
  {
    id: 'action-1',
    name: '动作动感',
    description: '快节奏的动作场景',
    thumbnail: 'https://via.placeholder.com/400x225?text=Action',
    category: '新品',
    tags: ['动作', '快节奏', '动感'],
    config: {
      colorTone: 'vibrant',
      transitionStyle: 'dynamic',
      textAnimation: 'slide',
      cameraMovement: 'dynamic',
      shotDuration: 2,
      bgmStyle: 'action',
      bgmVolume: 80,
      voiceVolume: 90,
    },
  },
  {
    id: 'documentary-1',
    name: '纪录片风格',
    description: '客观真实的记录风格',
    thumbnail: 'https://via.placeholder.com/400x225?text=Documentary',
    category: '新品',
    tags: ['纪录片', '真实', '客观'],
    config: {
      colorTone: 'neutral',
      transitionStyle: 'minimal',
      textAnimation: 'fade',
      cameraMovement: 'static',
      shotDuration: 7,
      bgmStyle: 'documentary',
      bgmVolume: 40,
      voiceVolume: 100,
    },
  },
];

const ASidePage: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentStep,
    selectedStyle,
    styleTemplates,
    config,
    scripts,
    isGeneratingScripts,
    queueItems,
    setCurrentStep,
    selectStyle,
    updateConfig,
    setScripts,
    addScript,
    removeScript,
    updateScript,
    setGeneratingScripts,
    addToQueue,
    removeFromQueue,
    updateQueuePriority,
    clearQueue,
  } = useASideStore();

  // 初始化风格模板
  useEffect(() => {
    useASideStore.setState({ styleTemplates: MOCK_STYLE_TEMPLATES });
  }, []);

  // 检查是否可以生成
  const canGenerate = selectedStyle && config.region && config.productName;

  // 模拟生成脚本
  const handleGenerateScripts = async () => {
    if (!canGenerate) return;

    setGeneratingScripts(true);
    setCurrentStep('scripts');

    // 模拟 API 调用延迟
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 生成模拟脚本
    const newScripts = Array.from({ length: config.batchSize }, (_, index) => ({
      id: `script-${Date.now()}-${index}`,
      title: `${config.productName} - ${selectedStyle!.name}风格 #${index + 1}`,
      scenes: [
        {
          id: `scene-${Date.now()}-${index}-1`,
          sequence: 1,
          content: `开场：介绍${config.productName}在${config.region}市场的独特优势`,
          duration: 5,
        },
        {
          id: `scene-${Date.now()}-${index}-2`,
          sequence: 2,
          content: `展示核心功能和用户受益点`,
          duration: 5,
        },
        {
          id: `scene-${Date.now()}-${index}-3`,
          sequence: 3,
          content: `结尾：呼吁行动，引导下载或注册`,
          duration: 5,
        },
      ],
      totalDuration: 15,
      createdAt: new Date(),
    }));

    setScripts([...scripts, ...newScripts]);
    setGeneratingScripts(false);
  };

  // 重新生成单条脚本
  const handleRegenerateScript = async (scriptId: string) => {
    setGeneratingScripts(true);

    // 模拟 API 调用
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const newScript = {
      id: `script-${Date.now()}`,
      title: `${config.productName} - ${selectedStyle!.name}风格 (新)`,
      scenes: [
        {
          id: `scene-${Date.now()}-1`,
          sequence: 1,
          content: `开场：全新角度介绍${config.productName}`,
          duration: 5,
        },
        {
          id: `scene-${Date.now()}-2`,
          sequence: 2,
          content: `展示用户真实案例和反馈`,
          duration: 5,
        },
        {
          id: `scene-${Date.now()}-3`,
          sequence: 3,
          content: `结尾：限时优惠，立即行动`,
          duration: 5,
        },
      ],
      totalDuration: 15,
      createdAt: new Date(),
    };

    // 替换旧脚本
    const updatedScripts = scripts.map((s) =>
      s.id === scriptId ? newScript : s
    );
    setScripts(updatedScripts);
    setGeneratingScripts(false);
  };

  // 开始生产
  const handleStartProduction = () => {
    // TODO: 实现生产逻辑
    console.log('开始生产视频...');
  };

  // 步骤标题
  const getStepTitle = () => {
    switch (currentStep) {
      case 'style':
        return '选择风格';
      case 'config':
        return '配置参数';
      case 'scripts':
        return '脚本生成';
      case 'queue':
        return '待产库';
    }
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col">
      {/* 顶部导航 */}
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
              <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded-full">
                {queueItems.length}
              </span>
            )}
          </button>
        }
      />

      {/* 步骤指示器 */}
      <div className="border-b border-slate-800 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center gap-2">
            {(['style', 'config', 'scripts', 'queue'] as const).map((step, index) => (
              <React.Fragment key={step}>
                <button
                  onClick={() => setCurrentStep(step)}
                  className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${
                      currentStep === step
                        ? 'bg-gradient-to-r from-pink-600 to-violet-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }
                  `}
                >
                  {index + 1}. {getStepTitle()}
                </button>
                {index < 3 && <ChevronRight className="w-4 h-4 text-slate-600" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {currentStep === 'style' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">选择视频风格</h2>
                <p className="text-slate-400">选择适合您产品的视觉风格模板</p>
              </div>
              <StyleSelector
                styles={styleTemplates}
                selectedStyle={selectedStyle}
                onSelect={(style) => {
                  selectStyle(style);
                  setCurrentStep('config');
                }}
              />
            </div>
          )}

          {currentStep === 'config' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 左侧：配置面板 */}
              <div>
                <ConfigPanel
                  config={config}
                  onUpdate={updateConfig}
                  onGenerate={handleGenerateScripts}
                  isGenerating={isGeneratingScripts}
                  canGenerate={!!canGenerate}
                />
              </div>

              {/* 右侧：已选风格 */}
              <div className="bg-black/50 border border-slate-800 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">已选风格</h3>
                {selectedStyle ? (
                  <div className="space-y-4">
                    <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden">
                      <img
                        src={selectedStyle.thumbnail}
                        alt={selectedStyle.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-1">{selectedStyle.name}</h4>
                      <p className="text-sm text-slate-400 mb-2">
                        {selectedStyle.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {selectedStyle.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 text-xs bg-pink-500/10 text-pink-400 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500">未选择风格</p>
                )}
              </div>
            </div>
          )}

          {currentStep === 'scripts' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 左侧：配置面板 */}
              <div>
                <ConfigPanel
                  config={config}
                  onUpdate={updateConfig}
                  onGenerate={handleGenerateScripts}
                  isGenerating={isGeneratingScripts}
                  canGenerate={!!canGenerate}
                />
              </div>

              {/* 右侧：脚本列表 */}
              <div className="lg:col-span-2">
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-white">生成的脚本</h2>
                  <p className="text-sm text-slate-400">
                    已生成 {scripts.length} 条脚本
                  </p>
                </div>
                <ScriptList
                  scripts={scripts}
                  onAddToQueue={addToQueue}
                  onEdit={updateScript}
                  onRemove={removeScript}
                  onRegenerate={handleRegenerateScript}
                />
              </div>
            </div>
          )}

          {currentStep === 'queue' && (
            <ProductionQueue
              items={queueItems}
              onRemove={removeFromQueue}
              onUpdatePriority={updateQueuePriority}
              onStartProduction={handleStartProduction}
              onClearQueue={clearQueue}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ASidePage;
