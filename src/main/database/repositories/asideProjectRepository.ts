/**
 * A面项目仓库
 * 负责项目数据的 CRUD 操作
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../index';
import type { Project, GameType } from '@shared/types/aside';

/**
 * 数据库行类型
 */
interface ProjectRow {
  id: string;
  name: string;
  game_type: string;
  selling_point: string | null;
  created_at: number;
  updated_at: number;
}

export class AsideProjectRepository {
  // ==================== 创建 ====================

  /**
   * 创建新项目
   * 自动插入预设的创意方向和人设
   */
  createProject(name: string, gameType: GameType, sellingPoint?: string): Project {
    // 参数验证
    if (!name || name.trim() === '') {
      throw new Error('项目名称不能为空');
    }

    const validGameTypes: GameType[] = ['麻将', '扑克', '赛车'];
    if (!validGameTypes.includes(gameType)) {
      throw new Error(`无效的游戏类型：${gameType}`);
    }

    // 新增:卖点长度验证
    if (sellingPoint && sellingPoint.length > 200) {
      throw new Error('卖点不能超过200字符');
    }

    const db = getDatabase();
    const id = uuidv4();
    const now = Date.now();

    try {
      /**
       * 使用事务确保数据一致性
       * 创建项目时只插入预设人设，创意方向由 AI 按项目生成
       */
      const transaction = db.transaction(() => {
        // 插入项目
        const insertProject = db.prepare(`
          INSERT INTO aside_projects (id, name, game_type, selling_point, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        insertProject.run(id, name, gameType, sellingPoint || null, now, now);
      });

      // 执行事务
      transaction();

      const project = this.getProjectById(id);
      if (!project) {
        throw new Error(`项目创建失败：无法找到刚创建的项目 ID ${id}`);
      }

      console.log(`[AsideProjectRepository] 成功创建项目: ${name}`);
      return project;
    } catch (error) {
      console.error('[AsideProjectRepository] 创建项目失败:', error);
      throw error;
    }
  }

  // ==================== 查询 ====================

  /**
   * 获取所有项目
   */
  getProjects(): Project[] {
    try {
      const db = getDatabase();
      const rows = db.prepare(`
        SELECT id, name, game_type, selling_point, created_at, updated_at
        FROM aside_projects
        ORDER BY created_at DESC
      `).all() as ProjectRow[];

      console.log(`[AsideProjectRepository] 查询到 ${rows.length} 个项目`);
      return rows.map(row => this.mapRowToProject(row));
    } catch (error) {
      console.error('[AsideProjectRepository] 查询项目失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID获取项目
   */
  getProjectById(id: string): Project | null {
    try {
      const db = getDatabase();
      const row = db.prepare(`
        SELECT id, name, game_type, selling_point, created_at, updated_at
        FROM aside_projects
        WHERE id = ?
      `).get(id) as ProjectRow | undefined;

      if (!row) return null;

      return this.mapRowToProject(row);
    } catch (error) {
      console.error('[AsideProjectRepository] 查询项目失败:', error);
      throw error;
    }
  }

  // ==================== 更新 ====================

  updateProject(id: string, data: { name?: string; gameType?: GameType; sellingPoint?: string }): Project {
    // 参数验证
    if (data.name !== undefined && data.name.trim() === '') {
      throw new Error('项目名称不能为空');
    }
    if (data.gameType !== undefined) {
      const validGameTypes: GameType[] = ['麻将', '扑克', '赛车'];
      if (!validGameTypes.includes(data.gameType)) {
        throw new Error(`无效的游戏类型：${data.gameType}`);
      }
    }
    if (data.sellingPoint !== undefined && data.sellingPoint.length > 200) {
      throw new Error('卖点不能超过200字符');
    }

    const db = getDatabase();
    const now = Date.now();

    try {
      // 检查项目是否存在
      const existingProject = this.getProjectById(id);
      if (!existingProject) {
        throw new Error('项目不存在');
      }

      // 更新项目
      const updateStatement = db.prepare(`
        UPDATE aside_projects
        SET name = ?, game_type = ?, selling_point = ?, updated_at = ?
        WHERE id = ?
      `);
      const result = updateStatement.run(
        data.name ?? existingProject.name,
        data.gameType ?? existingProject.gameType,
        data.sellingPoint !== undefined ? (data.sellingPoint || null) : (existingProject.sellingPoint || null),
        now,
        id
      );

      if (result.changes === 0) {
        throw new Error('更新项目失败：没有修改任何行');
      }

      // 查询并返回更新后的项目
      const row = db.prepare(`
        SELECT id, name, game_type, selling_point, created_at, updated_at
        FROM aside_projects
        WHERE id = ?
      `).get(id) as ProjectRow | undefined;

      if (!row) {
        throw new Error(`更新项目失败：无法找到项目 ID ${id}`);
      }

      console.log(`[AsideProjectRepository] 成功更新项目: ${data.name || existingProject.name}`);
      return this.mapRowToProject(row);
    } catch (error) {
      console.error('[AsideProjectRepository] 更新项目失败:', error);
      throw error;
    }
  }

  // ==================== 删除 ====================

  deleteProject(id: string): void {
    try {
      const db = getDatabase();
      const result = db.prepare(`DELETE FROM aside_projects WHERE id = ?`).run(id);
      console.log(`[AsideProjectRepository] 成功删除项目 ID: ${id}，影响行数: ${result.changes}`);
    } catch (error) {
      console.error('[AsideProjectRepository] 删除项目失败:', error);
      throw error;
    }
  }

  // ==================== 工具方法 ====================

  /**
   * 映射数据库行到项目对象
   */
  private mapRowToProject(row: ProjectRow): Project {
    return {
      id: row.id,
      name: row.name,
      gameType: row.game_type as GameType,
      sellingPoint: row.selling_point || undefined,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }
}

// 导出单例
export const asideProjectRepository = new AsideProjectRepository();
