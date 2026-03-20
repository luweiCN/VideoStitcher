/**
 * 导演模式状态管理 Hook
 * 封装与导演模式相关的状态和 API 调用
 */

import { useState, useCallback, useEffect } from 'react';
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
  characterImages: Map<string, string>; // characterId -> imageUrl
  sceneBreakdowns: Array<{
    scene_number: number;
    scene_name: string;
    location_type: string;
    time_of_day: string;
    environment: string;
    props: string[];
    atmosphere: string;
    key_visual_elements: string[];
  }>; // 场景信息
  videos: Array<{ id: string; url: string; duration?: number; description?: string }>;
  isGeneratingCharacters: boolean;
  isGeneratingStoryboard: boolean;
  isComposingVideo: boolean;
  error: string | null;
}

export function useDirectorMode(screenplayId: string) {
  const [state, setState] = useState<DirectorModeState>({
    characters: [],
    storyboard: null,
    characterImages: new Map(),
    sceneBreakdowns: [],
    videos: [],
    isGeneratingCharacters: false,
    isGeneratingStoryboard: false,
    isComposingVideo: false,
    error: null,
  });

  // 调试:每次 state 变化时打印
  useEffect(() => {
    console.log('[useDirectorMode] state 变化:', {
      charactersCount: state.characters.length,
      characters: state.characters,
    });
  }, [state]);

  // 生成角色
  const generateCharacters = useCallback(async () => {
    console.log('[useDirectorMode] 开始生成角色');
    setState((prev) => ({ ...prev, isGeneratingCharacters: true, error: null }));

    try {
      const result = await apiGenerateCharacters(screenplayId);
      console.log('[useDirectorMode] API 返回结果:', result);

      if (result.success && result.characters) {
        console.log('[useDirectorMode] 成功获取角色:', result.characters.length, '个');

        const newCharacters = [...result.characters]; // 创建新数组
        console.log('[useDirectorMode] 新数组长度:', newCharacters.length);

        setState((prev) => {
          const newState = {
            ...prev,
            characters: newCharacters,
            isGeneratingCharacters: false,
          };
          console.log('[useDirectorMode] 更新后的状态，角色数量:', newState.characters.length);
          return newState;
        });
        return result.characters;
      } else {
        throw new Error(result.error || '生成角色失败');
      }
    } catch (error) {
      console.error('[useDirectorMode] 生成角色失败:', error);
      setState((prev) => ({
        ...prev,
        isGeneratingCharacters: false,
        error: (error as Error).message,
      }));
      throw error;
    }
  }, [screenplayId]); // 移除 state.characters 依赖

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

  // 更新角色图片
  const updateCharacterImage = useCallback((characterId: string, imageUrl: string) => {
    console.log('[useDirectorMode] 更新角色图片:', characterId, imageUrl);
    setState((prev) => {
      // 更新 characters 数组中对应角色的 imageUrl
      const updatedCharacters = prev.characters.map((char) =>
        char.id === characterId ? { ...char, imageUrl } : char
      );

      // 同时更新 characterImages Map
      const newImages = new Map(prev.characterImages);
      newImages.set(characterId, imageUrl);

      return {
        ...prev,
        characters: updatedCharacters,
        characterImages: newImages,
      };
    });
  }, []);

  // 更新角色列表（用于工作流事件）
  const updateCharacters = useCallback((characters: Character[]) => {
    console.log('[useDirectorMode] 更新角色列表:', characters.length, characters);
    setState((prev) => {
      const newState = {
        ...prev,
        characters,
      };
      console.log('[useDirectorMode] 新状态:', {
        oldCharactersCount: prev.characters.length,
        newCharactersCount: newState.characters.length,
      });
      return newState;
    });
  }, []);

  // 更新分镜图（用于工作流事件）
  const updateStoryboard = useCallback((storyboard: Storyboard) => {
    console.log('[useDirectorMode] 更新分镜图:', storyboard);
    setState((prev) => ({
      ...prev,
      storyboard,
    }));
  }, []);

  // 更新场景设定（用于工作流事件）
  const updateSceneBreakdowns = useCallback((scenes: DirectorModeState['sceneBreakdowns']) => {
    console.log('[useDirectorMode] 更新场景设定:', scenes);
    setState((prev) => ({
      ...prev,
      sceneBreakdowns: scenes,
    }));
  }, []);

  // 添加视频
  const addVideo = useCallback((video: { id: string; url: string; duration?: number; description?: string }) => {
    console.log('[useDirectorMode] 添加视频:', video);
    setState((prev) => ({
      ...prev,
      videos: [...prev.videos, video],
    }));
  }, []);

  return {
    ...state,
    generateCharacters,
    addCharacter,
    editCharacter,
    regenerateCharacter,
    generateStoryboard,
    regenerateStoryboard,
    composeVideo,
    updateCharacterImage,
    addVideo,
    updateCharacters,
    updateStoryboard,
    updateSceneBreakdowns,
  };
}
