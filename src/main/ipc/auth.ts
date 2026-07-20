/**
 * 授权验证 IPC 处理器
 * 处理渲染进程与主进程之间的授权相关通信
 */

import { app, BrowserWindow } from 'electron';
import { trustedIpcMain as ipcMain } from './security';
import { getMachineId } from '@shared/utils/machineId';
import {
  connectCloudDevice,
  configureCloudLicenseHeartbeat,
  getCloudPackageCenter,
  getCloudLicenseStatus,
  getCloudPublicPlans,
  redeemCloudPackageCode,
  stopCloudHeartbeat,
} from '@shared/utils/cloudLicense';
import type { LicensePackageCenter, LicensePackageSummary } from '@shared/types/license';
import { licenseGate } from '@main/services/LicenseGate';
import { taskQueueManager } from '@main/services/TaskQueueManager';

// 只有未打包应用才拥有本地开发套餐，避免发布版通过环境变量绕过授权。
const isDevelopment = !app.isPackaged;
const DEVELOPMENT_PACKAGE_ID = 'local-development-package';
const developmentPackageAssignedAt = new Date().toISOString();

function createDevelopmentPackage(): LicensePackageSummary {
  return {
    id: DEVELOPMENT_PACKAGE_ID,
    planId: DEVELOPMENT_PACKAGE_ID,
    planName: '本地开发套餐',
    term: { unit: 'perpetual' },
    source: 'development',
    reason: '仅用于本地开发和授权流程测试，不写入授权服务器',
    assignedAt: developmentPackageAssignedAt,
    waitsForDefault: false,
    status: 'active',
    startsAt: developmentPackageAssignedAt,
  };
}

// 保留服务端返回的当前权益，只把本地开发套餐注入可见套餐列表。
function addDevelopmentPackage(center: LicensePackageCenter): LicensePackageCenter {
  if (!isDevelopment) return center;
  return {
    ...center,
    packages: [
      createDevelopmentPackage(),
      ...center.packages.filter((item) => item.id !== DEVELOPMENT_PACKAGE_ID),
    ],
  };
}

function createDevelopmentPackageCenter(): LicensePackageCenter {
  const developmentPackage = createDevelopmentPackage();
  return {
    authorized: true,
    deviceLabel: '本地开发设备',
    access: {
      mode: 'package',
      planId: developmentPackage.planId,
      planName: developmentPackage.planName,
      source: 'development',
      status: 'active',
    },
    packages: [developmentPackage],
    queuedPackageCount: 0,
    device: {
      id: 'dev-mode',
      machineFingerprintHint: 'dev-mode',
      deviceName: '本地开发设备',
      platform: process.platform,
      arch: process.arch,
      appVersion: app.getVersion(),
      status: 'active',
    },
  };
}

/**
 * 获取当前机器 ID
 * 用于客户端展示和客服定位设备
 */
