/**
 * AI 视频生产 IPC 处理器
 *
 * 功能：
 * 1. 生成脚本
 * 2. 加载风格模板
 * 3. 保存会话
 * 4. 加载会话
 */

import { ipcMain, app } from 'electron';
import log from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { asideProjectRepository } from '../database/repositories/asideProjectRepository';
import { asideCreativeDirectionRepository } from '../database/repositories/asideCreativeDirectionRepository';
import { asidePersonaRepository } from '../database/repositories/asidePersonaRepository';
import { asideScreenplayRepository } from '../database/repositories/asideScreenplayRepository';
import type { GameType, AIModel } from '@shared/types/aside';

// 使用 logger
const logger = log;

// ==================== 类型定义 ====================

/**
 * 脚本生成请求
 */
export interface GenerateScriptsRequest {
  /** 用户需求描述 */
  userRequirement: string;
  /** 选择的脚本风格 */
  selectedStyle: string;
  /** 批量生成数量 */
  batchSize: number;
}

/**
 * 脚本数据
 */
export interface Script {
  /** 脚本唯一标识 */
  id: string;
  /** 脚本文本内容 */
  text: string;
  /** 脚本风格 */
  style: string;
  /** 创建时间 */
  createdAt: number;
  /** 是否选中 */
  selected?: boolean;
}

/**
 * 风格模板
 */
export interface StyleTemplate {
  /** 模板 ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 模板描述 */
  description: string;
  /** 模板图标 */
  icon?: string;
  /** 创建时间 */
  createdAt: number;
}

/**
 * 会话数据
 */
export interface SessionData {
  /** 会话 ID */
  id: string;
  /** 会话名称 */
  name: string;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 会话状态数据 */
  state: any;
}

// ==================== 辅助函数 ====================

/**
 * 获取会话存储目录
 */
function getSessionsDir(): string {
  const userDataPath = app.getPath('userData');
  const sessionsDir = path.join(userDataPath, 'ai-sessions');

  // 确保目录存在
  if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
  }

  return sessionsDir;
}

/**
 * 获取会话文件路径
 */
function getSessionFilePath(sessionId: string): string {
  return path.join(getSessionsDir(), `${sessionId}.json`);
}

// ==================== IPC 处理器 ====================

/**
 * 加载风格模板
 */
async function handleLoadStyles(): Promise<{ success: boolean; styles?: StyleTemplate[]; error?: string }> {
  logger.info('[AI 处理器] 加载风格模板');

  try {
    // TODO: 从配置文件或数据库加载风格模板
    // 这里先用模拟数据
    const styles: StyleTemplate[] = [
      {
        id: 'humorous',
        name: '幽默搞笑',
        description: '轻松幽默，引人发笑的风格',
        icon: '😂',
        createdAt: Date.now(),
      },
      {
        id: 'suspense',
        name: '悬疑推理',
        description: '扣人心弦，充满悬念的风格',
        icon: '🔍',
        createdAt: Date.now(),
      },
      {
        id: 'educational',
        name: '教学科普',
        description: '知识性强，易于理解的风格',
        icon: '📚',
        createdAt: Date.now(),
      },
      {
        id: 'dramatic',
        name: '剧情叙事',
        description: '故事性强，情感丰富的风格',
        icon: '🎬',
        createdAt: Date.now(),
      },
      {
        id: 'news',
        name: '新闻解说',
        description: '客观中立，信息量大的风格',
        icon: '📰',
        createdAt: Date.now(),
      },
    ];

    logger.info('[AI 处理器] 风格模板加载完成', { count: styles.length });

    return { success: true, styles };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[AI 处理器] 加载风格模板失败', errorMessage);

    return { success: false, error: errorMessage };
  }
}

/**
 * 保存会话
 */
