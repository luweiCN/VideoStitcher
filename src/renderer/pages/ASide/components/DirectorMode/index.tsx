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
import { ScreenplayEditModal } from '../ScreenplayGenerator/ScreenplayEditModal';

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
  /** 当前正在编辑的剧本 */
  const [editingScreenplay, setEditingScreenplay] = useState<{ id: string; content: string } | null>(null);

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
      data: { text: selectedScreenplay.content, screenplayId: selectedScreenplay.id },
    });
  }, [selectedScreenplay]);

  // ── 人物节点 + 场景节点（同一排）─────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const y = 50 + PADDING_Y;

    // 计算总宽度和起始位置
    const charCount = characters?.length || 0;
    const sceneCount = sceneBreakdowns?.length || 0;
    const totalCount = charCount + sceneCount;

    if (totalCount === 0) return;

    // 计算所有节点的总宽度（包括间距）
    const totalWidth = (totalCount - 1) * PADDING_X;
    const startX = CANVAS_CENTER_X - totalWidth / 2;

    // 先添加人物节点
    characters?.forEach((char, index) => {
      const x = startX + index * PADDING_X;

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

    // 再添加场景节点（紧挨着人物节点）
    sceneBreakdowns?.forEach((scene, index) => {
      const x = startX + (charCount + index) * PADDING_X;

      canvas.addNode({
        id: `node_scene_${scene.scene_number}`,
        type: 'scene',
        x, y,
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
  }, [characters, sceneBreakdowns]);

  // ── 人物形象图片更新（imageUrl 异步到来时更新已有节点） ──────────
  useEffect(() => {
    if (!characters || !canvasRef.current) return;
    const sharedImageUrl = characters.find(c => c.imageUrl)?.imageUrl;
    if (sharedImageUrl) {
      canvasRef.current.updateNode('node_char_image_shared', { imageUrl: sharedImageUrl });
    }
  }, [characters]);

  // ── 共享形象节点（放在人物/场景节点下方）─────────────────────────────
  useEffect(() => {
    if (!characters?.length || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const sharedImageUrl = characters.find(c => c.imageUrl)?.imageUrl;
    if (!sharedImageUrl) return;

    const y = 50 + PADDING_Y + NODE_HEIGHT_CHARACTER + 50;

    canvas.addNode({
      id: 'node_char_image_shared',
      type: 'character-image',
      x: CANVAS_CENTER_X - NODE_WIDTH_WIDE / 2,
      y,
      width: NODE_WIDTH_WIDE,
      data: {
        name: characters.map(c => c.name).join(' / '),
        imageUrl: sharedImageUrl,
        characterId: 'shared',
      },
    });

    // 所有人物节点连线到共享形象
    characters.forEach((char) => {
      canvas.addEdge({ id: `edge_char_${char.id}_image`, source: `node_char_${char.id}`, target: 'node_char_image_shared' });
    });
  }, [characters]);

  // ── 分镜节点 + 连线（放在共享形象下方，场景和共享形象都连到分镜图）──────────
  useEffect(() => {
    if (!storyboard?.scenes?.length || !canvasRef.current) return;
    const canvas = canvasRef.current;
    // 分镜节点放在共享形象节点下方（如果有）或人物/场景节点下方
    const hasCharImage = characters?.some(c => c.imageUrl);
    const storyboardY = hasCharImage
      ? 50 + PADDING_Y + NODE_HEIGHT_CHARACTER + 50 + 400 + 100  // 共享形象下方
      : 50 + PADDING_Y + NODE_HEIGHT_CHARACTER + 100;            // 人物/场景节点下方

    canvas.addNode({
      id: 'node_storyboard',
      type: 'storyboard',
      x: CANVAS_CENTER_X - NODE_WIDTH_WIDE / 2,
      y: storyboardY,
      width: NODE_WIDTH_WIDE,
      data: {
        label: `分镜矩阵 (${storyboard.rows}×${storyboard.cols})`,
        imageUrl: storyboard.imageUrl,
        frames: storyboard.scenes,
        isHorizontal: true,
      },
    });

    // 场景节点连线到分镜图（所有场景都连）
    if (sceneBreakdowns?.length) {
      sceneBreakdowns.forEach((scene) => {
        canvas.addEdge({
          id: `edge_scene_${scene.scene_number}_storyboard`,
          source: `node_scene_${scene.scene_number}`,
          target: 'node_storyboard'
        });
      });
    }

    // 共享形象节点也连线到分镜图
    if (hasCharImage) {
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
    // 视频节点放在分镜节点下方
    const hasCharImage = characters?.some(c => c.imageUrl);
    const storyboardY = hasCharImage
      ? 50 + PADDING_Y + NODE_HEIGHT_CHARACTER + 50 + 400 + 100
      : 50 + PADDING_Y + NODE_HEIGHT_CHARACTER + 100;
    const videoY = storyboardY + 400 + 100; // 分镜节点高度约400 + 间距
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
  }, [videos, storyboard, characters]);

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

  /** 始终持有最新的剧本内容，避免 onEdit 闭包捕获旧值 */
  const currentScreenplayContentRef = useRef(selectedScreenplay?.content ?? '');
  useEffect(() => {
    if (selectedScreenplay) {
      currentScreenplayContentRef.current = selectedScreenplay.content;
    }
  }, [selectedScreenplay]);

  // 处理节点编辑（当前仅 script 节点触发）
  const handleNodeEdit = (_nodeId: string, data: any) => {
    const sid = (data.screenplayId as string) ?? screenplayId;
    setEditingScreenplay({ id: sid, content: currentScreenplayContentRef.current });
  };

  // 剧本编辑保存：更新画布节点的展示内容
  const handleScreenplaySaved = (newContent: string) => {
    currentScreenplayContentRef.current = newContent;
    canvasRef.current?.updateNode('node_script', { text: newContent });
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
          onNodeEdit={handleNodeEdit}
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

      {/* 剧本编辑弹窗 */}
      {editingScreenplay && (
        <ScreenplayEditModal
          screenplayId={editingScreenplay.id}
          content={editingScreenplay.content}
          onClose={() => setEditingScreenplay(null)}
          onSaved={handleScreenplaySaved}
        />
      )}
    </div>
  );
}
