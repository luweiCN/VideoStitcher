import type {
  AccessSource,
  AdminRole,
  AdminStatus,
  BillingCycle,
  DeviceStatus,
  LicenseStatus,
  PackageGrantSource,
  PackageGrantStatus,
  PlanTerm,
} from './types';

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function formatDateTime(value?: string): string {
  if (!value) return '暂无记录';
  return dateTimeFormatter.format(new Date(value));
}

export function formatDate(value?: string): string {
  if (!value) return '长期有效';
  return dateFormatter.format(new Date(value));
}

export function formatRelativeTime(value?: string): string {
  if (!value) return '从未使用';
  const difference = Date.now() - new Date(value).getTime();
  if (difference < 60_000) return '刚刚';
  if (difference < 60 * 60_000) return `${Math.floor(difference / 60_000)} 分钟前`;
  if (difference < 24 * 60 * 60_000) return `${Math.floor(difference / (60 * 60_000))} 小时前`;
  return `${Math.floor(difference / (24 * 60 * 60_000))} 天前`;
}

export function formatUsageDuration(value: unknown): string {
  const seconds = typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours} 小时` : `${hours} 小时 ${remainingMinutes} 分`;
}

export function formatPlanTerm(term: PlanTerm): string {
  if (term.unit === 'perpetual') return '长期有效';
  return `${term.value} ${term.unit === 'day' ? '天' : '个月'}`;
}

export const licenseStatusLabels: Record<LicenseStatus, string> = {
  active: '使用中',
  suspended: '已暂停',
  revoked: '已撤销',
  expired: '已到期',
};

export const deviceStatusLabels: Record<DeviceStatus, string> = {
  pending: '等待连接',
  active: '可登录',
  deactivated: '已退出',
  revoked: '已禁用',
};

export const accessSourceLabels: Record<AccessSource, string> = {
  none: '尚未获得权益',
  trial: '历史试用',
  complimentary: '运营赠送',
  paid: '购买套餐',
  legacy: '历史授权',
};

export const packageGrantSourceLabels: Record<PackageGrantSource, string> = {
  complimentary: '运营赠送',
  paid: '购买兑换',
  legacy: '历史迁移',
};

export const packageGrantStatusLabels: Record<PackageGrantStatus, string> = {
  queued: '待生效',
  active: '使用中',
  completed: '已用完',
  withdrawn: '已撤回',
};

export const billingCycleLabels: Record<BillingCycle, string> = {
  monthly: '月度',
  quarterly: '季度',
  yearly: '年度',
  perpetual: '长期',
  custom: '自定义',
};

export const adminRoleLabels: Record<AdminRole, string> = {
  owner: '所有者',
  operator: '运营管理员',
};

export const adminStatusLabels: Record<AdminStatus, string> = {
  active: '已启用',
  disabled: '已停用',
};

export const auditActionLabels: Record<string, string> = {
  'admin.bootstrapped': '创建首个所有者账号',
  'admin.created': '添加管理员账号',
  'admin.updated': '更新管理员账号',
  'admin.password_changed': '管理员修改自己的密码',
  'admin.logged_out': '退出管理后台',
  'admin.login_succeeded': '登录管理后台',
  'admin.login_failed': '管理员登录失败',
  'user.created': '旧版设备建档记录',
  'user.claimed': '旧版设备建档更新',
  'authorized_device.created': '旧版设备建档记录',
  'authorized_device.registered': '旧版设备建档更新',
  'license.profile_updated': '更新授权设备备注',
  'license.active': '恢复设备使用权限',
  'license.suspended': '暂停设备使用权限',
  'license.revoked': '撤销设备使用权限',
  'plan.created': '创建套餐包',
  'plan.updated': '更新套餐包',
  'package_grant.created': '发放套餐包',
  'package_grant.withdrawn': '撤回套餐包',
  'redemption_batch.created': '生成套餐码批次',
  'redemption_batch.active': '恢复套餐码批次',
  'redemption_batch.disabled': '暂停套餐码批次',
  'redemption_code.redeemed': '设备兑换套餐码',
  'default_access.updated': '更新全局权益',
  'new_device_default_access.updated': '更新新设备默认权益',
  'new_device_default_access.granted': '自动发放新设备默认权益',
  'device.credential_bound': '设备完成首次绑定',
  'device.credential_rotated': '未发放套餐设备凭据已更新',
  'device.registered': '客户端首次登记设备',
  'device.rebound': '更换授权设备',
  'device.deactivated': '电脑退出登录',
  'device.revoked': '禁用登录电脑',
  'trial.started': '历史试用开始记录',
  'trial.credential_rotated': '历史试用设备凭据已更新',
};

export function getAuditActionLabel(action: string): string {
  return auditActionLabels[action] ?? action;
}
