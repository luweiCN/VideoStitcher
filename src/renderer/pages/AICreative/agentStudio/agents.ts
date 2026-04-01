import { FileText, Palette, Lightbulb, Sparkles, Users, Video, Film } from 'lucide-react';
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
    id: 'writer-generator-agent',
    name: '编剧生成 Agent',
    role: '人设创建',
    description:
      '根据游戏信息生成专属的编剧人设，决定剧本的语言风格和叙事方式。支持一键生成和按名称生成两种模式，同时产出人物特点标签。',
    icon: Sparkles,
    iconColor: 'text-pink-400',
    bgColor: 'bg-pink-500/10 group-hover:bg-pink-500',
    modelTypes: ['text'],
  },
  {
    id: 'screenplay-agent',
    name: '剧本写作 Agent',
    role: '内容创作',
    description:
      '根据游戏信息、创意方向、编剧人设和文化档案，生成 15 秒短视频广告剧本。严格遵循「黄金 3 秒钩子 → 无厘头反转 → B 面衔接」三段式结构，支持自定义提示词模板优化创作风格。',
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
  {
    id: 'casting-director-agent',
    name: '选角导演 Agent',
    role: '角色设计',
    description:
      '根据艺术总监的角色描述，为每个角色生成三个视角（正面、侧面、动作姿态）的图像生成提示词，确保角色形象的一致性和可生成性。',
    icon: Users,
    iconColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 group-hover:bg-emerald-500',
    modelTypes: ['text'],
  },
  {
    id: 'cinematographer-planner-agent',
    name: '摄像师 - 规划器',
    role: '视频规划',
    description:
      '分析分镜输出，根据视频生成模型能力制定渲染计划（分几段、每段时长、镜头运动）。支持参考图的模型用单阶段，只支持首尾帧的用多阶段。',
    icon: Video,
    iconColor: 'text-orange-400',
    bgColor: 'bg-orange-500/10 group-hover:bg-orange-500',
    modelTypes: ['text'],
  },
  {
    id: 'cinematographer-executor-agent',
    name: '摄像师 - 执行器',
    role: '视频生成',
    description:
      '根据渲染计划逐段生成视频片段，使用 ffmpeg 拼接成最终视频。支持首帧图和尾帧图作为关键帧参考。',
    icon: Film,
    iconColor: 'text-red-400',
    bgColor: 'bg-red-500/10 group-hover:bg-red-500',
    modelTypes: ['video'],
  },
];

export default AGENTS;
