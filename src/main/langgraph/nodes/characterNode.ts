/**
 * 角色设定节点
 * 负责调用豆包 Vision API 生成角色设定和概念图
 */

import { GraphStateType, NodeNames, Character } from '../state';
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
 * 角色设定节点配置
 */
export interface CharacterNodeConfig {
  /** 进度回调函数 */
  onProgress?: ProgressCallback;
}

/**
 * 角色设定节点函数
 * @param state 当前状态
 * @param config 配置选项
 */
export async function characterNode(
  state: GraphStateType,
  config?: CharacterNodeConfig
): Promise<Partial<GraphStateType>> {
  logger.info('[角色节点] 开始执行', {
    selectedScriptId: state.selectedScriptId,
  });

  try {
    // 验证输入参数
    if (!state.selectedScriptId) {
      throw new Error('未选择脚本');
    }

    // 找到选中的脚本
    const selectedScript = state.scripts.find((s) => s.id === state.selectedScriptId);

    if (!selectedScript) {
      throw new Error('未找到选中的脚本');
    }

    // 通知进度：开始分析脚本
    config?.onProgress?.(10, '正在分析脚本内容...');

    // 创建火山引擎客户端
    const client = new VolcanoClient();

    // 使用 LLM 分析脚本，提取角色信息
    const analysisPrompt = `你是一位专业的角色设计师。

请分析以下脚本，提取出需要的主要角色（最多 2 个）。

脚本内容：
${selectedScript.text}

请输出 JSON 格式的角色列表，每个角色包含：
1. name: 角色名称（简洁明了）
2. description: 角色描述（包含外貌、性格、服装等，不超过 200 个字）
3. type: 角色类型（主角/配角）

示例格式：
[
  {
    "name": "主角",
    "description": "年轻的创业者，穿着休闲西装，自信阳光...",
    "type": "主角"
  },
  {
    "name": "顾客",
    "description": "中年男性，穿着商务装，沉稳...",
    "type": "配角"
  }
]

请直接输出 JSON 格式，不要包含其他说明文字。`;

    const analysisResponse = await client.callLLM(
      analysisPrompt,
      '你是一位专业的角色设计师，擅长从脚本中提取角色信息。'
    );

    // 解析角色列表
    let characterList: Array<{
      name: string;
      description: string;
      type: string;
    }> = [];

    try {
      const jsonMatch = analysisResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        characterList = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('未找到有效的 JSON 内容');
      }
    } catch (parseError) {
      logger.warn('[角色节点] JSON 解析失败，使用默认角色', {
        error: parseError instanceof Error ? parseError.message : '未知错误',
      });
      // 使用默认角色
      characterList = [
        {
          name: '主角',
          description: '基于脚本自动生成的主角形象',
          type: '主角',
        },
      ];
    }

    // 通知进度：生成角色设定
    config?.onProgress?.(30, `正在生成 ${characterList.length} 个角色设定...`);

    // 生成角色列表
    const characters: Character[] = [];

    for (let i = 0; i < characterList.length; i++) {
      const characterData = characterList[i];
      const progress = 30 + Math.round(((i + 1) / characterList.length) * 60);

      config?.onProgress?.(progress, `正在生成${characterData.type} "${characterData.name}" 的概念图...`);

      try {
        // 生成角色概念图
        const imagePrompt = `专业的角色概念图设计，${characterData.description}。

风格要求：
- 高质量插画风格
- 清晰的人物轮廓
- 适合视频制作使用
- 尺寸：1024x1024`;

        const imageUrl = await client.generateImage({
          prompt: imagePrompt,
          style: 'digital art',
          width: 1024,
          height: 1024,
        });

        // 创建角色对象
        const character: Character = {
          id: uuidv4(),
          name: characterData.name,
          description: characterData.description,
          imageUrl,
          createdAt: Date.now(),
        };

        characters.push(character);

        logger.info('[角色节点] 角色生成成功', {
          name: characterData.name,
          type: characterData.type,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        logger.error('[角色节点] 单个角色生成失败', {
          name: characterData.name,
          error: errorMessage,
        });

        // 添加一个没有图片的备用角色
        characters.push({
          id: uuidv4(),
          name: characterData.name,
          description: characterData.description,
          imageUrl: undefined,
          createdAt: Date.now(),
        });
      }
    }

    // 通知进度：生成完成
    config?.onProgress?.(100, '角色设定生成完成');

    logger.info('[角色节点] 生成完成', { count: characters.length });

    return {
      characters,
      currentNode: NodeNames.CHARACTER,
      error: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[角色节点] 执行失败', errorMessage);

    // 通知进度：生成失败
    config?.onProgress?.(0, `角色设定生成失败: ${errorMessage}`);

    return {
      error: errorMessage,
      currentNode: NodeNames.CHARACTER,
    };
  }
}
