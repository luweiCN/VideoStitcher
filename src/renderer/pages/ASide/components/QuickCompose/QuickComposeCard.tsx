/**
 * QuickComposeCard 子组件
 * 显示单个剧本卡片,支持模型选择、生成视频、预览、保存和删除功能
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2, Video, Play, RefreshCw } from 'lucide-react';
import type { Screenplay, AIModel } from '@shared/types/aside';
import { getScreenplayName } from './utils';

/**
 * QuickComposeCard Props
 */
interface QuickComposeCardProps {
  /** 剧本数据 */
  screenplay: Screenplay;

  /** 序号(用于显示) */
  index: number;

  /** 生成进度 (0-100) */
  progress?: number;

  /** 模型变更回调 */
  onModelChange: (screenplayId: string, model: AIModel) => void;

  /** 生成视频回调 */
  onGenerate: (screenplayId: string) => void;

  /** 取消生成回调 */
  onCancelGenerate?: (screenplayId: string) => void;

  /** 删除回调 */
  onDelete: (screenplayId: string) => void;

  /** 预览回调 */
  onPreview: (screenplayId: string) => void;

  /** 保存回调 */
  onSave?: (screenplayId: string) => void;
}

/**
 * AI 模型选项
 */
const MODEL_OPTIONS: { value: AIModel; label: string }[] = [
  { value: 'gemini', label: 'Gemini' },
  { value: 'doubao', label: '豆包' },
  { value: 'qwen', label: '通义千问' },
  { value: 'chatgpt', label: 'ChatGPT' },
];

/**
 * 剧本卡片组件
 */
export function QuickComposeCard({
  screenplay,
  index,
  progress,
  onModelChange,
  onGenerate,
  onCancelGenerate,
  onDelete,
  onPreview,
  onSave,
}: QuickComposeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isProducing = screenplay.status === 'producing';
  const isCompleted = screenplay.status === 'completed';

  /**
   * 切换内容展开/折叠状态
   */
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  /**
   * 处理模型选择
   */
  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value as AIModel;
    onModelChange(screenplay.id, newModel);
  };

  /**
   * 处理生成视频
   */
  const handleGenerate = () => {
    onGenerate(screenplay.id);
  };

  /**
   * 处理取消生成
   */
  const handleCancelGenerate = () => {
    if (onCancelGenerate) {
      onCancelGenerate(screenplay.id);
    }
  };

  /**
   * 处理删除
   */
  const handleDelete = () => {
    onDelete(screenplay.id);
  };
  /**
   * 处理预览
   */
  const handlePreview = () => {
    onPreview(screenplay.id);
  };

  /**
   * 处理保存
   */
  const handleSave = () => {
    if (onSave) {
      onSave(screenplay.id);
    }
  };

  return (
    <div data-testid="screenplay-card" className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-all">
      {/* 头部:剧本名称 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-100">
            {getScreenplayName(screenplay.content)}
          </span>
        </div>
        {/* 模型选择器 */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">模型:</label>
          <select
            value={screenplay.aiModel || 'gemini'}
            onChange={handleModelChange}
            aria-label="选择模型"
            className="px-2 py-1 text-xs bg-black/50 border border-slate-800 rounded focus:outline-none focus:border-slate-700 text-slate-100"
          >
            {MODEL_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {/* 内容预览(可折叠) */}
      <div className="mb-3">
        <button
          onClick={toggleExpand}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300 transition-colors"
          aria-label={isExpanded ? '折叠预览' : '展开预览'}
        >
          <span>{isExpanded ? '折叠预览' : '展开预览'}</span>
          {isExpanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>
        {isExpanded && (
          <div className="mt-2 p-3 bg-black/30 border border-slate-800 rounded text-sm text-slate-300 max-h-32 overflow-y-auto">
            {screenplay.content}
          </div>
        )}
      </div>
      {/* 操作按钮区 */}
      <div className="flex items-center gap-2">
        {/* 生成中状态 */}
        {isProducing && (
          <>
            <div className="flex-1">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-slate-400">生成中...</span>
                <span className="text-xs text-slate-400">{progress || 0}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pink-600 to-violet-600 transition-all"
                  style={{ width: `${progress}%` }}
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="生成进度"
                />
              </div>
              <button
                onClick={handleCancelGenerate}
                className="mt-2 px-3 py-1 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700 transition-colors"
                aria-label="取消生成"
              >
                取消
              </button>
            </div>
          </>
        )}
        {/* 已完成状态 */}
        {isCompleted && (
          <>
            <button
              onClick={handlePreview}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-gradient-to-r from-pink-600 to-violet-600 text-white rounded hover:opacity-90 transition-opacity"
              aria-label="预览视频"
            >
              <Play className="w-3 h-3" />
              <span>预览</span>
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700 transition-colors"
              aria-label="保存视频"
            >
              <Video className="w-3 h-3" />
              <span>保存</span>
            </button>
            <button
              onClick={handleGenerate}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700 transition-colors"
              aria-label="重新生成视频"
            >
              <RefreshCw className="w-3 h-3" />
              <span>重新生成</span>
            </button>
          </>
        )}
        {/* 草稿/已入库状态 */}
        {!isProducing && !isCompleted && (
          <>
            <button
              onClick={handleGenerate}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-gradient-to-r from-pink-600 to-violet-600 text-white rounded hover:opacity-90 transition-opacity"
              aria-label="生成视频"
            >
              <Video className="w-3 h-3" />
              <span>生成视频</span>
            </button>
          </>
        )}
        {/* 删除按钮 */}
        <button
          onClick={handleDelete}
          className="flex items-center gap-1 px-3 py-1 text-xs bg-slate-800 text-red-400 rounded hover:bg-red-900/20 transition-colors"
          aria-label="删除剧本"
        >
          <Trash2 className="w-3 h-3" />
          <span>删除</span>
        </button>
      </div>
    </div>
  );
}
