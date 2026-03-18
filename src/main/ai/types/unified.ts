/**
 * 统一消息格式
 * 兼容 LangChain BaseMessage 和各种 AI 供应商 API
 */

/**
 * 消息角色
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'function';

/**
 * 多模态消息内容
 */
export interface MessageContent {
  /** 内容类型 */
  type: 'text' | 'image' | 'audio' | 'video';

  /** 文本内容（type 为 text 时） */
  text?: string;

  /** 媒体 URL（type 为 image/audio/video 时） */
  url?: string;

  /** MIME 类型 */
  mimeType?: string;

  /** Base64 编码数据 */
  data?: string;
}

/**
 * 统一消息格式
 *
 * @example 文本消息
 * ```typescript
 * const message: UnifiedMessage = {
 *   role: 'user',
 *   content: '请生成一个短视频剧本'
 * };
 * ```
 *
 * @example 多模态消息（文本 + 图片）
 * ```typescript
 * const message: UnifiedMessage = {
 *   role: 'user',
 *   content: [
 *     { type: 'text', text: '这张图片描述了什么？' },
 *     { type: 'image', url: 'https://example.com/image.jpg' }
 *   ]
 * };
 * ```
 */
export interface UnifiedMessage {
  /** 消息角色 */
  role: MessageRole;

  /** 消息内容（字符串或多模态内容数组） */
  content: string | MessageContent[];

  /** 函数调用时的函数名（可选） */
  name?: string;

  /** 消息唯一 ID（可选） */
  id?: string;

  /** 额外元数据（可选） */
  metadata?: Record<string, any>;
}

/**
 * Token 使用量统计
 */
export interface UsageMetrics {
  /** 输入 tokens */
  inputTokens: number;

  /** 输出 tokens */
  outputTokens: number;

  /** 总 tokens */
  totalTokens: number;
}

/**
 * 响应内容（多模态）
 */
export interface ResponseContent {
  /** 内容类型 */
  type: 'text' | 'image' | 'audio' | 'video';

  /** 文本内容 */
  text?: string;

  /** 媒体 URL */
  url?: string;

  /** 图片生成时的重写提示词 */
  revisedPrompt?: string;

  /** MIME 类型 */
  mimeType?: string;
}

/**
 * 响应元数据
 */
export interface ResponseMetadata {
  /** 供应商名称 */
  provider: string;

  /** 模型 ID */
  modelId: string;

  /** 停止原因 */
  finishReason?: string;

  /** 创建时间戳（图片/音视频生成时） */
  created?: number;

  /** 响应延迟（毫秒） */
  latency?: number;

  /** 额外元数据 */
  [key: string]: any;
}

/**
 * 统一响应格式
 *
 * @example 文本响应
 * ```typescript
 * const response: UnifiedResponse = {
 *   content: '生成的剧本内容...',
 *   usage: {
 *     inputTokens: 100,
 *     outputTokens: 500,
 *     totalTokens: 600
 *   },
 *   metadata: {
 *     provider: 'volcengine',
 *     modelId: 'doubao-1-5-pro-32k-250115',
 *     finishReason: 'stop'
 *   }
 * };
 * ```
 *
 * @example 图片响应
 * ```typescript
 * const response: UnifiedResponse = {
 *   content: [
 *     {
 *       type: 'image',
 *       url: 'https://example.com/image1.jpg',
 *       revisedPrompt: '一只可爱的小猫...'
 *     }
 *   ],
 *   metadata: {
 *     provider: 'volcengine',
 *     modelId: 'doubao-seedream-3-0-t2i-250428',
 *     created: 1234567890
 *   }
 * };
 * ```
 */
export interface UnifiedResponse {
  /** 响应内容（字符串或多模态内容数组） */
  content: string | ResponseContent[];

  /** Token 使用量 */
  usage?: UsageMetrics;

  /** 元数据 */
  metadata?: ResponseMetadata;
}

/**
 * 流式响应块
 */
export interface StreamChunk {
  /** 完整内容块 */
  content?: string;

  /** 增量内容（每次新增的部分） */
  delta?: string;

  /** Token 使用量（可能部分可用） */
  usage?: Partial<UsageMetrics>;

  /** 元数据（可能部分可用） */
  metadata?: Partial<ResponseMetadata>;

  /** 是否完成 */
  done?: boolean;

  /** 错误信息 */
  error?: string;
}
