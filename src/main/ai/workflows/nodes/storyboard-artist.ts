/**
 * 分镜师 Agent
 * Agent 3: 根据人物和脚本生成分镜图
 */

import type { WorkflowState, StoryboardFrame } from '../state';
import { getGlobalProvider } from '../../provider-manager';

/**
 * 场景信息接口
 */
interface SceneInfo {
  sequenceNumber: number;
  description: string;
  visualPrompt: string;
  duration: number;
  isKeyFrame: boolean;
  characters: string[];
}

/**
 * 分镜师 Agent 节点
 */
export async function storyboardArtistNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  console.log('[Agent 3: 分镜师] 开始执行');
  const startTime = Date.now();

  try {
    // 1. 获取 AI 提供商
    const provider = getGlobalProvider();

    // 2. 获取脚本和人物
    const scriptContent = state.step1_script?.content;
    const characters = state.step2_characters;

    if (!scriptContent) {
      throw new Error('[Agent 3: 分镜师] 缺少脚本内容');
    }

    console.log('[Agent 3: 分镜师] 开始拆分场景');

    // 3. 调用 LLM 拆分场景
    const splitPrompt = buildSplitScenesPrompt(scriptContent, characters);
    const splitResult = await provider.generateText(splitPrompt, {
      temperature: 0.7,
      maxTokens: 2048,
    });

    console.log('[Agent 3: 分镜师] 场景拆分完成');

    // 4. 解析场景信息
    const scenes = parseSceneList(splitResult.content);
    console.log(`[Agent 3: 分镜师] 拆分到 ${scenes.length} 个场景`);

    // 5. 为每个场景生成分镜图
    const storyboardFrames: StoryboardFrame[] = [];

    for (const scene of scenes) {
      console.log(`[Agent 3: 分镜师] 为场景 ${scene.sequenceNumber} 生成分镜图`);

      try {
        const imageResult = await provider.generateImage(scene.visualPrompt, {
          size: '1024x1024',
          style: 'cinematic',
          quality: 'high',
        });

        storyboardFrames.push({
          id: `frame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          sequenceNumber: scene.sequenceNumber,
          description: scene.description,
          imageUrl: imageResult.url,
          duration: scene.duration,
          isKeyFrame: scene.isKeyFrame,
          metadata: {
            characters: scene.characters,
            generatedAt: new Date().toISOString(),
          },
        });

        console.log(`[Agent 3: 分镜师] 场景 ${scene.sequenceNumber} 分镜图生成完成`);
      } catch (error) {
        console.error(`[Agent 3: 分镜师] 场景 ${scene.sequenceNumber} 分镜图生成失败:`, error);

        // 使用占位符图片
        storyboardFrames.push({
          id: `frame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          sequenceNumber: scene.sequenceNumber,
          description: scene.description,
          imageUrl: `https://via.placeholder.com/1024x1024?text=Scene+${scene.sequenceNumber}`,
          duration: scene.duration,
          isKeyFrame: scene.isKeyFrame,
          metadata: {
            characters: scene.characters,
            error: error instanceof Error ? error.message : '图片生成失败',
          },
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Agent 3: 分镜师] 完成，生成 ${storyboardFrames.length} 个分镜，耗时 ${duration}ms`);

    return {
      step3_storyboard: storyboardFrames,
      currentStep: 4,
    };
  } catch (error) {
    console.error('[Agent 3: 分镜师] 执行失败:', error);
    throw error;
  }
}

/**
 * 构建拆分场景提示词
 */
function buildSplitScenesPrompt(scriptContent: string, characters: any[]): string {
  const characterList = characters?.map(c => c.name).join(', ') || '无特定人物';

  return `你是一位专业的分镜师。请将以下视频脚本拆分为详细的场景（分镜）。

脚本内容：
---
${scriptContent}
---

可用人物：
${characterList}

要求：
1. 将脚本拆分为 3-8 个场景（根据内容复杂度）
2. 为每个场景提供：
   - 序号（从 1 开始）
   - 详细描述（镜头内容、人物动作、环境等）
   - 视觉提示词（用于生成分镜图，英文，描述镜头角度、光线、构图等）
   - 时长（秒，根据内容重要性分配，总时长控制在 15 秒以内）
   - 是否关键帧（重要场景标记为 true）
   - 出场人物（列表）

请以 JSON 数组格式返回，格式如下：
\`\`\`json
[
  {
    "sequenceNumber": 1,
    "description": "场景的详细描述",
    "visualPrompt": "英文视觉提示词，用于 AI 图片生成，描述镜头、光线、构图等",
    "duration": 3,
    "isKeyFrame": true,
    "characters": ["人物1", "人物2"]
  }
]
\`\`\`

注意：
- visualPrompt 必须是英文
- visualPrompt 应该专业且具体（镜头类型、角度、光线等）
- duration 应合理分配，总时长建议 15 秒左右
- 关键场景（开头、高潮、结尾）标记为 isKeyFrame: true`;
}

/**
 * 解析场景列表
 */
function parseSceneList(text: string): SceneInfo[] {
  try {
    // 尝试提取 JSON 代码块
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    // 尝试直接解析整个文本
    return JSON.parse(text);
  } catch (error) {
    console.error('[Agent 3: 分镜师] 解析场景列表失败:', error);
    console.log('[Agent 3: 分镜师] 原始文本:', text);

    // 返回默认场景
    return [
      {
        sequenceNumber: 1,
        description: '开场镜头',
        visualPrompt: 'Opening shot, wide angle, cinematic, high quality',
        duration: 3,
        isKeyFrame: true,
        characters: [],
      },
    ];
  }
}
