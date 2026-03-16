/**
 * 脚本仓库
 * 负责脚本数据的 CRUD 操作
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../index';
import type { Script, AIModel, ScriptStatus } from '@shared/types/aside';
import { asideCreativeDirectionRepository } from './asideCreativeDirectionRepository';
import { asidePersonaRepository } from './asidePersonaRepository';

/**
 * 数据库行类型
 */
interface ScriptRow {
  id: string;
  project_id: string;
  content: string;
  creative_direction_id: string | null;
  persona_id: string | null;
  ai_model: string | null;
  status: string;
  created_at: number;
}

export class AsideScriptRepository {
  // ==================== 查询 ====================

  /**
   * 获取待产库中的所有脚本
   * @param projectId 项目 ID
   * @returns 待产库脚本列表
   */
  getLibraryScripts(projectId: string): Script[] {
    // 参数验证
    if (!projectId || projectId.trim() === '') {
      throw new Error('项目 ID 不能为空');
    }

    try {
      const db = getDatabase();
      const rows = db.prepare(`
        SELECT id, project_id, content, creative_direction_id, persona_id, ai_model, status, created_at
        FROM aside_scripts
        WHERE project_id = ? AND status = 'library'
        ORDER BY created_at ASC
      `).all(projectId) as ScriptRow[];

      console.log(`[AsideScriptRepository] 查询到 ${rows.length} 个待产库脚本`);
      return rows.map(row => this.mapRowToScript(row));
    } catch (error) {
      console.error('[AsideScriptRepository] 查询待产库脚本失败:', error);
      throw error;
    }
  }

  // ==================== 生成 ====================

