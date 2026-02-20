/**
 * 数据库管理 IPC 接口
 */

import { ipcMain, dialog } from 'electron';
import {
  getDatabaseStats,
  getLogSize,
  clearLogs,
  cleanupOldTasks,
  checkIntegrity,
  repairDatabase,
  resetDatabase,
  createBackup,
  listBackups,
  restoreFromBackup,
} from '../database';

export function registerDatabaseIpc(): void {
  // 获取数据库统计信息
  ipcMain.handle('db:get-stats', async () => {
    return getDatabaseStats();
  });

  // 获取日志大小
  ipcMain.handle('db:get-log-size', async () => {
    return getLogSize();
  });

  // 清除所有日志
  ipcMain.handle('db:clear-logs', async () => {
    return clearLogs();
  });

  // 清理旧任务
  ipcMain.handle('db:cleanup-old-tasks', async (_, beforeDays: number) => {
    return cleanupOldTasks(beforeDays);
  });

  // 检查数据库完整性
  ipcMain.handle('db:check-integrity', async () => {
    return checkIntegrity();
  });

  // 修复数据库
  ipcMain.handle('db:repair', async () => {
    return repairDatabase();
  });

  // 重置数据库（危险操作，会弹窗确认）
  ipcMain.handle('db:reset', async (event) => {
    const result = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['取消', '确认重置'],
      defaultId: 0,
      cancelId: 0,
      title: '重置数据库',
      message: '确定要重置数据库吗？',
      detail: '此操作将删除所有任务数据和日志，且无法恢复。建议先备份。',
    });

    if (result.response === 1) {
      return resetDatabase();
    }
    
    return { success: false, error: '用户取消' };
  });

  // 直接重置数据库（不弹窗，用于前端已确认的场景）
  ipcMain.handle('db:reset-direct', async () => {
    return resetDatabase();
  });

  // 创建备份
  ipcMain.handle('db:create-backup', async (_, description?: string) => {
    return createBackup(description);
  });

  // 获取备份列表
  ipcMain.handle('db:list-backups', async () => {
    return listBackups();
  });

  // 从备份恢复
  ipcMain.handle('db:restore-backup', async (_, backupPath: string) => {
    return restoreFromBackup(backupPath);
  });

  // 删除备份文件
  ipcMain.handle('db:delete-backup', async (_, backupPath: string) => {
    try {
      const fs = await import('fs');
      fs.unlinkSync(backupPath);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
