/**
 * QuickCompose 工具函数
 */

/**
 * 获取剧本显示名称的辅助函数
 * - 如果剧本内容较短,直接显示全部内容
 * - 如果剧本内容较长,显示前 30 个字符 + "..."
 */
export const getScreenplayName = (content: string): string => {
  const trimmed = content.trim();
  if (trimmed.length <= 30) {
    return trimmed;
  }
  return trimmed.substring(0, 30) + '...';
};
