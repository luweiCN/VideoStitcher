/**
 * 剧本仓库
 * 负责剧本数据的 CRUD 操作
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../index';
import type { Screenplay, AIModel, ScreenplayStatus } from '@shared/types/aside';
import { asideCreativeDirectionRepository } from './asideCreativeDirectionRepository';
import { asidePersonaRepository } from './asidePersonaRepository';
import { getGlobalProvider } from '../../ai/provider-manager';

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
  created_at: number;
}

export class AsideScreenplayRepository {
  // ==================== 查询 ====================

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
   * 使用 LangGraph AI 工作流生成真实剧本内容
   * @param data 生成参数
   * @returns 生成的剧本数组
   */
  async generateScreenplaysAsync(data: {
    projectId: string;
    creativeDirectionId: string;
    personaId: string;
    aiModel: string;
    count: number;
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

      // 获取 AI 提供商
      const provider = getGlobalProvider();
      const screenplays: Screenplay[] = [];

      console.log(`[AsideScreenplayRepository] 开始使用 AI 生成 ${data.count} 个剧本`);

      // 使用 for 循环生成指定数量的剧本
      for (let i = 0; i < data.count; i++) {
        const id = uuidv4();
        const now = Date.now();

        // 构建 AI 提示词
        const systemPrompt = this.buildScreenplaySystemPrompt(creativeDirection, persona);
        const userPrompt = this.buildScreenplayUserPrompt(i + 1);

        console.log(`[AsideScreenplayRepository] 生成第 ${i + 1}/${data.count} 个剧本...`);

        // 调用 AI 生成剧本
        const result = await provider.generateText(userPrompt, {
          temperature: 0.8,
          maxTokens: 1024,
          systemPrompt,
        });

        const screenplayContent = result.content;

        // 插入数据库
        const insertStatement = db.prepare(`
          INSERT INTO aside_screenplays (id, project_id, content, creative_direction_id, persona_id, ai_model, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertStatement.run(
          id,
          data.projectId,
          screenplayContent,
          data.creativeDirectionId,
          data.personaId,
          data.aiModel,
          'draft',
          now
        );

        // 查询并添加到返回数组
        const row = db.prepare(`
          SELECT id, project_id, content, creative_direction_id, persona_id, ai_model, status, created_at
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
  regenerateScreenplay(screenplayId: string): Screenplay {
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

      // 生成新的 mock 内容
      const newContent = this.generateMockContent(
        creativeDirection.name,
        persona.name,
        oldScreenplay.aiModel || 'gemini',
        Date.now() // 使用时间戳作为随机种子
      );

      // 更新剧本内容
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
  /**
   * 构建剧本生成的系统提示词
   */
  private buildScreenplaySystemPrompt(
    creativeDirection: { name: string; description?: string },
    persona: { name: string; prompt: string }
  ): string {
    return `你是一位专业的视频剧本编写专家。

角色设定：
- 你是"${persona.name}"：${persona.prompt}

创意方向：
- 方向：${creativeDirection.name}
- 描述：${creativeDirection.description || '无'}

任务：
根据以上信息生成一个短视频剧本，要求：
1. 符合角色设定和创意方向
2. 适合视频制作（包含场景描述、动作、对白）
3. 时长控制在 15-30 秒
4. 内容简洁有力，有吸引力

输出格式：
直接输出剧本内容，不要添加额外的说明或格式标记。`;
  }

  /**
   * 构建剧本生成的用户提示词
   */
  private buildScreenplayUserPrompt(index: number): string {
    return `请生成第 ${index} 个短视频剧本。

要求：
1. 时长：15-30 秒
2. 画幅比例：9:16（竖屏）
3. 包含清晰的场景描述、角色动作和对话
4. 内容要有戏剧性和吸引力`;
  }

  private mapRowToScreenplay(row: ScreenplayRow): Screenplay {
    return {
      id: row.id,
      projectId: row.project_id,
      content: row.content,
      creativeDirectionId: row.creative_direction_id || undefined,
      personaId: row.persona_id || undefined,
      aiModel: (row.ai_model as AIModel) || undefined,
      status: row.status as ScreenplayStatus,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }
}

// 导出单例
export const asideScreenplayRepository = new AsideScreenplayRepository();
