/**
 * 创意方向生成 Agent 提示词构建器
 */

import type { Project } from '@shared/types/aside';
import {
  CREATIVE_DIRECTION_AGENT_SYSTEM_PROMPT,
  CREATIVE_DIRECTION_AGENT_USER_PROMPT_TEMPLATE,
} from '@shared/constants/promptTemplates';

/**
 * 创意方向生成 Agent 提示词构建器
 */
export class CreativeDirectionAgentPrompts {
  /**
   * 系统提示词（直接使用共享常量，确保与 PromptStudio 展示一致）
   */
  static buildSystemPrompt(): string {
    return CREATIVE_DIRECTION_AGENT_SYSTEM_PROMPT;
  }

  /**
   * 用户提示词（替换占位符）
   */
  static buildUserPrompt(project: Project): string {
    return CREATIVE_DIRECTION_AGENT_USER_PROMPT_TEMPLATE
      .replace(/\{\{gameName\}\}/g, project.name)
      .replace(/\{\{gameType\}\}/g, project.gameType)
      .replace(/\{\{sellingPoint\}\}/g, project.sellingPoint || '暂无');
  }
}

/**
 * 解析 AI 输出的 JSON，提取方向列表
 */
export function parseCreativeDirectionsOutput(
  llmOutput: string
): Array<{ name: string; iconName: string; description: string }> {
  // 尝试提取 JSON 代码块
  const jsonMatch = llmOutput.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : llmOutput.trim();

  const parsed = JSON.parse(jsonStr);

  if (!parsed.directions || !Array.isArray(parsed.directions)) {
    throw new Error('AI 输出缺少 directions 数组');
  }

  return parsed.directions.map((d: any) => ({
    name: String(d.name || '').trim(),
    iconName: String(d.iconName || 'Sparkles').trim(),
    description: String(d.description || '').trim(),
  }));
}
