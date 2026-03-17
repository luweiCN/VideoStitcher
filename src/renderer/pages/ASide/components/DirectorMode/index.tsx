/**
 * 导演模式主页面
 * 左右分栏：左侧 Agent 群聊 + 右侧可视化画板
 */

import { useState, useEffect } from 'react';
import { ChatPanel } from './ChatPanel';
import { CanvasPanel } from './CanvasPanel';
import { useDirectorMode } from '@renderer/pages/ASide/hooks/useDirectorMode';

interface DirectorModeProps {
  /** 剧本 ID */
  screenplayId: string;
  /** 完成回调 */
  onComplete?: () => void;
}

export function DirectorMode({ screenplayId, onComplete }: DirectorModeProps) {
  const {
    characters,
    storyboard,
    generateCharacters,
    editCharacter,
    regenerateCharacter,
    generateStoryboard,
    regenerateStoryboard,
    composeVideo,
    isGeneratingCharacters,
    isGeneratingStoryboard,
    isComposingVideo,
  } = useDirectorMode(screenplayId);

  return (
    <div className="h-full flex">
      {/* 左侧：Agent 群聊 */}
      <div className="w-2/5 border-r border-slate-700">
        <ChatPanel screenplayId={screenplayId} onComplete={onComplete} />
      </div>

      {/* 右侧：可视化画板 */}
      <div className="w-3/5">
        <CanvasPanel
          characters={characters}
          storyboard={storyboard || undefined}
          onEditCharacter={editCharacter}
          onRegenerateCharacter={regenerateCharacter}
          onAddCharacter={() => {
            // TODO: 打开添加角色对话框
            console.log('[DirectorMode] 添加角色');
          }}
          onRegenerateStoryboard={regenerateStoryboard}
        />
      </div>
    </div>
  );
}
