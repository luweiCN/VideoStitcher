/**
 * AI Agent 提示词统一导出
 * 集中管理所有 Agent 的提示词配置
 */

export { ScreenplayAgentPrompts } from './screenplay-agent';
export { ArtDirectorAgentPrompts } from './art-director-agent';
export { StoryboardArtistAgentPrompts } from './storyboard-artist-agent';
export { CinematographerAgentPrompts } from './cinematographer-agent';

/**
 * Agent 类型定义
 */
export enum AgentType {
  SCREENPLAY = 'screenplay',
  ART_DIRECTOR = 'art_director',
  STORYBOARD_ARTIST = 'storyboard_artist',
  CINEMATOGRAPHER = 'cinematographer',
}

/**
 * Agent 配置接口
 */
export interface AgentConfig {
  type: AgentType;
  name: string;
  description: string;
  systemPrompt: string;
  userPrompt: string;
}
