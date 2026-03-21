/**
 * 导演模式主页面
 * 左右分栏:左侧 Agent 群聊 + 右侧可视化画板
 */

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { ChatPanel } from './ChatPanel';
import { NodeCanvas, type NodeCanvasHandle } from './NodeCanvas';
import { useDirectorMode } from '@renderer/pages/ASide/hooks/useDirectorMode';
import { useASideStore } from '@renderer/stores/asideStore';

interface DirectorModeProps {
  /** 剧本 ID */
  screenplayId: string;
  /** 完成回调 */
  onComplete?: () => void;
}

/** 预览弹窗数据 */
interface PreviewItem {
  type: 'image' | 'video';
  src: string;         // 图片 URL 或 base64
  title?: string;
}

/** 媒体预览弹窗 */
function MediaPreviewModal({ item, onClose }: { item: PreviewItem; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl max-h-[90vh] w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <button
          className="absolute -top-10 right-0 text-white hover:text-slate-300 p-1"
          onClick={onClose}
        >
          <X size={24} />
        </button>

        {item.title && (
          <p className="text-white text-sm text-center mb-2 opacity-70">{item.title}</p>
        )}

        {item.type === 'image' ? (
          <img
            src={item.src}
            alt={item.title}
            className="w-full h-auto max-h-[85vh] object-contain rounded-xl"
          />
        ) : (
          <video
            src={item.src}
            className="w-full max-h-[85vh] rounded-xl"
            controls
            autoPlay
          />
        )}
      </div>
    </div>
  );
}

// 布局常量（与原版保持一致）
const NODE_WIDTH = 320;
const NODE_WIDTH_WIDE = NODE_WIDTH * 2;   // 640px 初始宽度，横图动态扩展至 NODE_WIDTH*3(960)
const NODE_HEIGHT_CHARACTER = 380;
const PADDING_X = 380;
const PADDING_Y = 480;
const CANVAS_CENTER_X = 500;

