/**
 * 导演模式主页面
 * 左右分栏：左侧 Agent 群聊 + 右侧可视化画板
 */

import { useState } from 'react';
import { ChatPanel } from './ChatPanel';
import { CanvasPanel } from './CanvasPanel';

interface DirectorModeProps {
  /** 剧本 ID */
  screenplayId: string;
  /** 完成回调 */
  onComplete?: () => void;
}

export function DirectorMode({ screenplayId, onComplete }: DirectorModeProps) {
  const [characters, setCharacters] = useState<
    Array<{
      id: string;
      name: string;
      description: string;
      imageUrl?: string;
    }>
  >([]);

  const [storyboard, setStoryboard] = useState<{
    id: string;
    rows: number;
    cols: number;
    scenes: Array<{
      id: string;
      index: number;
      description: string;
      imageUrl?: string;
    }>;
    imageUrl?: string;
  } | null>(null);

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

  // 处理重新生成分镜图
  const handleRegenerateStoryboard = () => {
    console.log('[DirectorMode] 重新生成分镜图');
    // TODO: 调用后端重新生成分镜图
  };

  return (
    <div className="h-full flex">
      {/* 左侧：Agent 群聊 */}
      <div className="w-2/5 border-r border-slate-800">
        <ChatPanel screenplayId={screenplayId} onComplete={onComplete} />
      </div>

      {/* 右侧：可视化画板 */}
      <div className="w-3/5">
        <CanvasPanel
          characters={characters}
          storyboard={storyboard || undefined}
          onEditCharacter={handleEditCharacter}
          onRegenerateCharacter={handleRegenerateCharacter}
          onRegenerateStoryboard={handleRegenerateStoryboard}
        />
      </div>
    </div>
  );
}
