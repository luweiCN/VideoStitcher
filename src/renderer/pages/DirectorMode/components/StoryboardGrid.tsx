/**
 * 分镜网格 - 5x5 分镜展示
 */

import React from 'react';
import { Film, Clock, Image as ImageIcon } from 'lucide-react';
import type { Scene } from '../types';

interface StoryboardGridProps {
  scenes: Scene[];
  onUpdate: (id: string, updates: Partial<Scene>) => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
}

export const StoryboardGrid: React.FC<StoryboardGridProps> = ({
  scenes,
  onUpdate,
  onSelect,
  selectedId,
}) => {
  return (
    <div className="space-y-6">
      {/* 分镜网格 */}
      <div className="grid grid-cols-5 gap-3">
        {scenes.map((scene, index) => (
          <div
            key={scene.id}
            onClick={() => onSelect(scene.id)}
            className={`group relative aspect-video bg-slate-900 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
              selectedId === scene.id
                ? 'border-blue-500 shadow-lg shadow-blue-500/20'
                : 'border-slate-800 hover:border-blue-500/50'
            }`}
          >
            {/* 场景预览图 */}
            <div className="w-full h-full bg-gradient-to-br from-blue-600/10 to-cyan-600/10 flex items-center justify-center">
              {scene.imageUrl ? (
                <img
                  src={scene.imageUrl}
                  alt={`场景 ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="w-8 h-8 text-blue-400/30" />
              )}
            </div>

            {/* 场景编号 */}
            <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-md">
              <span className="text-xs font-bold text-white">{index + 1}</span>
            </div>

            {/* 悬停信息 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-0 left-0 right-0 p-2">
                <p className="text-xs text-slate-300 line-clamp-2 mb-1">
                  {scene.description}
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock className="w-3 h-3" />
                  <span>{scene.duration}s</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 分镜详情列表 */}
      <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
        <div className="flex items-center gap-2 mb-4">
          <Film className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-bold text-white">分镜详情</h3>
        </div>

        <div className="space-y-3">
          {scenes.map((scene, index) => (
            <div
              key={scene.id}
              onClick={() => onSelect(scene.id)}
              className={`flex items-start gap-4 p-3 rounded-lg border transition-all cursor-pointer ${
                selectedId === scene.id
                  ? 'bg-blue-500/10 border-blue-500'
                  : 'bg-slate-900/50 border-slate-800 hover:border-blue-500/50'
              }`}
            >
              {/* 场景编号 */}
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <span className="text-sm font-bold text-blue-400">{index + 1}</span>
              </div>

              {/* 场景信息 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white mb-1">{scene.description}</p>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{scene.duration} 秒</span>
                  </div>
                  {scene.transition && (
                    <span className="px-2 py-0.5 bg-slate-800 rounded">
                      {scene.transition}
                    </span>
                  )}
                  {scene.characters.length > 0 && (
                    <span>{scene.characters.length} 个角色</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