export function DirectorMode({ screenplayId, onComplete }: DirectorModeProps) {
  const { selectedScreenplay } = useASideStore();
  const [isWorkflowInitialized, setIsWorkflowInitialized] = useState(false);
  const [previewItem, setPreviewItem] = useState<PreviewItem | null>(null);

  // 命令式画布句柄
  const canvasRef = useRef<NodeCanvasHandle>(null);

  const directorMode = useDirectorMode(screenplayId);
  const {
    characters,
    storyboard,
    sceneBreakdowns,
    videos,
    regenerateCharacter,
  } = directorMode;

  // 调试:追踪 characters 变化
  useEffect(() => {
    console.log('[DirectorMode] characters 更新:', {
      count: characters?.length || 0,
      firstCharId: characters?.[0]?.id,
      firstCharName: characters?.[0]?.name,
    });
  }, [characters]);

  // 调试:追踪 storyboard 变化
  useEffect(() => {
    console.log('[DirectorMode] storyboard 更新:', storyboard);
  }, [storyboard]);

  // ── 剧本节点 ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedScreenplay || !canvasRef.current) return;
    canvasRef.current.addNode({
      id: 'node_script',
      type: 'script',
      x: CANVAS_CENTER_X - NODE_WIDTH / 2,
      y: 50,
      width: NODE_WIDTH,
      data: { text: selectedScreenplay.content },
    });
  }, [selectedScreenplay]);

  // ── 人物节点 + 连线 ───────────────────────────────────────────────
  useEffect(() => {
    if (!characters?.length || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const count = characters.length;
    const y = 50 + PADDING_Y;

    characters.forEach((char, index) => {
      let x: number;
      if (count === 1) x = CANVAS_CENTER_X - NODE_WIDTH / 2;
      else if (count === 2) x = CANVAS_CENTER_X - PADDING_X / 2 - NODE_WIDTH / 2 + index * PADDING_X;
      else if (count === 3) x = CANVAS_CENTER_X - PADDING_X - NODE_WIDTH / 2 + index * PADDING_X;
      else { const tw = (count - 1) * PADDING_X; x = CANVAS_CENTER_X - tw / 2 + index * PADDING_X; }

      const roleTypeLabel = char.role_type === 'protagonist' ? '主角' :
        char.role_type === 'antagonist' ? '反派' : '配角';

      canvas.addNode({
        id: `node_char_${char.id}`,
        type: 'character',
        x, y,
        width: NODE_WIDTH,
        data: {
          name: `人物设定-${roleTypeLabel}`,
          charName: char.name,
          description: char.description,
          role_type: char.role_type,
        },
      });

      canvas.addEdge({ id: `edge_script_${char.id}`, source: 'node_script', target: `node_char_${char.id}` });
    });

    // 共享形象节点
    const sharedImageUrl = characters.find(c => c.imageUrl)?.imageUrl;
    if (sharedImageUrl) {
      canvas.addNode({
        id: 'node_char_image_shared',
        type: 'character-image',
        x: CANVAS_CENTER_X - NODE_WIDTH_WIDE / 2,
        y: y + NODE_HEIGHT_CHARACTER + 50,
        width: NODE_WIDTH_WIDE,
        data: {
          name: characters.map(c => c.name).join(' / '),
          imageUrl: sharedImageUrl,
          characterId: 'shared',
        },
      });
      characters.forEach((char) => {
        canvas.addEdge({ id: `edge_char_${char.id}_image`, source: `node_char_${char.id}`, target: 'node_char_image_shared' });
      });
    }
  }, [characters]);

  // ── 人物形象图片更新（imageUrl 异步到来时更新已有节点） ──────────
  useEffect(() => {
    if (!characters || !canvasRef.current) return;
    const sharedImageUrl = characters.find(c => c.imageUrl)?.imageUrl;
    if (sharedImageUrl) {
      canvasRef.current.updateNode('node_char_image_shared', { imageUrl: sharedImageUrl });
    }
  }, [characters]);

  // ── 场景节点 + 连线 ───────────────────────────────────────────────
  useEffect(() => {
    if (!sceneBreakdowns?.length || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const sceneY = 50 + PADDING_Y * 2;
    const count = sceneBreakdowns.length;

    sceneBreakdowns.forEach((scene, index) => {
      let x: number;
      if (count === 1) x = CANVAS_CENTER_X - NODE_WIDTH / 2;
      else { const tw = (count - 1) * PADDING_X; x = CANVAS_CENTER_X - tw / 2 + index * PADDING_X; }

      canvas.addNode({
        id: `node_scene_${scene.scene_number}`,
        type: 'scene',
        x, y: sceneY,
        width: NODE_WIDTH,
        data: {
          name: scene.scene_name,
          description: scene.environment,
          environment: scene.environment,
          atmosphere: scene.atmosphere,
          props: scene.props,
          location_type: scene.location_type,
          time_of_day: scene.time_of_day,
          key_visual_elements: scene.key_visual_elements,
        },
      });

      canvas.addEdge({ id: `edge_script_scene_${scene.scene_number}`, source: 'node_script', target: `node_scene_${scene.scene_number}` });
    });
  }, [sceneBreakdowns]);

  // ── 分镜节点 + 连线 ───────────────────────────────────────────────
  useEffect(() => {
    if (!storyboard?.scenes?.length || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const y = 50 + PADDING_Y * 3;

    canvas.addNode({
      id: 'node_storyboard',
      type: 'storyboard',
      x: CANVAS_CENTER_X - NODE_WIDTH_WIDE / 2,
      y,
      width: NODE_WIDTH_WIDE,
      data: {
        label: `分镜矩阵 (${storyboard.rows}×${storyboard.cols})`,
        imageUrl: storyboard.imageUrl,
        frames: storyboard.scenes,
        isHorizontal: true,
      },
    });

    if (sceneBreakdowns?.length) {
      canvas.addEdge({ id: 'edge_scene_storyboard', source: `node_scene_${sceneBreakdowns[0].scene_number}`, target: 'node_storyboard' });
    } else if (characters?.some(c => c.imageUrl)) {
      canvas.addEdge({ id: 'edge_char_image_storyboard', source: 'node_char_image_shared', target: 'node_storyboard' });
    }
  }, [storyboard, sceneBreakdowns, characters]);

  // ── 新节点添加后自动 fitView（等待 React Flow 完成节点渲染） ───────
  useEffect(() => {
    if (!canvasRef.current) return;
    const timer = setTimeout(() => {
      canvasRef.current?.fitView();
    }, 200);
    return () => clearTimeout(timer);
  }, [selectedScreenplay, characters, sceneBreakdowns, storyboard, videos]);

  // ── 视频节点 + 连线 ───────────────────────────────────────────────
  useEffect(() => {
    if (!videos?.length || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const videoY = 50 + PADDING_Y * 4;
    const count = videos.length;

    videos.forEach((video, index) => {
      let x: number;
      if (count === 1) x = CANVAS_CENTER_X - NODE_WIDTH / 2;
      else { const tw = (count - 1) * PADDING_X; x = CANVAS_CENTER_X - tw / 2 + index * PADDING_X; }

      canvas.addNode({
        id: `node_video_${video.id}`,
        type: 'video',
        x, y: videoY,
        width: NODE_WIDTH,
        data: {
          label: video.description ?? '生成的视频',
          url: video.url,
          localPath: video.localPath,
          duration: video.duration ? `${video.duration}s` : undefined,
        },
      });

      if (storyboard?.scenes?.length) {
        canvas.addEdge({ id: `edge_storyboard_video_${video.id}`, source: 'node_storyboard', target: `node_video_${video.id}` });
      }
    });
  }, [videos, storyboard]);

  // 处理节点重新生成
  const handleNodeRegenerate = async (nodeId: string) => {
    console.log('[DirectorMode] 重新生成节点:', nodeId);
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
      if (!screenplayId || !selectedScreenplay || isWorkflowInitialized) return;

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
          directorMode={directorMode}
        />
      </div>

      {/* 右侧:节点画布（始终显示，无内容时显示点阵背景） */}
      <div className="w-3/4 relative">
        <NodeCanvas
          ref={canvasRef}
          onNodeRegenerate={handleNodeRegenerate}
          onPreview={setPreviewItem}
        />
      </div>

      {/* 媒体预览弹窗 */}
      {previewItem && (
        <MediaPreviewModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </div>
  );
}
