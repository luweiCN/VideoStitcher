/**
 * 剧本生成器组件
 * 使用 AI 生成剧本，支持编辑和添加到待产库
 */

import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { useASideStore } from '@renderer/stores/asideStore';
import type { Screenplay, AIModel } from '@shared/types/aside';
import { ModelSelector } from './ModelSelector';
import { ScriptCard } from './ScriptCard';
import { PersonaManager } from '../PersonaManager';
import { StepLayout } from '../StepLayout';

/**
 * 剧本生成器主组件
 */
export function ScreenplayGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [addedScreenplayIds, setAddedScreenplayIds] = useState<Set<string>>(new Set()); // 跟踪已添加的剧本

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
    clearGeneratedScripts,
    setCurrentView,
    setLibraryScripts,
  } = useASideStore();

  /**
   * 返回 Step 2
   */
  const handleBack = () => {
    setCurrentView('step2-region');
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
   * 生成剧本
   */
  const handleGenerate = async () => {
    if (!currentProject || !selectedDirection || !selectedPersona) {
      alert('请先选择创意方向和人设');
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
      });

      if (result.success && result.screenplays) {
        setGeneratedScripts([...generatedScripts, ...result.screenplays]);
        console.log('[ScriptGenerator] 剧本生成完成，数量:', result.screenplays.length);
      } else {
        throw new Error(result.error || '生成失败');
      }
    } catch (error) {
      console.error('[ScriptGenerator] 生成剧本失败:', error);
      alert(`生成剧本失败: ${(error as Error).message}`);
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
        alert('已添加到待产库');
      } else {
        throw new Error(result.error || '添加失败');
      }
    } catch (error) {
      console.error('[ScriptGenerator] 添加到待产库失败:', error);
      alert(`添加失败: ${(error as Error).message}`);
    }
  };

  if (!currentProject || !selectedDirection) {
    return (
      <div className="h-full flex items-center justify-center bg-black text-slate-500">
        <p>请先选择创意方向和区域</p>
      </div>
    );
  }

  return (
    <StepLayout
      title="生成剧本"
      stepNumber={3}
      totalSteps={3}
      onPrev={handleBack}
      nextButtons={
        <>
          <button
            onClick={() => setCurrentView('quick-compose')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <span>⚡ 快速合成</span>
          </button>
          <button
            onClick={() => setCurrentView('director-mode')}
            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-pink-600 to-violet-600 text-white rounded-lg hover:from-pink-700 hover:to-violet-700 transition-all"
          >
            <span>🎬 导演模式</span>
          </button>
        </>
      }
    >
      <div className="h-full flex flex-col bg-black text-slate-100">
        {/* 上半部分：控制区 + 人设管理 */}
        <div className="flex gap-6 h-1/2 p-6 border-b border-slate-800">
          {/* 左侧控制栏 - 窄栏 */}
          <div className="w-48 flex flex-col gap-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">AI 模型：</label>
              <ModelSelector
                selectedModel={selectedModel}
                onModelChange={setModel}
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">生成数量：</label>
              <input
                type="number"
                value={scriptCount}
                onChange={(e) => setScriptCount(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                max="20"
                className="w-full px-3 py-1.5 bg-black/50 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-slate-700"
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedPersona}
              className={`
                flex items-center justify-center gap-2 w-full py-3 rounded-lg transition-all mt-2
                ${
                  isGenerating || !selectedPersona
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-pink-600 to-violet-600 text-white hover:opacity-90'
                }
              `}
            >
              <Sparkles className={`w-5 h-5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>{isGenerating ? '生成中...' : '✨ 生成剧本'}</span>
            </button>
            {!selectedPersona && (
              <p className="text-xs text-slate-500 text-center">请先选择人设</p>
            )}
          </div>

          {/* 右侧人设管理 - 宽区 */}
          <div className="flex-1 overflow-hidden">
            <PersonaManager />
          </div>
        </div>

        {/* 下半部分：生成的剧本列表 */}
        <div className="h-1/2 overflow-y-auto p-6">
          {generatedScripts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Sparkles className="w-16 h-16 text-slate-700 mb-4" />
              <p className="text-slate-500 mb-2">还没有生成任何剧本</p>
              <p className="text-sm text-slate-600">选择人设后点击左侧按钮生成剧本</p>
            </div>
          ) : (
            <div className="space-y-4">
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
            </div>
          )}
        </div>
      </div>
    </StepLayout>
  );
}
