import { FileText, Palette, Lightbulb } from 'lucide-react';
import type { AgentConfig } from './types';

const AGENTS: AgentConfig[] = [
  {
    id: 'creative-direction-agent',
    name: '创意方向生成 Agent',
    role: '创意策划',
    description:
      '根据游戏名称、类型和核心卖点，自动生成项目专属的创意方向选项，替代通用预设，让每个项目都有量身定制的创作风格。',
    icon: Lightbulb,
    iconColor: 'text-amber-400',
    bgColor: 'bg-amber-500/10 group-hover:bg-amber-500',
    modelTypes: ['text'],
  },
  {
    id: 'screenplay-agent',
    name: '剧本写作 Agent',
    role: '内容创作',
    description:
      '根据游戏信息、创意方向和目标受众，生成 15 秒短视频广告剧本。负责黄金 3 秒钩子、无厘头反转、B 面衔接三段式结构。',
    icon: FileText,
    iconColor: 'text-violet-400',
    bgColor: 'bg-violet-500/10 group-hover:bg-violet-500',
    modelTypes: ['text'],
  },
  {
    id: 'art-director-agent',
    name: '艺术总监 Agent',
    role: '视觉设计',
    description:
      '分析剧本内容，设计角色形象与整体视觉风格，生成人物三视图图像提示词，为后续分镜和图像生成提供视觉方向指引。',
    icon: Palette,
    iconColor: 'text-blue-400',
    bgColor: 'bg-blue-500/10 group-hover:bg-blue-500',
    modelTypes: ['text', 'image'],
  },
];

export default AGENTS;
