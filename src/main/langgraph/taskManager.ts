/**
 * AI 任务管理工具
 * 跟踪和管理 AI 视频生产任务的进度
 */

import { getDatabase } from '../database/index';
import { logger } from '../utils/logger';

/**
 * AI 任务类型
 */
export type AITaskType = 'script_generation' | 'character_design' | 'storyboard' | 'video_render';

/**
 * AI 任务状态
 */
export type AITaskStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * AI 任务进度信息
 */
export interface AITaskProgress {
  /** 任务 ID */
  taskId: string;
  /** 任务类型 */
  taskType: AITaskType;
  /** 任务状态 */
  status: AITaskStatus;
  /** 进度 (0-100) */
  progress: number;
  /** 当前步骤描述 */
  currentStep?: string;
  /** 错误信息 */
  error?: string;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

/**
 * 创建 AI 任务进度记录
 */
export function createAITaskProgress(
  taskId: string,
  taskType: AITaskType
): AITaskProgress {
  const db = getDatabase();
  const now = Date.now();

  const progress: AITaskProgress = {
    taskId,
    taskType,
    status: 'pending',
    progress: 0,
    createdAt: now,
    updatedAt: now,
  };

  // 存储到配置表（使用任务 ID 作为 key）
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO config (key, value, updated_at)
    VALUES (?, ?, ?)
  `);

  stmt.run(`ai_task_${taskId}`, JSON.stringify(progress), now);

  logger.info('[AI任务] 创建任务进度', { taskId, taskType });

  return progress;
}

/**
 * 更新 AI 任务进度
 */
export function updateAITaskProgress(
  taskId: string,
  updates: Partial<Pick<AITaskProgress, 'status' | 'progress' | 'currentStep' | 'error'>>
): AITaskProgress | null {
  const db = getDatabase();

  // 获取当前进度
  const stmt = db.prepare('SELECT value FROM config WHERE key = ?');
  const row = stmt.get(`ai_task_${taskId}`) as { value: string } | undefined;

  if (!row) {
    logger.warn('[AI任务] 未找到任务进度', { taskId });
    return null;
  }

  const progress: AITaskProgress = JSON.parse(row.value);

  // 更新字段
  if (updates.status !== undefined) {
    progress.status = updates.status;
  }
  if (updates.progress !== undefined) {
    progress.progress = updates.progress;
  }
  if (updates.currentStep !== undefined) {
    progress.currentStep = updates.currentStep;
  }
  if (updates.error !== undefined) {
    progress.error = updates.error;
  }

  progress.updatedAt = Date.now();

  // 保存更新
  const updateStmt = db.prepare(`
    UPDATE config SET value = ?, updated_at = ? WHERE key = ?
  `);

  updateStmt.run(JSON.stringify(progress), progress.updatedAt, `ai_task_${taskId}`);

  logger.info('[AI任务] 更新任务进度', {
    taskId,
    status: progress.status,
    progress: progress.progress,
  });

  return progress;
}

/**
 * 获取 AI 任务进度
 */
export function getAITaskProgress(taskId: string): AITaskProgress | null {
  const db = getDatabase();

  const stmt = db.prepare('SELECT value FROM config WHERE key = ?');
  const row = stmt.get(`ai_task_${taskId}`) as { value: string } | undefined;

  if (!row) {
    return null;
  }

  return JSON.parse(row.value) as AITaskProgress;
}

/**
 * 删除 AI 任务进度
 */
export function deleteAITaskProgress(taskId: string): void {
  const db = getDatabase();

  const stmt = db.prepare('DELETE FROM config WHERE key = ?');
  stmt.run(`ai_task_${taskId}`);

  logger.info('[AI任务] 删除任务进度', { taskId });
}

/**
 * 获取所有 AI 任务进度
 */
export function getAllAITaskProgress(): AITaskProgress[] {
  const db = getDatabase();

  const stmt = db.prepare("SELECT value FROM config WHERE key LIKE 'ai_task_%'");
  const rows = stmt.all() as Array<{ value: string }>;

  return rows.map((row) => JSON.parse(row.value) as AITaskProgress);
}

/**
 * 清理已完成的 AI 任务进度
 */
export function clearCompletedAITaskProgress(): number {
  const db = getDatabase();

  const stmt = db.prepare(`
    DELETE FROM config
    WHERE key LIKE 'ai_task_%'
    AND json_extract(value, '$.status') = 'completed'
  `);

  const result = stmt.run();

  logger.info('[AI任务] 清理已完成任务进度', { count: result.changes });

  return result.changes;
}
