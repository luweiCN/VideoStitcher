/**
 * 导演模式主页面
 * 左右分栏:左侧 Agent 群聊 + 右侧可视化画板
 */

import { useState, useEffect, useMemo } from 'react';
import { ChatPanel } from './ChatPanel';
import { NodeCanvas, CanvasNode, CanvasEdge } from './NodeCanvas';
import { useDirectorMode } from '@renderer/pages/ASide/hooks/useDirectorMode';
import { useASideStore } from '@renderer/stores/asideStore';
import type { Character, Storyboard } from '@shared/types/aside';

interface DirectorModeProps {
  /** 剧本 ID */
  screenplayId: string;
  /** 完成回调 */
  onComplete?: () => void;
}

export function DirectorMode({ screenplayId, onComplete }: DirectorModeProps) {
  const { selectedScreenplay } = useASideStore();
  const [isWorkflowInitialized, setIsWorkflowInitialized] = useState(false);

  const {
    characters,
    storyboard,
    generateCharacters,
    editCharacter,
    regenerateCharacter,
    generateStoryboard,
    regenerateStoryboard,
    composeVideo,
    isGeneratingCharacters,
    isGeneratingStoryboard,
    isComposingVideo,
  } = useDirectorMode(screenplayId);

  // 调试:追踪 characters 变化
  useEffect(() => {
    console.log('[DirectorMode] characters 更新:', {
      count: characters?.length || 0,
      characters: characters,
      firstCharId: characters?.[0]?.id,
      firstCharName: characters?.[0]?.name,
    });
  }, [characters]);

  // 调试:追踪 storyboard 变化
  useEffect(() => {
    console.log('[DirectorMode] storyboard 更新:', storyboard);
  }, [storyboard]);

  // 将后端数据转换为节点画布格式（智能布局，自适应节点数量）
  const canvasNodes = useMemo<CanvasNode[]>(() => {
    console.log('[DirectorMode] 转换节点数据:', {
      isWorkflowInitialized,
      hasScript: !!selectedScreenplay,
      charactersCount: characters?.length || 0,
      storyboardScenesCount: storyboard?.scenes?.length || 0,
    });

    const nodes: CanvasNode[] = [];
    const NODE_WIDTH = 320;
    const NODE_HEIGHT_CHARACTER = 380;
    const PADDING_X = 380; // 水平间距
    const PADDING_Y = 480; // 垂直间距
    const CANVAS_CENTER_X = 500; // 画布中心 X 坐标

    // 脚本节点 - 只要选择了剧本就显示（不依赖工作流初始化）
    if (selectedScreenplay) {
      nodes.push({
        id: 'node_script',
        type: 'script',
        x: CANVAS_CENTER_X - NODE_WIDTH / 2, // 居中
        y: 50,
        width: NODE_WIDTH,
        data: {
          text: selectedScreenplay.content,
        },
      });
    }

    // 人物节点 - 根据数量自适应布局
    if (characters && characters.length > 0) {
      console.log('[DirectorMode] 添加人物节点:', characters);

      const count = characters.length;
      const y = 50 + PADDING_Y; // 脚本下方

      characters.forEach((char, index) => {
        let x: number;

        if (count === 1) {
          // 1个：居中
          x = CANVAS_CENTER_X - NODE_WIDTH / 2;
        } else if (count === 2) {
          // 2个：左右对称
          x = CANVAS_CENTER_X - PADDING_X / 2 - NODE_WIDTH / 2 + index * PADDING_X;
        } else if (count === 3) {
          // 3个：左中右
          x = CANVAS_CENTER_X - PADDING_X - NODE_WIDTH / 2 + index * PADDING_X;
        } else {
          // 4个或更多：等间距分布
          const totalWidth = (count - 1) * PADDING_X;
          x = CANVAS_CENTER_X - totalWidth / 2 + index * PADDING_X;
        }

        nodes.push({
          id: `node_char_${char.id}`,
          type: 'character',
          x: x,
          y: y,
          width: NODE_WIDTH,
          data: {
            name: char.name,
            description: char.description,
            imageUrl: char.imageUrl,
            isGeneratingImage: false,
          },
        });
      });
    }

    // 分镜节点 - 在所有人物下方
    if (storyboard && storyboard.scenes && storyboard.scenes.length > 0) {
      const y = 50 + PADDING_Y * 2; // 人物下方
      nodes.push({
        id: 'node_storyboard',
        type: 'storyboard',
        x: CANVAS_CENTER_X - 320, // 居中（宽度640）
        y: y,
        width: 640,
        data: {
          label: `分镜矩阵 (${storyboard.rows}×${storyboard.cols})`,
          isHorizontal: true,
        },
      });
    }

    console.log('[DirectorMode] 生成的节点数量:', nodes.length);
    return nodes;
  }, [selectedScreenplay, characters, storyboard]); // 移除 isWorkflowInitialized 依赖

  // 生成连线
  const canvasEdges = useMemo<CanvasEdge[]>(() => {
    const edges: CanvasEdge[] = [];

    // 脚本 -> 人物
    if (characters && characters.length > 0) {
      characters.forEach((char) => {
        edges.push({
          id: `edge_script_${char.id}`,
          source: 'node_script',
          target: `node_char_${char.id}`,
        });
      });
    }

    // 人物 -> 分镜
    if (storyboard && characters && characters.length > 0) {
      characters.forEach((char) => {
        edges.push({
          id: `edge_${char.id}_storyboard`,
          source: `node_char_${char.id}`,
          target: 'node_storyboard',
        });
      });
    }

    return edges;
  }, [characters, storyboard]);

  // 选中的节点
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

  // 节点位置状态（用于拖拽）
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});

  // 合并节点数据和位置
  const nodesWithPositions = useMemo(() => {
    return canvasNodes.map(node => ({
      ...node,
      x: nodePositions[node.id]?.x ?? node.x,
      y: nodePositions[node.id]?.y ?? node.y,
    }));
  }, [canvasNodes, nodePositions]);

  // 处理节点更新
  const handleNodeUpdate = (nodeId: string, updates: Partial<CanvasNode['data'] | { x: number; y: number }>) => {
    console.log('[DirectorMode] 更新节点:', nodeId, updates);

    // 如果更新包含位置信息，更新节点位置
    if ('x' in updates && 'y' in updates) {
      setNodePositions(prev => ({
        ...prev,
        [nodeId]: {
          x: updates.x as number,
          y: updates.y as number,
        },
      }));
    }
  };

  // 处理节点重新生成
  const handleNodeRegenerate = async (nodeId: string) => {
    console.log('[DirectorMode] 重新生成节点:', nodeId);

    // 如果是人物节点,提取角色 ID
    if (nodeId.startsWith('node_char_')) {
      const characterId = nodeId.replace('node_char_', '');
      try {
        await regenerateCharacter(characterId);
      } catch (error) {
        console.error('[DirectorMode] 重新生成角色失败:', error);
      }
    }
  };

  // 初始化工作流状态
  useEffect(() => {
    const initWorkflow = async () => {
      if (!screenplayId || !selectedScreenplay || isWorkflowInitialized) {
        return;
      }

      console.log('[DirectorMode] 初始化工作流,剧本 ID:', screenplayId);

      try {
        const result = await window.api.asideInitDirectorWorkflow({
          screenplayId,
          scriptContent: selectedScreenplay.content,
          videoSpec: {
            duration: 'short',
            aspectRatio: '16:9',
          },
          projectId: selectedScreenplay.projectId,
          creativeDirectionId: selectedScreenplay.creativeDirectionId,
          personaId: selectedScreenplay.personaId,
        });

        if (result.success) {
          console.log('[DirectorMode] 工作流初始化成功');
          setIsWorkflowInitialized(true);
        } else {
          console.error('[DirectorMode] 工作流初始化失败:', result.error);
        }
      } catch (error) {
        console.error('[DirectorMode] 工作流初始化异常:', error);
      }
    };

    initWorkflow();
  }, [screenplayId, selectedScreenplay, isWorkflowInitialized]);

  return (
    <div className="h-full flex">
      {/* 左侧:Agent 群聊 */}
      <div className="w-1/4 border-r border-slate-700">
        <ChatPanel
          screenplayId={screenplayId}
          onComplete={onComplete}
          isWorkflowInitialized={isWorkflowInitialized}
        />
      </div>

      {/* 右侧:节点画布 */}
      <div className="w-3/4 relative">

        {nodesWithPositions.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-slate-500 mb-2">等待 Agent 完成</p>
              <p className="text-xs text-slate-600">
                成果将在此显示(当前 {nodesWithPositions.length} 个节点)
              </p>
            </div>
          </div>
        ) : (
          <NodeCanvas
            nodes={nodesWithPositions}
            edges={canvasEdges}
            onNodeUpdate={handleNodeUpdate}
            onNodeRegenerate={handleNodeRegenerate}
            selectedNodeIds={selectedNodeIds}
            onSelectionChange={setSelectedNodeIds}
          />
        )}
      </div>
    </div>
  );
}
