/**
 * 授权验证工具模块
 * 提供机器 ID 获取、授权文件下载、授权验证等功能
 */

const { machineIdSync } = require('node-machine-id');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// GitHub 仓库配置
const GITHUB_OWNER = 'luweiCN';
const GITHUB_REPO = 'VideoStitcher';
const LICENSE_RELEASE_TAG = 'licenses';

// 本地缓存配置
const CACHE_FILENAME = 'licenses.json';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 小时
const OFFLINE_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 天离线宽限期

/**
 * 获取授权文件缓存路径
 */
function getLicenseCachePath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, CACHE_FILENAME);
}

/**
 * 获取当前机器唯一 ID
 * @returns {string} 机器 ID
 */
function getMachineId() {
  try {
    const id = machineIdSync();
    console.log('[授权] 机器 ID:', id);
    return id;
  } catch (error) {
    console.error('[授权] 获取机器 ID 失败:', error);
    throw new Error('无法获取机器 ID');
  }
}

/**
 * 从 GitHub Release 下载授权文件
 * @returns {Promise<Object>} 授权文件内容
 */
async function downloadLicenseFile() {
  return new Promise((resolve, reject) => {
    const url = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/${LICENSE_RELEASE_TAG}/licenses.json`;

    console.log('[授权] 正在下载授权文件:', url);

    const client = url.startsWith('https') ? https : http;

    client.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // 处理重定向
        const redirectUrl = response.headers.location;
        console.log('[授权] 跟随重定向:', redirectUrl);

        const redirectClient = redirectUrl.startsWith('https') ? https : http;
        redirectClient.get(redirectUrl, (redirectResponse) => {
          if (redirectResponse.statusCode !== 200) {
            return reject(new Error(`下载授权文件失败，状态码: ${redirectResponse.statusCode}`));
          }

          let data = '';
          redirectResponse.on('data', (chunk) => {
            data += chunk;
          });

          redirectResponse.on('end', () => {
            try {
              const licenseData = JSON.parse(data);
              console.log('[授权] 授权文件下载成功');
              resolve(licenseData);
            } catch (error) {
              console.error('[授权] 解析授权文件失败:', error);
              reject(new Error('授权文件格式错误'));
            }
          });
        }).on('error', (error) => {
          console.error('[授权] 下载授权文件失败 (重定向):', error);
          reject(error);
        });

        return;
      }

      if (response.statusCode !== 200) {
        return reject(new Error(`下载授权文件失败，状态码: ${response.statusCode}`));
      }

      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        try {
          const licenseData = JSON.parse(data);
          console.log('[授权] 授权文件下载成功');
          resolve(licenseData);
        } catch (error) {
          console.error('[授权] 解析授权文件失败:', error);
          reject(new Error('授权文件格式错误'));
        }
      });
    }).on('error', (error) => {
      console.error('[授权] 下载授权文件失败:', error);
      reject(error);
    });
  });
}

/**
 * 保存授权文件到本地缓存
 * @param {Object} licenseData - 授权文件内容
 */
function saveLicenseCache(licenseData) {
  try {
    const cachePath = getLicenseCachePath();
    const cacheData = {
      ...licenseData,
      _cachedAt: Date.now()
    };
    fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), 'utf-8');
    console.log('[授权] 授权文件已缓存');
  } catch (error) {
    console.error('[授权] 保存授权文件缓存失败:', error);
  }
}

/**
 * 从本地缓存读取授权文件
 * @returns {Object|null} 缓存的授权文件内容，如果不存在或已过期则返回 null
 */
function readLicenseCache() {
  try {
    const cachePath = getLicenseCachePath();
    if (!fs.existsSync(cachePath)) {
      console.log('[授权] 授权文件缓存不存在');
      return null;
    }

    const cacheContent = fs.readFileSync(cachePath, 'utf-8');
    const cacheData = JSON.parse(cacheContent);
    const cachedAt = cacheData._cachedAt || 0;
    const now = Date.now();
    const cacheAge = now - cachedAt;

    console.log('[授权] 缓存年龄:', Math.floor(cacheAge / 1000 / 60), '分钟');

    // 检查缓存是否过期
    if (cacheAge > CACHE_MAX_AGE_MS) {
      console.log('[授权] 授权文件缓存已过期');
      return null;
    }

    // 检查是否超过离线宽限期
    if (cacheAge > OFFLINE_GRACE_PERIOD_MS) {
      console.log('[授权] 已超过离线宽限期');
      return null;
    }

    console.log('[授权] 使用缓存的授权文件');
    return cacheData;
  } catch (error) {
    console.error('[授权] 读取授权文件缓存失败:', error);
    return null;
  }
}

/**
 * 验证当前机器是否在授权列表中
 * @param {Object} licenseData - 授权文件内容
 * @returns {Object} 验证结果 { authorized: boolean, userInfo?: Object, reason?: string }
 */
function verifyLicense(licenseData) {
  if (!licenseData || !licenseData.licenses || !Array.isArray(licenseData.licenses)) {
    return {
      authorized: false,
      reason: '授权文件格式错误'
    };
  }

  const machineId = getMachineId();

  // 查找当前机器的授权信息
  const license = licenseData.licenses.find(l => l.machineId === machineId);

  if (!license) {
    return {
      authorized: false,
      reason: '当前机器未在授权列表中'
    };
  }

  if (!license.enabled) {
    return {
      authorized: false,
      reason: '授权已被禁用'
    };
  }

  return {
    authorized: true,
    userInfo: {
      user: license.user || '未知用户',
      machineId: license.machineId
    }
  };
}

/**
 * 获取授权状态详情
 * @param {boolean} forceRefresh - 是否强制刷新授权文件
 * @returns {Promise<Object>} 授权状态详情
 */
async function getLicenseStatus(forceRefresh = false) {
  console.log('[授权] 获取授权状态, 强制刷新:', forceRefresh);

  let licenseData = null;
  let usedCache = false;
  let offlineMode = false;

  // 如果不是强制刷新，先尝试读取缓存
  if (!forceRefresh) {
    licenseData = readLicenseCache();
    if (licenseData) {
      usedCache = true;
    }
  }

  // 如果没有缓存或强制刷新，尝试下载
  if (!licenseData) {
    try {
      licenseData = await downloadLicenseFile();
      saveLicenseCache(licenseData);
    } catch (error) {
      console.error('[授权] 下载授权文件失败:', error.message);

      // 下载失败时，尝试使用缓存（即使在离线宽限期内）
      const cachedData = readLicenseCache();
      if (cachedData) {
        licenseData = cachedData;
        usedCache = true;
        offlineMode = true;
      } else {
        return {
          authorized: false,
          reason: '无法连接到授权服务器，且无可用缓存',
          offline: true
        };
      }
    }
  }

  // 验证授权
  const verificationResult = verifyLicense(licenseData);

  return {
    ...verificationResult,
    usedCache,
    offlineMode,
    licenseVersion: licenseData.version,
    updatedAt: licenseData.updatedAt
  };
}

module.exports = {
  getMachineId,
  downloadLicenseFile,
  verifyLicense,
  getLicenseStatus,
  getLicenseCachePath
};
