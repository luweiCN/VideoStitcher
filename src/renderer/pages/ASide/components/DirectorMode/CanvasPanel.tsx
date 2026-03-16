/**
 * 画布面板组件
 * 显示 Agent 工作成果的可视化展示
 */

import { Eye } from 'lucide-react';

interface CanvasPanelProps {
  /** Agent 输出内容 */
  output?: string;
}

/**
 * 画布面板组件
 */
export function CanvasPanel({ output }: CanvasPanelProps) {
  return (
    <div className="h-full flex flex-col bg-black text-slate-100">
      {/* 头部 */}
      <div className="px-4 py-3 border-b border-slate-800">
        <h3 className="font-semibold flex items-center gap-2">
          <Eye className="w-4 h-4" />
          <span>预览</span>
        </h3>
      </div>

      {/* 画布区域 */}
      <div className="flex-1 overflow-y-auto p-4">
        {!output ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-lg flex items-center justify-center mb-4">
              <Eye className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-slate-500">等待 Agent 完成</p>
            <p className="text-xs text-slate-600 mt-1">成果将在此显示</p>
          </div>
        ) : (
          <div className="bg-slate-800/50 rounded-lg p-4">
            <pre className="text-sm text-slate-300 whitespace-pre-wrap">{output}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