  /**
   * 生成脚本
   * ⚠️ 暂时使用 mock 内容，后续集成 LangGraph AI
   * @param data 生成参数
   * @returns 生成的脚本数组
   */
  generateScripts(data: {
    projectId: string;
    creativeDirectionId: string;
    personaId: string;
    aiModel: string;
    count: number;
  }): Script[] {
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

      const scripts: Script[] = [];

      // 使用 for 循环生成指定数量的脚本
      for (let i = 0; i < data.count; i++) {
        const id = uuidv4();
        const now = Date.now();

        // 生成 mock 内容
        const mockContent = this.generateMockContent(creativeDirection.name, persona.name, data.aiModel, i + 1);

        // 插入数据库
        const insertStatement = db.prepare(`
          INSERT INTO aside_scripts (id, project_id, content, creative_direction_id, persona_id, ai_model, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertStatement.run(
          id,
          data.projectId,
          mockContent,
          data.creativeDirectionId,
          data.personaId,
          data.aiModel,
          'draft',
          now
        );

        // 查询并添加到返回数组
        const row = db.prepare(`
          SELECT id, project_id, content, creative_direction_id, persona_id, ai_model, status, created_at
          FROM aside_scripts
          WHERE id = ?
        `).get(id) as ScriptRow;

        if (row) {
          scripts.push(this.mapRowToScript(row));
        }
      }

      console.log(`[AsideScriptRepository] 成功生成 ${scripts.length} 个脚本`);
      return scripts;
    } catch (error) {
      console.error('[AsideScriptRepository] 生成脚本失败:', error);
      throw error;
    }
  }

  // ==================== 更新 ====================

  /**
   * 添加脚本到待产库
   * ⚠️ 关键：添加到待产库后，自动生成 1 个新脚本补充
   * @param scriptId 脚本 ID
   * @returns 更新后的脚本和新补充的脚本
   */
  addScriptToLibrary(scriptId: string): { script: Script; newScript?: Script } {
    // 参数验证
    if (!scriptId || scriptId.trim() === '') {
      throw new Error('脚本 ID 不能为空');
    }

    try {
      const db = getDatabase();

      // 1. 将脚本状态更新为 'library'
      const updateStatement = db.prepare(`
        UPDATE aside_scripts
        SET status = 'library'
        WHERE id = ?
      `);

      const result = updateStatement.run(scriptId);

      if (result.changes === 0) {
        throw new Error(`脚本不存在：ID ${scriptId}`);
      }

      // 查询更新后的脚本
      const updatedRow = db.prepare(`
        SELECT id, project_id, content, creative_direction_id, persona_id, ai_model, status, created_at
        FROM aside_scripts
        WHERE id = ?
      `).get(scriptId) as ScriptRow;

      const updatedScript = this.mapRowToScript(updatedRow);

      console.log(`[AsideScriptRepository] 脚本已添加到待产库: ${scriptId}`);

      // 2. 生成 1 个新脚本补充
      let newScript: Script | undefined;

      try {
        // 获取项目中的任意一个创意方向和人设（或使用原有的）
        const creativeDirectionId = updatedScript.creativeDirectionId;
        const personaId = updatedScript.personaId;
        const aiModel = updatedScript.aiModel || 'gemini';

        if (creativeDirectionId && personaId) {
          // 使用原有的创意方向和人设生成新脚本
          const newScripts = this.generateScripts({
            projectId: updatedScript.projectId,
            creativeDirectionId,
            personaId,
            aiModel,
            count: 1,
          });

          if (newScripts.length > 0) {
            newScript = newScripts[0];
            console.log(`[AsideScriptRepository] 已自动生成新脚本补充: ${newScript.id}`);
          }
        }
      } catch (error) {
        console.warn('[AsideScriptRepository] 自动生成补充脚本失败:', error);
        // 即使生成失败，也不影响主流程
      }

      return { script: updatedScript, newScript };
    } catch (error) {
      console.error('[AsideScriptRepository] 添加脚本到待产库失败:', error);
      throw error;
    }
  }

  /**
   * 从待产库移除脚本
   * @param scriptId 脚本 ID
   */
  removeScriptFromLibrary(scriptId: string): void {
    // 参数验证
    if (!scriptId || scriptId.trim() === '') {
      throw new Error('脚本 ID 不能为空');
    }

    try {
      const db = getDatabase();

      // 检查脚本状态
      const row = db.prepare(`
        SELECT status FROM aside_scripts WHERE id = ?
      `).get(scriptId) as { status: string } | undefined;

      if (!row) {
        throw new Error(`脚本不存在：ID ${scriptId}`);
      }

      if (row.status !== 'library') {
        throw new Error('只能移除待产库中的脚本');
      }

      // 删除脚本（而不是改变状态）
      const result = db.prepare(`DELETE FROM aside_scripts WHERE id = ?`).run(scriptId);

      console.log(`[AsideScriptRepository] 成功从待产库移除脚本 ID: ${scriptId}，影响行数: ${result.changes}`);
    } catch (error) {
      console.error('[AsideScriptRepository] 从待产库移除脚本失败:', error);
      throw error;
    }
  }

  /**
   * 更新脚本内容
   * @param scriptId 脚本 ID
   * @param content 新的脚本内容
   */
  updateScriptContent(scriptId: string, content: string): void {
    // 参数验证
    if (!scriptId || scriptId.trim() === '') {
      throw new Error('脚本 ID 不能为空');
    }

    if (!content || content.trim() === '') {
      throw new Error('脚本内容不能为空');
    }

    try {
      const db = getDatabase();

      // 检查脚本是否存在
      const existing = db.prepare(`
        SELECT id FROM aside_scripts WHERE id = ?
      `).get(scriptId) as { id: string } | undefined;

      if (!existing) {
        throw new Error(`脚本不存在：ID ${scriptId}`);
      }

      // 更新内容
      const updateStatement = db.prepare(`
        UPDATE aside_scripts
        SET content = ?
        WHERE id = ?
      `);

      const result = updateStatement.run(content, scriptId);
      console.log(`[AsideScriptRepository] 成功更新脚本内容 ID: ${scriptId}，影响行数: ${result.changes}`);
    } catch (error) {
      console.error('[AsideScriptRepository] 更新脚本内容失败:', error);
      throw error;
    }
  }

  /**
   * 重新生成脚本
   * @param scriptId 脚本 ID
   * @returns 重新生成的脚本
   */
  regenerateScript(scriptId: string): Script {
    // 参数验证
    if (!scriptId || scriptId.trim() === '') {
      throw new Error('脚本 ID 不能为空');
    }

    try {
      const db = getDatabase();

      // 获取原脚本信息
      const row = db.prepare(`
        SELECT id, project_id, content, creative_direction_id, persona_id, ai_model, status, created_at
        FROM aside_scripts
        WHERE id = ?
      `).get(scriptId) as ScriptRow | undefined;

      if (!row) {
        throw new Error(`脚本不存在：ID ${scriptId}`);
      }

      const oldScript = this.mapRowToScript(row);

      // 获取创意方向和人设信息
      if (!oldScript.creativeDirectionId || !oldScript.personaId) {
        throw new Error('脚本缺少创意方向或人设信息，无法重新生成');
      }

      const creativeDirection = asideCreativeDirectionRepository.getCreativeDirections(oldScript.projectId)
        .find(cd => cd.id === oldScript.creativeDirectionId);

      if (!creativeDirection) {
        throw new Error(`创意方向不存在：ID ${oldScript.creativeDirectionId}`);
      }

      const persona = asidePersonaRepository.getPersonas(oldScript.projectId)
        .find(p => p.id === oldScript.personaId);

      if (!persona) {
        throw new Error(`人设不存在：ID ${oldScript.personaId}`);
      }

      // 生成新的 mock 内容
      const newContent = this.generateMockContent(
        creativeDirection.name,
        persona.name,
        oldScript.aiModel || 'gemini',
        Date.now() // 使用时间戳作为随机种子
      );

      // 更新脚本内容
      const updateStatement = db.prepare(`
        UPDATE aside_scripts
        SET content = ?
        WHERE id = ?
      `);

      updateStatement.run(newContent, scriptId);

      // 查询并返回更新后的脚本
      const updatedRow = db.prepare(`
        SELECT id, project_id, content, creative_direction_id, persona_id, ai_model, status, created_at
        FROM aside_scripts
        WHERE id = ?
      `).get(scriptId) as ScriptRow;

      console.log(`[AsideScriptRepository] 成功重新生成脚本: ${scriptId}`);
      return this.mapRowToScript(updatedRow);
    } catch (error) {
      console.error('[AsideScriptRepository] 重新生成脚本失败:', error);
      throw error;
    }
  }

  // ==================== 工具方法 ====================

  /**
   * 生成 mock 内容
   * @param creativeDirectionName 创意方向名称
   * @param personaName 人设名称
   * @param aiModel AI 模型
   * @param seed 随机种子
   * @returns mock 脚本内容
   */
  private generateMockContent(
    creativeDirectionName: string,
    personaName: string,
    aiModel: string,
    seed: number
  ): string {
    return `# 脚本标题 - ${seed}

这是一个生成的脚本内容。

**创意方向：** ${creativeDirectionName}
**人设：** ${personaName}
**AI 模型：** ${aiModel}

---

## 场景1

（这里是对话内容）

**角色 A：** 今天天气真不错啊！

**角色 B：** 是啊，很适合出去走走。

---

## 场景2

（这里是旁白内容）

随着太阳缓缓升起，新的一天开始了...

---

## 场景3

**角色 A：** 我们去公园吧！

**角色 B：** 好主意！

---

*生成时间: ${new Date().toLocaleString('zh-CN')}*
`;
  }

  /**
   * 映射数据库行到脚本对象
   * @param row 数据库行
   * @returns 脚本对象
   */
  private mapRowToScript(row: ScriptRow): Script {
    return {
      id: row.id,
      projectId: row.project_id,
      content: row.content,
      creativeDirectionId: row.creative_direction_id || undefined,
      personaId: row.persona_id || undefined,
      aiModel: (row.ai_model as AIModel) || undefined,
      status: row.status as ScriptStatus,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }
}

// 导出单例
export const asideScriptRepository = new AsideScriptRepository();
