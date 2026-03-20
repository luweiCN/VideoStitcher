/**
 * 导演模式 IPC handlers - 集成真实 AI Agent 工作流
 * 处理角色生成、分镜图生成、视频合成
 */

import { ipcMain } from 'electron';
import type { Character, Storyboard } from '@shared/types/aside';
import {
  startWorkflow,
  resumeWorkflow,
  regenerateStep,
  type WorkflowExecutionOptions
} from '@main/ai/workflows/executor';
import type { WorkflowState } from '@main/ai/workflows/state';
import { cinematographerNode } from '@main/ai/workflows/nodes/cinematographer';

// 工作流状态缓存（临时方案，后续可存数据库）
const workflowStates = new Map<string, WorkflowState>();

/**
 * 将工作流角色转换为前端 Character 类型
 */
function convertToCharacter(artDirectorOutput: any): any[] {
  if (!artDirectorOutput || !artDirectorOutput.character_profiles) {
    console.warn('[DirectorMode] 角色数据为空或格式错误');
    return [];
  }

  const profiles = artDirectorOutput.character_profiles;

  if (!Array.isArray(profiles)) {
    console.warn('[DirectorMode] character_profiles 不是数组');
    return [];
  }

  console.log('[DirectorMode] convertToCharacter 输入数据:', profiles);

  const result = profiles.map((profile, index) => {
    // 保留所有结构化字段，同时生成 description 作为完整描述
    const description = [
      `【${profile.role_type === 'protagonist' ? '主角' : profile.role_type === 'antagonist' ? '反派' : '配角'}】`,
      `外貌：${profile.appearance}`,
      `服装：${profile.costume}`,
      `性格：${profile.personality_traits?.join('、')}`,
      `关键动作：${profile.key_actions?.join('、')}`,
    ].filter(Boolean).join('\n');

    // 关键修复：优先使用 profile.id（来自 LangGraph），确保 ID 一致性
    const characterId = profile.id || `char-${Date.now()}-${index}`;

    const character = {
      id: characterId,
      name: profile.name,
      description, // 完整描述文本
      // 保留结构化字段供前端使用
      role_type: profile.role_type,
      appearance: profile.appearance,
      costume: profile.costume,
      personality_traits: profile.personality_traits,
      key_actions: profile.key_actions,
      image_generation_prompt: profile.image_generation_prompt,
      imageUrl: undefined, // 暂时没有真实图片，后续选角导演会生成
    };

    console.log(`[DirectorMode] 转换角色 ${index + 1}:`, {
      id: characterId,
      hasProfileId: !!profile.id,
      name: profile.name,
    });

    return character;
  });

  console.log('[DirectorMode] convertToCharacter 输出数据:', result.map(c => ({ id: c.id, name: c.name })));
  return result;
}

/**
 * 将工作流分镜图转换为前端 Storyboard 类型
 */
function convertToStoryboard(framesData: any): Storyboard {
  if (!framesData || !framesData.frames || !Array.isArray(framesData.frames)) {
    console.warn('[DirectorMode] 分镜数据为空或格式错误');
    return {
      id: `storyboard-${Date.now()}`,
      rows: 0,
      cols: 5,
      imageUrl: '',
      scenes: [],
    };
  }

  const frames = framesData.frames;
  // 使用后端返回的行列数，默认5x5
  const cols = framesData.cols || 5;
  const rows = framesData.rows || 5;

  // 所有帧共用同一个分镜大图URL
  const storyboardImageUrl = framesData.imageUrl || '';

  return {
    id: `storyboard-${Date.now()}`,
    rows,
    cols,
    imageUrl: storyboardImageUrl, // 分镜大图URL（5x5网格）
    scenes: frames.map((frame: any) => ({
      id: frame.id,
      index: frame.frameNumber,
      description: frame.description,
      // 不设置imageUrl，因为所有帧共用顶层的大图
    })),
  };
}

/**
 * 注册导演模式 IPC handlers
 */
