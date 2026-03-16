/**
 * 参数配置面板组件
 */

import React from 'react';
import { Settings, Globe, Package, Hash } from 'lucide-react';

interface ConfigPanelProps {
  config: {
    region: string;
    productName: string;
    batchSize: number;
  };
  onUpdate: (config: Partial<ConfigPanelProps['config']>) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  canGenerate: boolean;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  config,
  onUpdate,
  onGenerate,
  isGenerating,
  canGenerate,
}) => {
  return (
    <div className="bg-black/50 border border-slate-800 rounded-xl p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-pink-600 rounded-lg flex items-center justify-center">
          <Settings className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">参数配置</h2>
          <p className="text-xs text-slate-400">设置视频生成参数</p>
        </div>
      </div>

      {/* 地区 */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
          <Globe className="w-4 h-4 text-slate-400" />
          目标地区
        </label>
        <input
          type="text"
          value={config.region}
          onChange={(e) => onUpdate({ region: e.target.value })}
          placeholder="例如：北美、欧洲、东南亚..."
          className="w-full bg-black/50 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
        />
      </div>

      {/* 产品名称 */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
          <Package className="w-4 h-4 text-slate-400" />
          产品名称
        </label>
        <input
          type="text"
          value={config.productName}
          onChange={(e) => onUpdate({ productName: e.target.value })}
          placeholder="例如：XX游戏、XX应用..."
          className="w-full bg-black/50 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
        />
      </div>

      {/* 生成数量 */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
          <Hash className="w-4 h-4 text-slate-400" />
          生成数量
        </label>
        <div className="flex gap-2">
          {[3, 5, 10].map((count) => (
            <button
              key={count}
              onClick={() => onUpdate({ batchSize: count })}
              className={`
                flex-1 py-2 rounded-lg font-medium transition-all
                ${
                  config.batchSize === count
                    ? 'bg-gradient-to-r from-pink-600 to-violet-600 text-white shadow-lg shadow-pink-500/20'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                }
              `}
            >
              {count} 条
            </button>
          ))}
        </div>
      </div>

      {/* 生成按钮 */}
      <button
        onClick={onGenerate}
        disabled={!canGenerate || isGenerating}
        className={`
          w-full py-3 rounded-lg font-bold text-white transition-all duration-300
          ${
            canGenerate && !isGenerating
              ? 'bg-gradient-to-r from-pink-600 to-violet-600 hover:shadow-lg hover:shadow-pink-500/30 hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-slate-800 text-slate-600 cursor-not-allowed'
          }
        `}
      >
        {isGenerating ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            生成中...
          </span>
        ) : (
          '开始生成脚本'
        )}
      </button>
    </div>
  );
};

export default ConfigPanel;
