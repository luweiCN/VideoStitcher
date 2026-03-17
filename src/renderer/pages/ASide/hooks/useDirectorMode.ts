/**
 * 导演模式状态管理 Hook
 * 封装与导演模式相关的状态和 API 调用
 */

import { useState, useCallback } from 'react';
import type { Character, Storyboard } from '@shared/types/aside';
import {
  generateCharacters as apiGenerateCharacters,
  addCharacter as apiAddCharacter,
  editCharacter as apiEditCharacter,
  regenerateCharacter as apiRegenerateCharacter,
  generateStoryboard as apiGenerateStoryboard,
  regenerateStoryboard as apiRegenerateStoryboard,
  composeVideo as apiComposeVideo,
} from '@renderer/api/directorMode';

export interface DirectorModeState {
  characters: Character[];
  storyboard: Storyboard | null;
  isGeneratingCharacters: boolean;
  isGeneratingStoryboard: boolean;
  isComposingVideo: boolean;
  error: string | null;
}

export function useDirectorMode(screenplayId: string) {
  const [state, setState] = useState<DirectorModeState>({
    characters: [],
    storyboard: null,
    isGeneratingCharacters: false,
    isGeneratingStoryboard: false,
    isComposingVideo: false,
    error: null,
  });

  // 生成角色
  const generateCharacters = useCallback(async () => {
    setState((prev) => ({ ...prev, isGeneratingCharacters: true, error: null }));

    try {
      const result = await apiGenerateCharacters(screenplayId);
      if (result.success && result.characters) {
        setState((prev) => ({
          ...prev,
          characters: result.characters!,
          isGeneratingCharacters: false,
        }));
        return result.characters;
      } else {
        throw new Error(result.error || '生成角色失败');
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isGeneratingCharacters: false,
        error: (error as Error).message,
      }));
      throw error;
    }
  }, [screenplayId]);

  // 添加角色
  const addCharacter = useCallback(async (name: string, description: string) => {
    try {
      const result = await apiAddCharacter({ screenplayId, name, description });
      if (result.success && result.character) {
        setState((prev) => ({
          ...prev,
          characters: [...prev.characters, result.character!],
        }));
        return result.character;
      } else {
        throw new Error(result.error || '添加角色失败');
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: (error as Error).message,
      }));
      throw error;
    }
  }, [screenplayId]);

  // 编辑角色
  const editCharacter = useCallback(async (characterId: string, name: string, description: string) => {
    try {
      const result = await apiEditCharacter({ characterId, name, description });
      if (result.success) {
        setState((prev) => ({
          ...prev,
          characters: prev.characters.map((char) =>
            char.id === characterId ? { ...char, name, description } : char
          ),
        }));
      } else {
        throw new Error(result.error || '编辑角色失败');
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: (error as Error).message,
      }));
      throw error;
    }
  }, []);

  // 重新生成角色
  const regenerateCharacter = useCallback(async (characterId: string) => {
    try {
      const result = await apiRegenerateCharacter(characterId);
      if (result.success && result.character) {
        setState((prev) => ({
          ...prev,
          characters: prev.characters.map((char) =>
            char.id === characterId ? result.character! : char
          ),
        }));
        return result.character;
      } else {
        throw new Error(result.error || '重新生成角色失败');
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: (error as Error).message,
      }));
      throw error;
    }
  }, []);

  // 生成分镜图
  const generateStoryboard = useCallback(async () => {
    setState((prev) => ({ ...prev, isGeneratingStoryboard: true, error: null }));

    try {
      const result = await apiGenerateStoryboard(screenplayId);
      if (result.success && result.storyboard) {
        setState((prev) => ({
          ...prev,
          storyboard: result.storyboard!,
          isGeneratingStoryboard: false,
        }));
        return result.storyboard;
      } else {
        throw new Error(result.error || '生成分镜图失败');
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isGeneratingStoryboard: false,
        error: (error as Error).message,
      }));
      throw error;
    }
  }, [screenplayId]);

  // 重新生成分镜图
  const regenerateStoryboard = useCallback(async (storyboardId: string) => {
    try {
      const result = await apiRegenerateStoryboard(storyboardId);
      if (result.success && result.storyboard) {
        setState((prev) => ({
          ...prev,
          storyboard: result.storyboard!,
        }));
        return result.storyboard;
      } else {
        throw new Error(result.error || '重新生成分镜图失败');
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: (error as Error).message,
      }));
      throw error;
    }
  }, []);

  // 合成视频
  const composeVideo = useCallback(async () => {
    setState((prev) => ({ ...prev, isComposingVideo: true, error: null }));

    try {
      const result = await apiComposeVideo(screenplayId);
      if (result.success && result.videoUrl) {
        setState((prev) => ({
          ...prev,
          isComposingVideo: false,
        }));
        return result.videoUrl;
      } else {
        throw new Error(result.error || '合成视频失败');
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isComposingVideo: false,
        error: (error as Error).message,
      }));
      throw error;
    }
  }, [screenplayId]);

  return {
    ...state,
    generateCharacters,
    addCharacter
    editCharacter,
    regenerateCharacter,
    generateStoryboard,
    regenerateStoryboard,
    composeVideo,
  };
}
