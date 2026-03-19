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

// 工作流状态缓存（临时方案，后续可存数据库）
const workflowStates = new Map<string, WorkflowState>();

/**
 * 将工作流角色转换为前端 Character 类型
 */
function convertToCharacter(artDirectorOutput: any): Character[] {
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
    // 合并所有描述信息
    const description = [
      `【${profile.role_type === 'protagonist' ? '主角' : profile.role_type === 'antagonist' ? '反派' : '配角'}】`,
      `外貌：${profile.appearance}`,
      `服装：${profile.costume}`,
      `性格：${profile.personality_traits?.join('、')}`,
      `关键动作：${profile.key_actions?.join('、')}`,
      `图片生成提示词：${profile.image_generation_prompt}`, // 添加提示词信息
    ].filter(Boolean).join('\n');

    const character = {
      id: profile.id || `char-${Date.now()}-${index}`,
      name: profile.name,
      description,
      imageUrl: undefined, // 暂时没有真实图片，后续选角导演会生成
    };

    console.log(`[DirectorMode] 转换角色 ${index + 1}:`, character);

    return character;
  });

  console.log('[DirectorMode] convertToCharacter 输出数据:', result);
  return result;
}

/**
 * 将工作流分镜图转换为前端 Storyboard 类型
 */
function convertToStoryboard(frames: any[] | undefined): Storyboard {
  if (!frames || !Array.isArray(frames)) {
    console.warn('[DirectorMode] 分镜数据为空或格式错误');
    return {
      id: `storyboard-${Date.now()}`,
      rows: 0,
      cols: 3,
      scenes: [],
    };
  }

  // 计算 3x3 网格
  const cols = 3;
  const rows = Math.ceil(frames.length / cols);

  return {
    id: `storyboard-${Date.now()}`,
    rows,
    cols,
    scenes: frames.map((frame) => ({
      id: frame.id,
      index: frame.frameNumber,
      description: frame.description,
      imageUrl: frame.imageUrl,
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
          name: profile.name,
          role_type: profile.role_type,
          hasAppearance: !!profile.appearance,
        });
      });

      // 更新缓存
      workflowStates.set(screenplayId, result.state);

      // 发送角色生成完成事件
      event.sender.send('aside:workflow:characters', {
        screenplayId,
        characters: convertToCharacter(artDirectorOutput),
        message: '我为本剧本设计了如下的角色和场景，您看是否需要修改',
      });

      return {
        success: true,
        characters: convertToCharacter(artDirectorOutput),
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
      const onProgress = (progressEvent: any) => {
        console.log('[DirectorMode] 分镜进度事件:', progressEvent);
        event.sender.send('aside:workflow:progress', {
          screenplayId,
          ...progressEvent,
        });
      };

      // 恢复工作流执行（从步骤 2 继续执行步骤 3-4）
      const result = await resumeWorkflow(state, onProgress);

      if (!result.success) {
        throw new Error(result.error || '分镜图生成失败');
      }

      if (!result.state?.step3_storyboard?.content) {
        console.error('[DirectorMode] 分镜生成结果:', result.state?.step3_storyboard);
        throw new Error('分镜图生成失败：未生成任何分镜');
      }

      // 更新缓存
      workflowStates.set(screenplayId, result.state);

      return {
        success: true,
        storyboard: convertToStoryboard(result.state.step3_storyboard.content),
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
  ipcMain.handle('aside:compose-video', async (_event, screenplayId: string) => {
    console.log('[DirectorMode] 合成视频.剧本 ID:', screenplayId);

    try {
      const state = workflowStates.get(screenplayId);
      if (!state) {
        throw new Error('工作流状态不存在');
      }

      // 执行步骤 4: 摄像导演
      const result = await regenerateStep(state, 4);

      if (!result.success || !result.state?.step5_final) {
        throw new Error(result.error || '视频合成失败');
      }

      // 更新缓存
      workflowStates.set(screenplayId, result.state);

      return {
        success: true,
        videoUrl: result.state.step5_final.content.videoUrl,
      };
    } catch (error) {
      console.error('[DirectorMode] 合成视频失败:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // ===== 生成人物形象 =====
  ipcMain.handle('aside:generate-character-image', async (_event, data: {
    screenplayId: string;
    characterId: string;
    useReference: boolean;
  }) => {
    console.log('[DirectorMode] 生成人物形象:', data);

    try {
      const state = workflowStates.get(data.screenplayId);
      if (!state) {
        throw new Error('工作流状态不存在');
      }

      // 1. 获取角色的图像生成提示词
      const artDirectorOutput = state.step2_characters?.content;
      if (!artDirectorOutput || !artDirectorOutput.character_profiles) {
        throw new Error('艺术总监输出不存在');
      }

      // 查找对应角色
      const character = artDirectorOutput.character_profiles.find(
        (profile: any) => profile.id === data.characterId
      );

      if (!character) {
        throw new Error(`找不到角色: ${data.characterId}`);
      }

      // 获取图像生成提示词
      const imagePrompt = character.image_generation_prompt;
      if (!imagePrompt) {
        throw new Error('角色缺少图像生成提示词');
      }

      console.log('[DirectorMode] 使用提示词:', imagePrompt.substring(0, 100));

      // 2. 获取全局 AI Provider
      const { getGlobalProvider } = await import('@main/ai/provider-manager');
      const provider = getGlobalProvider();

      // 3. 调用图像生成 API
      console.log('[DirectorMode] 调用图像生成 API...');
      const result = await provider.generateImage(imagePrompt, {
        size: '1024x1024',
        quality: 'hd',
        numberOfImages: 1,
      });

      if (!result.images || result.images.length === 0) {
        throw new Error('图像生成失败：未返回图像');
      }

      const imageUrl = result.images[0].url;
      console.log('[DirectorMode] 人物形象生成完成:', imageUrl);

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
