/**
 * 分镜生成节点
 * 负责调用豆包 Vision API 生成分镜图像
 */

import { GraphStateType, NodeNames, StoryboardScene } from '../state';
import log from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { VolcanoClient } from '../../api/volcano-client';

// 使用 logger
const logger = log;

/**
 * 进度回调函数类型
 */
export type ProgressCallback = (progress: number, message: string) => void;

/**
 * 分镜生成节点配置
 */
export interface StoryboardNodeConfig {
  /** 进度回调函数 */
  onProgress?: ProgressCallback;
}

/**
 * 分镜生成节点函数
 * @param state 当前状态
 * @param config 配置选项
 */
export async function storyboardNode(
  state: GraphStateType,
  config?: StoryboardNodeConfig
): Promise<Partial<GraphStateType>> {
  logger.info('[分镜节点] 开始执行', {
    characterCount: state.characters.length,
  });

  try {
    // 验证输入参数
    if (!state.characters || state.characters.length === 0) {
      throw new Error('角色列表不能为空');
    }

    if (!state.selectedScriptId) {
      throw new Error('未选择脚本');
    }

    // 通知进度：开始生成分镜
    config?.onProgress?.(10, '正在分析角色和脚本...');

    // 找到选中的脚本
    const selectedScript = state.scripts.find((s) => s.id === state.selectedScriptId);
    if (!selectedScript) {
      throw new Error('未找到选中的脚本');
    }

    // 创建火山引擎客户端
    const client = new VolcanoClient();

    // 使用 LLM 生成分镜场景列表
    const storyboardPrompt = `你是一位专业的视频分镜师。

请根据以下脚本和角色信息，生成详细的分镜场景列表。

脚本内容：
${selectedScript.text}

角色信息：
${state.characters.map((c) => `- ${c.name}: ${c.description}`).join('\n')}

请输出 JSON 格式的分镜列表，每个分镜包含：
1. sceneNumber: 场景序号（从 1 开始）
2. description: 场景详细描述（包含画面、动作、镜头角度等，不超过 150 个字）
3. duration: 持续时间（秒，建议 3-8 秒）

注意：
- 根据脚本长度生成 4-8 个分镜
- 确保分镜连贯性，有开场、发展、高潮、结尾
- 每个分镜要能转换为视觉画面

示例格式：
[
  {
    "sceneNumber": 1,
    "description": "开场镜头：主角从远处走来，背景是城市天际线，镜头缓慢推进",
    "duration": 5
  },
  {
    "sceneNumber": 2,
    "description": "特写镜头：主角面部表情自信，目光坚定，准备展示产品",
    "duration": 3
  }
]

请直接输出 JSON 格式，不要包含其他说明文字。`;

    const storyboardResponse = await client.callLLM(
      storyboardPrompt,
      '你是一位专业的视频分镜师，擅长将脚本转换为视觉场景。'
    );

    // 解析分镜列表
    let sceneList: Array<{
      sceneNumber: number;
      description: string;
      duration: number;
    }> = [];

    try {
      const jsonMatch = storyboardResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        sceneList = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('未找到有效的 JSON 内容');
      }
    } catch (parseError) {
      logger.warn('[分镜节点] JSON 解析失败，使用默认分镜', {
        error: parseError instanceof Error ? parseError.message : '未知错误',
      });
      // 使用默认分镜
      sceneList = [
        { sceneNumber: 1, description: '开场镜头 - 基于角色和脚本生成的场景描述', duration: 3 },
        { sceneNumber: 2, description: '发展镜头 - 基于角色和脚本生成的场景描述', duration: 4 },
        { sceneNumber: 3, description: '高潮镜头 - 基于角色和脚本生成的场景描述', duration: 5 },
        { sceneNumber: 4, description: '结尾镜头 - 基于角色和脚本生成的场景描述', duration: 3 },
      ];
    }

    // 通知进度：开始生成分镜图
    config?.onProgress?.(30, `准备生成 ${sceneList.length} 个分镜图...`);

    // 生成分镜列表
    const storyboard: StoryboardScene[] = [];

    for (let i = 0; i < sceneList.length; i++) {
      const sceneData = sceneList[i];
      const progress = 30 + Math.round(((i + 1) / sceneList.length) * 70);

      config?.onProgress?.(progress, `正在生成分镜 ${i + 1}/${sceneList.length}...`);

      try {
        // 生成分镜图像
        const imagePrompt = `专业的视频分镜画面。

场景描述：${sceneData.description}

角色信息：${state.characters.map((c) => c.name).join('、')}

风格要求：
- 电影级画面质量
- 清晰的构图
- 适合视频制作
- 尺寸：1920x1080`;

        const imageUrl = await client.generateImage({
          prompt: imagePrompt,
          style: 'cinematic',
          width: 1920,
          height: 1080,
        });

        // 创建分镜对象
        const scene: StoryboardScene = {
          id: uuidv4(),
          sceneNumber: sceneData.sceneNumber,
          description: sceneData.description,
          imageUrl,
          duration: sceneData.duration,
          createdAt: Date.now(),
        };

        storyboard.push(scene);

        logger.info('[分镜节点] 分镜生成成功', {
          sceneNumber: sceneData.sceneNumber,
          duration: sceneData.duration,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        logger.error('[分镜节点] 单个分镜生成失败', {
          sceneNumber: sceneData.sceneNumber,
          error: errorMessage,
        });

        // 添加一个没有图片的备用分镜
        storyboard.push({
          id: uuidv4(),
          sceneNumber: sceneData.sceneNumber,
          description: sceneData.description,
          imageUrl: undefined,
          duration: sceneData.duration,
          createdAt: Date.now(),
        });
      }
    }

    // 通知进度：生成完成
    config?.onProgress?.(100, '分镜生成完成');

    logger.info('[分镜节点] 生成完成', { count: storyboard.length });

    return {
      storyboard,
      currentNode: NodeNames.STORYBOARD,
      error: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[分镜节点] 执行失败', errorMessage);

    // 通知进度：生成失败
    config?.onProgress?.(0, `分镜生成失败: ${errorMessage}`);

    return {
      error: errorMessage,
      currentNode: NodeNames.STORYBOARD,
    };
  }
}
