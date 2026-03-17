/**
 * 导演模式 API Hooks
 * 封装与导演模式相关的 IPC 调用
 */

import { ipcRenderer } from 'electron';
import type { Character, Storyboard } from '@shared/types/aside';

/**
 * 生成角色
 */
export async function generateCharacters(screenplayId: string): Promise<{
  success: boolean;
  characters?: Character[];
  error?: string;
}> {
  return ipcRenderer.invoke('aside:generate-characters', screenplayId);
}

/**
 * 添加角色
 */
export async function addCharacter(data: {
  screenplayId: string;
  name: string;
  description: string;
}): Promise<{
  success: boolean;
  character?: Character;
  error?: string;
}> {
  return ipcRenderer.invoke('aside:add-character', data);
}

/**
 * 编辑角色
 */
export async function editCharacter(data: {
  characterId: string;
  name: string;
  description: string;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  return ipcRenderer.invoke('aside:edit-character', data);
}

/**
 * 重新生成角色
 */
export async function regenerateCharacter(characterId: string): Promise<{
  success: boolean;
  character?: Character;
  error?: string;
}> {
  return ipcRenderer.invoke('aside:regenerate-character', characterId);
}

/**
 * 生成分镜图
 */
export async function generateStoryboard(screenplayId: string): Promise<{
  success: boolean;
  storyboard?: Storyboard;
  error?: string;
}> {
  return ipcRenderer.invoke('aside:generate-storyboard', screenplayId);
}

/**
 * 重新生成分镜图
 */
export async function regenerateStoryboard(storyboardId: string): Promise<{
  success: boolean;
  storyboard?: Storyboard;
  error?: string;
}> {
  return ipcRenderer.invoke('aside:regenerate-storyboard', storyboardId);
}

/**
 * 合成视频
 */
export async function composeVideo(screenplayId: string): Promise<{
  success: boolean;
  videoUrl?: string;
  error?: string;
}> {
  return ipcRenderer.invoke('aside:compose-video', screenplayId);
}
