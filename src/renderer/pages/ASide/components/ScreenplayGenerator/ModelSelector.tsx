/**
 * AI 模型选择器组件
 */

import type { AIModel } from '@shared/types/aside';

interface ModelSelectorProps {
  /** 当前选中的模型 */
  selectedModel: AIModel;
  /** 模型变更回调 */
  onModelChange: (model: AIModel) => void;
}

/**
 * AI 模型选项
 */
const MODEL_OPTIONS: { value: AIModel; label: string; description: string }[] = [
  { value: 'gemini', label: 'Gemini', description: 'Google AI' },
  { value: 'doubao', label: '豆包', description: '字节跳动' },
  { value: 'qwen', label: '通义千问', description: '阿里云' },
  { value: 'chatgpt', label: 'ChatGPT', description: 'OpenAI' },
];

/**
 * AI 模型选择器组件
 */
export function ModelSelector({ selectedModel, onModelChange }: ModelSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-slate-400">AI 模型：</label>
      <select
        value={selectedModel}
        onChange={(e) => onModelChange(e.target.value as AIModel)}
        className="px-3 py-1.5 bg-black/50 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-slate-700"
      >
        {MODEL_OPTIONS.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
