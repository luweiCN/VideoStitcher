/**
 * 剧本仓库
 * 负责剧本数据的 CRUD 操作
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../index';
import type { Screenplay, AIModel, ScreenplayStatus } from '@shared/types/aside';
import { asideCreativeDirectionRepository } from './asideCreativeDirectionRepository';
import { asidePersonaRepository } from './asidePersonaRepository';
import { asideRegionRepository } from './asideRegionRepository';
import { runScreenplayAgent, type ScreenplayResult } from '../../ai/agents/screenplay';

/**
 * 数据库行类型
 */
interface ScreenplayRow {
  id: string;
  project_id: string;
  content: string;
  creative_direction_id: string | null;
  persona_id: string | null;
  ai_model: string | null;
  status: string;
  region: string | null;
  created_at: number;
}

export class AsideScreenplayRepository {
  // ==================== 查询 ====================

  /**
   * 根据 ID 获取剧本
   * @param screenplayId 剧本 ID
   * @returns 剧本对象，如果不存在则返回 undefined
   */
  getScreenplayById(screenplayId: string): Screenplay | undefined {
    // 参数验证
    if (!screenplayId || screenplayId.trim() === '') {
      throw new Error('剧本 ID 不能为空');
    }

    try {
      const db = getDatabase();
      const row = db.prepare(`
        SELECT id, project_id, content, creative_direction_id, persona_id, ai_model, status, created_at
        FROM aside_screenplays
        WHERE id = ?
      `).get(screenplayId) as ScreenplayRow | undefined;

      if (!row) {
        return undefined;
      }

      return this.mapRowToScreenplay(row);
    } catch (error) {
      console.error('[AsideScreenplayRepository] 查询剧本失败:', error);
      throw error;
    }
  }

  /**
   * 获取待产库中的所有剧本
   * @param projectId 项目 ID
   * @returns 待产库剧本列表
   */
  getLibraryScreenplays(projectId: string): Screenplay[] {
    // 参数验证
    if (!projectId || projectId.trim() === '') {
      throw new Error('项目 ID 不能为空');
    }

    try {
      const db = getDatabase();
      const rows = db.prepare(`
        SELECT id, project_id, content, creative_direction_id, persona_id, ai_model, status, created_at
        FROM aside_screenplays
        WHERE project_id = ? AND status = 'library'
        ORDER BY created_at ASC
      `).all(projectId) as ScreenplayRow[];

      console.log(`[AsideScreenplayRepository] 查询到 ${rows.length} 个待产库剧本`);
      return rows.map(row => this.mapRowToScreenplay(row));
    } catch (error) {
      console.error('[AsideScreenplayRepository] 查询待产库脚本失败:', error);
      throw error;
    }
  }

  // ==================== 生成 ====================

