/**
 * 人设仓库
 * 负责人设数据的 CRUD 操作
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../index';
import type { Persona } from '@shared/types/aside';

/**
 * 数据库行类型
 */
interface PersonaRow {
  id: string;
  project_id: string;
  name: string;
  prompt: string;
  characteristics: string;
  is_preset: number;
  created_at: number;
}

export class AsidePersonaRepository {
  // ==================== 查询 ====================

  /**
   * 获取项目的所有人设
   * @param projectId 项目 ID
   * @returns 人设列表
   */
  getPersonas(projectId: string): Persona[] {
    if (!projectId || projectId.trim() === '') {
      throw new Error('项目 ID 不能为空');
    }

    try {
      const db = getDatabase();
      const rows = db.prepare(`
        SELECT id, project_id, name, prompt, characteristics, is_preset, created_at
        FROM aside_personas
        WHERE project_id = ?
        ORDER BY created_at ASC
      `).all(projectId) as PersonaRow[];

      console.log(`[AsidePersonaRepository] 查询到 ${rows.length} 个人设`);
      return rows.map(row => this.mapRowToPersona(row));
    } catch (error) {
      console.error('[AsidePersonaRepository] 查询人设失败:', error);
      throw error;
    }
  }

  // ==================== 创建 ====================

  /**
   * 添加人设
   * @param data 人设数据
   * @returns 新创建的人设
   */
  addPersona(data: {
    projectId: string;
    name: string;
    prompt: string;
    characteristics?: string[];
  }): Persona {
    if (!data.projectId || data.projectId.trim() === '') {
      throw new Error('项目 ID 不能为空');
    }

    if (!data.name || data.name.trim() === '') {
      throw new Error('人设名称不能为空');
    }

    if (!data.prompt || data.prompt.trim() === '') {
      throw new Error('人设提示词不能为空');
    }

    const db = getDatabase();
    const id = uuidv4();
    const now = Date.now();
    const characteristics = JSON.stringify(data.characteristics ?? []);

    try {
      db.prepare(`
        INSERT INTO aside_personas (id, project_id, name, prompt, characteristics, is_preset, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, data.projectId, data.name, data.prompt, characteristics, 0, now);

      const row = db.prepare(`
        SELECT id, project_id, name, prompt, characteristics, is_preset, created_at
        FROM aside_personas WHERE id = ?
      `).get(id) as PersonaRow;

      if (!row) {
        throw new Error(`人设创建失败：无法找到刚创建的人设 ID ${id}`);
      }

      console.log(`[AsidePersonaRepository] 成功创建人设: ${data.name}`);
      return this.mapRowToPersona(row);
    } catch (error) {
      console.error('[AsidePersonaRepository] 创建人设失败:', error);
      throw error;
    }
  }

  // ==================== 更新 ====================

  /**
   * 更新人设
   * @param id 人设 ID
   * @param data 更新数据
   */
  updatePersona(
    id: string,
    data: { name?: string; prompt?: string; characteristics?: string[] }
  ): void {
    if (!id || id.trim() === '') {
      throw new Error('人设 ID 不能为空');
    }

    if (data.name !== undefined && data.name.trim() === '') {
      throw new Error('人设名称不能为空');
    }

    if (data.prompt !== undefined && data.prompt.trim() === '') {
      throw new Error('人设提示词不能为空');
    }

    if (
      data.name === undefined &&
      data.prompt === undefined &&
      data.characteristics === undefined
    ) {
      throw new Error('至少需要提供一个要更新的字段');
    }

    try {
      const db = getDatabase();

      const existing = db.prepare(`
        SELECT id FROM aside_personas WHERE id = ?
      `).get(id) as { id: string } | undefined;

      if (!existing) {
        throw new Error(`人设不存在：ID ${id}`);
      }

      const updates: string[] = [];
      const values: (string | number)[] = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        values.push(data.name);
      }

      if (data.prompt !== undefined) {
        updates.push('prompt = ?');
        values.push(data.prompt);
      }

      if (data.characteristics !== undefined) {
        updates.push('characteristics = ?');
        values.push(JSON.stringify(data.characteristics));
      }

      values.push(id);

      db.prepare(`
        UPDATE aside_personas
        SET ${updates.join(', ')}
        WHERE id = ?
      `).run(...values);

      console.log(`[AsidePersonaRepository] 成功更新人设 ID: ${id}`);
    } catch (error) {
      console.error('[AsidePersonaRepository] 更新人设失败:', error);
      throw error;
    }
  }

  // ==================== 删除 ====================

  /**
   * 删除人设
   * 只能删除非预设的人设（is_preset = 0）
   * @param id 人设 ID
   */
  deletePersona(id: string): void {
    if (!id || id.trim() === '') {
      throw new Error('人设 ID 不能为空');
    }

    try {
      const db = getDatabase();

      const row = db.prepare(`
        SELECT is_preset FROM aside_personas WHERE id = ?
      `).get(id) as { is_preset: number } | undefined;

      if (!row) {
        throw new Error(`人设不存在：ID ${id}`);
      }

      if (row.is_preset === 1) {
        throw new Error('无法删除预设人设');
      }

      db.prepare(`DELETE FROM aside_personas WHERE id = ?`).run(id);
      console.log(`[AsidePersonaRepository] 成功删除人设 ID: ${id}`);
    } catch (error) {
      console.error('[AsidePersonaRepository] 删除人设失败:', error);
      throw error;
    }
  }

  // ==================== 工具方法 ====================

  /**
   * 映射数据库行到人设对象
   */
  private mapRowToPersona(row: PersonaRow): Persona {
    let characteristics: string[] = [];
    try {
      characteristics = JSON.parse(row.characteristics || '[]');
    } catch {
      characteristics = [];
    }

    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      prompt: row.prompt,
      characteristics,
      isPreset: row.is_preset === 1,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }
}

// 导出单例
export const asidePersonaRepository = new AsidePersonaRepository();
