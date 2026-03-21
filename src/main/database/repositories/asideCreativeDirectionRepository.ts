/**
 * 创意方向仓库
 * 负责创意方向数据的 CRUD 操作
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../index';
import type { CreativeDirection } from '@shared/types/aside';

/**
 * 数据库行类型
 */
interface CreativeDirectionRow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  icon_name: string | null;
  is_preset: number;
  created_at: number;
}

export class AsideCreativeDirectionRepository {
  // ==================== 查询 ====================

  /**
   * 获取项目的所有创意方向
   * @param projectId 项目 ID
   * @returns 创意方向列表
   */
  getCreativeDirections(projectId: string): CreativeDirection[] {
    // 参数验证
    if (!projectId || projectId.trim() === '') {
      throw new Error('项目 ID 不能为空');
    }

    try {
      const db = getDatabase();
      const rows = db.prepare(`
        SELECT id, project_id, name, description, icon_name, is_preset, created_at
        FROM aside_creative_directions
        WHERE project_id = ?
        ORDER BY created_at ASC
      `).all(projectId) as CreativeDirectionRow[];

      console.log(`[AsideCreativeDirectionRepository] 查询到 ${rows.length} 个创意方向`);
      return rows.map(row => this.mapRowToCreativeDirection(row));
    } catch (error) {
      console.error('[AsideCreativeDirectionRepository] 查询创意方向失败:', error);
      throw error;
    }
  }

  // ==================== 创建 ====================

  /**
   * 添加创意方向
   * @param data 创意方向数据
   * @returns 新创建的创意方向
   */
  addCreativeDirection(data: {
    projectId: string;
    name: string;
    description?: string;
    iconName?: string;
  }): CreativeDirection {
    // 参数验证
    if (!data.projectId || data.projectId.trim() === '') {
      throw new Error('项目 ID 不能为空');
    }

    if (!data.name || data.name.trim() === '') {
      throw new Error('创意方向名称不能为空');
    }

    const db = getDatabase();
    const id = uuidv4();
    const now = Date.now();

    try {
      const insertStatement = db.prepare(`
        INSERT INTO aside_creative_directions (id, project_id, name, description, icon_name, is_preset, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      insertStatement.run(
        id,
        data.projectId,
        data.name,
        data.description || null,
        data.iconName || null,
        0, // 用户创建的创意方向，is_preset = 0
        now
      );

      // 查询并返回新创建的记录
      const row = db.prepare(`
        SELECT id, project_id, name, description, icon_name, is_preset, created_at
        FROM aside_creative_directions
        WHERE id = ?
      `).get(id) as CreativeDirectionRow;

      if (!row) {
        throw new Error(`创意方向创建失败：无法找到刚创建的创意方向 ID ${id}`);
      }

      console.log(`[AsideCreativeDirectionRepository] 成功创建创意方向: ${data.name}`);
      return this.mapRowToCreativeDirection(row);
    } catch (error) {
      console.error('[AsideCreativeDirectionRepository] 创建创意方向失败:', error);
      throw error;
    }
  }

  // ==================== 删除 ====================

  /**
   * 删除创意方向
   * 只能删除非预设的创意方向（is_preset = 0）
   * @param id 创意方向 ID
   */
  deleteCreativeDirection(id: string): void {
    // 参数验证
    if (!id || id.trim() === '') {
      throw new Error('创意方向 ID 不能为空');
    }

    try {
      const db = getDatabase();

      // 检查是否存在
      const row = db.prepare(`
        SELECT is_preset FROM aside_creative_directions WHERE id = ?
      `).get(id) as { is_preset: number } | undefined;

      if (!row) {
        throw new Error(`创意方向不存在：ID ${id}`);
      }

      // 执行删除
      const result = db.prepare(`DELETE FROM aside_creative_directions WHERE id = ?`).run(id);
      console.log(`[AsideCreativeDirectionRepository] 成功删除创意方向 ID: ${id}，影响行数: ${result.changes}`);
    } catch (error) {
      console.error('[AsideCreativeDirectionRepository] 删除创意方向失败:', error);
      throw error;
    }
  }

  // ==================== 更新 ====================

  /**
   * 更新创意方向
   * 只能更新非预设的创意方向（is_preset = 0）
   * @param id 创意方向 ID
   * @param data 更新数据
   */
  updateCreativeDirection(id: string, data: { name?: string; description?: string; iconName?: string }): void {
    // 参数验证
    if (!id || id.trim() === '') {
      throw new Error('创意方向 ID 不能为空');
    }

    try {
      const db = getDatabase();

      // 检查是否为预设
      const row = db.prepare(`
        SELECT is_preset FROM aside_creative_directions WHERE id = ?
      `).get(id) as { is_preset: number } | undefined;

      if (!row) {
        throw new Error(`创意方向不存在：ID ${id}`);
      }

      // 构建更新语句
      const updates: string[] = [];
      const values: any[] = [];

      if (data.name !== undefined) {
        if (data.name.trim() === '') {
          throw new Error('创意方向名称不能为空');
        }
        updates.push('name = ?');
        values.push(data.name);
      }

      if (data.description !== undefined) {
        updates.push('description = ?');
        values.push(data.description || null);
      }

      if (data.iconName !== undefined) {
        updates.push('icon_name = ?');
        values.push(data.iconName || null);
      }

      if (updates.length === 0) {
        throw new Error('没有提供要更新的数据');
      }

      values.push(id);

      const updateStatement = db.prepare(`
        UPDATE aside_creative_directions
        SET ${updates.join(', ')}
        WHERE id = ?
      `);

      const result = updateStatement.run(...values);
      console.log(`[AsideCreativeDirectionRepository] 成功更新创意方向 ID: ${id}，影响行数: ${result.changes}`);
    } catch (error) {
      console.error('[AsideCreativeDirectionRepository] 更新创意方向失败:', error);
      throw error;
    }
  }

  // ==================== 工具方法 ====================

  /**
   * 映射数据库行到创意方向对象
   * @param row 数据库行
   * @returns 创意方向对象
   */
  private mapRowToCreativeDirection(row: CreativeDirectionRow): CreativeDirection {
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      description: row.description || undefined,
      iconName: row.icon_name || undefined,
      isPreset: row.is_preset === 1,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }
}

// 导出单例
export const asideCreativeDirectionRepository = new AsideCreativeDirectionRepository();
