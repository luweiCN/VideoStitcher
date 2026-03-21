import type React from 'react';

export type ModelType = 'text' | 'image' | 'video';

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  enabled: boolean;
  description?: string;
}

/** 每个 Agent 支持的模型类型，以及各类型当前选中的 modelId */
export type AgentModelConfig = Partial<Record<ModelType, string>>;

export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  description: string;
  iconColor: string;
  bgColor: string;
  icon: React.ElementType;
  /** 该 Agent 使用哪些类型的模型，决定渲染几个选择器 */
  modelTypes: ModelType[];
}

export interface PromptTemplate {
  id: string;
  agentId: string;
  name: string;
  content: string;
  isActive: boolean;
  createdAt: string;
}

export const MODEL_TYPE_LABEL: Record<ModelType, string> = {
  text: '文本模型',
  image: '图片模型',
  video: '视频模型',
};
