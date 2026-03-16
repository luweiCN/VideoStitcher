/**
 * 导演画布 - 分镜预览和编辑
 */

import React from 'react';
import { Users, Film, Play } from 'lucide-react';
import { CharacterGrid } from './CharacterGrid';
import { StoryboardGrid } from './StoryboardGrid';
import { VideoPreview } from './VideoPreview';
import type { Character, Scene, SelectedItem } from '../types';

interface CanvasProps {
  characters: Character[];
  storyboard: Scene[];
  currentStep: 'character' | 'storyboard' | 'preview';
  onCharacterUpdate: (id: string, updates: Partial<Character>) => void;
  onSceneUpdate: (id: string, updates: Partial<Scene>) => void;
  onCharacterSelect: (id: string) => void;
  onSceneSelect: (id: string) => void;
  selectedItem: SelectedItem | null;
}

export const Canvas: React.FC<CanvasProps> = ({
  characters,
  storyboard,
  currentStep,
  onCharacterUpdate,
  onSceneUpdate,
  onCharacterSelect,
  onSceneSelect,
  selectedItem,
}) => {
  return (
    <div className="flex-1 overflow-auto bg-gradient-to-br from-slate-950 via-slate-900 to-black p-8">
      {/* 空状态提示 */}
      {currentStep === 'character' && characters.length === 0 && (
        <div className="h-full flex flex-col items-center justify-center">
          <div className="w-24 h-24 bg-gradient-to-br from-violet-600/20 to-blue-600/20 rounded-2xl flex items-center justify-center mb-6">
            <Users className="w-12 h-12 text-violet-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">开始创建角色</h3>
          <p className="text-slate-400 text-center max-w-md">
            在左侧对话框输入剧本描述，或点击"生成角色"按钮，AI 将自动创建角色
          </p>
        </div>
      )}

      {currentStep === 'storyboard' && storyboard.length === 0 && (
        <div className="h-full flex flex-col items-center justify-center">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 rounded-2xl flex items-center justify-center mb-6">
            <Film className="w-12 h-12 text-blue-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">开始创建分镜</h3>
          <p className="text-slate-400 text-center max-w-md">
            点击"生成分镜"按钮，AI 将根据角色和剧本自动生成分镜场景
          </p>
        </div>
      )}

      {currentStep === 'preview' && storyboard.length === 0 && (
        <div className="h-full flex flex-col items-center justify-center">
          <div className="w-24 h-24 bg-gradient-to-br from-emerald-600/20 to-teal-600/20 rounded-2xl flex items-center justify-center mb-6">
            <Play className="w-12 h-12 text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">预览视频</h3>
          <p className="text-slate-400 text-center max-w-md">
            先完成角色和分镜创建，然后可以预览和导出视频
          </p>
        </div>
      )}

      {/* 内容区域 */}
      {currentStep === 'character' && characters.length > 0 && (
        <CharacterGrid
          characters={characters}
          onUpdate={onCharacterUpdate}
          onSelect={onCharacterSelect}
          selectedId={selectedItem?.type === 'character' ? selectedItem.id : null}
        />
      )}

      {currentStep === 'storyboard' && storyboard.length > 0 && (
        <StoryboardGrid
          scenes={storyboard}
          onUpdate={onSceneUpdate}
          onSelect={onSceneSelect}
          selectedId={selectedItem?.type === 'scene' ? selectedItem.id : null}
        />
      )}

      {currentStep === 'preview' && storyboard.length > 0 && (
        <VideoPreview storyboard={storyboard} />
      )}
    </div>
  );
};