async function handleSaveSession(
  _event: any,
  session: SessionData
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  logger.info('[AI 处理器] 保存会话', { sessionId: session.id, name: session.name });

  try {
    // 验证输入
    if (!session.id || session.id.trim().length === 0) {
      throw new Error('会话 ID 不能为空');
    }

    if (!session.name || session.name.trim().length === 0) {
      throw new Error('会话名称不能为空');
    }

    // 更新时间戳
    const updatedSession: SessionData = {
      ...session,
      updatedAt: Date.now(),
    };

    // 如果是新建会话，设置创建时间
    if (!updatedSession.createdAt) {
      updatedSession.createdAt = Date.now();
    }

    // 保存到文件
    const sessionPath = getSessionFilePath(updatedSession.id);
    fs.writeFileSync(sessionPath, JSON.stringify(updatedSession, null, 2), 'utf-8');

    logger.info('[AI 处理器] 会话保存成功', { sessionId: updatedSession.id });

    return { success: true, sessionId: updatedSession.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[AI 处理器] 保存会话失败', errorMessage);

    return { success: false, error: errorMessage };
  }
}

/**
 * 加载会话
 */
async function handleLoadSession(
  _event: any,
  sessionId: string
): Promise<{ success: boolean; session?: SessionData; error?: string }> {
  logger.info('[AI 处理器] 加载会话', { sessionId });

  try {
    // 验证输入
    if (!sessionId || sessionId.trim().length === 0) {
      throw new Error('会话 ID 不能为空');
    }

    // 读取会话文件
    const sessionPath = getSessionFilePath(sessionId);

    if (!fs.existsSync(sessionPath)) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    const sessionData = fs.readFileSync(sessionPath, 'utf-8');
    const session: SessionData = JSON.parse(sessionData);

    logger.info('[AI 处理器] 会话加载成功', { sessionId });

    return { success: true, session };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[AI 处理器] 加载会话失败', errorMessage);

    return { success: false, error: errorMessage };
  }
}

/**
 * 列出所有会话
 */
async function handleListSessions(): Promise<{ success: boolean; sessions?: SessionData[]; error?: string }> {
  logger.info('[AI 处理器] 列出所有会话');

  try {
    const sessionsDir = getSessionsDir();
    const files = fs.readdirSync(sessionsDir);
    const sessions: SessionData[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const sessionPath = path.join(sessionsDir, file);
        const sessionData = fs.readFileSync(sessionPath, 'utf-8');
        const session: SessionData = JSON.parse(sessionData);
        sessions.push(session);
      }
    }

    // 按更新时间排序（最新的在前）
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);

    logger.info('[AI 处理器] 会话列表加载完成', { count: sessions.length });

    return { success: true, sessions };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[AI 处理器] 列出会话失败', errorMessage);

    return { success: false, error: errorMessage };
  }
}

/**
 * 删除会话
 */
async function handleDeleteSession(
  _event: any,
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  logger.info('[AI 处理器] 删除会话', { sessionId });

  try {
    // 验证输入
    if (!sessionId || sessionId.trim().length === 0) {
      throw new Error('会话 ID 不能为空');
    }

    // 删除会话文件
    const sessionPath = getSessionFilePath(sessionId);

    if (!fs.existsSync(sessionPath)) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    fs.unlinkSync(sessionPath);

    logger.info('[AI 处理器] 会话删除成功', { sessionId });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[AI 处理器] 删除会话失败', errorMessage);

    return { success: false, error: errorMessage };
  }
}

// ==================== 知识库相关处理器 ====================

/**
 * 上传素材到知识库
 */