export function registerDirectorModeHandlers() {
  // ===== 生成角色 =====
  ipcMain.handle('aside:generate-characters', async (event, screenplayId: string, videoSpec?: { duration: 'short' | 'long'; aspectRatio: '16:9' | '9:16' }) => {
    console.log('[DirectorMode] 生成角色，剧本 ID:', screenplayId);

    try {
      // 从缓存获取工作流状态
      let state = workflowStates.get(screenplayId);

      // 如果工作流不存在，自动初始化（从步骤2开始，因为步骤1剧本写作已独立完成）
      if (!state) {
        console.log('[DirectorMode] 工作流不存在，自动初始化（从步骤2开始）');

        // 从数据库获取剧本信息
        const { AsideScreenplayRepository } = await import('@main/database/repositories/asideScreenplayRepository');
        const screenplayRepo = new AsideScreenplayRepository();
        const screenplay = screenplayRepo.getScreenplayById(screenplayId);
        if (!screenplay) {
          throw new Error(`剧本不存在: ${screenplayId}`);
        }

        console.log('[DirectorMode] 已加载剧本:', screenplay.title);

        // 使用默认视频规格（如果没有提供）
        const defaultVideoSpec = videoSpec || { duration: 'short', aspectRatio: '9:16' };

        // 创建初始状态（标记步骤1已完成，剧本已在外部生成）
        const { createInitialWorkflowState } = await import('@main/ai/workflows/state');
        const initialState = createInitialWorkflowState({
          scriptContent: screenplay.content,
          projectId: screenplay.projectId,
          executionMode: 'director',
          videoSpec: defaultVideoSpec,
        });

        console.log('[DirectorMode] 工作流已初始化，跳过步骤1（剧本写作已独立完成）');
        console.log('[DirectorMode] 当前步骤1状态:', !!initialState.step1_script);

        state = initialState;
        workflowStates.set(screenplayId, state);
      }

      // 恢复工作流执行（从当前状态继续，应该是步骤2）
      console.log('[DirectorMode] 当前工作流状态:', {
        hasStep1: !!state.step1_script,
        hasStep2: !!state.step2_characters,
        hasStep3: !!state.step3_storyboard,
        hasStep4: !!state.step4_video,
        hasStep5: !!state.step5_final,
      });

      // 定义进度回调：发送 IPC 事件到前端
      const onProgress = (progressEvent: any) => {
        console.log('[DirectorMode] 进度事件:', progressEvent);
        event.sender.send('aside:workflow:progress', {
          screenplayId,
          ...progressEvent,
        });
      };

      const result = await resumeWorkflow(state, onProgress);

      if (!result.success) {
        throw new Error(result.error || '工作流恢复失败');
      }

      if (!result.state?.step2_characters?.content) {
        console.error('[DirectorMode] 角色生成结果:', result.state?.step2_characters);
        throw new Error('角色生成失败：未生成任何角色');
      }

      const artDirectorOutput = result.state.step2_characters.content;

      // 检查是否是艺术总监的输出对象（包含 character_profiles 字段）
      if (!artDirectorOutput || !artDirectorOutput.character_profiles) {
        console.warn('[DirectorMode] 艺术总监输出格式错误:', artDirectorOutput);
        throw new Error('艺术总监输出格式错误：缺少 character_profiles 字段');
      }

      const profiles = artDirectorOutput.character_profiles;

      if (!Array.isArray(profiles) || profiles.length === 0) {
        console.warn('[DirectorMode] 角色数量为 0，可能是 LLM 解析失败');
        throw new Error('艺术总监未生成任何角色');
      }

      // 调试：打印每个角色的完整数据
      profiles.forEach((profile, i) => {
        console.log(`[DirectorMode] 角色 ${i + 1}:`, {
          id: profile.id,
          name: profile.name,
          role_type: profile.role_type,
          hasAppearance: !!profile.appearance,
        });
      });

      // 更新缓存
      workflowStates.set(screenplayId, result.state);

      // 关键修复：只调用一次 convertToCharacter，避免 ID 不一致
      const convertedCharacters = convertToCharacter(artDirectorOutput);

      // 发送角色生成完成事件（包含场景信息）
      event.sender.send('aside:workflow:characters', {
        screenplayId,
        characters: convertedCharacters,
        scene_breakdowns: artDirectorOutput.scene_breakdowns || [], // 添加场景信息
        message: '我为本剧本设计了如下的角色和场景，您看是否需要修改',
      });

      return {
        success: true,
        characters: convertedCharacters,
      };
    } catch (error) {
      console.error('[DirectorMode] 生成角色失败:', error);

      // 发送错误事件
      event.sender.send('aside:workflow:error', {
        screenplayId,
        step: 2,
        error: (error as Error).message,
        timestamp: Date.now(),
      });

      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // ===== 添加角色 =====
  ipcMain.handle('aside:add-character', async (_event, data: { screenplayId: string; name: string; description: string }) => {
    console.log('[DirectorMode] 添加角色:', data.name);

    try {
      const state = workflowStates.get(data.screenplayId);
      if (!state) {
        throw new Error('工作流状态不存在');
      }

      // 创建新角色
      const newCharacter = {
        id: `char-${Date.now()}`,
        name: data.name,
        description: data.description,
        imageUrl: undefined, // 用户上传的角色可能没有图片
      };

      // 添加到现有角色列表
      if (state.step2_characters) {
        state.step2_characters.content.push({
          id: newCharacter.id,
          name: newCharacter.name,
          description: newCharacter.description,
          imageUrl: newCharacter.imageUrl || '',
        });
      }

      return {
        success: true,
        character: newCharacter,
      };
    } catch (error) {
      console.error('[DirectorMode] 添加角色失败:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // ===== 编辑角色 =====
  ipcMain.handle('aside:edit-character', async (_event, data: { characterId: string; name: string; description: string }) => {
    console.log('[DirectorMode] 编辑角色:', data.characterId);

    // TODO: 更新数据库或工作流状态
    return {
      success: true,
    };
  });

  // ===== 重新生成角色 =====
  ipcMain.handle('aside:regenerate-character', async (event, characterId: string) => {
    console.log('[DirectorMode] 重新生成角色:', characterId);

    try {
      // 找到对应的工作流状态
      let targetScreenplayId: string | null = null;
      let targetState: WorkflowState | null = null;

      for (const [screenplayId, state] of workflowStates.entries()) {
        if (state.step2_characters?.content.some((c) => c.id === characterId)) {
          targetScreenplayId = screenplayId;
          targetState = state;
          break;
        }
      }

      if (!targetState || !targetScreenplayId) {
        throw new Error('找不到角色对应的工作流');
      }

      // 定义进度回调：发送 IPC 事件到前端
      const onProgress = (progressEvent: any) => {
        console.log('[DirectorMode] 重新生成角色进度:', progressEvent);
        event.sender.send('aside:workflow:progress', {
          screenplayId: targetScreenplayId,
          ...progressEvent,
        });
      };

      // 重新生成角色（带进度回调）
      const result = await regenerateStep(targetState, 2, onProgress);

      if (!result.success || !result.state?.step2_characters) {
        throw new Error(result.error || '重新生成角色失败');
      }

      // 更新缓存
      workflowStates.set(targetScreenplayId, result.state);

      // 返回更新后的角色
      const updatedCharacter = result.state.step2_characters.content.find((c) => c.id === characterId);

      return {
        success: true,
        character: updatedCharacter ? {
          id: updatedCharacter.id,
          name: updatedCharacter.name,
          description: updatedCharacter.description,
          imageUrl: updatedCharacter.imageUrl,
        } : undefined,
      };
    } catch (error) {
      console.error('[DirectorMode] 重新生成角色失败:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // ===== 生成分镜图 =====
  ipcMain.handle('aside:generate-storyboard', async (event, screenplayId: string) => {
    console.log('[DirectorMode] 生成分镜图，剧本 ID:', screenplayId);

    try {
      const state = workflowStates.get(screenplayId);
      if (!state) {
        throw new Error('工作流状态不存在');
      }

      // 确保步骤 1 和 2 已完成
      if (!state.step1_script || !state.step2_characters) {
        throw new Error('步骤 1 和 2 尚未完成');
      }

      // 定义进度回调：发送 IPC 事件到前端
      const onProgress = async (progressEvent: any) => {
        console.log('[DirectorMode] 分镜进度事件:', progressEvent);
        event.sender.send('aside:workflow:progress', {
          screenplayId,
          ...progressEvent,
        });

        // 步骤 3（选角导演）完成后，立即发送角色更新事件（包含图片）
        if (progressEvent.step === 3 && progressEvent.status === 'completed') {
          const currentState = workflowStates.get(screenplayId);
          if (currentState?.step3_storyboard?.content?.character_profiles) {
            const updatedCharacters = convertToCharacter(currentState.step3_storyboard.content);
            console.log('[DirectorMode] 选角导演完成，发送角色更新（包含图片）');

            event.sender.send('aside:workflow:characters', {
              screenplayId,
              characters: updatedCharacters,
              message: '已为所有角色生成三视图（正面、侧面、动作）',
            });
          }
        }
      };

      // 恢复工作流执行（从步骤 2 继续执行步骤 3-4）
      const result = await resumeWorkflow(state, onProgress);

      if (!result.success) {
        throw new Error(result.error || '分镜图生成失败');
      }

      if (!result.state?.step4_video?.content) {
        console.error('[DirectorMode] 分镜生成结果:', result.state?.step4_video);
        throw new Error('分镜图生成失败：未生成任何分镜');
      }

      // 更新缓存
      workflowStates.set(screenplayId, result.state);

      // 发送分镜图生成完成事件
      const storyboard = convertToStoryboard(result.state.step4_video.content);
      event.sender.send('aside:workflow:storyboard', {
        screenplayId,
        storyboard,
        message: '分镜图已生成',
      });

      return {
        success: true,
        storyboard,
      };
    } catch (error) {
      console.error('[DirectorMode] 生成分镜图失败:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // ===== 重新生成分镜图 =====
  ipcMain.handle('aside:regenerate-storyboard', async (event, storyboardId: string) => {
    console.log('[DirectorMode] 重新生成分镜图:', storyboardId);

    try {
      // 找到对应的工作流状态
      let targetScreenplayId: string | null = null;
      let targetState: WorkflowState | null = null;

      for (const [screenplayId, state] of workflowStates.entries()) {
        if (state.step3_storyboard) {
          targetScreenplayId = screenplayId;
          targetState = state;
          break;
        }
      }

      if (!targetState || !targetScreenplayId) {
        throw new Error('找不到分镜图对应的工作流');
      }

      // 定义进度回调：发送 IPC 事件到前端
      const onProgress = (progressEvent: any) => {
        console.log('[DirectorMode] 重新生成分镜进度:', progressEvent);
        event.sender.send('aside:workflow:progress', {
          screenplayId: targetScreenplayId,
          ...progressEvent,
        });
      };

      // 重新生成分镜图（带进度回调）
      const result = await regenerateStep(targetState, 3, onProgress);

      if (!result.success) {
        throw new Error(result.error || '重新生成分镜图失败');
      }

      if (!result.state?.step3_storyboard?.content) {
        console.error('[DirectorMode] 分镜重新生成结果:', result.state?.step3_storyboard);
        throw new Error('重新生成分镜图失败：未生成任何分镜');
      }

      // 更新缓存
      workflowStates.set(targetScreenplayId, result.state);

      return {
        success: true,
        storyboard: convertToStoryboard(result.state.step3_storyboard.content),
      };
    } catch (error) {
      console.error('[DirectorMode] 重新生成分镜图失败:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // ===== 合成视频 =====
  ipcMain.handle('aside:compose-video', async (event, screenplayId: string) => {
    console.log('[DirectorMode] 合成视频.剧本 ID:', screenplayId);

    try {
      const state = workflowStates.get(screenplayId);
      if (!state) {
        throw new Error('工作流状态不存在');
      }

      // 检查是否有分镜图
      if (!state.step4_video?.content) {
        throw new Error('缺少分镜图，无法合成视频');
      }

      // 直接调用摄像师节点生成视频
      console.log('[DirectorMode] 开始调用摄像师节点生成视频');

      // 发送进度事件
      event.sender.send('aside:workflow:progress', {
        screenplayId,
        step: 5,
        nodeName: 'cinematographer',
        status: 'started',
        message: '开始合成视频',
        timestamp: Date.now(),
      });

      // 执行摄像师节点
      const nodeResult = await cinematographerNode(state);

      // 更新状态
      const newState = { ...state, ...nodeResult } as WorkflowState;
      workflowStates.set(screenplayId, newState);

      // 发送完成事件
      event.sender.send('aside:workflow:progress', {
        screenplayId,
        step: 5,
        nodeName: 'cinematographer',
        status: 'completed',
        message: '视频合成完成',
        timestamp: Date.now(),
      });

      // 发送视频生成完成事件
      if (newState.step5_final?.content) {
        event.sender.send('aside:workflow:video', {
          screenplayId,
          videoUrl: newState.step5_final.content.videoUrl,
          totalDuration: newState.step5_final.content.totalDuration,
          message: '视频已生成',
        });
      }

      return {
        success: true,
        videoUrl: newState.step5_final?.content?.videoUrl,
      };
    } catch (error) {
      console.error('[DirectorMode] 合成视频失败:', error);

      // 发送错误事件
      event.sender.send('aside:workflow:error', {
        screenplayId,
        step: 5,
        error: (error as Error).message,
        timestamp: Date.now(),
      });

      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // ===== 生成人物形象（所有角色共用一张大图） =====
  ipcMain.handle('aside:generate-character-image', async (event, data: {
    screenplayId: string;
    characterId: string;
    useReference: boolean;
  }) => {
    console.log('[DirectorMode] 生成人物形象（所有角色共用一张大图）:', data);

    try {
      const state = workflowStates.get(data.screenplayId);
      if (!state) {
        throw new Error('工作流状态不存在');
      }

      // 1. 获取所有角色的图像生成提示词
      const artDirectorOutput = state.step2_characters?.content;
      if (!artDirectorOutput || !artDirectorOutput.character_profiles) {
        throw new Error('艺术总监输出不存在');
      }

      const allCharacters = artDirectorOutput.character_profiles;
      console.log(`[DirectorMode] 共 ${allCharacters.length} 个角色，生成一张包含所有角色的大图`);

      // 2. 构建所有角色的三视图提示词
      const characterDescriptions = allCharacters.map((char: any, index: number) => {
        const prompt = char.image_generation_prompt || `${char.appearance}, ${char.costume}`;
        return `Character ${index + 1} (${char.name}): ${prompt}`;
      }).join('; ');

      // 构建网格布局提示词
      let layoutPrompt: string;
      if (allCharacters.length === 1) {
        // 一个角色：一行三视图
        layoutPrompt = 'character reference sheet, single row layout with three views: front view (facing camera), side view (profile from right), back view (facing away from camera), white background, professional character design';
      } else {
        // 多个角色：多行，每行一个角色的三视图
        const rows = allCharacters.map((char: any, index: number) =>
          `Row ${index + 1}: ${char.name} three views (front, side, back)`
        ).join(', ');
        layoutPrompt = `character reference sheet, ${allCharacters.length} rows layout, each row contains one character with three views (front, side, back), grid arrangement, white background, professional character design, ${rows}`;
      }

      // 构建完整的提示词，强调风格一致性
      const fullPrompt = `${characterDescriptions}. ${layoutPrompt}, high quality, detailed, consistent art style across all characters and all views, photorealistic style, same lighting condition, same rendering quality, no text, no labels, no watermarks`;

      console.log('[DirectorMode] 使用合并提示词（所有角色）:', fullPrompt.substring(0, 200));

      // 3. 发送进度事件
      event.sender.send('aside:workflow:progress', {
        screenplayId: data.screenplayId,
        step: 3,
        nodeName: 'casting_director',
        status: 'started',
        message: `开始生成 ${allCharacters.length} 个角色的形象（共用一张图）`,
        timestamp: Date.now(),
      });

      // 4. 获取全局 AI Provider
      const { getGlobalProvider } = await import('@main/ai/provider-manager');
      const provider = getGlobalProvider();

      // 5. 调用图像生成 API（使用 2K 尺寸满足火山引擎要求）
      console.log('[DirectorMode] 调用图像生成 API（生成所有角色的大图）...');
      const result = await provider.generateImage(fullPrompt, {
        size: '2K', // 2560x1440 = 3,686,400 像素
        quality: 'hd',
        numberOfImages: 1,
      });

      if (!result.images || result.images.length === 0) {
        throw new Error('图像生成失败：未返回图像');
      }

      const imageUrl = result.images[0].url;
      console.log('[DirectorMode] 所有角色形象生成完成（共用一张图）:', imageUrl);

      // 6. 更新工作流状态中的所有角色图像（共用同一个 URL）
      if (state.step3_storyboard?.content?.character_profiles) {
        for (const profile of state.step3_storyboard.content.character_profiles) {
          profile.imageUrl = imageUrl;
        }
        console.log('[DirectorMode] 已更新所有角色的 imageUrl（共用同一张图）');
      }

      // 7. 发送完成事件
      event.sender.send('aside:workflow:progress', {
        screenplayId: data.screenplayId,
        step: 3,
        nodeName: 'casting_director',
        status: 'completed',
        message: `所有角色形象生成完成（共用一张图）`,
        timestamp: Date.now(),
      });

      return {
        success: true,
        imageUrl,
      };
    } catch (error) {
      console.error('[DirectorMode] 生成人物形象失败:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // ===== 初始化工作流（供内部调用） =====
  ipcMain.handle('aside:init-director-workflow', async (_event, data: {
    screenplayId: string;
    scriptContent: string;
    videoSpec: { duration: 'short' | 'long'; aspectRatio: '16:9' | '9:16' };
    projectId: string;
    creativeDirectionId?: string;
    personaId?: string;
  }) => {
    console.log('[DirectorMode] 初始化工作流，剧本 ID:', data.screenplayId);

    try {
      // 强制重置工作流图实例，确保使用最新配置
      const { resetVideoProductionGraph } = await import('@main/ai/workflows/graph');
      resetVideoProductionGraph();
      console.log('[DirectorMode] 工作流图实例已重置');

      // 从数据库加载项目信息
      const { AsideProjectRepository } = await import('@main/database/repositories/asideProjectRepository');
      const projectRepo = new AsideProjectRepository();
      const project = projectRepo.getProjectById(data.projectId);
      if (!project) {
        throw new Error(`项目不存在: ${data.projectId}`);
      }
      console.log('[DirectorMode] 已加载项目:', project.name);

      // 从数据库加载创意方向
      let creativeDirection = undefined;
      if (data.creativeDirectionId) {
        const { asideCreativeDirectionRepository } = await import('@main/database/repositories/asideCreativeDirectionRepository');
        const directions = asideCreativeDirectionRepository.getCreativeDirections(data.projectId);
        creativeDirection = directions.find(d => d.id === data.creativeDirectionId);
        if (!creativeDirection) {
          console.warn('[DirectorMode] 创意方向不存在:', data.creativeDirectionId);
        } else {
          console.log('[DirectorMode] 已加载创意方向:', creativeDirection.name);
        }
      }

      // 从数据库加载人设
      let persona = undefined;
      if (data.personaId) {
        const { asidePersonaRepository } = await import('@main/database/repositories/asidePersonaRepository');
        const personas = asidePersonaRepository.getPersonas(data.projectId);
        persona = personas.find(p => p.id === data.personaId);
        if (!persona) {
          console.warn('[DirectorMode] 人设不存在:', data.personaId);
        } else {
          console.log('[DirectorMode] 已加载人设:', persona.name);
        }
      }

      // 创建初始工作流状态（不执行任何 agent）
      const { createInitialWorkflowState } = await import('@main/ai/workflows/state');
      const initialState = createInitialWorkflowState({
        scriptContent: data.scriptContent,
        projectId: data.projectId,
        executionMode: 'director',
        videoSpec: data.videoSpec,
        project: project,
        creativeDirection: creativeDirection,
        persona: persona,
        region: data.region,
      });

      // 缓存工作流状态（不执行，等用户点击"生成角色"时才执行）
      workflowStates.set(data.screenplayId, initialState);

      console.log('[DirectorMode] 工作流已初始化（未执行），等待用户点击"生成角色"');
      console.log('[DirectorMode] 当前缓存数量:', workflowStates.size);

      return {
        success: true,
        state: initialState,
      };
    } catch (error) {
      console.error('[DirectorMode] 初始化工作流失败:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });
}
