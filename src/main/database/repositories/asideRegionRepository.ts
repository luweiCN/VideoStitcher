/**
 * A面地区仓库
 * 负责地区数据的查询操作
 */

import { getDatabase } from '../index';
import type { Region } from '@shared/types/aside';

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
  created_at: number;
  updated_at: number;
}

/**
 * 根据 ID 获取地区
 */
export async function getRegionById(id: string): Promise<Region | null> {
  try {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT id, name, parent_id, level, cultural_profile, emoji,
             icon_type, icon_value, is_preset, is_active, sort_order,
             created_at, updated_at
      FROM regions
      WHERE id = ?
    `).get(id) as RegionRow | undefined;

    if (!row) return null;

    return mapRowToRegion(row);
  } catch (error) {
    console.error('[AsideRegionRepository] 查询地区失败:', error);
    throw error;
  }
}

/**
 * 获取所有启用的地区
 */
export async function getActiveRegions(): Promise<Region[]> {
  try {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT id, name, parent_id, level, cultural_profile, emoji,
             icon_type, icon_value, is_preset, is_active, sort_order,
             created_at, updated_at
      FROM regions
      WHERE is_active = 1
      ORDER BY sort_order ASC, name ASC
    `).all() as RegionRow[];

    return rows.map(mapRowToRegion);
  } catch (error) {
    console.error('[AsideRegionRepository] 查询地区列表失败:', error);
    throw error;
  }
}

/**
 * 映射数据库行到地区对象
 */
function mapRowToRegion(row: RegionRow): Region {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id || undefined,
    level: row.level,
    culturalProfile: row.cultural_profile,
    emoji: row.emoji,
    iconType: row.icon_type as 'local' | 'url' | undefined,
    iconValue: row.icon_value || undefined,
    isPreset: Boolean(row.is_preset),
    isActive: Boolean(row.is_active),
    sortOrder: row.sort_order,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

// 导出统一的对象（与其他 repository 保持一致）
export const asideRegionRepository = {
  getRegionById,
  getActiveRegions,
};

export default asideRegionRepository;
