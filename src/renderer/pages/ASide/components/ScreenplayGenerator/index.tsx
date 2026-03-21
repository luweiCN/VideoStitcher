/**
 * 剧本生成器组件
 * 使用 AI 生成剧本，支持编辑和添加到待产库
 */

import { useState, useEffect } from 'react';
import { Sparkles, Plus, Check, ChevronDown, MoreVertical } from 'lucide-react';
import * as Select from '@radix-ui/react-select';
import * as Popover from '@radix-ui/react-popover';
import { useASideStore } from '@renderer/stores/asideStore';
import type { Screenplay, Persona } from '@shared/types/aside';
import { ModelSelector } from './ModelSelector';
import { ScriptCard } from './ScriptCard';
import { AddPersonaModal } from '../PersonaManager/AddPersonaModal';
import { EditPersonaModal } from '../PersonaManager/EditPersonaModal';
import { StepLayout } from '../StepLayout';
import { ScreenplaySelector } from './ScreenplaySelector';
import { ScreenplayEditModal } from './ScreenplayEditModal';
import { useToastMessages } from '@renderer/components/Toast';
import { useConfirm } from '@renderer/hooks/useConfirm';

/**
 * 剧本生成器主组件
 */
export function ScreenplayGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [addedScreenplayIds, setAddedScreenplayIds] = useState<Set<string>>(new Set());
  const [showScreenplaySelector, setShowScreenplaySelector] = useState(false);
  const [selectorMode, setSelectorMode] = useState<'single' | 'multiple'>('single');
  const [editingLibraryScreenplay, setEditingLibraryScreenplay] = useState<Screenplay | null>(null);

  // 编剧管理状态
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [isLoadingPersonas, setIsLoadingPersonas] = useState(true);
  const [isAddPersonaModalOpen, setIsAddPersonaModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);

  // Toast 通知
  const toast = useToastMessages();

  const {
    currentProject,
    selectedDirection,
    selectedRegion,
    selectedPersona,
    selectedModel,
    scriptCount,
    generatedScripts,
    libraryScripts,
    setModel,
    setScriptCount,
    setGeneratedScripts,
    addGeneratedScript,
    removeGeneratedScript,
    setCurrentView,
    setLibraryScripts,
    selectScreenplay,
    selectPersona,
  } = useASideStore();

  // 加载编剧列表和待产库
  useEffect(() => {
    if (currentProject) {
      loadPersonas();
      loadLibraryScreenplays();
    }
  }, [currentProject]);

  /**
   * 加载编剧列表
   */
  const loadPersonas = async () => {
    if (!currentProject) return;

    try {
      setIsLoadingPersonas(true);
      const result = await window.api.asideGetPersonas(currentProject.id);
      if (result.success && result.personas) {
        setPersonas(result.personas);
      }
    } catch (error) {
      console.error('[ScreenplayGenerator] 加载编剧列表失败:', error);
    } finally {
      setIsLoadingPersonas(false);
    }
  };

  /**
   * 加载待产库剧本
   */
  const loadLibraryScreenplays = async () => {
    if (!currentProject) return;

    try {
      const result = await window.api.asideGetLibraryScreenplays(currentProject.id);
      if (result.success && result.screenplays) {
        setLibraryScripts(result.screenplays);
      }
    } catch (error) {
      console.error('[ScreenplayGenerator] 加载待产库失败:', error);
    }
  };

  /**
   * 添加编剧
   */
  const handleAddPersona = async (name: string, prompt: string) => {
    if (!currentProject) return;

    try {
      const result = await window.api.asideAddPersona({
        projectId: currentProject.id,
        name,
        prompt,
      });
      if (result.success && result.persona) {
        setPersonas([...personas, result.persona]);
        setIsAddPersonaModalOpen(false);
        console.log('[ScreenplayGenerator] 添加编剧成功:', result.persona.name);
      }
    } catch (error) {
      console.error('[ScreenplayGenerator] 添加编剧失败:', error);
    }
  };

  /**
   * 编辑编剧
   */
  const handleEditPersona = async (personaId: string, name: string, prompt: string) => {
    try {
      const result = await window.api.asideUpdatePersona(personaId, { name, prompt });
      if (result.success) {
        await loadPersonas();
        setEditingPersona(null);
        console.log('[ScreenplayGenerator] 编辑编剧成功');
      }
    } catch (error) {
      console.error('[ScreenplayGenerator] 编辑编剧失败:', error);
    }
  };

  /**
   * 删除编剧
   */
  const handleDeletePersona = async (personaId: string) => {
    if (!confirm('确定要删除此编剧吗？')) {
      return;
    }

    try {
      const result = await window.api.asideDeletePersona(personaId);
      if (result.success) {
        setPersonas(personas.filter(p => p.id !== personaId));
        console.log('[ScreenplayGenerator] 删除编剧成功');
      }
    } catch (error) {
      console.error('[ScreenplayGenerator] 删除编剧失败:', error);
    }
  };

  /**
   * 返回 Step 2
   */
  const handleBack = () => {
    setCurrentView('step2-region');
  };

  /**
   * 打开导演模式选择弹窗
   */
  const handleOpenDirectorModeSelector = () => {
    if (libraryScripts.length === 0) {
      toast.warning('请先将剧本添加到待产库');
      return;
    }
    setSelectorMode('single');
    setShowScreenplaySelector(true);
  };

  /**
   * 打开快速合成选择弹窗
   */
  const handleOpenQuickComposeSelector = () => {
    if (libraryScripts.length === 0) {
      toast.warning('请先将剧本添加到待产库');
      return;
    }
    setSelectorMode('multiple');
    setShowScreenplaySelector(true);
  };

  /**
   * 确认选择
   */
  const handleSelectorConfirm = (selected: Screenplay | Screenplay[]) => {
    setShowScreenplaySelector(false);

    if (selectorMode === 'single') {
      // 导演模式：单选
      const screenplay = selected as Screenplay;
      selectScreenplay(screenplay);
      setCurrentView('director-mode');
    } else {
      // 快速合成：多选
      const screenplays = selected as Screenplay[];
      console.log('[快速合成] 选中的剧本:', screenplays.map(s => s.id));
      setCurrentView('quick-compose');
      // TODO: 将选中的剧本传递给快速合成页面
    }
  };

  /**
   * 生成剧本
   */
  const handleGenerate = async () => {
    if (!currentProject || !selectedDirection || !selectedPersona) {
      toast.warning('请先选择创意方向和编剧');
      return;
    }

    try {
      setIsGenerating(true);

      console.log('[ScriptGenerator] 开始生成剧本', {
        model: selectedModel,
        count: scriptCount,
        direction: selectedDirection.name,
        persona: selectedPersona.name,
        region: selectedRegion,
      });

      // 调用真实的 AI 生成剧本 API
      const result = await window.api.asideGenerateScreenplays({
        projectId: currentProject.id,
        creativeDirectionId: selectedDirection.id,
        personaId: selectedPersona.id,
        aiModel: selectedModel,
        count: scriptCount,
        region: selectedRegion,
      });

      if (result.success && result.screenplays) {
        setGeneratedScripts([...generatedScripts, ...result.screenplays]);
        console.log('[ScriptGenerator] 剧本生成完成，数量:', result.screenplays.length);
      } else {
        throw new Error(result.error || '生成失败');
      }
    } catch (error) {
      console.error('[ScriptGenerator] 生成剧本失败:', error);
      toast.error(`生成剧本失败: ${(error as Error).message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * 添加剧本到待产库
   */
  const handleAddToLibrary = async (screenplay: Screenplay) => {
    // 防止重复添加
    if (addedScreenplayIds.has(screenplay.id)) {
      console.log('[ScriptGenerator] 剧本已添加到待产库，跳过:', screenplay.id);
      return;
    }

    try {
      const result = await window.api.asideAddScreenplayToLibrary(screenplay.id);

      if (result.success) {
        // 标记为已添加
        setAddedScreenplayIds(prev => new Set([...prev, screenplay.id]));

        // 从生成列表中移除
        removeGeneratedScript(screenplay.id);

        // 如果有新补充的剧本，添加到生成列表
        if (result.newScreenplay) {
          addGeneratedScript(result.newScreenplay);
          console.log('[ScriptGenerator] 已自动补充新剧本:', result.newScreenplay.id);
        }

        // 刷新待产库列表
        await loadLibraryScreenplays();

        console.log('[ScreenplayGenerator] 已添加到待产库:', screenplay.id);
        toast.success('已添加到待产库');
      } else {
        throw new Error(result.error || '添加失败');
      }
    } catch (error) {
      console.error('[ScriptGenerator] 添加到待产库失败:', error);
      toast.error(`添加失败: ${(error as Error).message}`);
    }
  };

  if (!currentProject || !selectedDirection) {
    return (
      <div className="h-full flex items-center justify-center bg-black text-slate-500">
        <p>请先选择创意方向和区域</p>
      </div>
    );
  }

  // 头部左侧内容：步骤信息
  const leftContent = (
    <div>
      <h1 className="text-2xl font-bold text-slate-100">生成剧本</h1>
      <p className="text-sm text-slate-500 mt-1">Step 3 / 4</p>
    </div>
  );

  // 头部右侧内容：空（移除添加编剧按钮）
  const rightContent = null;

  return (
    <StepLayout
      stepNumber={3}
      totalSteps={4}
      showLibrary={false}
      onPrev={handleBack}
      onNext={selectedPersona ? handleGenerate : undefined}
      leftContent={leftContent}
      rightContent={rightContent}
      nextButtons={
        <>
          <button
            onClick={handleOpenQuickComposeSelector}
            disabled={libraryScripts.length <= 4}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              libraryScripts.length > 4
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                : 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
            }`}
          >
            <span>⚡ 快速合成</span>
          </button>
          <button
            onClick={handleOpenDirectorModeSelector}
            disabled={libraryScripts.length === 0}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all ${
              libraryScripts.length > 0
                ? 'bg-gradient-to-r from-pink-600 to-violet-600 text-white hover:from-pink-700 hover:to-violet-700'
                : 'bg-gradient-to-r from-pink-600/50 to-violet-600/50 text-white/50 cursor-not-allowed'
            }`}
          >
            <span>🎬 导演模式</span>
          </button>
        </>
      }
    >
      <div className="h-full overflow-y-auto px-6 pt-6 pb-24">
        {/* 编剧选择区域 - 通栏布局 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm text-slate-400 font-medium">选择编剧</h3>
            <button
              onClick={() => setIsAddPersonaModalOpen(true)}
              className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>添加编剧</span>
            </button>
          </div>

          {isLoadingPersonas ? (
            <div className="flex items-center justify-center h-24">
              <div className="text-slate-500">加载中...</div>
            </div>
          ) : personas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-center border border-slate-800 rounded-lg">
              <p className="text-slate-500 mb-1">还没有任何编剧</p>
              <p className="text-xs text-slate-600">点击右上角按钮添加</p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {personas.map(persona => (
                <div key={persona.id} className="relative flex-shrink-0">
                  {/* 紧凑卡片 */}
                  <button
                    onClick={() => selectPersona(persona)}
                    className={`
                      w-64 p-4 rounded-lg border transition-all text-left
                      ${selectedPersona?.id === persona.id
                        ? 'border-violet-500 bg-violet-500/10'
                        : 'border-slate-700/50 hover:bg-slate-800/50 hover:border-slate-600'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-slate-100">{persona.name}</span>
                      {persona.isPreset && (
                        <span className="px-2 py-0.5 bg-violet-600/20 text-violet-400 text-xs rounded">
                          预设
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 line-clamp-1">
                      {persona.prompt}
                    </div>
                  </button>

                  {/* 详情按钮 */}
                  <Popover.Root>
                    <Popover.Trigger asChild>
                      <button
                        className="absolute top-2 right-2 p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content
                        className="z-50 w-72 p-4 bg-slate-900 border border-slate-700 rounded-lg shadow-xl"
                        side="bottom"
                        align="end"
                        sideOffset={8}
                      >
                        <div className="font-medium text-slate-100 mb-2">{persona.name}</div>
                        <div className="text-sm text-slate-300 mb-3">{persona.prompt}</div>
                        {!persona.isPreset && (
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingPersona(persona);
                              }}
                              className="text-xs px-2 py-1 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 transition-colors"
                            >
                              编辑
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePersona(persona.id);
                              }}
                              className="text-xs px-2 py-1 bg-slate-800 text-red-400 rounded hover:bg-slate-700 transition-colors"
                            >
                              删除
                            </button>
                          </div>
                        )}
                        <Popover.Arrow className="fill-slate-900" />
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 生成设置 */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-800 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">AI 模型：</label>
              <ModelSelector
                selectedModel={selectedModel}
                onModelChange={setModel}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">生成数量：</label>
              <Select.Root
                value={scriptCount.toString()}
                onValueChange={(value) => setScriptCount(parseInt(value))}
              >
                <Select.Trigger className="inline-flex items-center justify-between gap-2 px-3 py-2 bg-black/50 border border-slate-800 rounded-lg text-slate-100 hover:border-slate-700 focus:outline-none focus:border-violet-500 w-[80px] h-9">
                  <Select.Value />
                  <Select.Icon>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </Select.Icon>
                </Select.Trigger>

                <Select.Portal>
                  <Select.Content className="overflow-hidden bg-slate-900 border border-slate-800 rounded-lg shadow-xl">
                    <Select.Viewport className="p-1">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                        <Select.Item
                          key={num}
                          value={num.toString()}
                          className="flex items-center justify-between px-3 py-2 text-sm text-slate-300 rounded cursor-pointer hover:bg-slate-800 focus:outline-none focus:bg-violet-500/10 focus:text-violet-300"
                        >
                          <Select.ItemText>{num}</Select.ItemText>
                          <Select.ItemIndicator>
                            <Check className="w-4 h-4 text-violet-500" />
                          </Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
          </div>

          {/* 生成剧本按钮 - 更醒目 */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !selectedPersona}
            className={`
              flex items-center gap-2 px-8 py-3 rounded-lg transition-all text-base font-medium
              ${
                isGenerating || !selectedPersona
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-pink-600 to-violet-600 text-white hover:from-pink-700 hover:to-violet-700 shadow-lg shadow-violet-500/30'
              }
            `}
          >
            <Sparkles className={`w-5 h-5 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? '生成中...' : '✨ 生成剧本'}</span>
          </button>
        </div>

        {/* 生成的剧本列表 - 限制最大宽度并居中 */}
        <div className="flex justify-center">
          <div className="w-full max-w-6xl">
            <div className="space-y-4">
              {generatedScripts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Sparkles className="w-16 h-16 text-slate-700 mb-4" />
                  <p className="text-slate-500 mb-2">还没有生成任何剧本</p>
                  <p className="text-sm text-slate-600">选择编剧后点击上方按钮生成剧本</p>
                </div>
              ) : (
                <>
                  {generatedScripts.map((screenplay, index) => (
                    <ScriptCard
                      key={screenplay.id}
                      screenplay={screenplay}
                      index={index + 1}
                      isAdded={addedScreenplayIds.has(screenplay.id)}
                      onAddToLibrary={() => handleAddToLibrary(screenplay)}
                      onDelete={() => removeGeneratedScript(screenplay.id)}
                    />
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 添加编剧弹窗 */}
      {isAddPersonaModalOpen && currentProject && (
        <AddPersonaModal
          projectId={currentProject.id}
          onClose={() => setIsAddPersonaModalOpen(false)}
          onAdd={handleAddPersona}
        />
      )}

      {/* 编辑编剧弹窗 */}
      {editingPersona && (
        <EditPersonaModal
          persona={editingPersona}
          onClose={() => setEditingPersona(null)}
          onSave={(name, prompt) => handleEditPersona(editingPersona.id, name, prompt)}
        />
      )}

      {/* 剧本选择弹窗 */}
      {showScreenplaySelector && (
        <ScreenplaySelector
          screenplays={libraryScripts}
          mode={selectorMode}
          onConfirm={handleSelectorConfirm}
          onCancel={() => setShowScreenplaySelector(false)}
          onEditScreenplay={setEditingLibraryScreenplay}
        />
      )}

      {/* 待产库剧本编辑弹窗 */}
      {editingLibraryScreenplay && (
        <ScreenplayEditModal
          screenplayId={editingLibraryScreenplay.id}
          content={editingLibraryScreenplay.content}
          onClose={() => setEditingLibraryScreenplay(null)}
          onSaved={(newContent) => {
            setLibraryScripts(
              libraryScripts.map((s: Screenplay) => s.id === editingLibraryScreenplay!.id ? { ...s, content: newContent } : s)
            );
            setEditingLibraryScreenplay(null);
          }}
        />
      )}
    </StepLayout>
  );
}
