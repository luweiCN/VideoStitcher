/**
 * A面视频生产 - 预设数据常量
 *
 * 定义创意方向和人设的预设数据
 * 新建项目时自动插入这些预设数据
 */

import type { CreativeDirection, Persona } from '../types/aside';

/**
 * 预设创意方向
 * 新建项目时自动插入这些创意方向
 */
export const PRESET_CREATIVE_DIRECTIONS: Omit<CreativeDirection, 'id' | 'projectId' | 'createdAt'>[] = [
  {
    name: '幽默诙谐',
    iconName: 'Laugh',
    description: '轻松搞笑,化解输牌尴尬',
    isPreset: true
  },
  {
    name: '悬疑剧情',
    iconName: 'Ghost',
    description: '反转不断,悬念拉满',
    isPreset: true
  },
  {
    name: '搞笑沙雕',
    iconName: 'Sparkles',
    description: '脑洞大开,魔性洗脑',
    isPreset: true
  },
  {
    name: '麻将教学',
    iconName: 'BookOpen',
    description: '干货满满,实战教学',
    isPreset: true
  },
  {
    name: '搞笑解说',
    iconName: 'Mic2',
    description: '毒舌点评,神级复盘',
    isPreset: true
  }
];

/**
 * 预设人设
 * 新建项目时自动插入这些人设
 */
export const PRESET_PERSONAS: Omit<Persona, 'id' | 'projectId' | 'createdAt'>[] = [
  {
    name: '民俗老炮',
    prompt: '资深老玩家,混迹牌馆30年,说话接地气,懂民间智慧',
    isPreset: true
  },
  {
    name: '5G冲浪手',
    prompt: '玩梗大师,网感极强,喜欢用网络热词,语言新潮',
    isPreset: true
  },
  {
    name: '故事大王',
    prompt: '擅长讲故事,能把一把牌讲成连续剧,语言生动',
    isPreset: true
  },
  {
    name: '数据分析师',
    prompt: '理性分析派,喜欢用数据说话,逻辑清晰',
    isPreset: true
  }
];
