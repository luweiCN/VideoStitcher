import { useCallback } from 'react';
import type { FileItem, FileAcceptType } from './FileSelector';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 文件处理结果
 */
export interface FileProcessResult {
  /** 最终要添加的文件列表 */
  filesToAdd: FileItem[];
  /** 成功添加的数量 */
  addedCount: number;
  /** 重复文件数量 */
  duplicateCount: number;
  /** 格式不符数量 */
  formatRejectedCount: number;
  /** 超出数量限制数量 */
  limitRejectedCount: number;
}

/**
 * 文件处理配置
 */
export interface FileProcessConfig {
  /** 接受的文件类型 */
  accept: FileAcceptType;
  /** 是否多选模式 */
  multiple: boolean;
  /** 最大文件数量 */
  maxCount: number;
  /** 当前已有文件数量 */
  currentCount: number;
  /** 当前已有文件路径集合（用于去重） */
  existingPaths: Set<string>;
}

/**
 * 原始文件数据
 */
export interface RawFileData {
  path: string;
  name: string;
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 检测文件类型
 */
export const detectFileType = (filename: string): 'video' | 'image' | 'unknown' => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const videoExts = ['mp4', 'mov', 'mkv', 'm4v', 'avi', 'webm'];
  const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'];
  if (videoExts.includes(ext)) return 'video';
  if (imageExts.includes(ext)) return 'image';
  return 'unknown';
};

/**
 * 检查文件类型是否兼容
 */
export const checkFileTypeCompatibility = (
  fileType: 'video' | 'image' | 'unknown',
  acceptType: FileAcceptType
): boolean => {
  if (acceptType === 'all') return true;
  if (acceptType === 'video') return fileType === 'video';
  if (acceptType === 'image') return fileType === 'image';
  if (Array.isArray(acceptType)) return true;
  return true;
};

/**
 * 构建通知消息
 */
export const buildNotificationMessage = (
  addedCount: number,
  duplicateCount: number,
  formatRejectedCount: number,
  limitRejectedCount: number
): { message: string; type: 'success' | 'error' } => {
  const skipReasons: string[] = [];

  if (duplicateCount > 0) skipReasons.push(`${duplicateCount} 个重复文件`);
  if (formatRejectedCount > 0) skipReasons.push(`${formatRejectedCount} 个文件格式不符`);
  if (limitRejectedCount > 0) skipReasons.push(`${limitRejectedCount} 个文件超出数量限制`);

  if (addedCount > 0 && skipReasons.length === 0) {
    return { message: `成功添加 ${addedCount} 个文件`, type: 'success' };
  } else if (addedCount > 0 && skipReasons.length > 0) {
    return { message: `成功添加 ${addedCount} 个文件，${skipReasons.join('、')}已跳过`, type: 'success' };
  } else if (skipReasons.length > 0) {
    return { message: `${skipReasons.join('、')}已跳过`, type: 'error' };
  }

  return { message: '没有可添加的文件', type: 'error' };
};

// ============================================================================
// 主 Hook
// ============================================================================

/**
 * 文件处理 Hook
 *
 * 封装文件选择的通用逻辑：
 * 1. 格式校验 - 根据类型要求筛选有效文件
 * 2. 数量限制 - 根据单选/多选限制数量
 * 3. 去重 - 和已有文件列表去重
 * 4. 通知消息生成
 */
export const useFileProcessor = () => {
  /**
   * 处理文件列表
   *
   * @param rawFiles 原始文件数据列表
   * @param config 处理配置
   * @returns 处理结果
   */
  const processFiles = useCallback((
    rawFiles: RawFileData[],
    config: FileProcessConfig
  ): FileProcessResult => {
    const { accept, multiple, maxCount, currentCount, existingPaths } = config;

    // ============================================================================
    // 第一步：格式校验 - 根据类型要求筛选有效文件
    // ============================================================================
    const validFiles: FileItem[] = [];
    let formatRejectedCount = 0;

    for (const item of rawFiles) {
      const fileType = detectFileType(item.path);
      const isCompatible = checkFileTypeCompatibility(fileType, accept);

      if (isCompatible) {
        validFiles.push({
          path: item.path,
          name: item.name,
          type: fileType,
          _infoLoaded: false
        });
      } else {
        formatRejectedCount++;
      }
    }

    // ============================================================================
    // 第二步：数量限制 - 单选模式允许替换，多选模式检查剩余容量
    // ============================================================================
    // 单选模式允许替换，多选模式根据剩余容量
    const remainingSlots = multiple ? Math.max(0, maxCount - currentCount) : 1;

    let selectedFiles: FileItem[];
    let limitRejectedCount = 0;

    if (multiple && remainingSlots === 0) {
      // 多选模式已达最大数量
      selectedFiles = [];
      limitRejectedCount = validFiles.length;
    } else if (validFiles.length <= remainingSlots) {
      // 未超出剩余容量
      selectedFiles = validFiles;
    } else {
      // 超出剩余容量，只取前 remainingSlots 个
      selectedFiles = validFiles.slice(0, remainingSlots);
      limitRejectedCount = validFiles.length - remainingSlots;
    }

    // ============================================================================
    // 第三步：去重 - 单选模式跳过，直接替换
    // ============================================================================
    let filesToAdd: FileItem[];
    let duplicateCount = 0;

    if (!multiple) {
      // 单选模式：直接使用选中的文件，不检查重复
      filesToAdd = selectedFiles;
    } else {
      // 多选模式：检查重复
      filesToAdd = [];
      for (const file of selectedFiles) {
        if (existingPaths.has(file.path)) {
          duplicateCount++;
        } else {
          filesToAdd.push(file);
        }
      }
    }

    return {
      filesToAdd,
      addedCount: filesToAdd.length,
      duplicateCount,
      formatRejectedCount,
      limitRejectedCount
    };
  }, []);

  /**
   * 处理原始路径列表（将路径字符串转换为 RawFileData）
   */
  const processPaths = useCallback((
    paths: string[]
  ): RawFileData[] => {
    return paths.map(path => ({
      path,
      name: path.split('/').pop() || path
    }));
  }, []);

  return {
    processFiles,
    processPaths,
    detectFileType,
    checkFileTypeCompatibility,
    buildNotificationMessage
  };
};

export default useFileProcessor;
