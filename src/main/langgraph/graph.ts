/**
 * LangGraph 状态图定义
 * AI 视频生产流程的状态机编排
 */

import { StateGraph, END } from '@langchain/langgraph';
import { GraphState, GraphStateType, NodeNames } from './state';
import { scriptNode } from './nodes/scriptNode';
import { characterNode } from './nodes/characterNode';
import { storyboardNode } from './nodes/storyboardNode';
import { videoNode } from './nodes/videoNode';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * 创建 LangGraph 工作流
 */
function createWorkflow() {
  // 创建状态图
  const workflow = new StateGraph(GraphState);

  // ==================== 添加节点 ====================

  // 脚本生成节点
  workflow.addNode(NodeNames.SCRIPT, scriptNode);

  // 角色设定节点
  workflow.addNode(NodeNames.CHARACTER, characterNode);

  // 分镜生成节点
  workflow.addNode(NodeNames.STORYBOARD, storyboardNode);

  // 视频生成节点
  workflow.addNode(NodeNames.VIDEO, videoNode);

  // ==================== 设置入口点 ====================

  workflow.setEntryPoint(NodeNames.SCRIPT);

  // ==================== 添加条件边 ====================

  /**
   * 路由决策：脚本生成后的下一步
   */
  function routeAfterScript(state: GraphStateType): string {
    // 如果有错误，直接结束
    if (state.error) {
      logger.error('[路由] 脚本节点错误，结束流程', state.error);
      return END;
    }

    // 如果有选中的脚本且配置了视频参数，进入导演模式
    if (state.selectedScriptId && state.videoConfig) {
      logger.info('[路由] 进入导演模式 - 角色设定');
      return NodeNames.CHARACTER;
    }

    // 否则结束，等待用户选择
    logger.info('[路由] 脚本生成完成，等待用户选择');
    return END;
  }

  /**
   * 路由决策：角色设定后的下一步
   */
  function routeAfterCharacter(state: GraphStateType): string {
    // 如果有错误，直接结束
    if (state.error) {
      logger.error('[路由] 角色节点错误，结束流程', state.error);
      return END;
    }

    // 进入分镜生成
    logger.info('[路由] 进入分镜生成');
    return NodeNames.STORYBOARD;
  }

  /**
   * 路由决策：分镜生成后的下一步
   */
  function routeAfterStoryboard(state: GraphStateType): string {
    // 如果有错误，直接结束
    if (state.error) {
      logger.error('[路由] 分镜节点错误，结束流程', state.error);
      return END;
    }

    // 进入视频生成
    logger.info('[路由] 进入视频生成');
    return NodeNames.VIDEO;
  }

  /**
   * 路由决策：视频生成后的下一步
   */
  function routeAfterVideo(state: GraphStateType): string {
    // 如果有错误，直接结束
    if (state.error) {
      logger.error('[路由] 视频节点错误，结束流程', state.error);
      return END;
    }

    // 流程结束
    logger.info('[路由] 视频生成完成');
    return END;
  }

  // ==================== 添加边 ====================

  // 脚本节点 -> 条件路由
  workflow.addConditionalEdges(NodeNames.SCRIPT, routeAfterScript, {
    [END]: END,
    [NodeNames.CHARACTER]: NodeNames.CHARACTER,
  });

  // 角色节点 -> 条件路由
  workflow.addConditionalEdges(NodeNames.CHARACTER, routeAfterCharacter, {
    [END]: END,
    [NodeNames.STORYBOARD]: NodeNames.STORYBOARD,
  });

  // 分镜节点 -> 条件路由
  workflow.addConditionalEdges(NodeNames.STORYBOARD, routeAfterStoryboard, {
    [END]: END,
    [NodeNames.VIDEO]: NodeNames.VIDEO,
  });

  // 视频节点 -> 条件路由
  workflow.addConditionalEdges(NodeNames.VIDEO, routeAfterVideo, {
    [END]: END,
  });

  // ==================== 编译工作流 ====================

  const app = workflow.compile();

  logger.info('[LangGraph] 工作流编译完成');

  return app;
}

// 导出编译后的应用
export const langgraphApp = createWorkflow();

/**
 * 初始化状态
 * 用于脚本批量生成场景
 */
export function createInitialState(input: {
  userRequirement: string;
  selectedStyle: string;
  batchSize: number;
}): Partial<GraphStateType> {
  return {
    userRequirement: input.userRequirement,
    selectedStyle: input.selectedStyle,
    batchSize: input.batchSize,
    scripts: [],
    selectedScriptId: null,
    videoConfig: null,
    characters: [],
    storyboard: [],
    videos: [],
    knowledgeBaseResults: [],
    error: null,
    currentNode: NodeNames.SCRIPT,
  };
}

/**
 * 创建导演模式初始状态
 * 用于从脚本进入导演模式场景
 */
export function createDirectorState(input: {
  selectedScriptId: string;
  scripts: GraphStateType['scripts'];
  videoConfig: GraphStateType['videoConfig'];
}): Partial<GraphStateType> {
  return {
    userRequirement: '',
    selectedStyle: '',
    batchSize: 0,
    scripts: input.scripts,
    selectedScriptId: input.selectedScriptId,
    videoConfig: input.videoConfig,
    characters: [],
    storyboard: [],
    videos: [],
    knowledgeBaseResults: [],
    error: null,
    currentNode: NodeNames.CHARACTER,
  };
}
