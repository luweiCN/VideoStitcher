/**
 * 地区仓库
 * 负责地区数据的 CRUD 操作（全局，不绑定项目）
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../index';
import type { Region } from '@shared/types/aside';
import { REGION_PRESETS } from '@shared/constants/regionPresets';

/**
 * 数据库行类型
 */
interface RegionRow {
  id: string;
  name: string;
  parent_id: string | null;
  level: number;
  cultural_profile: string;
  emoji: string;
  icon_type: string | null;
  icon_value: string | null;
  is_preset: number;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export class RegionRepository {
  // ==================== 查询 ====================

  /**
   * 获取所有启用的地区（平铺列表，前端自行建树）
   */
  getAllRegions(): Region[] {
    try {
      const db = getDatabase();
      const rows = db.prepare(`
        SELECT id, name, parent_id, level, cultural_profile, emoji, icon_type, icon_value,
               is_preset, is_active, sort_order, created_at, updated_at
        FROM regions
        WHERE is_active = 1
        ORDER BY level ASC, sort_order ASC, name ASC
      `).all() as RegionRow[];

      console.log(`[RegionRepository] 查询到 ${rows.length} 个地区`);
      return rows.map((row) => this.mapRow(row));
    } catch (error) {
      console.error('[RegionRepository] 查询地区列表失败:', error);
      throw error;
    }
  }

  /**
   * 根据 ID 获取地区
   */
  getRegionById(id: string): Region | null {
    if (!id?.trim()) throw new Error('地区 ID 不能为空');

    try {
      const db = getDatabase();
      const row = db.prepare(`
        SELECT id, name, parent_id, level, cultural_profile, emoji, icon_type, icon_value,
               is_preset, is_active, sort_order, created_at, updated_at
        FROM regions WHERE id = ?
      `).get(id) as RegionRow | undefined;

      return row ? this.mapRow(row) : null;
    } catch (error) {
      console.error('[RegionRepository] 查询地区失败:', error);
      throw error;
    }
  }

  // ==================== 创建 ====================

  /**
   * 添加地区
   */
  addRegion(data: {
    name: string;
    parentId?: string | null;
    level?: number;
    emoji?: string;
    iconType?: string | null;
    iconValue?: string | null;
    culturalProfile?: string;
    sortOrder?: number;
  }): Region {
    if (!data.name?.trim()) throw new Error('地区名称不能为空');

    try {
      const db = getDatabase();
      const id = `region_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
      const now = new Date().toISOString();

      // 自动推断 level
      let level = data.level ?? 1;
      if (data.parentId) {
        const parent = this.getRegionById(data.parentId);
        if (parent) level = parent.level + 1;
      }

      db.prepare(`
        INSERT INTO regions (id, name, parent_id, level, cultural_profile, emoji, icon_type, icon_value,
                             is_preset, is_active, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?)
      `).run(
        id,
        data.name.trim(),
        data.parentId ?? null,
        level,
        data.culturalProfile ?? '',
        data.emoji ?? '',
        data.iconType ?? null,
        data.iconValue ?? null,
        data.sortOrder ?? 999,
        now,
        now,
      );

      const created = this.getRegionById(id);
      if (!created) throw new Error(`地区创建失败：无法找到 ID ${id}`);

      console.log(`[RegionRepository] 成功创建地区: ${data.name}`);
      return created;
    } catch (error) {
      console.error('[RegionRepository] 创建地区失败:', error);
      throw error;
    }
  }

  // ==================== 更新 ====================

  /**
   * 更新地区信息
   */
  updateRegion(
    id: string,
    data: {
      name?: string;
      parentId?: string | null;
      emoji?: string;
      iconType?: string | null;
      iconValue?: string | null;
      culturalProfile?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
  ): void {
    if (!id?.trim()) throw new Error('地区 ID 不能为空');

    try {
      const db = getDatabase();

      const existing = db.prepare('SELECT id FROM regions WHERE id = ?').get(id) as
        | { id: string }
        | undefined;
      if (!existing) throw new Error(`地区不存在：ID ${id}`);

      const updates: string[] = [];
      const values: unknown[] = [];

      if (data.name !== undefined) {
        if (!data.name.trim()) throw new Error('地区名称不能为空');
        updates.push('name = ?');
        values.push(data.name.trim());
      }
      if (data.parentId !== undefined) {
        updates.push('parent_id = ?');
        values.push(data.parentId);
      }
      if (data.emoji !== undefined) {
        updates.push('emoji = ?');
        values.push(data.emoji);
      }
      if (data.iconType !== undefined) {
        updates.push('icon_type = ?');
        values.push(data.iconType);
      }
      if (data.iconValue !== undefined) {
        updates.push('icon_value = ?');
        values.push(data.iconValue);
      }
      if (data.culturalProfile !== undefined) {
        updates.push('cultural_profile = ?');
        values.push(data.culturalProfile);
      }
      if (data.sortOrder !== undefined) {
        updates.push('sort_order = ?');
        values.push(data.sortOrder);
      }
      if (data.isActive !== undefined) {
        updates.push('is_active = ?');
        values.push(data.isActive ? 1 : 0);
      }

      if (updates.length === 0) throw new Error('没有提供要更新的数据');

      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);

      db.prepare(`UPDATE regions SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      console.log(`[RegionRepository] 成功更新地区 ID: ${id}`);
    } catch (error) {
      console.error('[RegionRepository] 更新地区失败:', error);
      throw error;
    }
  }

  // ==================== 删除 ====================

  /**
   * 删除地区
   */
  deleteRegion(id: string): void {
    if (!id?.trim()) throw new Error('地区 ID 不能为空');

    try {
      const db = getDatabase();

      const row = db.prepare('SELECT id FROM regions WHERE id = ?').get(id) as
        | { id: string }
        | undefined;
      if (!row) throw new Error(`地区不存在：ID ${id}`);

      db.prepare('DELETE FROM regions WHERE id = ?').run(id);
      console.log(`[RegionRepository] 成功删除地区 ID: ${id}`);
    } catch (error) {
      console.error('[RegionRepository] 删除地区失败:', error);
      throw error;
    }
  }

  // ==================== 工具方法 ====================

  private mapRow(row: RegionRow): Region {
    return {
      id: row.id,
      name: row.name,
      parentId: row.parent_id ?? undefined,
      level: row.level,
      culturalProfile: row.cultural_profile ?? '',
      emoji: row.emoji ?? '',
      iconType: (row.icon_type as 'local' | 'url' | null) ?? undefined,
      iconValue: row.icon_value ?? undefined,
      isPreset: row.is_preset === 1,
      isActive: row.is_active === 1,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ==================== 预置数据管理 ====================

  /**
   * 批量插入预置数据
   */
  private seedPresets(): void {
    const db = getDatabase();
    const now = new Date().toISOString();

    const insert = db.prepare(`
      INSERT OR REPLACE INTO regions
        (id, name, parent_id, level, cultural_profile, emoji, is_preset, is_active, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?)
    `);

    const insertMany = db.transaction(() => {
      for (const preset of REGION_PRESETS) {
        insert.run(
          preset.id,
          preset.name,
          preset.parentId ?? null,
          preset.level,
          preset.culturalProfile ?? '',
          preset.emoji ?? '',
          preset.sortOrder,
          now,
          now,
        );
      }
    });

    insertMany();
    console.log(`[RegionRepository] 成功植入 ${REGION_PRESETS.length} 条预置地区数据`);
  }

  /**
   * 确保预置数据已植入（启动时调用）
   * 若数据库中没有任何 is_preset=1 的记录，则执行初始化种子
   */
  ensurePresetsSeeded(): void {
    try {
      const db = getDatabase();
      const result = db
        .prepare('SELECT COUNT(*) as count FROM regions WHERE is_preset = 1')
        .get() as { count: number };

      if (result.count === 0) {
        console.log('[RegionRepository] 未发现预置地区数据，开始初始化...');
        this.seedPresets();
      } else {
        console.log(`[RegionRepository] 已有 ${result.count} 条预置地区数据，跳过初始化`);
      }
    } catch (error) {
      console.error('[RegionRepository] 检查预置数据失败:', error);
      throw error;
    }
  }

  /**
   * 重置预置数据：删除所有 is_preset=1 的记录，重新植入
   */
  resetPresets(): void {
    try {
      const db = getDatabase();

      db.transaction(() => {
        db.prepare('DELETE FROM regions WHERE is_preset = 1').run();
        console.log('[RegionRepository] 已清除旧预置数据');
      })();

      this.seedPresets();
      console.log('[RegionRepository] 预置数据重置完成');
    } catch (error) {
      console.error('[RegionRepository] 重置预置数据失败:', error);
      throw error;
    }
  }
}

// 导出单例
export const regionRepository = new RegionRepository();