async function handleGetMachineId(): Promise<{ success: boolean; machineId?: string; error?: string }> {
  try {
    const machineId = getMachineId();
    return {
      success: true,
      machineId
    };
  } catch (error: any) {
    console.error('[授权 IPC] 获取机器 ID 失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 检查授权状态
 */
async function handleCheckLicense(event: Electron.IpcMainInvokeEvent, { forceRefresh: _forceRefresh = false } = {}): Promise<any> {
  try {
    console.log('[授权 IPC] 检查授权状态');

    // 开发模式下跳过授权检查
    if (isDevelopment) {
      console.log('[授权 IPC] 开发模式，跳过授权检查');
      return {
        authorized: true,
        developmentMode: true,
        userInfo: {
          user: '开发者',
          machineId: 'dev-mode'
        }
      };
    }

    // 正式版只允许云授权，配置缺失时必须保持未授权状态。
    const cloudStatus = await getCloudLicenseStatus();
    const status = {
      ...(cloudStatus.hasCloudCredential ? cloudStatus : await connectCloudDevice()),
      provider: 'cloud' as const,
    };
    licenseGate.updateStatus(status);
    if (status.authorized) taskQueueManager.notifyLicenseRestored();
    console.log('[授权 IPC] 授权状态:', {
      authorized: status.authorized,
      provider: status.provider,
      offlineMode: status.offlineMode,
    });

    // 发送授权状态变更事件到渲染进程
    event.sender.send('license-status-changed', status);

    return status;
  } catch (error: any) {
    console.error('[授权 IPC] 检查授权失败:', error);
    return {
      authorized: false,
      reason: error.message
    };
  }
}

/**
 * 获取授权详情
 */
async function handleGetLicenseInfo(): Promise<any> {
  try {
    console.log('[授权 IPC] 获取授权详情');

    // 开发模式
    if (isDevelopment) {
      return {
        authorized: true,
        developmentMode: true,
        userInfo: {
          user: '开发者',
          machineId: 'dev-mode'
        },
        licenseVersion: 'dev',
        updatedAt: new Date().toISOString()
      };
    }

    const cloudStatus = await getCloudLicenseStatus();
    const status = {
      ...(cloudStatus.hasCloudCredential ? cloudStatus : await connectCloudDevice()),
      provider: 'cloud' as const,
    };
    licenseGate.updateStatus(status);
    return status;
  } catch (error: any) {
    console.error('[授权 IPC] 获取授权详情失败:', error);
    return {
      authorized: false,
      reason: error.message
    };
  }
}

/**
 * 注册所有授权相关的 IPC 处理器
 */
export function registerAuthHandlers(mainWindow?: BrowserWindow): void {
  // 获取机器 ID
  ipcMain.handle('auth:get-machine-id', async () => {
    return handleGetMachineId();
  });

  // 检查授权状态
  ipcMain.handle('auth:check-license', async (event, params) => {
    return handleCheckLicense(event, params);
  });

  // 获取授权详情
  ipcMain.handle('auth:get-license-info', async () => {
    return handleGetLicenseInfo();
  });

  ipcMain.handle('auth:get-public-plans', async () => {
    try {
      return { success: true, plans: await getCloudPublicPlans() };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[授权 IPC] 获取公开套餐失败:', message);
      return { success: false, plans: [], error: message };
    }
  });

  ipcMain.handle('auth:get-package-center', async () => {
    try {
      return { success: true, center: addDevelopmentPackage(await getCloudPackageCenter()) };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (isDevelopment) {
        console.warn('[授权 IPC] 开发环境未连接授权服务器，使用本地开发套餐:', message);
        return { success: true, center: createDevelopmentPackageCenter() };
      }
      console.error('[授权 IPC] 获取套餐中心失败:', message);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('auth:redeem-package-code', async (_event, code: unknown) => {
    if (typeof code !== 'string' || code.trim().length < 10 || code.length > 80) {
      return { success: false, error: '请输入有效的套餐兑换码' };
    }
    try {
      const result = await redeemCloudPackageCode(code);
      licenseGate.updateStatus({
        configured: true,
        hasCloudCredential: true,
        authorized: result.center.authorized,
        accessSource: result.center.access.source,
        licensePlan: result.center.access.planName,
        ...(result.center.access.expiresAt === undefined ? {} : {
          licenseExpiresAt: result.center.access.expiresAt,
        }),
      });
      if (result.center.authorized) taskQueueManager.notifyLicenseRestored();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('license-status-changed', {
          authorized: result.center.authorized,
          provider: 'cloud',
          accessSource: result.center.access.source,
          licensePlan: result.center.access.planName,
          ...(result.center.access.expiresAt === undefined ? {} : {
            licenseExpiresAt: result.center.access.expiresAt,
          }),
        });
      }
      return { success: true, ...result, center: addDevelopmentPackage(result.center) };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[授权 IPC] 兑换套餐码失败:', message);
      return { success: false, error: message };
    }
  });

  if (mainWindow) {
    configureCloudLicenseHeartbeat({
      isActive: () => mainWindow.isVisible() && !mainWindow.isMinimized() && mainWindow.isFocused(),
      onStatus: (status) => {
        licenseGate.updateStatus(status);
        if (status.authorized) taskQueueManager.notifyLicenseRestored();
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('license-status-changed', { ...status, provider: 'cloud' });
        }
      },
    });
    app.once('before-quit', stopCloudHeartbeat);
  }

  console.log('[授权 IPC] 授权处理器已注册');
}

export {
  handleGetMachineId,
  handleCheckLicense,
  handleGetLicenseInfo
};
