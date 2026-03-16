/**
 * 脚本生成器组件
 * 使用 AI 生成脚本，支持编辑和添加到待产库
 */

import { useState, useEffect } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useASideStore } from '@renderer/stores/asideStore';
import type { Script, AIModel } from '@shared/types/aside';
import { ModelSelector } from './ModelSelector';
import { ScriptCard } from './ScriptCard';
import { PersonaManager } from '../PersonaManager';

/**
 * 脚本生成器主组件
 */
export function ScriptGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);

  const {
    currentProject,
    selectedDirection,
    selectedRegion,
    selectedPersona,
    selectedModel,
    scriptCount,
    generatedScripts,
    setModel,
    setScriptCount,
    setGeneratedScripts,
    addGeneratedScript,
    removeGeneratedScript,
    clearGeneratedScripts,
    setCurrentView,
  } = useASideStore();

  /**
   * 返回 Step 2
   */
  const handleBack = () => {
    setCurrentView('step2-region');
  };

  /**
   * 生成脚本
   */
  const handleGenerate = async () => {
    if (!currentProject || !selectedDirection || !selectedPersona) {
      alert('请先选择创意方向和人设');
      return;
    }

    try {
      setIsGenerating(true);

      // TODO: 调用 AI 生成脚本的 IPC
      console.log('[ScriptGenerator] 开始生成脚本', {
        model: selectedModel,
        count: scriptCount,
        direction: selectedDirection.name,
        persona: selectedPersona.name,
        region: selectedRegion,
      });

      // 模拟生成脚本（实际应调用 window.api.generateScripts）
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 模拟生成的脚本数据
      const mockScripts: Script[] = Array.from({ length: scriptCount }, (_, i) => ({
        id: `script-${Date.now()}-${i}`,
        projectId: currentProject.id,
        content: `这是第 ${i + 1} 个生成的脚本内容...`,
        creativeDirectionId: selectedDirection.id,
        personaId: selectedPersona.id,
        aiModel: selectedModel,
        status: 'draft' as const,
        createdAt: new Date().toISOString(),
      }));

      setGeneratedScripts([...generatedScripts, ...mockScripts]);
      console.log('[ScriptGenerator] 脚本生成完成，数量:', mockScripts.length);
    } catch (error) {
      console.error('[ScriptGenerator] 生成脚本失败:', error);
      alert('生成脚本失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * 添加脚本到待产库
   */
  const handleAddToLibrary = async (script: Script) => {
    try {
      const result = await window.api.createScript({
        projectId: script.projectId,
        content: script.content,
        creativeDirectionId: script.creativeDirectionId,
        personaId: script.personaId,
        aiModel: script.aiModel,
        status: 'library',
      });

      if (result.success && result.script) {
        removeGeneratedScript(script.id);
        console.log('[ScriptGenerator] 已添加到待产库:', result.script.id);
        alert('已添加到待产库');
      }
    } catch (error) {
      console.error('[ScriptGenerator] 添加到待产库失败:', error);
      alert('添加失败，请重试');
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
    <div className="h-full flex bg-black text-slate-100">
      {/* 左侧：人设管理 */}
      <div className="w-80 border-r border-slate-800 overflow-hidden">
        <PersonaManager />
      </div>

      {/* 右侧：脚本生成 */}
      <div className="flex-1 flex flex-col">
        {/* 头部 */}
        <header className="px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-4 mb-3">
            <button
              onClick={handleBack}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Step 3: 生成脚本</h1>
              <p className="text-sm text-slate-500 mt-1">
                项目：{currentProject.name} / 创意方向：{selectedDirection.name}
              </p>
            </div>
          </div>

          {/* 模型选择器 */}
          <div className="flex gap-4">
            <ModelSelector
              selectedModel={selectedModel}
              onModelChange={setModel}
            />
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">生成数量：</label>
              <input
                type="number"
                value={scriptCount}
                onChange={(e) => setScriptCount(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                max="20"
                className="w-20 px-3 py-1.5 bg-black/50 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-slate-700"
              />
            </div>
          </div>
        </header>

        {/* 生成按钮 */}
        <div className="px-6 py-4 border-b border-slate-800">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !selectedPersona}
            className={`
              flex items-center justify-center gap-2 w-full py-3 rounded-lg transition-all
              ${
                isGenerating || !selectedPersona
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-pink-600 to-violet-600 text-white hover:opacity-90'
              }
            `}
          >
            <Sparkles className={`w-5 h-5 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? '生成中...' : '生成脚本'}</span>
          </button>
          {!selectedPersona && (
            <p className="text-xs text-slate-500 mt-2 text-center">请先在左侧选择一个人设</p>
          )}
        </div>

        {/* 脚本列表 */}
        <div className="flex-1 overflow-y-auto p-6">
          {generatedScripts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Sparkles className="w-16 h-16 text-slate-700 mb-4" />
              <p className="text-slate-500 mb-2">还没有生成任何脚本</p>
              <p className="text-sm text-slate-600">选择人设后点击上方按钮生成脚本</p>
            </div>
          ) : (
            <div className="space-y-4">
              {generatedScripts.map((script, index) => (
                <ScriptCard
                  key={script.id}
                  script={script}
                  index={index + 1}
                  onAddToLibrary={() => handleAddToLibrary(script)}
                  onDelete={() => removeGeneratedScript(script.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 底部工具栏 */}
        {generatedScripts.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-800">
            <button
              onClick={clearGeneratedScripts}
              className="w-full py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
            >
              清空所有脚本
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
