/**
 * 地区文化档案模块
 *
 * 根据地区 ID 获取对应的文化档案内容
 */

import { REGION_PRESETS } from '@shared/constants/regionPresets';

/**
 * 获取指定地区的文化档案
 *
 * @param regionId - 地区 ID（如 'region_general_cn', 'region_sichuan' 等）
 * @returns 文化档案字符串，如果找不到则返回全国通用的档案
 */
export function getCultureProfile(regionId: string | undefined): string {
  // 默认使用全国通用
  const targetId = regionId || 'region_general_cn';

  // 查找对应地区的预置数据
  const region = REGION_PRESETS.find(r => r.id === targetId);

  if (region && region.culturalProfile) {
    return region.culturalProfile;
  }

  // 如果找不到指定地区，返回全国通用档案
  const generalRegion = REGION_PRESETS.find(r => r.id === 'region_general_cn');
  return generalRegion?.culturalProfile || '';
}

/**
 * 获取所有可用地区列表（用于调试或展示）
 */
export function getAvailableRegions(): { id: string; name: string }[] {
  return REGION_PRESETS
    .filter(r => r.culturalProfile && r.culturalProfile.length > 0)
    .map(r => ({ id: r.id, name: r.name }));
}
