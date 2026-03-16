/**
 * 选角导演 Agent
 * Agent 2: 根据脚本生成人物卡片
 */

import type { WorkflowState, CharacterCard } from '../state';
import type { AIProvider } from '../../providers/interface';
import { getGlobalProvider } from '../../provider-manager';

/**
 * 人物信息接口
 */
interface CharacterInfo {
  name: string;
  description: string;
  traits: string[];
  visualPrompt: string;
}

/**
 * 选角导演 Agent 节点
 */
export async function castingDirectorNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  console.log('[Agent 2: 选角导演] 开始执行');
  const startTime = Date.now();

  try {
    // 1. 获取 AI 提供商
    const provider = getGlobalProvider();

    // 2. 获取优化后的脚本
    const scriptContent = state.step1_script?.content;
    if (!scriptContent) {
      throw new Error('[Agent 2: 选角导演] 缺少脚本内容');
    }

    console.log('[Agent 2: 选角导演] 开始从脚本中提取人物');

    // 3. 调用 LLM 提取人物信息
    const extractPrompt = buildExtractCharactersPrompt(scriptContent);
    const extractResult = await provider.generateText(extractPrompt, {
      temperature: 0.7,
      maxTokens: 2048,
    });

    console.log('[Agent 2: 选角导演] 人物提取完成');

    // 4. 解析人物信息
    const characters = parseCharacterList(extractResult.content);
    console.log(`[Agent 2: 选角导演] 提取到 ${characters.length} 个人物`);

    // 5. 为每个人物生成概念图
    const characterCards: CharacterCard[] = [];

    for (const char of characters) {
      console.log(`[Agent 2: 选角导演] 为人物 "${char.name}" 生成概念图`);

      try {
        const imageResult = await provider.generateImage(char.visualPrompt, {
          size: '512x512',
          style: 'cinematic',
          quality: 'high',
        });

        characterCards.push({
          id: `char-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: char.name,
          description: char.description,
          imageUrl: imageResult.url,
          metadata: {
            traits: char.traits,
            generatedAt: new Date().toISOString(),
          },
        });

        console.log(`[Agent 2: 选角导演] 人物 "${char.name}" 概念图生成完成`);
      } catch (error) {
        console.error(`[Agent 2: 选角导演] 人物 "${char.name}" 概念图生成失败:`, error);

        // 使用占位符图片
        characterCards.push({
          id: `char-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: char.name,
          description: char.description,
          imageUrl: 'https://via.placeholder.com/512x512?text=' + encodeURIComponent(char.name),
          metadata: {
            traits: char.traits,
            error: error instanceof Error ? error.message : '图片生成失败',
          },
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Agent 2: 选角导演] 完成，生成 ${characterCards.length} 个人物卡片，耗时 ${duration}ms`);

    return {
      step2_characters: characterCards,
      currentStep: 3,
    };
  } catch (error) {
    console.error('[Agent 2: 选角导演] 执行失败:', error);
    throw error;
  }
}

/**
 * 构建提取人物提示词
 */
function buildExtractCharactersPrompt(scriptContent: string): string {
  return `你是一位专业的选角导演。请从以下视频脚本中提取所有出场人物。

脚本内容：
---
${scriptContent}
---

要求：
1. 识别所有出场人物（包括旁白、主角、配角等）
2. 为每个人物提供：
   - 姓名（如果没有明确姓名，根据特征命名）
   - 详细描述（外貌、性格、服装等）
   - 性格特点（3-5 个关键词）
   - 视觉提示词（用于生成人物概念图，英文，详细描述外貌、服装、姿势等）

请以 JSON 数组格式返回，格式如下：
\`\`\`json
[
  {
    "name": "人物姓名",
    "description": "详细的人物描述",
    "traits": ["特点1", "特点2", "特点3"],
    "visualPrompt": "英文视觉提示词，用于 AI 图片生成，描述外貌、服装、姿势等"
  }
]
\`\`\`

注意：
- visualPrompt 必须是英文
- visualPrompt 应该详细且具体，便于生成高质量概念图
- 如果脚本是中文，description 可以是中文，但 visualPrompt 必须是英文`;
}

/**
 * 解析人物列表
 */
function parseCharacterList(text: string): CharacterInfo[] {
  try {
    // 尝试提取 JSON 代码块
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    // 尝试直接解析整个文本
    return JSON.parse(text);
  } catch (error) {
    console.error('[Agent 2: 选角导演] 解析人物列表失败:', error);
    console.log('[Agent 2: 选角导演] 原始文本:', text);

    // 返回默认人物
    return [
      {
        name: '主角',
        description: '视频的主要角色',
        traits: ['勇敢', '坚定', '有魅力'],
        visualPrompt: 'A heroic character, confident pose, cinematic portrait, high quality',
      },
    ];
  }
}
