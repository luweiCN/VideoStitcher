/**
 * 测试夹具数据
 * 用于 E2E 测试的模拟数据
 */

// 脚本风格测试数据
export const scriptStyles = [
  {
    id: 'style-1',
    name: '专业商务',
    description: '适合企业宣传片、产品介绍',
    icon: 'briefcase',
  },
  {
    id: 'style-2',
    name: '轻松活泼',
    description: '适合社交媒体、短视频',
    icon: 'smile',
  },
  {
    id: 'style-3',
    name: '技术讲解',
    description: '适合教程、技术分享',
    icon: 'code',
  },
  {
    id: 'style-4',
    name: '故事叙述',
    description: '适合品牌故事、纪录片',
    icon: 'book',
  },
];

// 脚本配置测试数据
export const scriptConfigs = [
  {
    id: 'config-1',
    topic: '产品功能介绍',
    duration: 60,
    audience: 'general',
    keywords: ['产品', '功能', '演示'],
    style: 'style-1',
    tone: 'professional',
    language: 'zh-CN',
  },
  {
    id: 'config-2',
    topic: '技术教程分享',
    duration: 120,
    audience: 'technical',
    keywords: ['技术', '教程', '编程'],
    style: 'style-3',
    tone: 'educational',
    language: 'zh-CN',
  },
  {
    id: 'config-3',
    topic: '品牌故事宣传',
    duration: 180,
    audience: 'general',
    keywords: ['品牌', '故事', '文化'],
    style: 'style-4',
    tone: 'emotional',
    language: 'zh-CN',
  },
];

// 生成的脚本测试数据
export const generatedScripts = [
  {
    id: 'script-1',
    title: '产品功能介绍脚本',
    content: `# 产品功能介绍

## 开场（0-10秒）
欢迎观看我们的产品功能介绍视频。今天我们将为您展示这款创新产品的核心功能。

## 主体内容（10-50秒）
### 功能一：智能识别
采用先进的AI技术，能够智能识别...

### 功能二：一键操作
简化操作流程，只需一键即可完成...

### 功能三：实时反馈
提供实时的数据反馈和分析...

## 结尾（50-60秒）
感谢您的观看，如需了解更多信息，请访问我们的官网。`,
    duration: 60,
    style: 'style-1',
    createdAt: '2024-01-01T10:00:00Z',
    status: 'completed',
  },
  {
    id: 'script-2',
    title: '技术教程脚本',
    content: `# 技术教程分享

## 开场（0-15秒）
大家好，今天我们来分享一个实用的技术教程...

## 第一步（15-45秒）
首先，我们需要准备开发环境...

## 第二步（45-90秒）
接下来，我们实现核心功能...

## 第三步（90-110秒）
最后，我们进行测试和优化...

## 总结（110-120秒）
通过本教程，我们学习了...`,
    duration: 120,
    style: 'style-3',
    createdAt: '2024-01-02T14:00:00Z',
    status: 'completed',
  },
  {
    id: 'script-3',
    title: '品牌故事脚本',
    content: `# 品牌故事宣传

## 序章（0-30秒）
在繁华的都市中，有一个关于梦想的故事...

## 发展（30-120秒）
从一个小小的创意，到改变行业的产品...

## 高潮（120-160秒）
当挑战来临时，我们如何突破...

## 尾声（160-180秒）
这就是我们的故事，也是每一个追梦人的故事...`,
    duration: 180,
    style: 'style-4',
    createdAt: '2024-01-03T09:00:00Z',
    status: 'completed',
  },
];

// 视频项目测试数据
export const videoProjects = [
  {
    id: 'project-1',
    name: '产品宣传视频',
    scriptId: 'script-1',
    status: 'pending',
    priority: 'high',
    createdAt: '2024-01-01T10:00:00Z',
  },
  {
    id: 'project-2',
    name: '教程录制视频',
    scriptId: 'script-2',
    status: 'processing',
    priority: 'medium',
    createdAt: '2024-01-02T14:00:00Z',
  },
  {
    id: 'project-3',
    name: '品牌故事视频',
    scriptId: 'script-3',
    status: 'completed',
    priority: 'low',
    createdAt: '2024-01-03T09:00:00Z',
  },
];

// API 响应模拟数据
export const apiResponses = {
  // 脚本生成成功响应
  generateScriptSuccess: {
    success: true,
    data: {
      script: generatedScripts[0],
    },
    message: '脚本生成成功',
  },

  // 脚本生成失败响应
  generateScriptError: {
    success: false,
    error: {
      code: 'GENERATION_FAILED',
      message: '脚本生成失败，请重试',
    },
  },

  // 风格列表响应
  getStylesSuccess: {
    success: true,
    data: {
      styles: scriptStyles,
    },
  },

  // 脚本列表响应
  getScriptsSuccess: {
    success: true,
    data: {
      scripts: generatedScripts,
      total: generatedScripts.length,
    },
  },

  // 项目列表响应
  getProjectsSuccess: {
    success: true,
    data: {
      projects: videoProjects,
      total: videoProjects.length,
    },
  },
};

// 用户配置测试数据
export const userSettings = {
  defaultStyle: 'style-1',
  defaultDuration: 60,
  defaultLanguage: 'zh-CN',
  autoSave: true,
  darkMode: false,
};

// 导出所有测试夹具
export default {
  scriptStyles,
  scriptConfigs,
  generatedScripts,
  videoProjects,
  apiResponses,
  userSettings,
};
