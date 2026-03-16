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
 * 生成脚本
 * TODO: 集成豆包 LLM API
 */
async function handleGenerateScripts(
  _event: any,
  request: GenerateScriptsRequest
): Promise<{ success: boolean; scripts?: Script[]; error?: string }> {
  logger.info('[AI 处理器] 开始生成脚本', request);

  try {
    // 验证输入
    if (!request.userRequirement || request.userRequirement.trim().length === 0) {
      throw new Error('用户需求不能为空');
    }

    if (!request.selectedStyle || request.selectedStyle.trim().length === 0) {
      throw new Error('脚本风格不能为空');
    }

    if (request.batchSize < 1 || request.batchSize > 10) {
      throw new Error('批量生成数量必须在 1-10 之间');
    }

    // TODO: 调用豆包 LLM API 生成脚本
    // 这里先用模拟数据
    const scripts: Script[] = [];

    for (let i = 0; i < request.batchSize; i++) {
      scripts.push({
        id: uuidv4(),
        text: `这是第 ${i + 1} 条模拟脚本，风格：${request.selectedStyle}，需求：${request.userRequirement}`,
        style: request.selectedStyle,
        createdAt: Date.now(),
        selected: false,
      });
    }

    logger.info('[AI 处理器] 脚本生成完成', { count: scripts.length });

    return { success: true, scripts };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[AI 处理器] 脚本生成失败', errorMessage);

    return { success: false, error: errorMessage };
  }
}

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

// ==================== 注册处理器 ====================

/**
 * 注册 AI 视频生产 IPC 处理器
 */
export function registerAsideHandlers(): void {
  logger.info('[AI 处理器] 开始注册 IPC 处理器');

  // 生成脚本
  ipcMain.handle('aside:generate-scripts', handleGenerateScripts);

  // 加载风格模板
  ipcMain.handle('aside:load-styles', handleLoadStyles);

  // 保存会话
  ipcMain.handle('aside:save-session', handleSaveSession);

  // 加载会话
  ipcMain.handle('aside:load-session', handleLoadSession);

  // 列出所有会话
  ipcMain.handle('aside:list-sessions', handleListSessions);

  // 删除会话
  ipcMain.handle('aside:delete-session', handleDeleteSession);

  logger.info('[AI 处理器] IPC 处理器注册完成');
}
