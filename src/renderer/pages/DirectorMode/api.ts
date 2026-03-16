/**
 * 导演模式 - API 接口定义
 */

import type { Script, Character, Scene, Message } from './types';

// 生成角色请求
export interface GenerateCharactersRequest {
  script: Script | null;
  description?: string;
  count?: number;
}

// 生成角色响应
export interface GenerateCharactersResponse {
  characters: Character[];
}

// 生成分镜请求
export interface GenerateStoryboardRequest {
  script: Script | null;
  characters: Character[];
  sceneCount?: number;
}

// 生成分镜响应
export interface GenerateStoryboardResponse {
  scenes: Scene[];
}

// 导演聊天请求
export interface DirectorChatRequest {
  message: string;
  script: Script | null;
  context?: {
    characters?: Character[];
    scenes?: Scene[];
  };
}

// 导演聊天响应
export interface DirectorChatResponse {
  message: string;
  actions?: Array<{
    type: 'generate_characters' | 'generate_storyboard' | 'update_scene' | 'update_character';
    data?: any;
  }>;
}

// 导出视频请求
export interface ExportVideoRequest {
  scenes: Scene[];
  config: {
    format: 'mp4' | 'mov' | 'webm';
    resolution: '1080p' | '2K' | '4K';
    fps: 24 | 30 | 60;
    quality: 'low' | 'medium' | 'high';
  };
}

// 导出视频响应
export interface ExportVideoResponse {
  taskId: string;
  estimatedTime: number; // 秒
}

// 加载剧本请求
export interface LoadScriptRequest {
  filePath: string;
}

// 加载剧本响应
export interface LoadScriptResponse {
  script: Script;
}

// API 函数（临时 Mock）
export const directorApi = {
  // 生成角色
  generateCharacters: async (request: GenerateCharactersRequest): Promise<GenerateCharactersResponse> => {
    // TODO: 调用真实后端 API
    // return await window.api.directorGenerateCharacters(request);

    // Mock 实现
    await new Promise(resolve => setTimeout(resolve, 1500));
    return {
      characters: [],
    };
  },

  // 生成分镜
  generateStoryboard: async (request: GenerateStoryboardRequest): Promise<GenerateStoryboardResponse> => {
    // TODO: 调用真实后端 API
    // return await window.api.directorGenerateStoryboard(request);

    // Mock 实现
    await new Promise(resolve => setTimeout(resolve, 2000));
    return {
      scenes: [],
    };
  },

  // 导演聊天
  chat: async (request: DirectorChatRequest): Promise<DirectorChatResponse> => {
    // TODO: 调用真实后端 API
    // return await window.api.directorChat(request);

    // Mock 实现
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      message: '收到您的消息，正在处理中...',
    };
  },

  // 导出视频
  exportVideo: async (request: ExportVideoRequest): Promise<ExportVideoResponse> => {
    // TODO: 调用真实后端 API
    // return await window.api.directorExportVideo(request);

    // Mock 实现
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      taskId: `task-${Date.now()}`,
      estimatedTime: 300,
    };
  },

  // 加载剧本
  loadScript: async (request: LoadScriptRequest): Promise<LoadScriptResponse> => {
    // TODO: 调用真实后端 API
    // return await window.api.directorLoadScript(request);

    // Mock 实现
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      script: {
        id: `script-${Date.now()}`,
        title: '示例剧本',
        content: '',
        characters: [],
        scenes: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  },
};
