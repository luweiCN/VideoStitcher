/**
 * A面视频生产 - API 接口定义
 *
 * 这些接口需要在后端实现对应的 IPC 处理函数
 */

import type { StyleTemplate, ScriptContent } from './types';

// ============================================================================
// 风格模板相关 API
// ============================================================================

/**
 * 加载风格模板列表
 *
 * IPC Channel: 'aside:load-styles'
 *
 * 返回所有可用的视频风格模板
 */
export interface LoadStylesRequest {
  // 暂无参数
}

export interface LoadStylesResponse {
  success: boolean;
  templates?: StyleTemplate[];
  error?: string;
}

// ============================================================================
// 脚本生成相关 API
// ============================================================================

/**
 * 生成视频脚本
 *
 * IPC Channel: 'aside:generate-scripts'
 *
 * 根据选定的风格和配置参数，生成视频脚本
 */
export interface GenerateScriptsRequest {
  style: StyleTemplate; // 选定的风格模板
  config: {
    region: string; // 目标地区
    productName: string; // 产品名称
    batchSize: number; // 生成数量
  };
}

export interface GenerateScriptsResponse {
  success: boolean;
  scripts?: ScriptContent[];
  error?: string;
}

/**
 * 重新生成单个脚本
 *
 * IPC Channel: 'aside:regenerate-script'
 *
 * 重新生成指定的脚本
 */
export interface RegenerateScriptRequest {
  scriptId: string;
  style: StyleTemplate;
  config: {
    region: string;
    productName: string;
  };
}

export interface RegenerateScriptResponse {
  success: boolean;
  script?: ScriptContent;
  error?: string;
}

// ============================================================================
// 待产库相关 API
// ============================================================================

/**
 * 添加到待产库
 *
 * IPC Channel: 'aside:add-to-queue'
 *
 * 将脚本添加到生产队列
 */
export interface AddToQueueRequest {
  scriptId: string;
  priority?: 'high' | 'normal' | 'low';
  productionConfig: {
    styleId: string;
    resolution: '1080p' | '2K' | '4K';
    aspectRatio: '16:9' | '9:16' | '1:1';
    fps: 24 | 30 | 60;
    format: 'mp4' | 'mov' | 'webm';
  };
}

export interface AddToQueueResponse {
  success: boolean;
  queueItemId?: string;
  error?: string;
}

/**
 * 开始生产
 *
 * IPC Channel: 'aside:start-production'
 *
 * 开始生产待产库中的所有任务
 */
export interface StartProductionRequest {
  queueItemIds: string[];
}

export interface StartProductionResponse {
  success: boolean;
  taskId?: string;
  error?: string;
}

// ============================================================================
// 需要在 preload/index.ts 中添加的 API 方法
// ============================================================================

/**
 * 将以下方法添加到 ElectronAPI 接口中：
 *
 * // A面视频生产 API
 * loadStyleTemplates: () => Promise<LoadStylesResponse>;
 * generateScripts: (request: GenerateScriptsRequest) => Promise<GenerateScriptsResponse>;
 * regenerateScript: (request: RegenerateScriptRequest) => Promise<RegenerateScriptResponse>;
 * addToProductionQueue: (request: AddToQueueRequest) => Promise<AddToQueueResponse>;
 * startProduction: (request: StartProductionRequest) => Promise<StartProductionResponse>;
 */

// ============================================================================
// IPC Channel 常量
// ============================================================================

export const ASIDE_IPC_CHANNELS = {
  LOAD_STYLES: 'aside:load-styles',
  GENERATE_SCRIPTS: 'aside:generate-scripts',
  REGENERATE_SCRIPT: 'aside:regenerate-script',
  ADD_TO_QUEUE: 'aside:add-to-queue',
  START_PRODUCTION: 'aside:start-production',
} as const;
