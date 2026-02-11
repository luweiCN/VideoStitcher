/**
 * FileSelector 组件库
 *
 * 工业科技风格的文件选择器组件，支持：
 * - 单选/多选
 * - 可配置文件类型过滤
 * - 文件列表预览（可折叠）
 * - 拖放上传
 * - 粘贴文件分配
 * - 视频和图片预览
 * - 目录缓存
 */

// 主组件
export { FileSelector } from './FileSelector';
export type { FileSelectorProps, FileItem, FileAcceptType } from './FileSelector';

// 组件组
export { FileSelectorGroup, useFileSelectorGroup } from './FileSelectorGroup';

// 预览弹窗
export { FilePreviewModal } from './FilePreviewModal';
export type { FilePreviewModalProps } from './FilePreviewModal';

// 文件处理 hook
export { useFileProcessor } from './useFileProcessor';
export type { FileProcessResult, FileProcessConfig, RawFileData } from './useFileProcessor';
export { detectFileType, checkFileTypeCompatibility, buildNotificationMessage } from './useFileProcessor';

// 文件 Tooltip
export { FileTooltipContent } from './FileTooltip';
export { formatFileSize } from './FileTooltip';

// 主题配置
export { getThemeConfig } from './themeConfig';
export type { ThemeColor, ThemeConfig } from './themeConfig';