  /**
   * 生成剧本
   * 使用剧本写作 Agent 生成真实剧本内容
   * @param data 生成参数
   * @returns 生成的剧本数组
   */
  async generateScreenplaysAsync(data: {
    projectId: string;
    creativeDirectionId: string;
    personaId: string;
    aiModel: string;
    count: number;
    region?: string;
  }): Promise<Screenplay[]> {
    // 参数验证
    if (!data.projectId || data.projectId.trim() === '') {
      throw new Error('项目 ID 不能为空');
    }

    if (!data.creativeDirectionId || data.creativeDirectionId.trim() === '') {
      throw new Error('创意方向 ID 不能为空');
    }

    if (!data.personaId || data.personaId.trim() === '') {
      throw new Error('人设 ID 不能为空');
    }

    if (!data.aiModel || data.aiModel.trim() === '') {
      throw new Error('AI 模型不能为空');
    }

    if (data.count < 1 || data.count > 10) {
      throw new Error('生成数量必须在 1-10 之间');
    }

    try {
      const db = getDatabase();

      // 获取项目信息
      const projectRow = db.prepare(`
        SELECT id, name, game_type, selling_point
        FROM aside_projects
        WHERE id = ?
      `).get(data.projectId) as { id: string; name: string; game_type: string; selling_point: string | null };

      if (!projectRow) {
        throw new Error(`项目不存在：ID ${data.projectId}`);
      }

      const project = {
        id: projectRow.id,
        name: projectRow.name,
        gameType: projectRow.game_type,
        sellingPoint: projectRow.selling_point || undefined,
      };

      // 获取创意方向和人设信息
      const creativeDirection = asideCreativeDirectionRepository.getCreativeDirections(data.projectId)
        .find(cd => cd.id === data.creativeDirectionId);

      if (!creativeDirection) {
        throw new Error(`创意方向不存在：ID ${data.creativeDirectionId}`);
      }

      const persona = asidePersonaRepository.getPersonas(data.projectId)
        .find(p => p.id === data.personaId);

      if (!persona) {
        throw new Error(`人设不存在：ID ${data.personaId}`);
      }

      // 获取地区文化档案
      const regionId = data.region || 'universal';
      const region = regionId !== 'universal'
        ? await asideRegionRepository.getRegionById(regionId)
        : null;
      const cultureProfile = region?.culturalProfile ?? '';

      console.log(`[AsideScreenplayRepository] 开始使用 AI 生成 ${data.count} 个剧本`);
      console.log(`[AsideScreenplayRepository] 项目: ${project.name}, 地区: ${region?.name || regionId}`);

      const screenplays: Screenplay[] = [];

      // 使用 for 循环生成指定数量的剧本
      for (let i = 0; i < data.count; i++) {
        const id = uuidv4();
        const now = Date.now();

        // 调用剧本写作 Agent
        const result = await runScreenplayAgent(
          {
            project,
            creativeDirection,
            persona,
            cultureProfile,
            regionName: region?.name,
          },
          {
            currentIndex: i + 1,
            totalCount: data.count,
          },
          { info: console.log }
        );

        // 将结果转换为 JSON 字符串存储
        const screenplayContent = JSON.stringify(result, null, 2);

        // 插入数据库
        const insertStatement = db.prepare(`
          INSERT INTO aside_screenplays (id, project_id, content, creative_direction_id, persona_id, ai_model, status, region, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertStatement.run(
          id,
          data.projectId,
          screenplayContent,
          data.creativeDirectionId,
          data.personaId,
          data.aiModel,
          'draft',
          regionId,
          now
        );

        // 查询并添加到返回数组
        const row = db.prepare(`
          SELECT id, project_id, content, creative_direction_id, persona_id, ai_model, status, region, created_at
          FROM aside_screenplays
          WHERE id = ?
        `).get(id) as ScreenplayRow;

        if (row) {
          screenplays.push(this.mapRowToScreenplay(row));
        }
      }

      console.log(`[AsideScreenplayRepository] 成功生成 ${screenplays.length} 个剧本`);
      return screenplays;
    } catch (error) {
      console.error('[AsideScreenplayRepository] 生成剧本失败:', error);
      throw error;
    }
  }

  // ==================== 默认文化档案 ====================

  // ==================== 更新 ====================

  /**
   * 添加剧本到待产库
   * ⚠️ 关键：添加到待产库后，自动生成 1 个新剧本补充
   * @param screenplayId 剧本 ID
   * @returns 更新后的剧本和新补充的剧本
   */
  async addScreenplayToLibrary(screenplayId: string): Promise<{ screenplay: Screenplay; newScreenplay?: Screenplay }> {
    // 参数验证
    if (!screenplayId || screenplayId.trim() === '') {
      throw new Error('剧本 ID 不能为空');
    }

    try {
      const db = getDatabase();

      // 1. 将剧本状态更新为 'library'
      const updateStatement = db.prepare(`
        UPDATE aside_screenplays
        SET status = 'library'
        WHERE id = ?
      `);

      const result = updateStatement.run(screenplayId);

      if (result.changes === 0) {
        throw new Error(`剧本不存在：ID ${screenplayId}`);
      }

      // 查询更新后的剧本
      const updatedRow = db.prepare(`
        SELECT id, project_id, content, creative_direction_id, persona_id, ai_model, status, created_at
        FROM aside_screenplays
        WHERE id = ?
      `).get(screenplayId) as ScreenplayRow;

      const updatedScreenplay = this.mapRowToScreenplay(updatedRow);

      console.log(`[AsideScreenplayRepository] 剧本已添加到待产库: ${screenplayId}`);

      // 2. 生成 1 个新剧本补充
      let newScreenplay: Screenplay | undefined;

      try {
        // 获取项目中的任意一个创意方向和人设（或使用原有的）
        const creativeDirectionId = updatedScreenplay.creativeDirectionId;
        const personaId = updatedScreenplay.personaId;
        const aiModel = updatedScreenplay.aiModel || 'gemini';

        if (creativeDirectionId && personaId) {
          // 使用原有的创意方向和人设生成新剧本
          const newScreenplays = await this.generateScreenplaysAsync({
            projectId: updatedScreenplay.projectId,
            creativeDirectionId,
            personaId,
            aiModel,
            count: 1,
          });

          if (newScreenplays.length > 0) {
            newScreenplay = newScreenplays[0];
            console.log(`[AsideScreenplayRepository] 已自动生成新剧本补充: ${newScreenplay.id}`);
          }
        }
      } catch (error) {
        console.warn('[AsideScreenplayRepository] 自动生成补充剧本失败:', error);
        // 即使生成失败，也不影响主流程
      }

      return { screenplay: updatedScreenplay, newScreenplay };
    } catch (error) {
      console.error('[AsideScreenplayRepository] 添加剧本到待产库失败:', error);
      throw error;
    }
  }

  /**
   * 从待产库移除剧本
   * @param screenplayId 剧本 ID
   */
  removeScreenplayFromLibrary(screenplayId: string): void {
    // 参数验证
    if (!screenplayId || screenplayId.trim() === '') {
      throw new Error('剧本 ID 不能为空');
    }

    try {
      const db = getDatabase();

      // 检查剧本状态
      const row = db.prepare(`
        SELECT status FROM aside_screenplays WHERE id = ?
      `).get(screenplayId) as { status: string } | undefined;

      if (!row) {
        throw new Error(`剧本不存在：ID ${screenplayId}`);
      }

      if (row.status !== 'library') {
        throw new Error('只能移除待产库中的剧本');
      }

      // 删除剧本（而不是改变状态）
      const result = db.prepare(`DELETE FROM aside_screenplays WHERE id = ?`).run(screenplayId);

      console.log(`[AsideScreenplayRepository] 成功从待产库移除剧本 ID: ${screenplayId}，影响行数: ${result.changes}`);
    } catch (error) {
      console.error('[AsideScreenplayRepository] 从待产库移除剧本失败:', error);
      throw error;
    }
  }

  /**
   * 更新剧本内容
   * @param screenplayId 剧本 ID
   * @param content 新的剧本内容
   */
  updateScreenplayContent(screenplayId: string, content: string): void {
    // 参数验证
    if (!screenplayId || screenplayId.trim() === '') {
      throw new Error('剧本 ID 不能为空');
    }

    if (!content || content.trim() === '') {
      throw new Error('剧本内容不能为空');
    }

    try {
      const db = getDatabase();

      // 检查剧本是否存在
      const existing = db.prepare(`
        SELECT id FROM aside_screenplays WHERE id = ?
      `).get(screenplayId) as { id: string } | undefined;

      if (!existing) {
        throw new Error(`剧本不存在：ID ${screenplayId}`);
      }

      // 更新内容
      const updateStatement = db.prepare(`
        UPDATE aside_screenplays
        SET content = ?
        WHERE id = ?
      `);

      const result = updateStatement.run(content, screenplayId);
      console.log(`[AsideScreenplayRepository] 成功更新剧本内容 ID: ${screenplayId}，影响行数: ${result.changes}`);
    } catch (error) {
      console.error('[AsideScreenplayRepository] 更新剧本内容失败:', error);
      throw error;
    }
  }

  /**
   * 重新生成剧本
   * @param screenplayId 剧本 ID
   * @returns 重新生成的剧本
   */
  async regenerateScreenplay(screenplayId: string): Promise<Screenplay> {
    // 参数验证
    if (!screenplayId || screenplayId.trim() === '') {
      throw new Error('剧本 ID 不能为空');
    }

    try {
      const db = getDatabase();

      // 获取原剧本信息
      const row = db.prepare(`
        SELECT id, project_id, content, creative_direction_id, persona_id, ai_model, status, created_at
        FROM aside_screenplays
        WHERE id = ?
      `).get(screenplayId) as ScreenplayRow | undefined;

      if (!row) {
        throw new Error(`剧本不存在：ID ${screenplayId}`);
      }

      const oldScreenplay = this.mapRowToScreenplay(row);

      // 获取创意方向和人设信息
      if (!oldScreenplay.creativeDirectionId || !oldScreenplay.personaId) {
        throw new Error('剧本缺少创意方向或人设信息，无法重新生成');
      }

      const creativeDirection = asideCreativeDirectionRepository.getCreativeDirections(oldScreenplay.projectId)
        .find(cd => cd.id === oldScreenplay.creativeDirectionId);

      if (!creativeDirection) {
        throw new Error(`创意方向不存在：ID ${oldScreenplay.creativeDirectionId}`);
      }

      const persona = asidePersonaRepository.getPersonas(oldScreenplay.projectId)
        .find(p => p.id === oldScreenplay.personaId);

      if (!persona) {
        throw new Error(`人设不存在：ID ${oldScreenplay.personaId}`);
      }

      // 使用剧本写作 Agent 重新生成
      const regionId = oldScreenplay.region || 'universal';
      const region = regionId !== 'universal'
        ? await asideRegionRepository.getRegionById(regionId)
        : null;
      const cultureProfile = region?.culturalProfile ?? '';

      const projectRow = db.prepare(`
        SELECT id, name, game_type, selling_point
        FROM aside_projects
        WHERE id = ?
      `).get(oldScreenplay.projectId) as { id: string; name: string; game_type: string; selling_point: string | null };

      if (!projectRow) {
        throw new Error(`项目不存在：ID ${oldScreenplay.projectId}`);
      }

      const project = {
        id: projectRow.id,
        name: projectRow.name,
        gameType: projectRow.game_type,
        sellingPoint: projectRow.selling_point || undefined,
      };

      // 调用剧本写作 Agent
      const result = await runScreenplayAgent(
        {
          project,
          creativeDirection,
          persona,
          cultureProfile,
          regionName: region?.name,
        },
        { currentIndex: 1, totalCount: 1 },
        { info: console.log }
      );

      // 更新剧本内容
      const newContent = JSON.stringify(result, null, 2);

      const updateStatement = db.prepare(`
        UPDATE aside_screenplays
        SET content = ?
        WHERE id = ?
      `);

      updateStatement.run(newContent, screenplayId);

      // 查询并返回更新后的剧本
      const updatedRow = db.prepare(`
        SELECT id, project_id, content, creative_direction_id, persona_id, ai_model, status, created_at
        FROM aside_screenplays
        WHERE id = ?
      `).get(screenplayId) as ScreenplayRow;

      console.log(`[AsideScreenplayRepository] 成功重新生成剧本: ${screenplayId}`);
      return this.mapRowToScreenplay(updatedRow);
    } catch (error) {
      console.error('[AsideScreenplayRepository] 重新生成剧本失败:', error);
      throw error;
    }
  }

  // ==================== 工具方法 ====================

  /**
   * 映射数据库行到脚本对象
   * @param row 数据库行
   * @returns 脚本对象
   */
  private mapRowToScreenplay(row: ScreenplayRow): Screenplay {
    return {
      id: row.id,
      projectId: row.project_id,
      content: row.content,
      creativeDirectionId: row.creative_direction_id || undefined,
      personaId: row.persona_id || undefined,
      region: row.region || undefined,
      aiModel: (row.ai_model as AIModel) || undefined,
      status: row.status as ScreenplayStatus,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }
}

// 导出单例
export const asideScreenplayRepository = new AsideScreenplayRepository();
