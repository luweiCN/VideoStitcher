/**
 * A面项目仓库
 * 负责项目数据的 CRUD 操作
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../index';
import type { Project, GameType } from '@shared/types/aside';
import { PRESET_CREATIVE_DIRECTIONS, PRESET_PERSONAS } from '@shared/constants/asidePresets';

/**
 * 数据库行类型
 */
interface ProjectRow {
  id: string;
  name: string;
  game_type: string;
  region: string;
  created_at: number;
  updated_at: number;
}

export class AsideProjectRepository {
  // ==================== 创建 ====================

  /**
   * 创建新项目
   * 自动插入预设的创意方向和人设
   */
  createProject(name: string, gameType: GameType): Project {
    // 参数验证
    if (!name || name.trim() === '') {
      throw new Error('项目名称不能为空');
    }

    const validGameTypes: GameType[] = ['麻将', '扑克', '赛车'];
    if (!validGameTypes.includes(gameType)) {
      throw new Error(`无效的游戏类型：${gameType}`);
    }

    const db = getDatabase();
    const id = uuidv4();
    const now = Date.now();

    try {
      // 使用事务确保数据一致性
      const transaction = db.transaction(() => {
        // 插入项目
        const insertProject = db.prepare(`
          INSERT INTO aside_projects (id, name, game_type, region, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        insertProject.run(id, name, gameType, 'universal', now, now);

        // 插入预设创意方向（5个）
        const insertDirection = db.prepare(`
          INSERT INTO aside_creative_directions (id, project_id, name, description, icon_name, is_preset, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const direction of PRESET_CREATIVE_DIRECTIONS) {
          insertDirection.run(
            uuidv4(),
            id,
            direction.name,
            direction.description || null,
            direction.iconName || null,
            direction.isPreset ? 1 : 0,
            now
          );
        }

        // 插入预设人设（4个）
        const insertPersona = db.prepare(`
          INSERT INTO aside_personas (id, project_id, name, prompt, is_preset, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const persona of PRESET_PERSONAS) {
          insertPersona.run(
            uuidv4(),
            id,
            persona.name,
            persona.prompt,
            persona.isPreset ? 1 : 0,
            now
          );
        }
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
        SELECT id, name, game_type, region, created_at, updated_at
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
        SELECT id, name, game_type, region, created_at, updated_at
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

  // ==================== 删除 ====================

  /**
   * 删除项目
   * 级联删除所有关联数据（创意方向、人设、脚本）
   */
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
      region: row.region,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }
}

// 导出单例
export const asideProjectRepository = new AsideProjectRepository();
