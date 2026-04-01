import React, { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { BUILTIN_PROMPT_TEMPLATES } from '@shared/constants/promptTemplates';
import AgentModelSelector from '@renderer/components/AgentModelSelector';
import BuiltinTemplateCard from './BuiltinTemplateCard';
import CustomTemplateCard from './CustomTemplateCard';
import type { AgentConfig, AgentModelConfig, ModelType, PromptTemplate } from './types';
import {
  getAgentTemplates,
  upsertTemplate,
  deleteTemplate,
  setActiveTemplate,
  clearActiveTemplate,
  getAgentModelConfig,
  saveAgentModelType,
} from './storage';

const TemplatesView: React.FC<{ agent: AgentConfig }> = ({ agent }) => {
  const [templates, setTemplates] = useState<PromptTemplate[]>(() => getAgentTemplates(agent.id));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingContent, setEditingContent] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');
  const [modelConfig, setModelConfig] = useState<AgentModelConfig>(() =>
    getAgentModelConfig(agent.id)
  );

  const refresh = () => setTemplates(getAgentTemplates(agent.id));

  const handleModelChange = (type: ModelType, modelId: string) => {
    setModelConfig((prev) => ({ ...prev, [type]: modelId }));
    saveAgentModelType(agent.id, type, modelId);
  };

  const handleCreate = () => {
    if (!newName.trim() || !newContent.trim()) return;
    const t: PromptTemplate = {
      id: `${agent.id}-${Date.now()}`,
      agentId: agent.id,
      name: newName.trim(),
      content: newContent.trim(),
      isActive: templates.length === 0,
      createdAt: new Date().toISOString(),
    };
    upsertTemplate(t);
    setIsCreating(false);
    setNewName('');
    setNewContent('');
    refresh();
  };

  const handleSaveEdit = (id: string) => {
    const t = templates.find((t) => t.id === id);
    if (!t || !editingName.trim() || !editingContent.trim()) return;
    upsertTemplate({ ...t, name: editingName.trim(), content: editingContent.trim() });
    setEditingId(null);
    refresh();
  };

  const Icon = agent.icon;
  const builtinTemplate = BUILTIN_PROMPT_TEMPLATES.find((t) => t.agentId === agent.id);
  const hasActiveCustom = templates.some((t) => t.isActive);
  // 检查是否使用内置提示词（不可编辑）
  const isBuiltinPrompts = (builtinTemplate as { builtinPrompts?: boolean } | undefined)?.builtinPrompts === true;

  return (
    <div className="w-full max-w-2xl space-y-4">
      {/* Agent 信息头部 */}
      <div className="flex items-center gap-3 pb-2 border-b border-slate-800">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${agent.bgColor} ${agent.iconColor}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{agent.name}</div>
          <div className="text-xs text-slate-500">{agent.role}</div>
        </div>
      </div>

      {/* 模型选择 */}
      <AgentModelSelector
        agentId={agent.id}
        modelTypes={agent.modelTypes}
        value={modelConfig}
        onChange={handleModelChange}
      />

      {/* 内置模板 - 仅对非 builtinPrompts 的 Agent 显示 */}
      {!isBuiltinPrompts && (
        <>
          {builtinTemplate ? (
            <BuiltinTemplateCard
              template={builtinTemplate}
              isActive={!hasActiveCustom}
              onSetActive={() => { clearActiveTemplate(agent.id); refresh(); }}
            />
          ) : (
            <div className="flex items-start gap-3 p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-slate-500 mt-1.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-300 mb-0.5">内置提示词（只读）</div>
                <div className="text-xs text-slate-500 leading-relaxed">
                  系统内置的默认提示词，不可编辑。若无自定义模板处于生效状态，Agent 将使用此提示词。
                </div>
              </div>
              {!hasActiveCustom && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 rounded-full text-xs text-emerald-400 flex-shrink-0">
                  <Check className="w-3 h-3" />
                  生效中
                </span>
              )}
            </div>
          )}
        </>
      )}

      {/* 内置提示词提示 - 仅对 builtinPrompts 的 Agent 显示 */}
      {isBuiltinPrompts && (
        <div className="flex items-start gap-3 p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
          <div className="w-2 h-2 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-slate-300 mb-0.5">内置提示词</div>
            <div className="text-xs text-slate-500 leading-relaxed">
              此 Agent 使用内置提示词，不可编辑。提示词已针对专业场景优化，确保最佳输出质量。
            </div>
          </div>
        </div>
      )}

      {/* 自定义模板列表 - 仅对非 builtinPrompts 的 Agent 显示 */}
      {!isBuiltinPrompts && templates.map((t) =>
        editingId === t.id ? (
          <div key={t.id} className="bg-slate-900 border border-violet-500/30 rounded-xl p-4 space-y-3">
            <input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              placeholder="模板名称"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
            <textarea
              value={editingContent}
              onChange={(e) => setEditingContent(e.target.value)}
              placeholder="提示词内容（可编辑层，替换内置的 Agent 人设和创意指南）"
              rows={8}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 font-mono resize-y"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditingId(null)}
                className="px-3 py-1.5 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg hover:border-slate-500 transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={() => handleSaveEdit(t.id)}
                className="px-3 py-1.5 text-sm bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors cursor-pointer"
              >
                保存
              </button>
            </div>
          </div>
        ) : (
          <CustomTemplateCard
            key={t.id}
            template={t}
            builtinLockedPart={builtinTemplate?.lockedPart}
            builtinUserPromptTemplate={builtinTemplate?.userPromptTemplate}
            onSetActive={(id) => { setActiveTemplate(agent.id, id); refresh(); }}
            onEdit={(id) => {
              const tpl = templates.find((x) => x.id === id);
              if (tpl) { setEditingId(id); setEditingName(tpl.name); setEditingContent(tpl.content); }
            }}
            onDelete={(id) => { deleteTemplate(agent.id, id); refresh(); }}
          />
        )
      )}

      {/* 新建模板 - 仅对非 builtinPrompts 的 Agent 显示 */}
      {!isBuiltinPrompts && (
        <>
          {isCreating ? (
            <div className="bg-slate-900 border border-violet-500/30 rounded-xl p-4 space-y-3">
              <div className="text-sm font-medium text-white">新建模板</div>
              <p className="text-xs text-slate-500">
                自定义模板只需填写「可编辑层」内容（Agent 人设、创意指南、示例），锁定层由系统自动追加。
              </p>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="模板名称，如：游戏广告增强版"
                autoFocus
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="在此粘贴或输入可编辑层提示词内容..."
                rows={8}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 font-mono resize-y"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setIsCreating(false); setNewName(''); setNewContent(''); }}
                  className="px-3 py-1.5 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg hover:border-slate-500 transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || !newContent.trim()}
                  className="px-3 py-1.5 text-sm bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors cursor-pointer"
                >
                  创建
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-slate-700 rounded-xl text-slate-500 hover:text-white hover:border-slate-500 transition-colors text-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              新建模板
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default TemplatesView;
