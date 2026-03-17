/**
 * 导演模式主页面
 * 左右分栏：左侧 Agent 群聊 + 右侧可视化画板
 */

import { useState } from 'react';
import { ChatPanel } from './ChatPanel';
import { CanvasPanel } from './CanvasPanel';

interface Character {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
}

interface Scene {
  id: string;
  index: number;
  description: string;
  imageUrl?: string;
}

interface Storyboard {
  id: string;
  rows: number;
  cols: number;
  scenes: Scene[];
  imageUrl?: string;
}

interface DirectorModeProps {
  /** 剧本 ID */
  screenplayId: string;
  /** 完成回调 */
  onComplete?: () => void;
}

export function DirectorMode({ screenplayId, onComplete }: DirectorModeProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);

  // 处理编辑角色
  const handleEditCharacter = (characterId: string) => {
    console.log('[DirectorMode] 编辑角色:', characterId);
    // TODO: 打开角色编辑对话框
  };

  // 处理重新生成角色
  const handleRegenerateCharacter = (characterId: string) => {
    console.log('[DirectorMode] 重新生成角色:', characterId);
    // TODO: 调用后端重新生成角色
  };

  // 处理添加角色
  const handleAddCharacter = () => {
    console.log('[DirectorMode] 添加角色');
    // TODO: 打开添加角色对话框
  };

  // 处理重新生成分镜图
  const handleRegenerateStoryboard = () => {
    console.log('[DirectorMode] 重新生成分镜图');
    // TODO: 调用后端重新生成分镜图
  };

  // 处理工作流完成
  const handleComplete = () => {
    console.log('[DirectorMode] 工作流完成');
    onComplete?.();
  };

  return (
    <div className="h-full flex">
      {/* 左侧：Agent 群聊 */}
      <div className="w-2/5 border-r border-slate-700">
        <ChatPanel screenplayId={screenplayId} onComplete={handleComplete} />
      </div>

      {/* 右侧：可视化画板 */}
      <div className="w-3/5">
        <CanvasPanel
          characters={characters}
          storyboard={storyboard || undefined}
          onEditCharacter={handleEditCharacter}
          onRegenerateCharacter={handleRegenerateCharacter}
          onAddCharacter={handleAddCharacter}
          onRegenerateStoryboard={handleRegenerateStoryboard}
        />
      </div>
    </div>
  );
}
