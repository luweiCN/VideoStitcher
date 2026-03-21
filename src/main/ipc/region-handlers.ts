/**
 * 地区管理 IPC 处理器
 * 提供地区 CRUD 操作的 IPC 接口
 */

import { ipcMain } from 'electron';
import { regionRepository } from '../database/repositories/regionRepository';

/**
 * 注册地区管理 IPC 处理器
 */
export function registerRegionHandlers(): void {
  // 获取所有地区（平铺列表）
  ipcMain.handle('region:getAll', async () => {
    try {
      const regions = regionRepository.getAllRegions();
      return { success: true, regions };
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      console.error('[区域处理器] 获取地区列表失败:', message);
      return { success: false, error: message };
    }
  });

  // 添加地区
  ipcMain.handle(
    'region:add',
    async (
      _event,
      data: {
        name: string;
        parentId?: string | null;
        emoji?: string;
        iconType?: string | null;
        iconValue?: string | null;
        culturalProfile?: string;
        sortOrder?: number;
      },
    ) => {
      try {
        const region = regionRepository.addRegion(data);
        return { success: true, region };
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误';
        console.error('[区域处理器] 添加地区失败:', message);
        return { success: false, error: message };
      }
    },
  );

  // 更新地区
  ipcMain.handle(
    'region:update',
    async (
      _event,
      id: string,
      data: {
        name?: string;
        parentId?: string | null;
        emoji?: string;
        iconType?: string | null;
        iconValue?: string | null;
        culturalProfile?: string;
        sortOrder?: number;
        isActive?: boolean;
      },
    ) => {
      try {
        regionRepository.updateRegion(id, data);
        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误';
        console.error('[区域处理器] 更新地区失败:', message);
        return { success: false, error: message };
      }
    },
  );

  // 删除地区（预置地区不可删除）
  ipcMain.handle('region:delete', async (_event, id: string) => {
    try {
      regionRepository.deleteRegion(id);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      console.error('[区域处理器] 删除地区失败:', message);
      return { success: false, error: message };
    }
  });
}
