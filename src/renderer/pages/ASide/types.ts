/**
 * A面视频生产 - 类型定义
 */

// 风格模板
export interface StyleTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  category: '热门' | '经典' | '新品';
  tags: string[];
  config: StyleConfig;
}

// 风格配置
export interface StyleConfig {
  // 视觉风格
  colorTone: 'warm' | 'cool' | 'neutral' | 'vibrant';
  transitionStyle: 'smooth' | 'dynamic' | 'minimal';
  textAnimation: 'fade' | 'slide' | 'typewriter' | 'bounce';

  // 镜头设置
  cameraMovement: 'static' | 'slowPan' | 'zoom' | 'dynamic';
  shotDuration: number; // 秒

  // 音频设置
  bgmStyle: string;
  bgmVolume: number; // 0-100
  voiceVolume: number; // 0-100
}

// 脚本内容
export interface ScriptContent {
  id: string;
  title: string;
  scenes: ScriptScene[];
  totalDuration: number; // 秒
  createdAt: Date;
}

// 脚本场景
export interface ScriptScene {
  id: string;
  sequence: number;
  content: string;
  duration: number; // 秒
  visualHint?: string; // 视觉提示
  transition?: string; // 转场效果
}

// 生产任务
export interface ProductionTask {
  id: string;
  scriptId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  config: ProductionConfig;
  outputPath?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 生产配置
export interface ProductionConfig {
  styleId: string;
  resolution: '1080p' | '2K' | '4K';
  aspectRatio: '16:9' | '9:16' | '1:1';
  fps: 24 | 30 | 60;
  format: 'mp4' | 'mov' | 'webm';
}

// 待产库项目
export interface QueueItem {
  id: string;
  task: ProductionTask;
  script: ScriptContent;
  priority: 'high' | 'normal' | 'low';
  order: number;
}
