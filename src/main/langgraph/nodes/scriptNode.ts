/**
 * 脚本生成节点
 * 负责调用豆包 LLM API 批量生成脚本
 */

import { GraphStateType, NodeNames, Script } from '../state';
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
 * 脚本生成节点配置
 */
export interface ScriptNodeConfig {
  /** 进度回调函数 */
  onProgress?: ProgressCallback;
  /** 是否启用知识库检索 */
  enableKnowledgeRetrieval?: boolean;
}

/**
 * 脚本生成节点函数
 * @param state 当前状态
 * @param config 配置选项
 */
export async function scriptNode(
  state: GraphStateType,
  config?: ScriptNodeConfig
): Promise<Partial<GraphStateType>> {
  logger.info('[脚本节点] 开始执行', {
    userRequirement: state.userRequirement,
    selectedStyle: state.selectedStyle,
    batchSize: state.batchSize,
  });

  try {
    // 验证输入参数
    if (!state.userRequirement || state.userRequirement.trim().length === 0) {
      throw new Error('用户需求不能为空');
    }

    if (!state.selectedStyle || state.selectedStyle.trim().length === 0) {
      throw new Error('脚本风格不能为空');
    }

    if (state.batchSize < 1 || state.batchSize > 10) {
      throw new Error('批量生成数量必须在 1-10 之间');
    }

    // 通知进度：开始生成
    config?.onProgress?.(0, '开始生成脚本...');

    // 1. 知识库检索（如果启用）
    let knowledgeContext = '';
    if (config?.enableKnowledgeRetrieval !== false) {
      config?.onProgress?.(10, '正在检索知识库...');

      try {
        const { knowledgeBase } = await import('../../services/KnowledgeBase');

        // 检索与需求相关的素材
        const searchResults = await knowledgeBase.searchSimilar(
          `${state.selectedStyle} ${state.userRequirement}`,
          5
        );

        if (searchResults.length > 0) {
          // 构建知识库上下文
          knowledgeContext = searchResults
            .map((result, index) => {
              return `\n【参考案例 ${index + 1}】(相似度: ${(result.score * 100).toFixed(1)}%)\n${result.content}\n`;
            })
            .join('\n---\n');

          logger.info('[脚本节点] 知识库检索完成', {
            resultCount: searchResults.length,
            avgScore:
              searchResults.reduce((sum, r) => sum + r.score, 0) /
              searchResults.length,
          });

          config?.onProgress?.(20, `找到 ${searchResults.length} 个相关案例`);
        } else {
          logger.info('[脚本节点] 知识库中未找到相关案例');
          config?.onProgress?.(20, '知识库中未找到相关案例');
        }
      } catch (error) {
        logger.warn('[脚本节点] 知识库检索失败，继续生成', error);
        config?.onProgress?.(20, '知识库检索失败，继续生成');
      }
    }

    // 创建火山引擎客户端
    const client = new VolcanoClient();

    // 批量生成脚本
    const scripts: Script[] = [];

    for (let i = 0; i < state.batchSize; i++) {
      // 通知进度：正在生成第 i+1 个脚本
      const baseProgress = 20;
      const progressRange = 80;
      const progress = Math.round(
        baseProgress + ((i + 1) / state.batchSize) * progressRange
      );
      config?.onProgress?.(progress, `正在生成第 ${i + 1}/${state.batchSize} 个脚本...`);

      try {
        // 构造提示词（包含知识库上下文）
        const prompt = `你是一位专业的视频脚本编剧，擅长创作吸引人的短视频内容。

${knowledgeContext ? `参考以下成功案例：
${knowledgeContext}

` : ''}请为以下产品生成一个短视频脚本。

产品需求：${state.userRequirement}
脚本风格：${state.selectedStyle}
脚本序号：第 ${i + 1} 个（共 ${state.batchSize} 个）

请输出 JSON 格式的脚本内容，包含：
1. title: 脚本标题（简洁明了，不超过 20 个字）
2. content: 脚本正文内容（包含开场、发展、高潮、结尾四个部分，总共不超过 500 个字）
3. duration: 预计时长（秒，建议 15-60 秒）

示例格式：
{
  "title": "产品介绍",
  "content": "开场：...\\n发展：...\\n高潮：...\\n结尾：...",
  "duration": 30
}

请直接输出 JSON 格式，不要包含其他说明文字。`;

        // 调用豆包 LLM API
        const llmResponse = await client.callLLM(prompt, '你是一位专业的视频脚本编剧，擅长创作吸引人的短视频内容。');

        // 解析 JSON 响应
        let scriptData;
        try {
          // 提取 JSON 内容（处理可能的 markdown 代码块）
          const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            scriptData = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('未找到有效的 JSON 内容');
          }
        } catch (parseError) {
          logger.warn('[脚本节点] JSON 解析失败，使用原始文本', {
            error: parseError instanceof Error ? parseError.message : '未知错误',
          });
          // 如果解析失败，使用原始文本
          scriptData = {
            title: `脚本 ${i + 1}`,
            content: llmResponse,
            duration: 30,
          };
        }

        // 创建脚本对象
        const script: Script = {
          id: uuidv4(),
          text: `${scriptData.title}\n\n${scriptData.content}\n\n预计时长：${scriptData.duration} 秒`,
          style: state.selectedStyle,
          createdAt: Date.now(),
          selected: false,
        };

        scripts.push(script);

        logger.info('[脚本节点] 脚本生成成功', {
          index: i + 1,
          title: scriptData.title,
          duration: scriptData.duration,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        logger.error('[脚本节点] 单个脚本生成失败', {
          index: i + 1,
          error: errorMessage,
        });

        // 继续生成其他脚本，不中断整个流程
        // 添加一个备用脚本
        scripts.push({
          id: uuidv4(),
          text: `备用脚本 ${i + 1}（生成失败，请重试）`,
          style: state.selectedStyle,
          createdAt: Date.now(),
          selected: false,
        });
      }
    }

    // 通知进度：生成完成
    config?.onProgress?.(100, '脚本生成完成');

    logger.info('[脚本节点] 生成完成', { count: scripts.length });

    return {
      scripts,
      currentNode: NodeNames.SCRIPT,
      error: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[脚本节点] 执行失败', errorMessage);

    // 通知进度：生成失败
    config?.onProgress?.(0, `脚本生成失败: ${errorMessage}`);

    return {
      error: errorMessage,
      currentNode: NodeNames.SCRIPT,
    };
  }
}
