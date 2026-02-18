/**
 * 配置仓库
 * 负责全局配置的存取
 */

import { getDatabase } from '../index';
import type { TaskCenterConfig } from '@shared/types/task';
import { DEFAULT_TASK_CENTER_CONFIG } from '@shared/types/task';

export class ConfigRepository {
  /**
   * 获取配置值
   */
  get<K extends keyof TaskCenterConfig>(key: K): TaskCenterConfig[K] | undefined {
    const db = getDatabase();
    const stmt = db.prepare('SELECT value FROM config WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;

    if (!row) return undefined;

    try {
      return JSON.parse(row.value) as TaskCenterConfig[K];
    } catch {
      return row.value as unknown as TaskCenterConfig[K];
    }
  }

  /**
   * 设置配置值
   */
  set<K extends keyof TaskCenterConfig>(key: K, value: TaskCenterConfig[K]): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO config (key, value, updated_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(key, JSON.stringify(value), Date.now());
  }

  /**
   * 获取所有配置
   */
  getAll(): TaskCenterConfig {
    const db = getDatabase();
    const stmt = db.prepare('SELECT key, value FROM config');
    const rows = stmt.all() as { key: string; value: string }[];

    const config: Partial<TaskCenterConfig> = {};

    for (const row of rows) {
      try {
        (config as Record<string, unknown>)[row.key] = JSON.parse(row.value);
      } catch {
        (config as Record<string, unknown>)[row.key] = row.value;
      }
    }

    return {
      ...DEFAULT_TASK_CENTER_CONFIG,
      ...config,
    };
  }

  /**
   * 批量设置配置
   */
  setMany(config: Partial<TaskCenterConfig>): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO config (key, value, updated_at)
      VALUES (?, ?, ?)
    `);

    const setMany = db.transaction((items: [string, unknown][]) => {
      for (const [key, value] of items) {
        stmt.run(key, JSON.stringify(value), Date.now());
      }
    });

    const items = Object.entries(config) as [string, unknown][];
    setMany(items);
  }

  /**
   * 恢复默认配置
   */
  resetToDefault(): void {
    this.setMany(DEFAULT_TASK_CENTER_CONFIG);
  }
}

// 导出单例
export const configRepository = new ConfigRepository();
