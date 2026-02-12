/**
 * TextCollapse 常量配置
 */

/** 默认省略号 */
export const DEFAULT_ELLIPSIS = '...';

/** 默认最大行数 */
export const DEFAULT_LINES = 2;

/** 默认测量延迟（毫秒） */
export const DEFAULT_MEASURE_DELAY = 0;

/** 二分查找最小文本长度阈值 */
export const MIN_TEXT_LENGTH = 10;

/** 测量缓存最大条目数 */
export const MAX_CACHE_SIZE = 100;

/** 批量调度器延迟（毫秒） */
export const SCHEDULER_DELAY = 16; // ~60fps

/** RAF 超时时间（毫秒） */
export const RAF_TIMEOUT = 100;

/** 测量重试次数 */
export const MAX_MEASURE_RETRIES = 3;

/** 词边界正则表达式 */
export const WORD_BREAK_REGEX = /[\s\u2000-\u200B\u3000\uFEFF]+/;

/** 句子边界正则表达式（中文句号、英文句号、问号、感叹号） */
export const SENTENCE_BREAK_REGEX = /[。.！!?？]/;

/** 段落边界正则表达式 */
export const PARAGRAPH_BREAK_REGEX = /\n/;

/** 安全的 HTML 实体编码字符 */
export const SAFE_HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** 可折叠的最小字符数（太短不需要折叠） */
export const MIN_COLLAPSE_LENGTH = 50;