async function handleKnowledgeUpload(
  _event: any,
  params: {
    type: 'video' | 'script' | 'image' | 'text';
    content: string;
    metadata?: Record<string, unknown>;
  }
): Promise<{ success: boolean; materialId?: string; error?: string }> {
  logger.info('[知识库处理器] 上传素材', { type: params.type });

  try {
    // 动态导入 KnowledgeBase
    const { knowledgeBase } = await import('../services/KnowledgeBase');

    const materialId = await knowledgeBase.uploadMaterial(params);

    logger.info('[知识库处理器] 素材上传成功', { materialId });

    return { success: true, materialId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[知识库处理器] 素材上传失败', errorMessage);

    return { success: false, error: errorMessage };
  }
}

/**
 * 知识库相似度检索
 */
async function handleKnowledgeSearch(
  _event: any,
  query: string,
  topK?: number
): Promise<{
  success: boolean;
  results?: Array<{
    materialId: string;
    content: string;
    score: number;
    metadata?: Record<string, unknown>;
    chunkIndex?: number;
  }>;
  error?: string;
}> {
  logger.info('[知识库处理器] 相似度检索', { query: query.substring(0, 50) });

  try {
    // 动态导入 KnowledgeBase
    const { knowledgeBase } = await import('../services/KnowledgeBase');

    const results = await knowledgeBase.searchSimilar(query, topK);

    logger.info('[知识库处理器] 检索完成', { resultCount: results.length });

    return { success: true, results };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[知识库处理器] 检索失败', errorMessage);

    return { success: false, error: errorMessage };
  }
}

/**
 * 获取知识库统计信息
 */
async function handleKnowledgeStats(): Promise<{
  success: boolean;
  stats?: {
    totalDocuments: number;
    totalMaterials: number;
  };
  error?: string;
}> {
  logger.info('[知识库处理器] 获取统计信息');

  try {
    // 动态导入 KnowledgeBase
    const { knowledgeBase } = await import('../services/KnowledgeBase');

    const stats = await knowledgeBase.getStats();

    logger.info('[知识库处理器] 统计信息获取成功', stats);

    return { success: true, stats };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[知识库处理器] 获取统计信息失败', errorMessage);

    return { success: false, error: errorMessage };
  }
}

// ==================== 项目管理相关处理器 ====================

/**
 * 获取所有项目
 */
async function handleGetProjects(): Promise<{ success: boolean; projects?: any[]; error?: string }> {
  logger.info('[项目管理处理器] 获取所有项目');

  try {
    const projects = asideProjectRepository.getProjects();
    logger.info('[项目管理处理器] 项目列表获取成功', { count: projects.length });
    return { success: true, projects };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[项目管理处理器] 获取项目列表失败', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * 创建新项目
 */
async function handleCreateProject(
  _event: any,
  data: { name: string; gameType: GameType; sellingPoint?: string }
): Promise<{ success: boolean; project?: any; error?: string }> {
  logger.info('[项目管理处理器] 创建项目', data);

  try {
    // 参数验证
    if (!data.name || data.name.trim() === '') {
      return { success: false, error: '项目名称不能为空' };
    }

    const validGameTypes: GameType[] = ['麻将', '扑克', '赛车'];
    if (!validGameTypes.includes(data.gameType)) {
      return { success: false, error: `无效的游戏类型：${data.gameType}` };
    }

    const project = asideProjectRepository.createProject(data.name, data.gameType, data.sellingPoint);
    logger.info('[项目管理处理器] 项目创建成功', { projectId: project.id, name: project.name });
    return { success: true, project };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[项目管理处理器] 创建项目失败', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * 删除项目
 */
async function handleDeleteProject(
  _event: any,
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  logger.info('[项目管理处理器] 删除项目', { projectId });

  try {
    if (!projectId || projectId.trim() === '') {
      return { success: false, error: '项目 ID 不能为空' };
    }

    asideProjectRepository.deleteProject(projectId);
    logger.info('[项目管理处理器] 项目删除成功', { projectId });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[项目管理处理器] 删除项目失败', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// ==================== 创意方向处理器 ====================

/**
 * 获取创意方向列表
 */
async function handleGetCreativeDirections(
  _event: any,
  projectId: string
): Promise<{ success: boolean; directions?: any[]; error?: string }> {
  logger.info('[创意方向处理器] 获取创意方向', { projectId });

  try {
    if (!projectId || projectId.trim() === '') {
      return { success: false, error: '项目 ID 不能为空' };
    }

    const directions = asideCreativeDirectionRepository.getCreativeDirections(projectId);
    logger.info('[创意方向处理器] 创意方向列表获取成功', { count: directions.length });
    return { success: true, directions };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[创意方向处理器] 获取创意方向失败', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * 添加创意方向
 */
async function handleAddCreativeDirection(
  _event: any,
  data: { projectId: string; name: string; description?: string; iconName?: string }
): Promise<{ success: boolean; direction?: any; error?: string }> {
  logger.info('[创意方向处理器] 添加创意方向', data);

  try {
    if (!data.projectId || data.projectId.trim() === '') {
      return { success: false, error: '项目 ID 不能为空' };
    }

    if (!data.name || data.name.trim() === '') {
      return { success: false, error: '创意方向名称不能为空' };
    }

    const direction = asideCreativeDirectionRepository.addCreativeDirection(data);
    logger.info('[创意方向处理器] 创意方向添加成功', { directionId: direction.id });
    return { success: true, direction };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[创意方向处理器] 添加创意方向失败', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * 删除创意方向
 */
async function handleDeleteCreativeDirection(
  _event: any,
  directionId: string
): Promise<{ success: boolean; error?: string }> {
  logger.info('[创意方向处理器] 删除创意方向', { directionId });

  try {
    if (!directionId || directionId.trim() === '') {
      return { success: false, error: '创意方向 ID 不能为空' };
    }

    asideCreativeDirectionRepository.deleteCreativeDirection(directionId);
    logger.info('[创意方向处理器] 创意方向删除成功', { directionId });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[创意方向处理器] 删除创意方向失败', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// ==================== 人设处理器 ====================

/**
 * 获取人设列表
 */
async function handleGetPersonas(
  _event: any,
  projectId: string
): Promise<{ success: boolean; personas?: any[]; error?: string }> {
  logger.info('[人设处理器] 获取人设', { projectId });

  try {
    if (!projectId || projectId.trim() === '') {
      return { success: false, error: '项目 ID 不能为空' };
    }

    const personas = asidePersonaRepository.getPersonas(projectId);
    logger.info('[人设处理器] 人设列表获取成功', { count: personas.length });
    return { success: true, personas };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[人设处理器] 获取人设失败', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * 添加人设
 */
async function handleAddPersona(
  _event: any,
  data: { projectId: string; name: string; prompt: string }
): Promise<{ success: boolean; persona?: any; error?: string }> {
  logger.info('[人设处理器] 添加人设', data);

  try {
    if (!data.projectId || data.projectId.trim() === '') {
      return { success: false, error: '项目 ID 不能为空' };
    }

    if (!data.name || data.name.trim() === '') {
      return { success: false, error: '人设名称不能为空' };
    }

    if (!data.prompt || data.prompt.trim() === '') {
      return { success: false, error: '人设提示词不能为空' };
    }

    const persona = asidePersonaRepository.addPersona(data);
    logger.info('[人设处理器] 人设添加成功', { personaId: persona.id });
    return { success: true, persona };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[人设处理器] 添加人设失败', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * 更新人设
 */
async function handleUpdatePersona(
  _event: any,
  personaId: string,
  data: { name?: string; prompt?: string }
): Promise<{ success: boolean; error?: string }> {
  logger.info('[人设处理器] 更新人设', { personaId, data });

  try {
    if (!personaId || personaId.trim() === '') {
      return { success: false, error: '人设 ID 不能为空' };
    }

    asidePersonaRepository.updatePersona(personaId, data);
    logger.info('[人设处理器] 人设更新成功', { personaId });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[人设处理器] 更新人设失败', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * 删除人设
 */
async function handleDeletePersona(
  _event: any,
  personaId: string
): Promise<{ success: boolean; error?: string }> {
  logger.info('[人设处理器] 删除人设', { personaId });

  try {
    if (!personaId || personaId.trim() === '') {
      return { success: false, error: '人设 ID 不能为空' };
    }

    asidePersonaRepository.deletePersona(personaId);
    logger.info('[人设处理器] 人设删除成功', { personaId });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[人设处理器] 删除人设失败', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// ==================== 剧本处理器 ====================

/**
 * 生成脚本
 */
async function handleGenerateScreenplays(
  _event: any,
  data: {
    projectId: string;
    creativeDirectionId: string;
    personaId: string;
    aiModel: AIModel;
    count: number;
  }
): Promise<{ success: boolean; screenplays: any[]; error?: string }> {
  logger.info('[剧本处理器] 生成剧本', data);

  try {
    // 参数验证
    if (!data.projectId || data.projectId.trim() === '') {
      return { success: false, error: '项目 ID 不能为空' };
    }

    if (!data.creativeDirectionId || data.creativeDirectionId.trim() === '') {
      return { success: false, error: '创意方向 ID 不能为空' };
    }

    if (!data.personaId || data.personaId.trim() === '') {
      return { success: false, error: '人设 ID 不能为空' };
    }

    if (!data.aiModel || data.aiModel.trim() === '') {
      return { success: false, error: 'AI 模型不能为空' };
    }

    if (data.count < 1 || data.count > 10) {
      return { success: false, error: '生成数量必须在 1-10 之间' };
    }

    const screenplays = await asideScreenplayRepository.generateScreenplaysAsync(data);
    logger.info('[剧本处理器] 剧本生成成功', { count: screenplays.length });
    return { success: true, screenplays };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[剧本处理器] 生成剧本失败', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * 添加剧本到待产库
 */
async function handleAddScreenplayToLibrary(
  _event: any,
  screenplayId: string
): Promise<{ success: boolean; screenplay?: any; newScreenplay?: any; error?: string }> {
  logger.info('[剧本处理器] 添加剧本到待产库', { screenplayId });

  try {
    if (!screenplayId || screenplayId.trim() === '') {
      return { success: false, error: '剧本 ID 不能为空' };
    }

    const result = asideScreenplayRepository.addScreenplayToLibrary(screenplayId);
    logger.info('[剧本处理器] 剧本已添加到待产库', {
      screenplayId,
      newScreenplayGenerated: !!result.newScreenplay,
    });
    return { success: true, screenplay: result.screenplay, newScreenplay: result.newScreenplay };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[剧本处理器] 添加剧本到待产库失败', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * 从待产库移除剧本
 */
async function handleRemoveScreenplayFromLibrary(
  _event: any,
  screenplayId: string
): Promise<{ success: boolean; error?: string }> {
  logger.info('[剧本处理器] 从待产库移除剧本', { screenplayId });

  try {
    if (!screenplayId || screenplayId.trim() === '') {
      return { success: false, error: '剧本 ID 不能为空' };
    }

    asideScreenplayRepository.removeScreenplayFromLibrary(screenplayId);
    logger.info('[剧本处理器] 剧本已从待产库移除', { screenplayId });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[剧本处理器] 从待产库移除剧本失败', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * 获取待产库剧本列表
 */
async function handleGetLibraryScreenplays(
  _event: any,
  projectId: string
): Promise<{ success: boolean; screenplays: any[]; error?: string }> {
  logger.info('[剧本处理器] 获取待产库剧本', { projectId });

  try {
    if (!projectId || projectId.trim() === '') {
      return { success: false, error: '项目 ID 不能为空' };
    }

    const screenplays = asideScreenplayRepository.getLibraryScreenplays(projectId);
    logger.info('[剧本处理器] 待产库剧本获取成功', { count: screenplays.length });
    return { success: true, screenplays };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[剧本处理器] 获取待产库剧本失败', errorMessage);
    return { success: false, screenplays: [], error: errorMessage };
  }
}

/**
 * 更新剧本内容
 */
async function handleUpdateScreenplayContent(
  _event: any,
  screenplayId: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  logger.info('[剧本处理器] 更新剧本内容', { screenplayId });

  try {
    if (!screenplayId || screenplayId.trim() === '') {
      return { success: false, error: '剧本 ID 不能为空' };
    }

    if (!content || content.trim() === '') {
      return { success: false, error: '剧本内容不能为空' };
    }

    asideScreenplayRepository.updateScreenplayContent(screenplayId, content);
    logger.info('[剧本处理器] 剧本内容更新成功', { screenplayId });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[剧本处理器] 更新剧本内容失败', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * 重新生成剧本
 */
async function handleRegenerateScreenplay(
  _event: any,
  screenplayId: string
): Promise<{ success: boolean; screenplay?: any; error?: string }> {
  logger.info('[剧本处理器] 重新生成剧本', { screenplayId });

  try {
    if (!screenplayId || screenplayId.trim() === '') {
      return { success: false, error: '剧本 ID 不能为空' };
    }

    const screenplay = asideScreenplayRepository.regenerateScreenplay(screenplayId);
    logger.info('[剧本处理器] 剧本重新生成成功', { screenplayId });
    return { success: true, screenplay };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[剧本处理器] 重新生成剧本失败', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// ==================== 注册处理器 ====================

/**
 * 注册 AI 视频生产 IPC 处理器
 */
export function registerAsideHandlers(): void {
  logger.info('[AI 处理器] 开始注册 IPC 处理器');

  // 加载风格模板（旧版，保留兼容）
  ipcMain.handle('aside:load-styles', handleLoadStyles);

  // 保存会话
  ipcMain.handle('aside:save-session', handleSaveSession);

  // 加载会话
  ipcMain.handle('aside:load-session', handleLoadSession);

  // 列出所有会话
  ipcMain.handle('aside:list-sessions', handleListSessions);

  // 删除会话
  ipcMain.handle('aside:delete-session', handleDeleteSession);

  // 知识库相关
  ipcMain.handle('knowledge:upload', handleKnowledgeUpload);
  ipcMain.handle('knowledge:search', handleKnowledgeSearch);
  ipcMain.handle('knowledge:stats', handleKnowledgeStats);

  // 项目管理
  ipcMain.handle('aside:getProjects', handleGetProjects);
  ipcMain.handle('aside:createProject', handleCreateProject);
  ipcMain.handle('aside:deleteProject', handleDeleteProject);

  // 创意方向
  ipcMain.handle('aside:getCreativeDirections', handleGetCreativeDirections);
  ipcMain.handle('aside:addCreativeDirection', handleAddCreativeDirection);
  ipcMain.handle('aside:deleteCreativeDirection', handleDeleteCreativeDirection);

  // 人设
  ipcMain.handle('aside:getPersonas', handleGetPersonas);
  ipcMain.handle('aside:addPersona', handleAddPersona);
  ipcMain.handle('aside:updatePersona', handleUpdatePersona);
  ipcMain.handle('aside:deletePersona', handleDeletePersona);

  // 脚本管理
  ipcMain.handle('aside:generateScreenplays', handleGenerateScreenplays);
  ipcMain.handle('aside:addScreenplayToLibrary', handleAddScreenplayToLibrary);
  ipcMain.handle('aside:removeScreenplayFromLibrary', handleRemoveScreenplayFromLibrary);
  ipcMain.handle('aside:getLibraryScreenplays', handleGetLibraryScreenplays);
  ipcMain.handle('aside:updateScreenplayContent', handleUpdateScreenplayContent);
  ipcMain.handle('aside:regenerateScreenplay', handleRegenerateScreenplay);

  logger.info('[AI 处理器] IPC 处理器注册完成');
}
