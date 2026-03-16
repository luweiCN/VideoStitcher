/**
 * 导演模式 - 类型定义
 */

// 剧本
export interface Script {
  id: string;
  title: string;
  content: string;
  characters: Character[];
  scenes: Scene[];
  createdAt: Date;
  updatedAt: Date;
}

// 角色
export interface Character {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  traits: string[];
  voiceStyle?: string;
}

// 场景
export interface Scene {
  id: string;
  sequence: number;
  description: string;
  duration: number; // 秒
  imageUrl?: string;
  videoUrl?: string;
  characters: string[]; // 角色ID列表
  dialogue?: Dialogue[];
  visualEffects?: string[];
  transition?: 'fade' | 'slide' | 'zoom' | 'cut';
}

// 对话
export interface Dialogue {
  characterId: string;
  content: string;
  emotion?: 'happy' | 'sad' | 'angry' | 'neutral' | 'excited';
  timestamp: number; // 秒
}

// 聊天消息
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// 导出配置
export interface ExportConfig {
  format: 'mp4' | 'mov' | 'webm';
  resolution: '1080p' | '2K' | '4K';
  fps: 24 | 30 | 60;
  quality: 'low' | 'medium' | 'high';
}

// 属性面板选中项
export interface SelectedItem {
  type: 'character' | 'scene';
  id: string;
}
