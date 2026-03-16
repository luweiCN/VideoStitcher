/**
 * LangGraph 工作流图定义
 * 整合 4 个 Agent 节点,支持快速生成和导演模式
 */

import { StateGraph, END } from '@langchain/langgraph';
import type { WorkflowState } from './state';
import { scriptWriterNode } from './nodes/script-writer';
import { castingDirectorNode } from './nodes/casting-director';
import { storyboardArtistNode } from './nodes/storyboard-artist';
import { cameraDirectorNode } from './nodes/camera-director';

/**
 * 人工检查点：决定是否暂停
 * 导演模式下每个 Agent 后暂停，快速生成模式下自动执行
 */
function humanCheckpoint(state: WorkflowState): string {
  // 导演模式：每个 Agent 后暂停
  if (state.executionMode === 'director' && !state.humanApproval) {
    return 'wait_for_human';
  }
  // 快速生成模式或已批准：继续执行
  return 'continue';
}

/**
 * 创建视频生产工作流图
 *
 * @returns 编译后的 LangGraph 工作流实例
 */
export function createVideoProductionGraph() {
  console.log('[LangGraph] 开始创建工作流图');

  // 1. 创建工作流图
  const workflow = new StateGraph<WorkflowState>({
    channels: {
        // 输入参数
        scriptContent: { value: null },
        projectId: { value: null },

        // 执行配置
        executionMode: { value: null },
        videoSpec: { value: null },

        // Agent 输出
        step1_script: { value: null },
        step2_characters: { value: null },
        step3_storyboard: { value: null },
        step4_video: { value: null },

        // 控制状态
        currentStep: { value: 1 },
        humanApproval: { value: false },
        userModifications: { value: {} },

        // 上下文信息
        context: { value: {} },

        // 消息历史
        messages: { value: [] },

        // 错误处理
        error: { value: null },
      },
  });

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
