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
    // 0. 检查是否已完成
    if (state.step2_characters) {
      console.log('[Agent 2: 选角导演] 步骤已完成，跳过执行');
      return {};
    }

    // 1. 获取 AI 提供商
    const provider = getGlobalProvider();

    // 2. 获取优化后的脚本内容
    const scriptContent = state.step1_script?.content?.content; // ← 修正路径
    if (!scriptContent) {
      throw new Error('[Agent 2: 选角导演] 缺少脚本内容');
    }

    console.log('[Agent 2: 选角导演] 开始根据剧本创造角色');

    // 3. 调用 LLM 创造角色（而不是提取）
    const extractPrompt = buildCreateCharactersPrompt(scriptContent);
    console.log('[Agent 2: 选角导演] ====== LLM 提示词 ======');
    console.log(extractPrompt);
    console.log('[Agent 2: 选角导演] ==========================');

    const extractResult = await provider.generateText(extractPrompt, {
      temperature: 0.7,
      maxTokens: 2048,
    });

    console.log('[Agent 2: 选角导演] ====== LLM 原始输出 ======');
    console.log(extractResult.content);
    console.log('[Agent 2: 选角导演] ============================');

    console.log('[Agent 2: 选角导演] 角色创造完成');

    // 4. 解析角色信息
    const characters = parseCharacterList(extractResult.content);
    console.log('[Agent 2: 选角导演] ====== 解析后的角色数据 ======');
    console.log(JSON.stringify(characters, null, 2));
    console.log('[Agent 2: 选角导演] ================================');
    console.log(`[Agent 2: 选角导演] 成功创造 ${characters.length} 个角色`);

    // 5. 并行生成所有人物概念图（性能优化）
    console.log(`[Agent 2: 选角导演] 开始并行生成 ${characters.length} 个角色的概念图`);

    const imagePromises = characters.map(async (char, index) => {
      console.log(`[Agent 2: 选角导演] [${index + 1}/${characters.length}] 为角色 "${char.name}" 生成概念图`);
      console.log(`[Agent 2: 选角导演] 角色详情:`, {
        name: char.name,
        description: char.description,
        traits: char.traits,
        visualPrompt: char.visualPrompt,
      });

      try {
        console.log(`[Agent 2: 选角导演] [${index + 1}] 调用图片生成 API，提示词:`, char.visualPrompt);

        const imageResult = await provider.generateImage(char.visualPrompt, {
          size: '2K', // Seedream 5.0 lite 最小支持 2K (2560x1440)
          style: 'cinematic',
          quality: 'standard', // 标准质量
        });

        console.log(`[Agent 2: 选角导演] [${index + 1}] 图片生成 API 返回:`, {
          hasUrl: !!imageResult.images?.[0]?.url,
          url: imageResult.images?.[0]?.url,
          fullResult: imageResult,
        });

        const characterCard = {
          id: `char-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: char.name,
          description: char.description,
          imageUrl: imageResult.images[0].url,
          metadata: {
            traits: char.traits,
            generatedAt: new Date().toISOString(),
          },
        };

        console.log(`[Agent 2: 选角导演] [${index + 1}] 创建的角色卡片:`, characterCard);
        console.log(`[Agent 2: 选角导演] [${index + 1}] 角色 "${char.name}" 概念图生成完成`);

        return characterCard;
      } catch (error) {
        console.error(`[Agent 2: 选角导演] [${index + 1}] 角色 "${char.name}" 概念图生成失败:`, error);
        console.error(`[Agent 2: 选角导演] [${index + 1}] 错误堆栈:`, error instanceof Error ? error.stack : '无堆栈信息');

        // 使用占位符图片
        const placeholderCard = {
          id: `char-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: char.name,
          description: char.description,
          imageUrl: 'https://via.placeholder.com/1024x1024?text=' + encodeURIComponent(char.name),
          metadata: {
            traits: char.traits,
            error: error instanceof Error ? error.message : '图片生成失败',
          },
        };

        console.log(`[Agent 2: 选角导演] [${index + 1}] 使用占位符的角色卡片:`, placeholderCard);
        return placeholderCard;
      }
    });

    // 并行执行所有图片生成
    const characterCards = await Promise.all(imagePromises);

    const duration = Date.now() - startTime;
    console.log(`[Agent 2: 选角导演] 完成，成功创造 ${characterCards.length} 个角色卡片，耗时 ${duration}ms`);
    console.log('[Agent 2: 选角导演] ====== 最终角色卡片数组 ======');
    console.log(JSON.stringify(characterCards, null, 2));
    console.log('[Agent 2: 选角导演] =================================');

    // 导演模式：步骤完成后设置 humanApproval = false，让条件边暂停
    const updates: Partial<WorkflowState> = {
      step2_characters: {
        content: characterCards,
        metadata: {
          timestamp: Date.now(),
          duration: duration,
          model: 'doubao-1-5-pro-32k-250115',
        },
      },
      currentStep: 3,
    };

    console.log('[Agent 2: 选角导演] ====== 返回的状态更新 ======');
    console.log(JSON.stringify(updates, null, 2));
    console.log('[Agent 2: 选角导演] =================================');

    if (state.executionMode === 'director') {
      updates.humanApproval = false;
    }

    return updates;
  } catch (error) {
    console.error('[Agent 2: 选角导演] 执行失败:', error);
    throw error;
  }
}

/**
 * 构建创造角色提示词（导演模式：根据剧本创造角色）
 */
function buildCreateCharactersPrompt(scriptContent: string): string {
  return `你是一位富有创意的选角导演。请根据以下视频剧本，创造合适的角色。

剧本内容：
---
${scriptContent}
---

**任务：**
根据剧本的场景和情节，创造 2-4 个适合的角色。发挥你的创意，为每个角色设计：

1. **姓名** - 符合角色特点的名字
2. **详细描述** - 外貌、性格、服装、年龄、职业等
3. **性格特点** - 3-5 个关键词（如：勇敢、幽默、神秘、温柔等）
4. **视觉提示词** - 英文，用于生成人物概念图，详细描述：
   - 外貌特征（脸型、发型、肤色等）
   - 服装装扮（风格、颜色、配饰等）
   - 肢体语言（姿势、表情、动作等）
   - 场景氛围（光影、背景等）

**创造原则：**
- 角色要与剧本场景和情节相匹配
- 每个角色应该有独特的个性和视觉特征
- 视觉提示词要详细且具体，便于生成高质量概念图
- 如果剧本已有明确人物，可以在此基础上丰富细节
- 如果剧本只有场景描述，自由创造适合的角色

**输出格式（必须严格遵守 JSON 格式）：**
\`\`\`json
[
  {
    "name": "角色姓名",
    "description": "详细的角色描述（中文）",
    "traits": ["特点1", "特点2", "特点3"],
    "visualPrompt": "A detailed English prompt for AI image generation, describing the character's appearance, clothing, pose, and atmosphere"
  }
]
\`\`\`

**注意：**
- visualPrompt 必须是英文，且要详细具体
- 角色数量建议 2-4 个
- 每个角色要有鲜明的视觉特征`;
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
    console.error('[Agent 2: 选角导演] 解析角色列表失败:', error);
    console.log('[Agent 2: 选角导演] LLM 原始输出:', text);

    // 返回默认角色（LLM 解析失败时使用）
    console.warn('[Agent 2: 选角导演] 使用默认角色');
    return [
      {
        name: '主角',
        description: '视频的主要角色',
        traits: ['勇敢', '坚定', '有魅力'],
        visualPrompt: 'A heroic character, confident pose, cinematic portrait, dramatic lighting, high quality, detailed',
      },
    ];
  }
}
