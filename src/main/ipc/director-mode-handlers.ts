/**
 * 导演模式 IPC handlers
 * 处理 Agent 工作流、角色生成、分镜图生成
 */

import { ipcMain } from 'electron';
import type { Character, Storyboard } from '@shared/types/aside';

// 模拟数据
const mockCharacters: Character[] = [
  {
    id: 'char-1',
    name: '老王',
    description: '50岁，麻将馆老板，经验丰富，说话接地气',
    imageUrl: undefined,
  },
  {
    id: 'char-2',
    name: '小李',
    description: '25岁，新手玩家，冲动热血',
    imageUrl: undefined,
  },
];

const mockStoryboard: Storyboard = {
  id: 'storyboard-1',
  rows: 3,
  cols: 3,
  scenes: [
    { id: 'scene-1', index: 1, description: '开场：麻将馆全景', imageUrl: undefined },
    { id: 'scene-2', index: 2, description: '老王特写：摸牌', imageUrl: undefined },
    { id: 'scene-3', index: 3, description: '小李特写：紧张表情', imageUrl: undefined },
    { id: 'scene-4', index: 4, description: '牌桌俯拍', imageUrl: undefined },
    { id: 'scene-5', index: 5, description: '老王打出一张牌', imageUrl: undefined },
    { id: 'scene-6', index: 6, description: '小李惊讶', imageUrl: undefined },
    { id: 'scene-7', index: 7, description: '胜负揭晓', imageUrl: undefined },
    { id: 'scene-8', index: 8, description: '老王微笑', imageUrl: undefined },
    { id: 'scene-9', index: 9, description: '结尾：字幕', imageUrl: undefined },
  ],
};

/**
 * 注册导演模式 IPC handlers
 */
export function registerDirectorModeHandlers() {
  // 生成角色
  ipcMain.handle('aside:generate-characters', async (_event, screenplayId: string) => {
    console.log('[DirectorMode] 生成角色，剧本 ID:', screenplayId);

    // TODO: 调用真实的 Agent 工作流
    // 模拟延迟
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return {
      success: true,
      characters: mockCharacters,
    };
  });

  // 添加角色
  ipcMain.handle('aside:add-character', async (_event, data: { screenplayId: string; name: string; description: string }) => {
    console.log('[DirectorMode] 添加角色:', data.name);

    // TODO: 保存到数据库
    const newCharacter: Character = {
      id: `char-${Date.now()}`,
      name: data.name,
      description: data.description,
      imageUrl: undefined,
    };

    return {
      success: true,
      character: newCharacter,
    };
  });

  // 编辑角色
  ipcMain.handle('aside:edit-character', async (_event, data: { characterId: string; name: string; description: string }) => {
    console.log('[DirectorMode] 编辑角色:', characterId);

    // TODO: 更新数据库
    return {
      success: true,
    };
  });

  // 重新生成角色
  ipcMain.handle('aside:regenerate-character', async (_event, characterId: string) => {
    console.log('[DirectorMode] 重新生成角色:', characterId);

    // TODO: 调用 AI 重新生成
    await new Promise((resolve) => setTimeout(resolve, 1500));

    return {
      success: true,
      character: mockCharacters[0], // 返回更新后的角色
    };
  });

  // 生成分镜图
  ipcMain.handle('aside:generate-storyboard', async (_event, screenplayId: string) => {
    console.log('[DirectorMode] 生成分镜图，剧本 ID:', screenplayId);

    // TODO: 调用真实的 Agent 工作流
    // 模拟延迟
    await new Promise((resolve) => setTimeout(resolve, 3000));

    return {
      success: true,
      storyboard: mockStoryboard,
    };
  });

  // 重新生成分镜图
  ipcMain.handle('aside:regenerate-storyboard', async (_event, storyboardId: string) => {
    console.log('[DirectorMode] 重新生成分镜图:', storyboardId);

    // TODO: 调用 AI 重新生成
    await new Promise((resolve) => setTimeout(resolve, 3000));

    return {
      success: true,
      storyboard: mockStoryboard,
    };
  });

  // 合成视频
  ipcMain.handle('aside:compose-video', async (_event, screenplayId: string) => {
    console.log('[DirectorMode] 合成视频,剧本 ID:', screenplayId);

    // TODO: 调用 FFmpeg 合成
    await new Promise((resolve) => setTimeout(resolve, 5000));

    return {
      success: true,
      videoUrl: '/path/to/output.mp4',
    };
  });
}
