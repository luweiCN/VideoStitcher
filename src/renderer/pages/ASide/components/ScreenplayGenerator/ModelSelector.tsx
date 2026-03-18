/**
 * AI 模型选择器组件
 * 使用 radix-ui Select 组件
 * 从后端获取实际配置的供应商和模型
 */

import { useState, useEffect } from 'react';
import * as Select from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';
import type { AIModel } from '@shared/types/aside';

/** 本地存储键名 */
const STORAGE_KEY = 'aside-last-selected-model';

interface ModelSelectorProps {
  /** 当前选中的模型 */
  selectedModel: AIModel;
  /** 模型变更回调 */
  onModelChange: (model: AIModel) => void;
}

/**
 * AI 模型选项类型
 */
interface ModelOption {
  id: string;
  name: string;
  provider: string;
  enabled: boolean;
}

/**
 * AI 模型选择器组件
 */
export function ModelSelector({ selectedModel, onModelChange }: ModelSelectorProps) {
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 加载 AI 提供商列表
  useEffect(() => {
    loadAIProviders();
  }, []);

  // 当模型列表加载完成后，设置默认选中的模型
  useEffect(() => {
    if (!isLoading && modelOptions.length > 0) {
      // 如果当前没有选中模型，或者选中的模型不在列表中
      if (!selectedModel || !modelOptions.find(opt => opt.id === selectedModel)) {
        // 尝试从本地存储读取上次选择的模型
        const lastSelectedModel = localStorage.getItem(STORAGE_KEY);
        const lastModelExists = lastSelectedModel && modelOptions.find(opt => opt.id === lastSelectedModel);

        if (lastModelExists) {
          // 使用上次选择的模型
          onModelChange(lastSelectedModel as AIModel);
        } else {
          // 默认选择第一个模型
          onModelChange(modelOptions[0].id as AIModel);
        }
      }
    }
  }, [isLoading, modelOptions, selectedModel, onModelChange]);

  /**
   * 处理模型变更，并保存到本地存储
   */
  const handleModelChange = (value: string) => {
    const newModel = value as AIModel;
    // 保存到本地存储
    localStorage.setItem(STORAGE_KEY, newModel);
    // 调用父组件的回调
    onModelChange(newModel);
  };

  const loadAIProviders = async () => {
    try {
      setIsLoading(true);
      // 使用新的通用 API 获取文本模型
      const result = await window.api.getAIModels('text');
      if (result.success && result.models) {
        setModelOptions(result.models);
      }
    } catch (error) {
      console.error('[ModelSelector] 加载 AI 提供商失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedOption = modelOptions.find(opt => opt.id === selectedModel);

  return (
    <Select.Root value={selectedModel} onValueChange={handleModelChange}>
      <Select.Trigger className="inline-flex items-center justify-between gap-2 px-3 py-2 bg-black/50 border border-slate-800 rounded-lg text-slate-100 hover:border-slate-700 focus:outline-none focus:border-violet-500 w-[200px] h-9">
        <Select.Value>
          {isLoading ? (
            <span className="text-sm text-slate-500">加载中...</span>
          ) : (
            <span className="text-sm">{selectedOption?.name}</span>
          )}
        </Select.Value>
        <Select.Icon>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content className="overflow-hidden bg-slate-900 border border-slate-800 rounded-lg shadow-xl">
          <Select.Viewport className="p-1">
            {modelOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500 text-center">
                {isLoading ? '加载中...' : '暂无可用模型'}
              </div>
            ) : (
              modelOptions.map(option => (
                <Select.Item
                  key={option.id}
                  value={option.id}
                  className="flex items-center justify-between px-3 py-2 text-sm text-slate-300 rounded cursor-pointer hover:bg-slate-800 focus:outline-none focus:bg-violet-500/10 focus:text-violet-300"
                >
                  <div className="flex items-center gap-2">
                    <Select.ItemText>
                      <div>
                        <div>{option.name}</div>
                        <div className="text-xs text-slate-500">{option.provider}</div>
                      </div>
                    </Select.ItemText>
                  </div>
                  <Select.ItemIndicator>
                    <Check className="w-4 h-4 text-violet-500" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))
            )}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
