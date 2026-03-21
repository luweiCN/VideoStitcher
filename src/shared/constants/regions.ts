/**
 * 区域数据常量
 * 定义中国地理区域分组（静态常量，用于 RegionSelector 下拉）
 */

/**
 * 静态地区选项（与数据库 Region 表解耦，保留向后兼容）
 */
export interface RegionOption {
  id: string;
  name: string;
  emoji: string;
  group: string;
}

/**
 * 区域列表
 * 按地理分组排列
 */
export const REGIONS: RegionOption[] = [
  // 全国通用
  { id: 'universal', name: '全国通用', emoji: '🌐', group: '通用' },

  // 华北
  { id: 'beijing', name: '北京', emoji: '🏛️', group: '华北' },
  { id: 'tianjin', name: '天津', emoji: '🏰', group: '华北' },
  { id: 'hebei', name: '河北', emoji: '🏔️', group: '华北' },
  { id: 'shanxi', name: '山西', emoji: '🏺', group: '华北' },
  { id: 'inner-mongolia', name: '内蒙古', emoji: '🐎', group: '华北' },

  // 东北
  { id: 'liaoning', name: '辽宁', emoji: '🏭', group: '东北' },
  { id: 'jilin', name: '吉林', emoji: '🌲', group: '东北' },
  { id: 'heilongjiang', name: '黑龙江', emoji: '❄️', group: '东北' },

  // 华东
  { id: 'shanghai', name: '上海', emoji: '🌃', group: '华东' },
  { id: 'jiangsu', name: '江苏', emoji: '🌸', group: '华东' },
  { id: 'zhejiang', name: '浙江', emoji: '🍵', group: '华东' },
  { id: 'anhui', name: '安徽', emoji: '🏔️', group: '华东' },
  { id: 'fujian', name: '福建', emoji: '🫖', group: '华东' },
  { id: 'jiangxi', name: '江西', emoji: '🌄', group: '华东' },
  { id: 'shandong', name: '山东', emoji: '⛽', group: '华东' },

  // 华中
  { id: 'henan', name: '河南', emoji: '🏯', group: '华中' },
  { id: 'hubei', name: '湖北', emoji: '🏞️', group: '华中' },
  { id: 'hunan', name: '湖南', emoji: '🌶️', group: '华中' },

  // 华南
  { id: 'guangdong', name: '广东', emoji: '🌺', group: '华南' },
  { id: 'guangxi', name: '广西', emoji: '🌴', group: '华南' },
  { id: 'hainan', name: '海南', emoji: '🏖️', group: '华南' },

  // 西南
  { id: 'chongqing', name: '重庆', emoji: '🌉', group: '西南' },
  { id: 'sichuan', name: '四川', emoji: '🐼', group: '西南' },
  { id: 'guizhou', name: '贵州', emoji: '🏔️', group: '西南' },
  { id: 'yunnan', name: '云南', emoji: '🦚', group: '西南' },
  { id: 'tibet', name: '西藏', emoji: '🏔️', group: '西南' },

  // 西北
  { id: 'shaanxi', name: '陕西', emoji: '🏛️', group: '西北' },
  { id: 'gansu', name: '甘肃', emoji: '🐪', group: '西北' },
  { id: 'qinghai', name: '青海', emoji: '🦅', group: '西北' },
  { id: 'ningxia', name: '宁夏', emoji: '🕌', group: '西北' },
  { id: 'xinjiang', name: '新疆', emoji: '🍇', group: '西北' },

  // 港澳台
  { id: 'hongkong', name: '香港', emoji: '🌃', group: '港澳台' },
  { id: 'macau', name: '澳门', emoji: '🎰', group: '港澳台' },
  { id: 'taiwan', name: '台湾', emoji: '🏝️', group: '港澳台' },
];

/**
 * 获取区域分组列表
 */
export function getRegionGroups(): { group: string; regions: RegionOption[] }[] {
  const groupMap = new Map<string, RegionOption[]>();

  REGIONS.forEach(region => {
    if (!groupMap.has(region.group)) {
      groupMap.set(region.group, []);
    }
    groupMap.get(region.group)!.push(region);
  });

  return Array.from(groupMap.entries()).map(([group, regions]) => ({
    group,
    regions,
  }));
}
