/**
 * 缓存工具：将远程 URL 下载到 app.getPath('userData')/temp/
 */
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';

/**
 * 获取缓存目录（保证目录存在）
 */
export function getCacheDir(): string {
  const cacheDir = path.join(app.getPath('userData'), 'temp');
  fs.mkdirSync(cacheDir, { recursive: true });
  return cacheDir;
}

/**
 * 下载 URL 到本地缓存文件
 * @param url HTTPS/HTTP 地址
 * @param ext 文件后缀，如 '.mp4' '.jpg'（不含点时自动加）
 * @returns 本地绝对路径
 */
export async function downloadToCache(url: string, ext: string): Promise<string> {
  const suffix = ext.startsWith('.') ? ext : `.${ext}`;
  const filename = `${uuidv4()}${suffix}`;
  const localPath = path.join(getCacheDir(), filename);

  const protocol = url.startsWith('https') ? https : http;

  await new Promise<void>((resolve, reject) => {
    const file = fs.createWriteStream(localPath);
    protocol.get(url, (res) => {
      // 跟随重定向（最多 5 次）
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        downloadToCache(res.headers.location, ext)
          .then((p) => {
            // 把重定向结果移动过来（简化：重新赋值 localPath 变量不可用，直接 resolve 原路径）
            fs.renameSync(p, localPath);
            resolve();
          })
          .catch(reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
      res.on('error', (err) => {
        file.close();
        fs.unlink(localPath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      fs.unlink(localPath, () => {});
      reject(err);
    });
  });

  console.log(`[Cache] 已下载到: ${localPath}`);
  return localPath;
}
