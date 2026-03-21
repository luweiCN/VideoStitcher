/**
 * 剧本选择弹窗组件
 * 支持单选（导演模式）和多选（快速合成）
 */

import { useState } from 'react';
import { X, Check, Film, Zap, Pencil } from 'lucide-react';
import type { Screenplay } from '@shared/types/aside';

interface ScreenplaySelectorProps {
  /** 待产库剧本列表 */
  screenplays: Screenplay[];
  /** 选择模式 */
  mode: 'single' | 'multiple';
  /** 确认回调 */
  onConfirm: (selected: Screenplay | Screenplay[]) => void;
  /** 取消回调 */
  onCancel: () => void;
  /** 编辑剧本回调（可选） */
  onEditScreenplay?: (screenplay: Screenplay) => void;
}

/**
 * 剧本选择弹窗
 */
export function ScreenplaySelector({ screenplays, mode, onConfirm, onCancel, onEditScreenplay }: ScreenplaySelectorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleToggle = (screenplayId: string) => {
    if (mode === 'single') {
      // 单选模式：直接选择
      setSelectedIds(new Set([screenplayId]));
    } else {
      // 多选模式：切换选中状态
      const newSet = new Set(selectedIds);
      if (newSet.has(screenplayId)) {
        newSet.delete(screenplayId);
      } else {
        newSet.add(screenplayId);
      }
      setSelectedIds(newSet);
    }
  };

  const handleConfirm = () => {
    const selectedScreenplays = screenplays.filter(s => selectedIds.has(s.id));

    if (selectedScreenplays.length === 0) {
      return;
    }

    if (mode === 'single') {
      onConfirm(selectedScreenplays[0]);
    } else {
      onConfirm(selectedScreenplays);
    }
  };

  const getTitle = () => {
    return mode === 'single' ? '选择剧本进入导演模式' : '选择剧本快速合成';
  };

  const getIcon = () => {
    return mode === 'single' ? <Film className="w-5 h-5" /> : <Zap className="w-5 h-5" />;
  };

  const getConfirmText = () => {
    if (mode === 'single') {
      return '进入导演模式';
    }
    return `合成 (${selectedIds.size})`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${mode === 'single' ? 'bg-violet-600/20 text-violet-400' : 'bg-amber-600/20 text-amber-400'}`}>
              {getIcon()}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">{getTitle()}</h2>
              <p className="text-sm text-slate-500">
                {mode === 'single' ? '选择一个剧本进入导演模式创作视频' : '选择多个剧本批量合成视频'}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 剧本列表 */}
        <div className="flex-1 overflow-y-auto p-6">
          {screenplays.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Film className="w-16 h-16 text-slate-700 mb-4" />
              <p className="text-slate-500 mb-2">待产库为空</p>
              <p className="text-sm text-slate-600">请先生成剧本并添加到待产库</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {screenplays.map((screenplay, index) => {
                const isSelected = selectedIds.has(screenplay.id);

                return (
                  <div
                    key={screenplay.id}
                    onClick={() => handleToggle(screenplay.id)}
                    className={`relative bg-black/50 border-2 rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.02] ${
                      isSelected
                        ? mode === 'single'
                          ? 'border-violet-600 bg-violet-600/10'
                          : 'border-amber-600 bg-amber-600/10'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* 选中指示器 */}
                    {isSelected && (
                      <div className={`absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center ${
                        mode === 'single' ? 'bg-violet-600' : 'bg-amber-600'
                      }`}>
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}

                    {/* 序号 + 编辑按钮 */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-semibold ${
                        isSelected
                          ? mode === 'single'
                            ? 'bg-violet-600/30 text-violet-300'
                            : 'bg-amber-600/30 text-amber-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-300 truncate">
                          剧本 #{index + 1}
                        </p>
                        <p className="text-xs text-slate-500">
                          {screenplay.aiModel?.toUpperCase()} · {new Date(screenplay.createdAt).toLocaleString('zh-CN')}
                        </p>
                      </div>
                      {onEditScreenplay && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onEditScreenplay(screenplay); }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-orange-400 hover:bg-slate-700 transition-colors flex-shrink-0"
                          title="编辑剧本"
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                    </div>

                    {/* 剧本内容 */}
                    <div className="bg-black/30 border border-slate-700/50 rounded-lg p-3 max-h-32 overflow-hidden">
                      <p className="text-xs text-slate-400" style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>{screenplay.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between p-6 border-t border-slate-800">
          <div className="text-sm text-slate-500">
            {mode === 'single'
              ? `已选择 ${selectedIds.size} 个剧本`
              : `已选择 ${selectedIds.size} 个剧本`
            }
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
              className={`px-6 py-2 rounded-lg transition-all font-medium ${
                selectedIds.size === 0
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  : mode === 'single'
                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 to-purple-500'
                    : 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-500 to-orange-500'
              }`}
            >
              {getConfirmText()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
