/**
 * 文件名处理工具模块
 * 统一处理文件名过长、非法字符等问题
 *
 * 跨平台兼容性说明：
 * - Windows: 文件名最大 255 字符，路径最大 260 字符，非法字符 < > : " / \ | ? *
 * - macOS: 文件名最大 255 字节（UTF-8），非法字符 : 和 /
 * - Linux: 文件名最大 255 字节（UTF-8），非法字符 /
 *
 * 为确保跨平台兼容，本模块：
 * 1. 使用所有平台非法字符的并集
 * 2. 按字节计算文件名长度（UTF-8 编码）
 * 3. 处理 Windows 保留名称
 */

/**
 * 获取字符串的 UTF-8 字节长度
 * @param {string} str - 输入字符串
 * @returns {number} 字节长度
 */
function getByteLength(str) {
  return Buffer.byteLength(str, 'utf8');
}

/**
 * 按 UTF-8 字节长度截断字符串
 * @param {string} str - 输入字符串
 * @param {number} maxBytes - 最大字节数
 * @returns {string} 截断后的字符串
 */
function truncateByBytes(str, maxBytes) {
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
 * - Windows: < > : " / \ | ? * 以及控制字符
 * - macOS: : (冒号)
 * - Linux: / (斜杠)
 *
 * 注意：# 号虽然在大多数系统是合法的，但在某些场景（如 URL、命令行）可能有问题
 */
const ILLEGAL_CHARS_REGEX = /[<>:"/\\|?*#\x00-\x1f]/g;

/**
 * 需要特别处理的字符映射
 * 转换为安全形式
 */
const CHAR_REPLACEMENTS = {
  '#': '_',      // 井号 → 下划线（在命令行和 URL 中可能有问题）
  ':': '_',      // 冒号 → 下划线（macOS/Windows 非法）
  '/': '_',      // 斜杠 → 下划线（所有系统路径分隔符）
  '\\': '_',     // 反斜杠 → 下划线（Windows 路径分隔符）
  '|': '_',      // 竖线 → 下划线（管道符）
  '?': '_',      // 问号 → 下划线（Windows 非法，URL 参数）
  '*': '_',      // 星号 → 下划线（通配符）
  '"': '_',      // 引号 → 下划线
  '<': '(',      // 小于号 → 左括号
  '>': ')',      // 大于号 → 右括号
};

/**
 * 最大文件名长度（字节）
 * macOS/Linux: 255 字节（UTF-8）
 * Windows: 255 字符
 * 这里设置为 200 字节，留出扩展名和路径的空间
 */
const MAX_FILENAME_BYTES = 200;

/**
 * 默认截断时保留的后缀长度（用于序号等）
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
 *
 * @param {string} filename - 原始文件名
 * @param {Object} options - 选项
 * @param {string} [options.replacement='_'] - 替换字符
 * @param {boolean} [options.preserveExtension=true] - 是否保留扩展名
 * @returns {string} 清理后的文件名
 */
function sanitizeFilename(filename, options = {}) {
  const {
    replacement = '_',
    preserveExtension = true,
  } = options;

  if (!filename || typeof filename !== 'string') {
    return 'unnamed';
  }

  let name = filename;
  let ext = '';

  // 分离扩展名
  if (preserveExtension) {
    const lastDotIndex = name.lastIndexOf('.');
    // 确保点是文件名的一部分而不是路径的一部分
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

  // 移除首尾的替换字符、空格、句点（Windows 不允许以空格或句点结尾）
  name = name.trim();
  name = name.replace(new RegExp(`^[${escapedReplacement}.\\s]+|[${escapedReplacement}.\\s]+$`, 'g'), '');

  // 处理空文件名
  if (!name) {
    name = 'unnamed';
  }

  // 检查是否是 Windows 保留名称，如果是则添加前缀
  const upperName = name.toUpperCase();
  if (WINDOWS_RESERVED_NAMES.has(upperName)) {
    name = 'file_' + name;
  }

  return name + ext;
}

/**
 * 截断过长的文件名（按字节计算）
 *
 * @param {string} filename - 原始文件名（可含扩展名）
 * @param {Object} options - 选项
 * @param {number} [options.maxBytes=MAX_FILENAME_BYTES] - 最大字节数
 * @param {number} [options.suffixLength=DEFAULT_SUFFIX_LENGTH] - 保留的后缀长度
 * @param {string} [options.ellipsis='...'] - 省略符号
 * @returns {string} 截断后的文件名
 */
function truncateFilename(filename, options = {}) {
  const {
    maxBytes = MAX_FILENAME_BYTES,
    suffixLength = DEFAULT_SUFFIX_LENGTH,
    ellipsis = '...',
  } = options;

  if (!filename || typeof filename !== 'string') {
    return 'unnamed';
  }

  // 如果文件名没有超长，直接返回
  if (getByteLength(filename) <= maxBytes) {
    return filename;
  }

  // 分离文件名和扩展名
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

  // 如果超长，进行智能截断
  if (getByteLength(name) > availableBytes) {
    // 保留后缀（序号等）
    if (availableBytes <= suffixLength + ellipsisBytes) {
      // 可用空间太小，直接截取
      name = truncateByBytes(name, Math.max(10, availableBytes - ellipsisBytes));
      if (getByteLength(name) + extBytes > maxBytes) {
        name = truncateByBytes(name, maxBytes - extBytes - ellipsisBytes) + ellipsis;
      }
    } else {
      // 保留前缀和后缀
      const prefixBytes = Math.floor((availableBytes - ellipsisBytes - suffixLength) / 2);
      const suffixBytes = availableBytes - ellipsisBytes - prefixBytes;

      const prefix = truncateByBytes(name, prefixBytes);
      const suffixStart = name.length;
      let suffixPart = '';

      // 从后往前找到合适长度的后缀
      for (let i = name.length; i >= 0; i--) {
        const candidate = name.slice(i);
        if (getByteLength(candidate) <= suffixBytes) {
          suffixPart = candidate;
          break;
        }
      }

      name = prefix + ellipsis + suffixPart;
    }
  }

  // 最终检查是否超长，如果还超则再次截断
  if (getByteLength(name + ext) > maxBytes) {
    name = truncateByBytes(name, maxBytes - extBytes - ellipsisBytes) + ellipsis;
  }

  return name + ext;
}

/**
 * 生成安全的输出文件名
 * 整合清理和截断功能
 *
 * @param {string} baseName - 基础文件名（不含扩展名）
 * @param {Object} options - 选项
 * @param {string} [options.suffix=''] - 要添加的后缀（如序号）
 * @param {string} [options.extension='.mp4'] - 文件扩展名
 * @param {number} [options.maxBytes=MAX_FILENAME_BYTES] - 最大字节数
 * @returns {string} 安全的完整文件名
 */
function generateSafeFilename(baseName, options = {}) {
  const {
    suffix = '',
    extension = '.mp4',
    maxBytes = MAX_FILENAME_BYTES,
  } = options;

  // 1. 清理基础文件名中的非法字符
  let safeName = sanitizeFilename(baseName, { preserveExtension: false });

  // 2. 添加后缀
  if (suffix) {
    safeName = safeName + suffix;
  }

  // 3. 计算可用长度（减去扩展名长度）
  const extBytes = getByteLength(extension);
  const availableBytes = maxBytes - extBytes;

  // 4. 截断过长的文件名
  safeName = truncateFilename(safeName, {
    maxBytes: Math.max(20, availableBytes + extBytes), // 至少保留 20 字节
    suffixLength: 10, // 保留序号部分
  });

  // 5. 再次检查并截断（确保加上扩展名后不超限）
  if (getByteLength(safeName) > availableBytes) {
    safeName = truncateByBytes(safeName, availableBytes - 3) + '...';
  }

  // 6. 添加扩展名
  return safeName + extension;
}

/**
 * 生成 A+B 拼接的安全文件名
 * 避免两个长文件名拼接后超过长度限制
 *
 * @param {string} aName - A 面文件名（不含扩展名）
 * @param {string} bName - B 面文件名（不含扩展名）
 * @param {Object} options - 选项
 * @param {string} [options.separator='__'] - 分隔符
 * @param {string} [options.suffix=''] - 序号后缀（如 '__0001'）
 * @param {string} [options.extension='.mp4'] - 文件扩展名
 * @param {number} [options.maxBytes=MAX_FILENAME_BYTES] - 最大字节数
 * @returns {string} 安全的拼接文件名
 */
function generateCombinedFilename(aName, bName, options = {}) {
  const {
    separator = '__',
    suffix = '',
    extension = '.mp4',
    maxBytes = MAX_FILENAME_BYTES,
  } = options;

  // 清理两个文件名
  const safeA = sanitizeFilename(aName, { preserveExtension: false });
  const safeB = sanitizeFilename(bName, { preserveExtension: false });

  // 计算可用字节数
  const separatorBytes = getByteLength(separator);
  const suffixBytes = getByteLength(suffix);
  const extBytes = getByteLength(extension);
  const reservedBytes = separatorBytes + suffixBytes + extBytes;
  const availableBytes = maxBytes - reservedBytes;

  // 平均分配可用字节给两个文件名
  const eachNameBytes = Math.floor(availableBytes / 2) - separatorBytes;

  // 截断过长的部分
  let truncatedA = safeA;
  let truncatedB = safeB;

  if (getByteLength(safeA) > eachNameBytes) {
    truncatedA = truncateByBytes(safeA, eachNameBytes - 3) + '...';
  }
  if (getByteLength(safeB) > eachNameBytes) {
    truncatedB = truncateByBytes(safeB, eachNameBytes - 3) + '...';
  }

  // 组合文件名
  let combined = truncatedA + separator + truncatedB + suffix;

  // 最终检查是否超长
  if (getByteLength(combined) + extBytes > maxBytes) {
    const finalAvailable = maxBytes - extBytes - 3;
    combined = truncateByBytes(combined, finalAvailable) + '...';
  }

  return combined + extension;
}

/**
 * 检查文件名是否有效
 *
 * @param {string} filename - 要检查的文件名
 * @returns {{ valid: boolean, errors: string[] }} 验证结果
 */
function validateFilename(filename) {
  const errors = [];

  if (!filename || typeof filename !== 'string') {
    errors.push('文件名为空');
    return { valid: false, errors };
  }

  // 检查字节长度（跨平台兼容）
  const byteLength = getByteLength(filename);
  if (byteLength > 255) {
    errors.push(`文件名过长 (${byteLength} 字节，最大 255 字节)`);
  }

  // 检查非法字符
  const illegalChars = filename.match(ILLEGAL_CHARS_REGEX);
  if (illegalChars) {
    const uniqueChars = [...new Set(illegalChars)];
    errors.push(`包含非法字符: ${uniqueChars.map(c => `"${c}"`).join(', ')}`);
  }

  // 检查保留名称（Windows）
  const baseName = filename.split('.')[0].toUpperCase();
  if (WINDOWS_RESERVED_NAMES.has(baseName)) {
    errors.push(`"${baseName}" 是系统保留名称`);
  }

  // 检查首尾空格和句点（Windows 不允许）
  if (filename !== filename.trim()) {
    errors.push('文件名首尾不能有空格');
  }
  if (filename.endsWith('.')) {
    errors.push('文件名不能以句点结尾');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  sanitizeFilename,
  truncateFilename,
  generateSafeFilename,
  generateCombinedFilename,
  validateFilename,
  getByteLength,
  truncateByBytes,
  MAX_FILENAME_BYTES,
  ILLEGAL_CHARS_REGEX,
};
