/**
 * 授权验证 IPC 处理器
 * 处理渲染进程与主进程之间的授权相关通信
 */

import { ipcMain, app } from 'electron';
import { getMachineId, getLicenseStatus } from '../../shared/utils/license';

// 检测开发环境
const isDevelopment: boolean =
  process.env.NODE_ENV === 'development' ||
  process.env.DEBUG === 'true' ||
  !app.isPackaged;

/**
 * 获取当前机器 ID
 * 用于用户向管理员申请授权
 */
async function handleGetMachineId(): Promise<{ success: boolean; machineId?: string; error?: string }> {
  try {
    const machineId = getMachineId();
    console.log('[授权 IPC] 获取机器 ID:', machineId);
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
async function handleCheckLicense(event: Electron.IpcMainInvokeEvent, { forceRefresh = false } = {}): Promise<any> {
  try {
    console.log('[授权 IPC] 检查授权状态, 强制刷新:', forceRefresh);

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

    const status = await getLicenseStatus(forceRefresh);
    console.log('[授权 IPC] 授权状态:', status);

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

    const status = await getLicenseStatus(false);
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
export function registerAuthHandlers(): void {
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

  console.log('[授权 IPC] 授权处理器已注册');
}

export {
  handleGetMachineId,
  handleCheckLicense,
  handleGetLicenseInfo
};
