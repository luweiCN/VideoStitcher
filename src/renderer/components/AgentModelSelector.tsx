import React, { useState, useEffect } from 'react';
import * as Select from '@radix-ui/react-select';
import { Cpu, ChevronDown, ChevronUp, Check } from 'lucide-react';

// ─── 类型定义 ──────────────────────────────────────────────

type ModelType = 'text' | 'image' | 'video';

interface AIModel {
  id: string;
  name: string;
  provider: string;
  enabled: boolean;
  description?: string;
}

type AgentModelConfig = Partial<Record<ModelType, string>>;

const MODEL_TYPE_LABEL: Record<ModelType, string> = {
  text: '文本模型',
  image: '图片模型',
  video: '视频模型',
};

// ─── 单个模型类型选择器 ────────────────────────────────────

const ModelTypeSelect: React.FC<{
  type: ModelType;
  models: AIModel[];
  selectedId: string;
  onChange: (modelId: string) => void;
}> = ({ type, models, selectedId, onChange }) => {
  const selectedName = models.find((m) => m.id === selectedId)?.name ?? '默认模型（系统配置）';

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400 w-16 flex-shrink-0">{MODEL_TYPE_LABEL[type]}</span>

      <Select.Root value={selectedId} onValueChange={onChange}>
        <Select.Trigger className="flex items-center justify-between gap-2 flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white hover:border-slate-500 focus:outline-none focus:border-violet-500 data-[placeholder]:text-slate-400 cursor-pointer transition-colors">
          <Select.Value placeholder="选择模型">{selectedName}</Select.Value>
          <Select.Icon>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            className="z-50 min-w-[280px] bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden"
            position="popper"
            sideOffset={4}
          >
            <Select.ScrollUpButton className="flex items-center justify-center py-1 text-slate-400">
              <ChevronUp />
            </Select.ScrollUpButton>

            <Select.Viewport className="p-1">
              <Select.Item
                value="default"
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 rounded-lg cursor-pointer focus:outline-none data-[highlighted]:bg-slate-700 data-[highlighted]:text-white"
              >
                <Select.ItemIndicator>
                  <Check className="w-4 h-4 text-violet-400" />
                </Select.ItemIndicator>
                <Select.ItemText>默认模型（系统配置）</Select.ItemText>
              </Select.Item>

              {models.length > 0 && (
                <>
                  <div className="mx-2 my-1 border-t border-slate-700" />
                  {models.map((model) => (
                    <Select.Item
                      key={model.id}
                      value={model.id}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 rounded-lg cursor-pointer focus:outline-none data-[highlighted]:bg-slate-700 data-[highlighted]:text-white"
                    >
                      <Select.ItemIndicator>
                        <Check className="w-4 h-4 text-violet-400" />
                      </Select.ItemIndicator>
                      <div className="flex-1 min-w-0">
                        <Select.ItemText>{model.name}</Select.ItemText>
                        <div className="text-xs text-slate-500">{model.provider}</div>
                      </div>
                    </Select.Item>
                  ))}
                </>
              )}

              {models.length === 0 && (
                <div className="px-3 py-2 text-xs text-slate-500">暂无可用模型</div>
              )}
            </Select.Viewport>

            <Select.ScrollDownButton className="flex items-center justify-center py-1 text-slate-400">
              <ChevronDown />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
};

// ─── 主组件 ───────────────────────────────────────────────

interface AgentModelSelectorProps {
  agentId: string;
  modelTypes: ModelType[];
  value: AgentModelConfig;
  onChange: (type: ModelType, modelId: string) => void;
}

/**
 * Agent 模型选择器
 *
 * 根据 modelTypes 声明，为每种类型渲染一个独立下拉选择器，
 * 从注册表（window.api.getAIModels）加载真实模型列表。
 * 可在任意需要选择模型的页面复用。
 */
const AgentModelSelector: React.FC<AgentModelSelectorProps> = ({
  agentId,
  modelTypes,
  value,
  onChange,
}) => {
  const [modelsByType, setModelsByType] = useState<Partial<Record<ModelType, AIModel[]>>>({});

  useEffect(() => {
    modelTypes.forEach(async (type) => {
      const result = await window.api.getAIModels(type);
      if (result.success && result.models) {
        setModelsByType((prev) => ({ ...prev, [type]: result.models }));
      }
    });
  }, [agentId]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Cpu className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-200">使用模型</span>
        <span className="text-xs text-slate-500 ml-1">为此 Agent 指定独立的模型，覆盖系统全局配置</span>
      </div>

      {modelTypes.map((type) => (
        <ModelTypeSelect
          key={type}
          type={type}
          models={modelsByType[type] ?? []}
          selectedId={value[type] ?? 'default'}
          onChange={(modelId) => onChange(type, modelId)}
        />
      ))}
    </div>
  );
};

export default AgentModelSelector;
