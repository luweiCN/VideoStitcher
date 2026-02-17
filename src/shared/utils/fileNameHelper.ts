/**
 * 文件名处理工具模块
 * 统一处理文件名过长、非法字符等问题
 */

import fs from 'fs';
import path from 'path';

/**
 * 获取字符串的 UTF-8 字节长度
 */
export function getByteLength(str: string): number {
  return Buffer.byteLength(str, 'utf8');
}

/**
 * 按 UTF-8 字节长度截断字符串
 */
export function truncateByBytes(str: string, maxBytes: number): string {
  if (getByteLength(str) <= maxBytes) {
    return str;
  }

  let result = '';
  let byteCount = 0;

  for (const char of str) {
    const charBytes = getByteLength(char);
    if (byteCount + charBytes > maxBytes) {
      break;
    }
    result += char;
    byteCount += charBytes;
  }

  return result;
}

/**
 * 各操作系统的非法字符（取并集以确保跨平台兼容）
 */
export const ILLEGAL_CHARS_REGEX = /[<>:"/\\|?*#\x00-\x1f]/g;

/**
 * 需要特别处理的字符映射
 */
const CHAR_REPLACEMENTS: Record<string, string> = {
  '#': '_',
  ':': '_',
  '/': '_',
  '\\': '_',
  '|': '_',
  '?': '_',
  '*': '_',
  '"': '_',
  '<': '(',
  '>': ')',
};

/**
 * 最大文件名长度（字节）
 */
export const MAX_FILENAME_BYTES = 255;

/**
 * 默认截断时保留的后缀长度
 */
const DEFAULT_SUFFIX_LENGTH = 20;

/**
 * Windows 保留名称
 */
const WINDOWS_RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
]);

/**
 * 清理文件名中的非法字符
 */
export function sanitizeFilename(
  filename: string,
  options: { replacement?: string; preserveExtension?: boolean } = {}
): string {
  const { replacement = '_', preserveExtension = true } = options;

  if (!filename || typeof filename !== 'string') {
    return 'unnamed';
  }

  let name = filename;
  let ext = '';

  // 分离扩展名
  if (preserveExtension) {
    const lastDotIndex = name.lastIndexOf('.');
    if (lastDotIndex > 0 && !name.slice(lastDotIndex).includes('/') && !name.slice(lastDotIndex).includes('\\')) {
      ext = name.slice(lastDotIndex);
      name = name.slice(0, lastDotIndex);
    }
  }

  // 替换非法字符
  name = name.replace(ILLEGAL_CHARS_REGEX, (char) => {
    return CHAR_REPLACEMENTS[char] || replacement;
  });

  // 移除连续的替换字符
  const escapedReplacement = replacement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const consecutiveRegex = new RegExp(`${escapedReplacement}{2,}`, 'g');
  name = name.replace(consecutiveRegex, replacement);

  // 移除首尾的替换字符、空格、句点
  name = name.trim();
  name = name.replace(new RegExp(`^[${escapedReplacement}.\\s]+|[${escapedReplacement}.\\s]+$`, 'g'), '');

  // 处理空文件名
  if (!name) {
    name = 'unnamed';
  }

  // 检查是否是 Windows 保留名称
  const upperName = name.toUpperCase();
  if (WINDOWS_RESERVED_NAMES.has(upperName)) {
    name = 'file_' + name;
  }

  return name + ext;
}

/**
 * 截断过长的文件名（按字节计算）
 */
export function truncateFilename(
  filename: string,
  options: { maxBytes?: number; suffixLength?: number; ellipsis?: string } = {}
): string {
  const { maxBytes = MAX_FILENAME_BYTES, suffixLength = DEFAULT_SUFFIX_LENGTH, ellipsis = '...' } = options;

  if (!filename || typeof filename !== 'string') {
    return 'unnamed';
  }

  if (getByteLength(filename) <= maxBytes) {
    return filename;
  }

  let name = filename;
  let ext = '';
  const lastDotIndex = name.lastIndexOf('.');
  if (lastDotIndex > 0) {
    ext = name.slice(lastDotIndex);
    name = name.slice(0, lastDotIndex);
  }

  const extBytes = getByteLength(ext);
  const ellipsisBytes = getByteLength(ellipsis);
  const availableBytes = maxBytes - extBytes;

  if (getByteLength(name) > availableBytes) {
    if (availableBytes <= suffixLength + ellipsisBytes) {
      name = truncateByBytes(name, Math.max(10, availableBytes - ellipsisBytes));
      if (getByteLength(name) + extBytes > maxBytes) {
        name = truncateByBytes(name, maxBytes - extBytes - ellipsisBytes) + ellipsis;
      }
    } else {
      const prefixBytes = Math.floor((availableBytes - ellipsisBytes - suffixLength) / 2);
      const suffixBytes = availableBytes - ellipsisBytes - prefixBytes;

      const prefix = truncateByBytes(name, prefixBytes);
      let suffixPart = '';

      const fullSuffixBytes = getByteLength(name) - prefixBytes;
      if (fullSuffixBytes > 0 && fullSuffixBytes <= suffixBytes) {
        suffixPart = name.slice(prefix.length);
      } else if (fullSuffixBytes > suffixBytes) {
        let byteCount = 0;
        for (let i = name.length - 1; i >= 0; i--) {
          byteCount += getByteLength(name[i]);
          if (byteCount >= suffixBytes) {
            suffixPart = name.slice(i);
            break;
          }
        }
      }

      name = prefix + ellipsis + suffixPart;
    }
  }

  if (getByteLength(name + ext) > maxBytes) {
    name = truncateByBytes(name, maxBytes - extBytes - ellipsisBytes) + ellipsis;
  }

  return name + ext;
}

