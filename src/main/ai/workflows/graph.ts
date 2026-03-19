/**
 * LangGraph 工作流图定义
 * 整合 4 个 Agent 节点（剧本写作是独立的，不在工作流中）
 *
 * 工作流架构：
 * - 剧本写作：独立运行，不在工作流中
 * - 工作流：4个Agent（艺术总监→选角导演→分镜师→摄像导演）
 *   - 快速生成模式：自动执行所有步骤
 *   - 导演模式：每步暂停等待确认
 */

import { StateGraph, END, Annotation } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';
import type { WorkflowState } from './state';
import { artDirectorNode } from './nodes/art-director';
import { castingDirectorNode } from './nodes/casting-director';
import { storyboardArtistNode } from './nodes/storyboard-artist';
import { cinematographerNode } from './nodes/cinematographer';

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

  // Agent 输出（5 个步骤）
  step1_script: Annotation<any>, // 剧本写作 Agent
  step2_characters: Annotation<any>, // 艺术总监 Agent（角色和场景）
  step3_storyboard: Annotation<any>, // 选角导演 Agent（人物图像提示词）
  step4_video: Annotation<any>, // 分镜师 Agent
  step5_final: Annotation<any>, // 摄像师 Agent（视频合成计划）

  // 控制状态
  currentStep: Annotation<number>,
  humanApproval: Annotation<boolean>,
  userModifications: Annotation<any>,

  // 上下文信息
  project: Annotation<any>,
  creativeDirection: Annotation<any>,
  persona: Annotation<any>,
  region: Annotation<string>,

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
                              state.step3_storyboard && state.step4_video && state.step5_final;

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
 * 工作流只包含 4 个 Agent（剧本写作是独立的）：
 * - 艺术总监（Agent 2）
 * - 选角导演（Agent 3）
 * - 分镜师（Agent 4）
 * - 摄像师（Agent 5）
 *
 * @returns 编译后的 LangGraph 工作流实例
 */
export function createVideoProductionGraph() {
  console.log('[LangGraph] 开始创建工作流图（4个Agent，剧本独立）');

  // 1. 创建工作流图（使用 Annotation）
  const workflow = new StateGraph(GraphStateAnnotation);

  // 2. 添加 4 个 Agent 节点（剧本写作独立，不在工作流中）
  console.log('[LangGraph] 添加 Agent 节点');
  workflow.addNode('art_director', artDirectorNode); // Agent 2: 艺术总监
  workflow.addNode('casting_director', castingDirectorNode); // Agent 3: 选角导演
  workflow.addNode('storyboard_artist', storyboardArtistNode); // Agent 4: 分镜师
  workflow.addNode('cinematographer', cinematographerNode); // Agent 5: 摄像师

  // 3. 添加条件边：根据执行模式决定是否暂停
  console.log('[LangGraph] 添加条件边（快速生成自动执行，导演模式每步暂停）');

  // 艺术总监 → 选角导演（或暂停）
  workflow.addConditionalEdges(
    'art_director',
    humanCheckpoint,
    {
      wait_for_human: END, // 暂停，等待人工确认（导演模式）
      continue: 'casting_director', // 继续执行（快速生成）
    }
  );

  // 选角导演 → 分镜师（或暂停）
  workflow.addConditionalEdges(
    'casting_director',
    humanCheckpoint,
    {
      wait_for_human: END,
      continue: 'storyboard_artist',
    }
  );

  // 分镜师 → 摄像师（或暂停）
  workflow.addConditionalEdges(
    'storyboard_artist',
    humanCheckpoint,
    {
      wait_for_human: END,
      continue: 'cinematographer',
    }
  );

  // 摄像师 → 结束
  workflow.addEdge('cinematographer', END);

  // 4. 设置入口节点为艺术总监
  workflow.setEntryPoint('art_director');

  // 5. 编译工作流图
  console.log('[LangGraph] 编译工作流图');
  const graph = workflow.compile();

  console.log('[LangGraph] 工作流图创建成功（4 个 Agent）');
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
