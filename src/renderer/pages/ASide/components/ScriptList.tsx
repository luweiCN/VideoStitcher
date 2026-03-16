/**
 * 脚本列表组件
 */

import React, { useState } from 'react';
import {
  FileText,
  Clock,
  Plus,
  Edit3,
  Trash2,
  RefreshCw,
  Check,
  X,
} from 'lucide-react';
import type { ScriptContent } from '../../pages/ASide/types';

interface ScriptListProps {
  scripts: ScriptContent[];
  onAddToQueue: (scriptId: string) => void;
  onEdit: (scriptId: string, updates: Partial<ScriptContent>) => void;
  onRemove: (scriptId: string) => void;
  onRegenerate: (scriptId: string) => void;
}

export const ScriptList: React.FC<ScriptListProps> = ({
  scripts,
  onAddToQueue,
  onEdit,
  onRemove,
  onRegenerate,
}) => {
  if (scripts.length === 0) {
    return (
      <div className="bg-black/50 border border-slate-800 rounded-xl p-12 text-center">
        <FileText className="w-16 h-16 text-slate-700 mx-auto mb-4" />
        <p className="text-slate-400">暂无脚本，请先生成</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {scripts.map((script) => (
        <ScriptCard
          key={script.id}
          script={script}
          onAddToQueue={onAddToQueue}
          onEdit={onEdit}
          onRemove={onRemove}
          onRegenerate={onRegenerate}
        />
      ))}
    </div>
  );
};

interface ScriptCardProps {
  script: ScriptContent;
  onAddToQueue: (scriptId: string) => void;
  onEdit: (scriptId: string, updates: Partial<ScriptContent>) => void;
  onRemove: (scriptId: string) => void;
  onRegenerate: (scriptId: string) => void;
}

const ScriptCard: React.FC<ScriptCardProps> = ({
  script,
  onAddToQueue,
  onEdit,
  onRemove,
  onRegenerate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  const handleStartEdit = () => {
    // 拼接所有场景内容用于编辑
    const fullContent = script.scenes.map((s) => s.content).join('\n\n');
    setEditContent(fullContent);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    // 简单处理：将编辑后的内容按段落分割为场景
    const scenes = editContent.split('\n\n').map((content, index) => ({
      id: `scene-${Date.now()}-${index}`,
      sequence: index + 1,
      content: content.trim(),
      duration: 5, // 默认 5 秒
    }));

    onEdit(script.id, {
      scenes,
      totalDuration: scenes.length * 5,
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent('');
  };

  return (
    <div className="bg-black/50 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
      {/* 头部 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-bold text-white mb-1">{script.title}</h3>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {script.totalDuration} 秒
            </span>
            <span>{script.scenes.length} 个场景</span>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAddToQueue(script.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-pink-600 to-violet-600 text-white text-xs font-medium rounded-lg hover:shadow-lg hover:shadow-pink-500/20 transition-all"
          >
            <Plus className="w-3 h-3" />
            加入待产库
          </button>
          <button
            onClick={handleStartEdit}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="编辑"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onRegenerate(script.id)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="重新生成"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => onRemove(script.id)}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 内容 */}
      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-48 bg-black border border-slate-700 rounded-lg p-3 text-slate-300 text-sm resize-none focus:outline-none focus:border-violet-500"
            placeholder="编辑脚本内容..."
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancelEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-medium rounded-lg hover:bg-slate-700 transition-colors"
            >
              <X className="w-3 h-3" />
              取消
            </button>
            <button
              onClick={handleSaveEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-medium rounded-lg hover:shadow-lg hover:shadow-emerald-500/20 transition-all"
            >
              <Check className="w-3 h-3" />
              保存
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {script.scenes.map((scene) => (
            <div
              key={scene.id}
              className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg"
            >
              <span className="flex-shrink-0 w-6 h-6 bg-pink-500/10 text-pink-400 rounded flex items-center justify-center text-xs font-bold">
                {scene.sequence}
              </span>
              <p className="flex-1 text-sm text-slate-300 leading-relaxed">
                {scene.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScriptList;