/**
 * 生成 A+B 拼接的安全文件名
 */
export function generateCombinedFilename(
  aName: string,
  bName: string,
  options: { separator?: string; suffix?: string; extension?: string; maxBytes?: number } = {}
): string {
  const { separator = '__', suffix = '', extension = '.mp4', maxBytes = MAX_FILENAME_BYTES } = options;

  const safeA = sanitizeFilename(aName, { preserveExtension: false });
  const safeB = sanitizeFilename(bName, { preserveExtension: false });

  const separatorBytes = getByteLength(separator);
  const suffixBytes = getByteLength(suffix);
  const extBytes = getByteLength(extension);
  const reservedBytes = separatorBytes + suffixBytes + extBytes;
  const availableBytes = maxBytes - reservedBytes;

  const eachNameBytes = Math.floor(availableBytes / 2) - separatorBytes;

  let truncatedA = safeA;
  let truncatedB = safeB;

  if (getByteLength(safeA) > eachNameBytes) {
    truncatedA = truncateByBytes(safeA, eachNameBytes - 3) + '...';
  }
  if (getByteLength(safeB) > eachNameBytes) {
    truncatedB = truncateByBytes(safeB, eachNameBytes - 3) + '...';
  }

  let combined = truncatedA + separator + truncatedB + suffix;

  if (getByteLength(combined) + extBytes > maxBytes) {
    const finalAvailable = maxBytes - extBytes - 3;
    combined = truncateByBytes(combined, finalAvailable) + '...';
  }

  return combined + extension;
}

/**
 * 检查文件名是否有效
 */
export function validateFilename(filename: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!filename || typeof filename !== 'string') {
    errors.push('文件名为空');
    return { valid: false, errors };
  }

  const byteLength = getByteLength(filename);
  if (byteLength > 255) {
    errors.push(`文件名过长 (${byteLength} 字节，最大 255 字节)`);
  }

  const illegalChars = filename.match(ILLEGAL_CHARS_REGEX);
  if (illegalChars) {
    const uniqueChars = [...new Set(illegalChars)];
    errors.push(`包含非法字符: ${uniqueChars.map(c => `"${c}"`).join(', ')}`);
  }

  const baseName = filename.split('.')[0].toUpperCase();
  if (WINDOWS_RESERVED_NAMES.has(baseName)) {
    errors.push(`"${baseName}" 是系统保留名称`);
  }

  if (filename !== filename.trim()) {
    errors.push('文件名首尾不能有空格');
  }
  if (filename.endsWith('.')) {
    errors.push('文件名不能以句点结尾');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 检测文件名冲突并生成唯一文件名（自动递增）
 */
export function generateUniqueFilename(outputDir: string, safeFilename: string): string {
  const lastDotIndex = safeFilename.lastIndexOf('.');
  let baseName = safeFilename;
  let extension = '';

  if (lastDotIndex > 0) {
    baseName = safeFilename.slice(0, lastDotIndex);
    extension = safeFilename.slice(lastDotIndex);
  }

  let checkName = baseName + extension;
  let checkPath = path.join(outputDir, checkName);

  if (!fs.existsSync(checkPath)) {
    return checkName;
  }

  let counter = 1;
  while (true) {
    const newName = `${baseName}_${counter}${extension}`;
    const newPath = path.join(outputDir, newName);

    if (!fs.existsSync(newPath)) {
      return newName;
    }

    counter++;

    if (counter > 10000) {
      console.warn('文件名序号达到上限，生成随机后缀');
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      return `${baseName}_${randomSuffix}${extension}`;
    }
  }
}

/**
 * 统一的文件名生成函数
 */
export function generateFileName(
  outputDir: string,
  baseName: string,
  options: { suffix?: string; extension?: string; reserveSuffixSpace?: number } = {}
): string {
  const { suffix = '', extension = '.mp4', reserveSuffixSpace = 4 } = options;

  // 步骤 1：清理非法字符
  let safeName = sanitizeFilename(baseName, { preserveExtension: false });

  // 步骤 2：添加后缀
  if (suffix) {
    safeName = safeName + suffix;
  }

  // 步骤 3：截断过长文件名
  const maxBytesWithReserve = MAX_FILENAME_BYTES - reserveSuffixSpace;
  safeName = truncateFilename(safeName, { maxBytes: maxBytesWithReserve, suffixLength: 10 });

  // 步骤 4：添加扩展名
  const fullName = safeName + extension;

  // 步骤 5：检测冲突并生成唯一文件名
  const uniqueName = generateUniqueFilename(outputDir, fullName);

  return uniqueName;
}
