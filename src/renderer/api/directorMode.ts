/**
 * 导演模式 API Hooks
 * 封装与导演模式相关的 IPC 调用
 */

import type { Character, Storyboard } from '@shared/types/aside';

export interface DirectorWorkflowInitRequest {
  screenplayId: string;
  scriptContent: string;
  videoSpec: { duration: 'short' | 'long'; aspectRatio: '16:9' | '9:16' };
  projectId: string;
  creativeDirectionId?: string;
  personaId?: string;
}

export interface DirectorWorkflowInitResult {
  success: boolean;
  state?: unknown;
  error?: string;
}

/**
 * 生成角色
 */
export async function generateCharacters(screenplayId: string): Promise<{
  success: boolean;
  characters?: Character[];
  error?: string;
}> {
  return window.api.asideGenerateCharacters(screenplayId);
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
  return window.api.asideAddCharacter(data);
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
  return window.api.asideEditCharacter(data);
}

/**
 * 重新生成角色
 */
export async function regenerateCharacter(characterId: string): Promise<{
  success: boolean;
  character?: Character;
  error?: string;
}> {
  return window.api.asideRegenerateCharacter(characterId);
}

/**
 * 生成分镜图
 */
export async function generateStoryboard(screenplayId: string): Promise<{
  success: boolean;
  storyboard?: Storyboard;
  error?: string;
}> {
  return window.api.asideGenerateStoryboard(screenplayId);
}

/**
 * 重新生成分镜图
 */
export async function regenerateStoryboard(storyboardId: string): Promise<{
  success: boolean;
  storyboard?: Storyboard;
  error?: string;
}> {
  return window.api.asideRegenerateStoryboard(storyboardId);
}

/**
 * 合成视频
 */
export async function composeVideo(screenplayId: string): Promise<{
  success: boolean;
  videoUrl?: string;
  error?: string;
}> {
  return window.api.asideComposeVideo(screenplayId);
}

/**
 * 初始化导演模式工作流
 */
export async function initDirectorWorkflow(
  data: DirectorWorkflowInitRequest,
): Promise<DirectorWorkflowInitResult> {
  return window.api.asideInitDirectorWorkflow(data);
}
