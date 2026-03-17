/**
 * 画布面板组件 - 导演模式可视化画板
 * 支持人物卡片、分镜图展示
 */

import { Eye, Edit3, RefreshCw, User, Film } from 'lucide-react';
import { useState } from 'react';

// 角色数据
interface Character {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
}

// 分镜场景
interface Scene {
  id: string;
  index: number;
  description: string;
  imageUrl?: string;
}

// 分镜图数据
interface Storyboard {
  id: string;
  rows: number;
  cols: number;
  scenes: Scene[];
  imageUrl?: string; // 完整分镜图
}

interface CanvasPanelProps {
  /** 角色 */
  characters?: Character[];
  /** 分镜图 */
  storyboard?: Storyboard;
  /** 编辑角色回调 */
  onEditCharacter?: (characterId: string) => void;
  /** 重新生成角色回调 */
  onRegenerateCharacter?: (characterId: string) => void;
  /** 重新生成分镜图回调 */
  onRegenerateStoryboard?: () => void;
}

export function CanvasPanel({
  characters = [],
  storyboard,
  onEditCharacter,
  onRegenerateCharacter,
  onRegenerateStoryboard,
}: CanvasPanelProps) {
  const [activeTab, setActiveTab] = useState<'characters' | 'storyboard'>('characters');

  // 是否有内容
  const hasContent = characters.length > 0 || storyboard;

  return (
    <div className="h-full flex flex-col bg-black text-slate-100">
      {/* 头部 + 标签切换 */}
      <div className="px-4 py-3 border-b border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Eye className="w-4 h-4" />
            <span>可视化画板</span>
          </h3>
        </div>

        {/* 标签切换 */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('characters')}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activeTab === 'characters'
                ? 'bg-violet-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <User className="w-3 h-3 inline-block mr-1" />
            人物卡片
          </button>
          <button
            onClick={() => setActiveTab('storyboard')}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activeTab === 'storyboard'
                ? 'bg-violet-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Film className="w-3 h-3 inline-block mr-1" />
            分镜图
          </button>
        </div>
      </div>

      {/* 画布区域 */}
      <div className="flex-1 overflow-y-auto p-4">
        {!hasContent ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-lg flex items-center justify-center mb-4">
              <Eye className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-slate-500">等待 Agent 完成</p>
            <p className="text-xs text-slate-600 mt-1">成果将在此显示</p>
          </div>
        ) : activeTab === 'characters' ? (
          // 人物卡片
          <div className="grid grid-cols-2 gap-4">
            {characters.map((character) => (
              <div
                key={character.id}
                className="bg-slate-800/50 border border-slate-700 rounded-lg p-4"
              >
                {/* 角色头像 */}
                <div className="w-full aspect-square bg-slate-900 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                  {character.imageUrl ? (
                    <img
                      src={character.imageUrl}
                      alt={character.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-12 h-12 text-slate-700" />
                  )}
                </div>

                {/* 角色信息 */}
                <h4 className="font-semibold mb-1">{character.name}</h4>
                <p className="text-xs text-slate-400 line-clamp-2 mb-3">{character.description}</p>

                {/* 操作按钮 */}
                <div className="flex gap-2">
                  <button
                    onClick={() => onEditCharacter?.(character.id)}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                    编辑
                  </button>
                  <button
                    onClick={() => onRegenerateCharacter?.(character.id)}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    重新生成
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // 分镜图
          storyboard && (
            <div>
              {/* 分镜网格 */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">
                    分镜图 ({storyboard.rows}×{storyboard.cols})
                  </h4>
                  <button
                    onClick={onRegenerateStoryboard}
                    className="flex items-center gap-1 px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    重新生成
                  </button>
                </div>

                {/* 完整分镜图 */}
                {storyboard.imageUrl && (
                  <div className="w-full mb-4 rounded-lg overflow-hidden">
                    <img
                      src={storyboard.imageUrl}
                      alt="分镜图"
                      className="w-full h-auto"
                    />
                  </div>
                )}

                {/* 分镜场景网格 */}
                <div
                  className="grid gap-2"
                  style={{
                    gridTemplateColumns: `repeat(${storyboard.cols}, 1fr)`,
                  }}
                >
                  {storyboard.scenes.map((scene) => (
                    <div
                      key={scene.id}
                      className="aspect-video bg-slate-900 rounded flex items-center justify-center overflow-hidden"
                    >
                      {scene.imageUrl ? (
                        <img
                          src={scene.imageUrl}
                          alt={`场景 ${scene.index}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center p-2">
                          <p className="text-xs text-slate-600">{scene.index}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
