/**
 * LangGraph 工作流图定义
 * 整合 4 个 Agent 节点,支持快速生成和导演模式
 */

import { StateGraph, END, Annotation } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';
import type { WorkflowState } from './state';
import { scriptWriterNode } from './nodes/script-writer';
import { castingDirectorNode } from './nodes/casting-director';
import { storyboardArtistNode } from './nodes/storyboard-artist';
import { cameraDirectorNode } from './nodes/camera-director';

/**
 * 使用 Annotation API 定义工作流状态（LangGraph 1.2.2+）
 */
const GraphStateAnnotation = Annotation.Root({
  // 输入参数
  scriptContent: Annotation<string>,
  projectId: Annotation<string>,

  // 执行配置
  executionMode: Annotation<'director' | 'fast'>,
  videoSpec: Annotation<{ duration: 'short' | 'long'; aspectRatio: '16:9' | '9:16' }>,

  // Agent 输出
  step1_script: Annotation<any>,
  step2_characters: Annotation<any>,
  step3_storyboard: Annotation<any>,
  step4_video: Annotation<any>,

  // 控制状态
  currentStep: Annotation<number>,
  humanApproval: Annotation<boolean>,
  userModifications: Annotation<any>,

  // 上下文信息
  creativeDirection: Annotation<any>,
  persona: Annotation<any>,

  // 消息历史（使用 reducer 合并消息）
  messages: Annotation<BaseMessage[]>({
    reducer: (left: BaseMessage[], right: BaseMessage[]) => left.concat(right),
    default: () => [],
  }),

  // 错误处理
  error: Annotation<string | undefined>,
});

/**
 * 人工检查点：决定是否暂停
 * 导演模式下每个 Agent 后暂停，快速生成模式下自动执行
 */
function humanCheckpoint(state: WorkflowState): string {
  // 如果已经批准，直接继续
  if (state.humanApproval) {
    return 'continue';
  }

  // 导演模式：每个 Agent 后暂停（除非步骤已完成）
  if (state.executionMode === 'director') {
    // 检查是否所有步骤都已完成
    const allStepsCompleted = state.step1_script && state.step2_characters &&
                              state.step3_storyboard && state.step4_video;

    if (!allStepsCompleted) {
      return 'wait_for_human';
    }
  }

  // 快速生成模式或所有步骤已完成：继续执行
  return 'continue';
}

/**
 * 创建视频生产工作流图（使用 LangGraph 1.2.2 Annotation API）
 *
 * @returns 编译后的 LangGraph 工作流实例
 */
export function createVideoProductionGraph() {
  console.log('[LangGraph] 开始创建工作流图');

  // 1. 创建工作流图（使用 Annotation）
  const workflow = new StateGraph(GraphStateAnnotation);

  // 2. 添加 4 个 Agent 节点
  console.log('[LangGraph] 添加 Agent 节点');
  workflow.addNode('script_writer', scriptWriterNode);
  workflow.addNode('casting_director', castingDirectorNode);
  workflow.addNode('storyboard_artist', storyboardArtistNode);
  workflow.addNode('camera_director', cameraDirectorNode);

  // 3. 添加条件边：导演模式暂停，快速生成自动执行
  console.log('[LangGraph] 添加条件边（支持导演模式暂停）');

  // Agent 1 → Agent 2（或暂停）
  workflow.addConditionalEdges(
    'script_writer',
    humanCheckpoint,
    {
      wait_for_human: END, // 暂停，等待人工确认
      continue: 'casting_director', // 继续执行
    }
  );

  // Agent 2 → Agent 3（或暂停）
  workflow.addConditionalEdges(
    'casting_director',
    humanCheckpoint,
    {
      wait_for_human: END,
      continue: 'storyboard_artist',
    }
  );

  // Agent 3 → Agent 4（或暂停）
  workflow.addConditionalEdges(
    'storyboard_artist',
    humanCheckpoint,
    {
      wait_for_human: END,
      continue: 'camera_director',
    }
  );

  // Agent 4 → 结束
  workflow.addEdge('camera_director', END);

  // 4. 设置入口节点
  workflow.setEntryPoint('script_writer');

  // 5. 编译工作流图
  console.log('[LangGraph] 编译工作流图');
  const graph = workflow.compile();

  console.log('[LangGraph] 工作流图创建成功');
  return graph;
}

/**
 * 导出工作流图实例（单例）
 * 延迟初始化，避免启动时就创建
 */
let graphInstance: ReturnType<typeof createVideoProductionGraph> | null = null;

/**
 * 获取工作流图实例（单例模式）
 */
export function getVideoProductionGraph() {
  if (!graphInstance) {
    graphInstance = createVideoProductionGraph();
  }
  return graphInstance;
}

/**
 * 重置工作流图实例（用于测试或配置变更）
 */
export function resetVideoProductionGraph() {
  graphInstance = null;
  console.log('[LangGraph] 工作流图实例已重置');
}
