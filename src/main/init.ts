/**
 * 启动初始化模块
 * 包含：清理残留文件、注册自定义协议等
 */

import { protocol } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * 清理残留的预览临时文件（处理上次异常退出的情况）
 */
export function cleanupResidualPreviews(): void {
  try {
    const tempDir = os.tmpdir();
    let cleanedCount = 0;

    // 清理系统临时目录下的 preview_fast_* 文件
    const files = fs.readdirSync(tempDir);
    const previewPattern = /^preview_fast_[a-f0-9]+\.mp4$/;

    for (const file of files) {
      if (previewPattern.test(file)) {
        const filePath = path.join(tempDir, file);
        try {
          fs.unlinkSync(filePath);
          cleanedCount++;
        } catch {
          // 忽略单个文件删除失败
        }
      }
    }

    // 清理 videostitcher-preview 目录下的所有预览文件
    const previewDir = path.join(tempDir, 'videostitcher-preview');
    if (fs.existsSync(previewDir)) {
      const previewFiles = fs.readdirSync(previewDir);
      for (const file of previewFiles) {
        const filePath = path.join(previewDir, file);
        try {
          fs.unlinkSync(filePath);
          cleanedCount++;
        } catch {
          // 忽略单个文件删除失败
        }
      }
    }

    console.log(`[主进程] 残留预览文件检查完成，已清理 ${cleanedCount} 个文件`);
  } catch (err) {
    console.error('[主进程] 清理残留预览文件失败:', err);
  }
}

/**
 * 注册自定义协议用于访问本地文件（预览功能）
 */
export function registerPreviewProtocol(): void {
  protocol.registerFileProtocol('preview', (request, callback) => {
    // 解码 URL 获取文件路径
    const filePath = decodeURIComponent(request.url.substr('preview://'.length));
    // 检查文件是否存在
    if (fs.existsSync(filePath)) {
      callback({ path: filePath });
    } else {
      console.error('预览文件不存在:', filePath);
      callback({ error: -2 }); // 找不到文件
    }
  });
}

/**
 * 执行所有启动初始化
 */
export function initStartup(): void {
  console.log('[主进程] 开始执行启动初始化...');

  // 清理上次异常退出残留的预览文件
  cleanupResidualPreviews();

  // 注册预览协议
  try {
    console.log('[主进程] 注册预览协议...');
    registerPreviewProtocol();
    console.log('[主进程] 预览协议注册完成');
  } catch (err) {
    console.error('[主进程] 注册预览协议失败:', err);
  }

  console.log('[主进程] 启动初始化完成');
}
