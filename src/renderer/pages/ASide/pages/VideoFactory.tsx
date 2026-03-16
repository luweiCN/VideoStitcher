/**
 * 视频工厂页面
 * 快速批量生成视频
 */

import React, { useState } from 'react';
import { Zap, Check, Play } from 'lucide-react';
import { useASideStore } from '@renderer/stores/asideStore';
import type { AIModel } from '@shared/types/aside';

/**
 * 视频工厂页面组件
 */
export function VideoFactory() {
  const { libraryScripts, currentProject } = useASideStore();

  const [selectedScripts, setSelectedScripts] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<AIModel>('gemini');
  const [isGenerating, setIsGenerating] = useState(false);

  /**
   * 切换脚本选择
   */
  const toggleScriptSelection = (scriptId: string) => {
    setSelectedScripts(prev =>
      prev.includes(scriptId)
        ? prev.filter(id => id !== scriptId)
        : [...prev, scriptId]
    );
  };

  /**
   * 全选/取消全选
   */
  const toggleSelectAll = () => {
    if (selectedScripts.length === libraryScripts.length) {
      setSelectedScripts([]);
    } else {
      setSelectedScripts(libraryScripts.map(s => s.id));
    }
  };

  /**
   * 开始生成视频
   */
  const handleGenerate = async () => {
    if (selectedScripts.length === 0) {
      alert('请选择至少一个脚本');
      return;
    }

    try {
      setIsGenerating(true);

      console.log('[VideoFactory] 开始生成视频', {
        scripts: selectedScripts.length,
        model: selectedModel,
      });

      // TODO: 调用视频生成 IPC
      await new Promise(resolve => setTimeout(resolve, 2000));

      alert(`已开始生成 ${selectedScripts.length} 个视频`);
    } catch (error) {
      console.error('[VideoFactory] 生成视频失败:', error);
      alert('生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!currentProject) {
    return (
      <div className="h-full flex items-center justify-center bg-black text-slate-500">
        <p>请先选择一个项目</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black text-slate-100">
      {/* 头部 */}
      <header className="px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3 mb-2">
          <Zap className="w-6 h-6 text-amber-400" />
          <h1 className="text-2xl font-bold">视频工厂</h1>
        </div>
        <p className="text-sm text-slate-500">批量生成视频 - 快速模式</p>
      </header>

      {/* 工具栏 */}
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSelectAll}
            className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
          >
            {selectedScripts.length === libraryScripts.length ? '取消全选' : '全选'}
          </button>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">AI 模型：</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as AIModel)}
              className="px-3 py-1.5 bg-black/50 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-slate-700"
            >
              <option value="gemini">Gemini</option>
              <option value="doubao">豆包</option>
              <option value="qwen">通义千问</option>
              <option value="chatgpt">ChatGPT</option>
            </select>
          </div>
        </div>
        <div className="text-sm text-slate-400">
          已选择 {selectedScripts.length} / {libraryScripts.length} 个脚本
        </div>
      </div>

      {/* 脚本列表 */}
      <div className="flex-1 overflow-y-auto p-6">
        {libraryScripts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Zap className="w-16 h-16 text-slate-700 mb-4" />
            <p className="text-slate-500 mb-2">待产库为空</p>
            <p className="text-sm text-slate-600">请先生成脚本并添加到待产库</p>
          </div>
        ) : (
          <div className="space-y-3">
            {libraryScripts.map((script, index) => (
              <div
                key={script.id}
                onClick={() => toggleScriptSelection(script.id)}
                className={`
                  flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all
                  ${
                    selectedScripts.includes(script.id)
                      ? 'bg-amber-600/10 border-amber-600'
                      : 'bg-black/50 border-slate-800 hover:border-slate-700'
                  }
                `}
              >
                {/* 选择框 */}
                <div
                  className={`
                    w-6 h-6 rounded flex items-center justify-center flex-shrink-0
                    ${
                      selectedScripts.includes(script.id)
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-800 text-slate-600'
                    }
                  `}
                >
                  {selectedScripts.includes(script.id) && <Check className="w-4 h-4" />}
                </div>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-300 line-clamp-2">{script.content}</div>
                  <div className="text-xs text-slate-500 mt-2">
                    #{index + 1} · {new Date(script.createdAt).toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部工具栏 */}
      <div className="px-6 py-4 border-t border-slate-800">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || selectedScripts.length === 0}
          className={`
            flex items-center justify-center gap-2 w-full py-3 rounded-lg transition-all
            ${
              isGenerating || selectedScripts.length === 0
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:opacity-90'
            }
          `}
        >
          <Play className="w-5 h-5" />
          <span>
            {isGenerating
              ? '生成中...'
              : `开始生成 (${selectedScripts.length} 个视频)`}
          </span>
        </button>
      </div>
    </div>
  );
}
