import { machineIdSync } from 'node-machine-id';

/**
 * 获取用于设备关联的系统标识。
 *
 * 该值不是认证秘密，也不承诺在系统重装后保持不变。
 */
export function getMachineId(): string {
  try {
    return machineIdSync();
  } catch (error: unknown) {
    console.error('[授权] 获取机器 ID 失败:', error);
    throw new Error('无法获取机器 ID');
  }
}
