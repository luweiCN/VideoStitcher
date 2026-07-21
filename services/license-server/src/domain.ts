import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

export const LICENSE_STATUSES = ['active', 'suspended', 'revoked', 'expired'] as const;
export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

export const BILLING_CYCLES = ['monthly', 'quarterly', 'yearly', 'perpetual', 'custom'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const SUBSCRIPTION_BILLING_CYCLES = ['monthly', 'quarterly', 'yearly'] as const;
export type SubscriptionBillingCycle = (typeof SUBSCRIPTION_BILLING_CYCLES)[number];

export const ENTITLEMENT_SOURCES = ['none', 'trial', 'complimentary', 'paid', 'legacy'] as const;
export type EntitlementSource = (typeof ENTITLEMENT_SOURCES)[number];

export const PACKAGE_GRANT_SOURCES = ['complimentary', 'paid', 'legacy'] as const;
export type PackageGrantSource = (typeof PACKAGE_GRANT_SOURCES)[number];

export const PACKAGE_GRANT_STATUSES = ['queued', 'active', 'completed', 'withdrawn'] as const;
export type PackageGrantStatus = (typeof PACKAGE_GRANT_STATUSES)[number];

export const REDEMPTION_BATCH_STATUSES = ['active', 'disabled'] as const;
export type RedemptionBatchStatus = (typeof REDEMPTION_BATCH_STATUSES)[number];

export const REDEMPTION_CODE_STATUSES = ['available', 'redeemed'] as const;
export type RedemptionCodeStatus = (typeof REDEMPTION_CODE_STATUSES)[number];

export const DEFAULT_ACCESS_STATUSES = ['active', 'disabled'] as const;
export type DefaultAccessStatus = (typeof DEFAULT_ACCESS_STATUSES)[number];

export const ACCESS_MODES = ['package', 'default', 'trial', 'legacy', 'none'] as const;
export type AccessMode = (typeof ACCESS_MODES)[number];

export const PACKAGE_GRANT_BATCH_DUPLICATE_POLICIES = ['append', 'skip_existing'] as const;
export type PackageGrantBatchDuplicatePolicy = (typeof PACKAGE_GRANT_BATCH_DUPLICATE_POLICIES)[number];

export const PLAN_STATUSES = ['active', 'archived'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const ADMIN_ROLES = ['owner', 'operator'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_STATUSES = ['active', 'disabled'] as const;
export type AdminStatus = (typeof ADMIN_STATUSES)[number];

export const PLAN_TERM_UNITS = ['day', 'month', 'perpetual'] as const;
export type PlanTerm =
  | { unit: 'day'; value: number }
  | { unit: 'month'; value: number }
  | { unit: 'perpetual' };

export const DEVICE_STATUSES = ['pending', 'active', 'deactivated', 'revoked'] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export const ONLINE_THRESHOLD_MS = 15 * 60 * 1000;
export const HEARTBEAT_INTERVAL_SECONDS = 5 * 60;
export const SESSION_TTL_SECONDS = 30 * 60;
export const OFFLINE_GRACE_SECONDS = 14 * 24 * 60 * 60;
export const MAX_LICENSE_TAGS = 20;
export const MAX_LICENSE_TAG_LENGTH = 24;

export interface PlanRecord {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: PlanStatus;
  term: PlanTerm;
  defaultMaxDevices: number;
  isPublic: boolean;
  recommended: boolean;
  priceLabel?: string;
  purchaseUrl?: string;
  externalSku?: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface LicenseRecord {
  id: string;
  customerName: string;
  customerEmail?: string;
  customerNote?: string;
  tags: string[];
  deviceCredentialLockedAt?: string;
  retiredMachineFingerprintHashes?: string[];
  planId?: string;
  plan: string;
  billingCycle?: BillingCycle;
  accessSource?: EntitlementSource;
  originSource?: EntitlementSource;
  status: LicenseStatus;
  maxDevices: number;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface PackageGrantRecord {
  id: string;
  licenseId: string;
  planId: string;
  planCode: string;
  planName: string;
  term: PlanTerm;
  maxDevices: number;
  source: PackageGrantSource;
  reason: string;
  assignedAt: string;
  assignedBy: string;
  batchGrantId?: string;
  waitsForDefault: boolean;
  pausedForDefault?: boolean;
  pausedRemainingSeconds?: number;
  startsAt?: string;
  expiresAt?: string;
  withdrawnAt?: string;
  withdrawnBy?: string;
  withdrawalReason?: string;
}

export interface AuthorizedDeviceFilter {
  query?: string;
  licenseStatuses?: LicenseStatus[];
  deviceStatuses?: DeviceStatus[];
  accessModes?: AccessMode[];
  accessSources?: EntitlementSource[];
  currentPlanIds?: string[];
  ownedPlanIds?: string[];
  missingPlanIds?: string[];
  tags?: string[];
  tagMatch?: 'any' | 'all';
  online?: boolean;
  foregroundNow?: boolean;
  activeToday?: boolean;
  platforms?: string[];
  archs?: string[];
  appVersions?: string[];
  createdFrom?: string;
  createdTo?: string;
  lastActivityFrom?: string;
  lastActivityTo?: string;
  expiresFrom?: string;
  expiresTo?: string;
  minTodayForegroundSeconds?: number;
  maxTodayForegroundSeconds?: number;
  minTodayLaunchCount?: number;
  maxTodayLaunchCount?: number;
}

export type PackageGrantBatchSelection =
  | { mode: 'selected'; licenseIds: string[] }
  | { mode: 'filter'; filter: AuthorizedDeviceFilter; excludedLicenseIds?: string[] };

export interface PackageGrantBatchRecord {
  id: string;
  operationKey: string;
  selection: PackageGrantBatchSelection;
  planId: string;
  planCode: string;
  planName: string;
  term: PlanTerm;
  source: PackageGrantSource;
  duplicatePolicy: PackageGrantBatchDuplicatePolicy;
  reason: string;
  matchedCount: number;
  grantedCount: number;
  skippedDuplicateCount: number;
  skippedBlockedCount: number;
  createdAt: string;
  createdBy: string;
  withdrawnAt?: string;
  withdrawnBy?: string;
  withdrawalReason?: string;
}

export interface RedemptionBatchRecord {
  id: string;
  name: string;
  planId: string;
  planCode: string;
  planName: string;
  term: PlanTerm;
  source: PackageGrantSource;
  salesChannel?: string;
  reason: string;
  status: RedemptionBatchStatus;
  quantity: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  disabledAt?: string;
  disabledBy?: string;
  disabledReason?: string;
}

export interface RedemptionCodeRecord {
  id: string;
  batchId: string;
  codeHash: string;
  codeCiphertext?: string;
  codeHint: string;
  status: RedemptionCodeStatus;
  createdAt: string;
  redeemedAt?: string;
  redeemedLicenseId?: string;
  redeemedDeviceId?: string;
  packageGrantId?: string;
}

export interface DefaultAccessRecord {
  planId: string;
  status: DefaultAccessStatus;
  endsAt?: string;
  reason: string;
  updatedAt: string;
  updatedBy: string;
  revision: number;
}

export interface NewDeviceDefaultAccessRecord {
  planId: string;
  status: DefaultAccessStatus;
  reason: string;
  updatedAt: string;
  updatedBy: string;
  revision: number;
}

export interface DeviceRecord {
  id: string;
  licenseId: string;
  installationId?: string;
  deviceCredentialHash?: string;
  devicePublicKey?: string;
  machineFingerprintHash: string;
  machineFingerprintHint: string;
  deviceName: string;
  platform: string;
  arch: string;
  appVersion: string;
  status: DeviceStatus;
  activatedAt: string;
  lastHeartbeatAt?: string;
  lastActivityAt?: string;
  lastIpHash?: string;
  sessionVersion: number;
  updatedAt: string;
}

export interface AdminRecord {
  id: string;
  username: string;
  displayName: string;
  role: AdminRole;
  status: AdminStatus;
  passwordHash: string;
  sessionVersion: number;
  failedLoginAttempts: number;
  lockedUntil?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface AuditEvent {
  id: string;
  occurredAt: string;
  actorType: 'admin' | 'device' | 'system';
  actorId: string;
  action: string;
  targetType: 'license' | 'device' | 'plan' | 'package_grant' | 'package_grant_batch' | 'redemption_batch' | 'redemption_code' | 'default_access' | 'admin' | 'system';
  targetId: string;
  reason?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface LicenseDatabase {
  schemaVersion: 9;
  revision: number;
  admins: AdminRecord[];
  plans: PlanRecord[];
  licenses: LicenseRecord[];
  packageGrants: PackageGrantRecord[];
  packageGrantBatches: PackageGrantBatchRecord[];
  redemptionBatches: RedemptionBatchRecord[];
  redemptionCodes: RedemptionCodeRecord[];
  defaultAccess?: DefaultAccessRecord;
  newDeviceDefaultAccess?: NewDeviceDefaultAccessRecord;
  devices: DeviceRecord[];
  auditEvents: AuditEvent[];
}

export interface PublicPackageGrantRecord extends PackageGrantRecord {
  status: PackageGrantStatus;
}

export interface PublicDefaultAccessRecord extends DefaultAccessRecord {
  planName: string;
  planTerm: PlanTerm;
  effective: boolean;
}

export interface PublicNewDeviceDefaultAccessRecord extends NewDeviceDefaultAccessRecord {
  planName: string;
  planTerm: PlanTerm;
  effective: boolean;
}

export interface PublicRedemptionBatchRecord extends RedemptionBatchRecord {
  redeemedCount: number;
  availableCount: number;
}

export interface PublicPackageGrantBatchRecord extends PackageGrantBatchRecord {
  activeCount: number;
  completedCount: number;
  withdrawnCount: number;
}

export interface PublicLicenseRecord {
  id: string;
  customerName: string;
  customerEmail?: string;
  customerNote?: string;
  tags: string[];
  planId?: string;
  plan: string;
  billingCycle: BillingCycle;
  accessSource: EntitlementSource;
  accessMode: AccessMode;
  status: LicenseStatus;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  activeDeviceCount: number;
  onlineDeviceCount: number;
  lastHeartbeatAt?: string;
  lastActivityAt?: string;
  packages: PublicPackageGrantRecord[];
  queuedPackageCount: number;
}

export interface PublicDeviceRecord extends Omit<
  DeviceRecord,
  'machineFingerprintHash' | 'deviceCredentialHash' | 'devicePublicKey' | 'installationId' | 'lastIpHash'
> {
  online: boolean;
  foreground: boolean;
  todayForegroundSeconds: number;
  todayLaunchCount: number;
  dailyUsage?: DailyUsageRecord[];
}

export interface DailyUsageRecord {
  date: string;
  foregroundSeconds: number;
  launchCount: number;
}

export interface DeviceActivityRecord {
  schemaVersion: 1;
  revision: number;
  deviceId: string;
  licenseId: string;
  appVersion: string;
  active: boolean;
  lastHeartbeatAt: string;
  lastActivityAt?: string;
  dailyUsage: DailyUsageRecord[];
}

export type PublicPlanRecord = Omit<PlanRecord, 'externalSku' | 'revision'>;

export type PublicAdminRecord = Omit<
  AdminRecord,
  'passwordHash' | 'failedLoginAttempts' | 'lockedUntil' | 'sessionVersion'
>;

const DEFAULT_PLAN_DEFINITIONS = [
  {
    id: 'plan-default-monthly',
    code: 'monthly',
    name: '月度套餐',
    description: '按一个自然月计算的授权套餐',
    term: { unit: 'month', value: 1 } as const,
  },
  {
    id: 'plan-default-quarterly',
    code: 'quarterly',
    name: '季度套餐',
    description: '按三个自然月计算的授权套餐',
    term: { unit: 'month', value: 3 } as const,
  },
  {
    id: 'plan-default-yearly',
    code: 'yearly',
    name: '年度套餐',
    description: '按十二个自然月计算的授权套餐',
    term: { unit: 'month', value: 12 } as const,
  },
] as const;

export function createDefaultPlans(now = new Date()): PlanRecord[] {
  const timestamp = now.toISOString();
  return DEFAULT_PLAN_DEFINITIONS.map((definition) => ({
    ...definition,
    status: 'active',
    defaultMaxDevices: 1,
    isPublic: false,
    recommended: definition.code === 'yearly',
    createdAt: timestamp,
    updatedAt: timestamp,
    revision: 1,
  }));
}

export function createEmptyDatabase(now = new Date()): LicenseDatabase {
  return {
    schemaVersion: 9,
    revision: 0,
    admins: [],
    plans: createDefaultPlans(now),
    licenses: [],
    packageGrants: [],
    packageGrantBatches: [],
    redemptionBatches: [],
    redemptionCodes: [],
    devices: [],
    auditEvents: [],
  };
}

function inferLegacyGrantTerm(license: LicenseRecord, plan?: PlanRecord): PlanTerm {
  if (plan !== undefined) return structuredClone(plan.term);
  const billingCycle = getLicenseBillingCycle(license);
  if (billingCycle === 'monthly') return { unit: 'month', value: 1 };
  if (billingCycle === 'quarterly') return { unit: 'month', value: 3 };
  if (billingCycle === 'yearly') return { unit: 'month', value: 12 };
  if (billingCycle === 'perpetual') return { unit: 'perpetual' };
  if (license.expiresAt !== undefined) {
    const duration = new Date(license.expiresAt).getTime() - new Date(license.createdAt).getTime();
    return { unit: 'day', value: Math.max(1, Math.round(duration / (24 * 60 * 60 * 1000))) };
  }
  return { unit: 'perpetual' };
}

function migrateLegacyPackageGrants(licenses: LicenseRecord[], plans: PlanRecord[]): PackageGrantRecord[] {
  return licenses.flatMap((license) => {
    if ((license.originSource ?? getEntitlementSource(license)) === 'trial') return [];
    const plan = license.planId === undefined
      ? undefined
      : plans.find((candidate) => candidate.id === license.planId);
    return [{
      id: `legacy-${license.id}`,
      licenseId: license.id,
      planId: plan?.id ?? `legacy-plan-${license.id}`,
      planCode: plan?.code ?? `legacy-${license.id}`,
      planName: plan?.name ?? license.plan,
      term: inferLegacyGrantTerm(license, plan),
      maxDevices: license.maxDevices,
      source: getEntitlementSource(license) === 'paid' ? 'paid'
        : getEntitlementSource(license) === 'complimentary' ? 'complimentary' : 'legacy',
      reason: '从旧版授权数据迁移',
      assignedAt: license.createdAt,
      assignedBy: 'system-migration',
      waitsForDefault: false,
      startsAt: license.createdAt,
      ...(license.expiresAt === undefined ? {} : { expiresAt: license.expiresAt }),
    }];
  });
}

export function migrateLicenseDatabase(value: unknown, now = new Date()): LicenseDatabase {
  if (value === null || typeof value !== 'object') {
    throw new Error('授权数据库格式无效');
  }
  const source = value as {
    schemaVersion?: unknown;
    revision?: unknown;
    plans?: unknown;
    licenses?: unknown;
    devices?: unknown;
    auditEvents?: unknown;
    admins?: unknown;
    packageGrants?: unknown;
    redemptionBatches?: unknown;
    redemptionCodes?: unknown;
    packageGrantBatches?: unknown;
    defaultAccess?: unknown;
    newDeviceDefaultAccess?: unknown;
  };
  if (!Array.isArray(source.licenses) || !Array.isArray(source.devices) || !Array.isArray(source.auditEvents)) {
    throw new Error('授权数据库缺少必要数据表');
  }
  const schemaVersion = source.schemaVersion;
  if (
    schemaVersion !== 1
    && schemaVersion !== 2
    && schemaVersion !== 3
    && schemaVersion !== 4
    && schemaVersion !== 5
    && schemaVersion !== 6
    && schemaVersion !== 7
    && schemaVersion !== 8
    && schemaVersion !== 9
  ) {
    throw new Error(`不支持的授权数据库版本：${String(source.schemaVersion)}`);
  }

  const rawLicenses = structuredClone(source.licenses as Array<LicenseRecord & { claimedAt?: string }>);
  const plans = schemaVersion >= 2 && Array.isArray(source.plans)
    ? structuredClone(source.plans as PlanRecord[])
    : createDefaultPlans(now);
  const admins = schemaVersion >= 3 && Array.isArray(source.admins)
    ? structuredClone(source.admins as AdminRecord[])
    : [];
  const packageGrants = schemaVersion >= 4 && Array.isArray(source.packageGrants)
    ? structuredClone(source.packageGrants as PackageGrantRecord[])
    : migrateLegacyPackageGrants(rawLicenses, plans);
  const licenses = rawLicenses.map((rawLicense) => {
    const license = rawLicense as LicenseRecord & {
      claimedAt?: string;
      keyHash?: string;
      keyHint?: string;
    };
    delete license.keyHash;
    delete license.keyHint;
    const customerName = license.customerName.replace(/^(?:未认领|兑换设备)\s*·\s*/, '');
    const originSource = license.originSource ?? license.accessSource ?? 'legacy';
    const hasFormalPackage = packageGrants.some(
      (grant) => grant.licenseId === license.id && grant.withdrawnAt === undefined,
    );
    const deviceCredentialLockedAt = license.deviceCredentialLockedAt
      ?? (schemaVersion < 9
        ? license.claimedAt
          ?? (originSource !== 'trial' || hasFormalPackage ? license.updatedAt : undefined)
        : undefined);
    delete license.claimedAt;
    return {
      ...license,
      customerName,
      accessSource: license.accessSource ?? 'legacy',
      originSource,
      maxDevices: 1,
      ...(deviceCredentialLockedAt === undefined ? {} : { deviceCredentialLockedAt }),
    };
  });
  const defaultAccess = schemaVersion >= 4
    && source.defaultAccess !== null
    && typeof source.defaultAccess === 'object'
    ? structuredClone(source.defaultAccess as DefaultAccessRecord)
    : undefined;
  const newDeviceDefaultAccess = schemaVersion >= 8
    && source.newDeviceDefaultAccess !== null
    && typeof source.newDeviceDefaultAccess === 'object'
    ? structuredClone(source.newDeviceDefaultAccess as NewDeviceDefaultAccessRecord)
    : undefined;
  const redemptionBatches = schemaVersion >= 6 && Array.isArray(source.redemptionBatches)
    ? structuredClone(source.redemptionBatches as RedemptionBatchRecord[])
    : [];
  const redemptionCodes = schemaVersion >= 6 && Array.isArray(source.redemptionCodes)
    ? structuredClone(source.redemptionCodes as RedemptionCodeRecord[])
    : [];
  const packageGrantBatches = schemaVersion >= 7 && Array.isArray(source.packageGrantBatches)
    ? structuredClone(source.packageGrantBatches as PackageGrantBatchRecord[])
    : [];

  const database: LicenseDatabase = {
    schemaVersion: 9,
    revision: typeof source.revision === 'number' ? source.revision : 0,
    admins,
    plans: plans.map((plan) => ({ ...plan, defaultMaxDevices: 1 })),
    licenses: licenses.map((license) => ({
      ...license,
      tags: normalizeLicenseTags(Array.isArray(license.tags) ? license.tags : []),
    })),
    packageGrants: packageGrants.map((grant) => ({ ...grant, maxDevices: 1 })),
    packageGrantBatches,
    redemptionBatches,
    redemptionCodes,
    ...(defaultAccess === undefined ? {} : { defaultAccess }),
    ...(newDeviceDefaultAccess === undefined ? {} : { newDeviceDefaultAccess }),
    devices: selectCurrentDeviceBindings(source.devices as DeviceRecord[]),
    auditEvents: structuredClone(source.auditEvents as AuditEvent[]),
  };
  assertLicenseDatabaseIntegrity(database);
  return database;
}

export function normalizeLicenseTags(tags: readonly string[]): string[] {
  const normalized = tags.map((tag) => tag.trim()).filter(Boolean);
  const unique = [...new Set(normalized)];
  if (unique.length > MAX_LICENSE_TAGS) {
    throw new Error(`每台授权设备最多设置 ${MAX_LICENSE_TAGS} 个标签`);
  }
  if (unique.some((tag) => tag.length > MAX_LICENSE_TAG_LENGTH || /[\u0000-\u001f\u007f]/.test(tag))) {
    throw new Error(`标签长度不能超过 ${MAX_LICENSE_TAG_LENGTH} 个字符且不能包含控制字符`);
  }
  return unique;
}

function assertUniqueValues(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label}存在重复值`);
  }
}

function assertRequiredString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label}必须是非空字符串`);
  }
}

function assertValidDate(value: string | undefined, label: string): void {
  if (value !== undefined && Number.isNaN(Date.parse(value))) {
    throw new Error(`${label}不是有效日期`);
  }
}

/**
 * 校验当前主状态的关键字段、唯一约束和实体关系。
 */
export function assertLicenseDatabaseIntegrity(database: LicenseDatabase): void {
  if (database.schemaVersion !== 9) throw new Error('授权数据库版本必须是 9');
  if (!Number.isInteger(database.revision) || database.revision < 0) {
    throw new Error('授权数据库 revision 无效');
  }
  const collections: Array<[string, readonly { id: string }[]]> = [
    ['管理员', database.admins],
    ['套餐', database.plans],
    ['授权档案', database.licenses],
    ['套餐包', database.packageGrants],
    ['批量发放', database.packageGrantBatches],
    ['兑换码批次', database.redemptionBatches],
    ['兑换码', database.redemptionCodes],
    ['设备', database.devices],
    ['审计日志', database.auditEvents],
  ];
  for (const [label, records] of collections) {
    if (!Array.isArray(records)) throw new Error(`${label}数据必须是数组`);
    records.forEach((record) => assertRequiredString(record.id, `${label} ID`));
    assertUniqueValues(records.map((record) => record.id), `${label} ID`);
  }

  const planIds = new Set(database.plans.map((plan) => plan.id));
  const licenseIds = new Set(database.licenses.map((license) => license.id));
  const deviceIds = new Set(database.devices.map((device) => device.id));
  const redemptionBatchIds = new Set(database.redemptionBatches.map((batch) => batch.id));
  const packageBatchIds = new Set(database.packageGrantBatches.map((batch) => batch.id));
  const packageGrantIds = new Set(database.packageGrants.map((grant) => grant.id));

  assertUniqueValues(database.plans.map((plan) => plan.code), '套餐代码');
  for (const plan of database.plans) {
    assertRequiredString(plan.code, '套餐代码');
    assertRequiredString(plan.name, '套餐名称');
    if (!PLAN_STATUSES.includes(plan.status)) throw new Error(`套餐 ${plan.id} 状态无效`);
    if (plan.term.unit !== 'perpetual'
      && (!Number.isInteger(plan.term.value) || plan.term.value < 1 || plan.term.value > 1200)) {
      throw new Error(`套餐 ${plan.id} 期限无效`);
    }
    assertValidDate(plan.createdAt, `套餐 ${plan.id} 创建时间`);
    assertValidDate(plan.updatedAt, `套餐 ${plan.id} 更新时间`);
  }

  for (const license of database.licenses) {
    assertRequiredString(license.customerName, `授权档案 ${license.id} 名称`);
    assertRequiredString(license.plan, `授权档案 ${license.id} 套餐名称`);
    if (!LICENSE_STATUSES.includes(license.status)) throw new Error(`授权档案 ${license.id} 状态无效`);
    const normalizedTags = normalizeLicenseTags(license.tags);
    if (JSON.stringify(normalizedTags) !== JSON.stringify(license.tags)) {
      throw new Error(`授权档案 ${license.id} 标签未规范化`);
    }
    assertValidDate(license.deviceCredentialLockedAt, `授权档案 ${license.id} 设备凭据锁定时间`);
    assertValidDate(license.expiresAt, `授权档案 ${license.id} 到期时间`);
    assertValidDate(license.createdAt, `授权档案 ${license.id} 创建时间`);
    assertValidDate(license.updatedAt, `授权档案 ${license.id} 更新时间`);
  }

  const deviceLicenseIds: string[] = [];
  for (const device of database.devices) {
    if (!licenseIds.has(device.licenseId)) {
      throw new Error(`设备 ${device.id} 引用了不存在的授权档案 ${device.licenseId}`);
    }
    if (!DEVICE_STATUSES.includes(device.status)) throw new Error(`设备 ${device.id} 状态无效`);
    assertRequiredString(device.machineFingerprintHash, `设备 ${device.id} 指纹摘要`);
    assertRequiredString(device.machineFingerprintHint, `设备 ${device.id} 指纹提示`);
    assertValidDate(device.activatedAt, `设备 ${device.id} 激活时间`);
    assertValidDate(device.updatedAt, `设备 ${device.id} 更新时间`);
    deviceLicenseIds.push(device.licenseId);
  }
  assertUniqueValues(deviceLicenseIds, '授权档案与设备的一对一绑定');
  assertUniqueValues(database.devices.map((device) => device.machineFingerprintHash), '设备指纹摘要');

  for (const grant of database.packageGrants) {
    if (!licenseIds.has(grant.licenseId)) {
      throw new Error(`套餐包 ${grant.id} 引用了不存在的授权档案 ${grant.licenseId}`);
    }
    if (grant.batchGrantId !== undefined && !packageBatchIds.has(grant.batchGrantId)) {
      throw new Error(`套餐包 ${grant.id} 引用了不存在的批量发放 ${grant.batchGrantId}`);
    }
    if (!PACKAGE_GRANT_SOURCES.includes(grant.source)) throw new Error(`套餐包 ${grant.id} 来源无效`);
    assertValidDate(grant.assignedAt, `套餐包 ${grant.id} 发放时间`);
    assertValidDate(grant.startsAt, `套餐包 ${grant.id} 生效时间`);
    assertValidDate(grant.expiresAt, `套餐包 ${grant.id} 到期时间`);
    assertValidDate(grant.withdrawnAt, `套餐包 ${grant.id} 撤回时间`);
    if (
      grant.pausedRemainingSeconds !== undefined
      && (!Number.isInteger(grant.pausedRemainingSeconds) || grant.pausedRemainingSeconds < 1)
    ) {
      throw new Error(`套餐包 ${grant.id} 暂停剩余时长无效`);
    }
  }

  assertUniqueValues(database.packageGrantBatches.map((batch) => batch.operationKey), '批量发放幂等键');
  for (const batch of database.packageGrantBatches) {
    if (!planIds.has(batch.planId)) throw new Error(`批量发放 ${batch.id} 引用了不存在的套餐`);
    assertRequiredString(batch.operationKey, `批量发放 ${batch.id} 幂等键`);
    assertRequiredString(batch.planCode, `批量发放 ${batch.id} 套餐代码`);
    assertRequiredString(batch.planName, `批量发放 ${batch.id} 套餐名称`);
    assertRequiredString(batch.reason, `批量发放 ${batch.id} 原因`);
    if (!PACKAGE_GRANT_SOURCES.includes(batch.source)) throw new Error(`批量发放 ${batch.id} 来源无效`);
    if (!PACKAGE_GRANT_BATCH_DUPLICATE_POLICIES.includes(batch.duplicatePolicy)) {
      throw new Error(`批量发放 ${batch.id} 重复策略无效`);
    }
    if (batch.selection.mode === 'selected') {
      assertUniqueValues(batch.selection.licenseIds, `批量发放 ${batch.id} 设备列表`);
      if (batch.selection.licenseIds.some((licenseId) => !licenseIds.has(licenseId))) {
        throw new Error(`批量发放 ${batch.id} 引用了不存在的授权档案`);
      }
    } else if (batch.selection.mode !== 'filter') {
      throw new Error(`批量发放 ${batch.id} 范围类型无效`);
    }
    const counts = [
      batch.matchedCount,
      batch.grantedCount,
      batch.skippedDuplicateCount,
      batch.skippedBlockedCount,
    ];
    if (counts.some((count) => !Number.isInteger(count) || count < 0)) {
      throw new Error(`批量发放 ${batch.id} 统计数量无效`);
    }
    if (
      batch.grantedCount + batch.skippedDuplicateCount + batch.skippedBlockedCount
      !== batch.matchedCount
    ) {
      throw new Error(`批量发放 ${batch.id} 统计数量不一致`);
    }
    const actualGrantCount = database.packageGrants.filter((grant) => grant.batchGrantId === batch.id).length;
    if (actualGrantCount !== batch.grantedCount) {
      throw new Error(`批量发放 ${batch.id} 与套餐包数量不一致`);
    }
    assertValidDate(batch.createdAt, `批量发放 ${batch.id} 创建时间`);
    assertValidDate(batch.withdrawnAt, `批量发放 ${batch.id} 撤回时间`);
  }

  for (const batch of database.redemptionBatches) {
    if (!planIds.has(batch.planId)) throw new Error(`兑换码批次 ${batch.id} 引用了不存在的套餐`);
  }
  assertUniqueValues(database.redemptionCodes.map((code) => code.codeHash), '兑换码摘要');
  for (const code of database.redemptionCodes) {
    if (!redemptionBatchIds.has(code.batchId)) throw new Error(`兑换码 ${code.id} 引用了不存在的批次`);
    if (code.codeCiphertext !== undefined) {
      assertRequiredString(code.codeCiphertext, `兑换码 ${code.id} 加密内容`);
    }
    if (code.redeemedLicenseId !== undefined && !licenseIds.has(code.redeemedLicenseId)) {
      throw new Error(`兑换码 ${code.id} 引用了不存在的授权档案`);
    }
    if (code.redeemedDeviceId !== undefined && !deviceIds.has(code.redeemedDeviceId)) {
      throw new Error(`兑换码 ${code.id} 引用了不存在的设备`);
    }
    if (code.packageGrantId !== undefined && !packageGrantIds.has(code.packageGrantId)) {
      throw new Error(`兑换码 ${code.id} 引用了不存在的套餐包`);
    }
  }
  if (database.defaultAccess !== undefined && !planIds.has(database.defaultAccess.planId)) {
    throw new Error('全局权益引用了不存在的套餐');
  }
  if (
    database.newDeviceDefaultAccess !== undefined
    && !planIds.has(database.newDeviceDefaultAccess.planId)
  ) {
    throw new Error('新设备默认权益引用了不存在的套餐');
  }
}

export function normalizeAdminUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function hashSensitiveValue(value: string, pepper: string): string {
  return createHash('sha256').update(`${pepper}:${value}`).digest('hex');
}

export function normalizeMachineFingerprint(value: string): string {
  return value.trim().toLowerCase();
}

export function getMachineFingerprintHint(value: string): string {
  return normalizeMachineFingerprint(value).slice(-8).padStart(8, '*');
}

export function isLicenseExpired(license: LicenseRecord, now: Date): boolean {
  return license.expiresAt !== undefined && new Date(license.expiresAt).getTime() <= now.getTime();
}

export function getEffectiveLicenseStatus(license: LicenseRecord, now: Date): LicenseStatus {
  if (license.status === 'active' && isLicenseExpired(license, now)) {
    return 'expired';
  }
  return license.status;
}

export function getLicenseBillingCycle(license: LicenseRecord): BillingCycle {
  if (license.billingCycle !== undefined) {
    return license.billingCycle;
  }
  return license.expiresAt === undefined ? 'perpetual' : 'custom';
}

export function getEntitlementSource(license: LicenseRecord): EntitlementSource {
  return license.accessSource ?? 'legacy';
}

export function getPlanBillingCycle(term: PlanTerm): BillingCycle {
  if (term.unit === 'perpetual') return 'perpetual';
  if (term.unit === 'month' && term.value === 1) return 'monthly';
  if (term.unit === 'month' && term.value === 3) return 'quarterly';
  if (term.unit === 'month' && term.value === 12) return 'yearly';
  return 'custom';
}

export function getPlanExpiresAt(baseDate: Date, term: PlanTerm): string | undefined {
  if (term.unit === 'perpetual') return undefined;
  if (term.unit === 'day') {
    return new Date(baseDate.getTime() + term.value * 24 * 60 * 60 * 1000).toISOString();
  }
  if (term.value === 1) return addBillingPeriods(baseDate, 'monthly', 1).toISOString();
  if (term.value === 3) return addBillingPeriods(baseDate, 'quarterly', 1).toISOString();
  if (term.value === 12) return addBillingPeriods(baseDate, 'yearly', 1).toISOString();
  return addBillingPeriods(baseDate, 'monthly', term.value).toISOString();
}

export function addBillingPeriods(
  baseDate: Date,
  billingCycle: SubscriptionBillingCycle,
  periods: number,
): Date {
  const monthsPerPeriod: Record<SubscriptionBillingCycle, number> = {
    monthly: 1,
    quarterly: 3,
    yearly: 12,
  };
  const months = monthsPerPeriod[billingCycle] * periods;
  const targetMonthIndex = baseDate.getUTCFullYear() * 12 + baseDate.getUTCMonth() + months;
  const targetYear = Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(
    targetYear,
    targetMonth,
    Math.min(baseDate.getUTCDate(), lastDayOfTargetMonth),
    baseDate.getUTCHours(),
    baseDate.getUTCMinutes(),
    baseDate.getUTCSeconds(),
    baseDate.getUTCMilliseconds(),
  ));
}

export interface EffectiveLicenseAccess {
  mode: AccessMode;
  planId?: string;
  plan: string;
  billingCycle: BillingCycle;
  source: EntitlementSource;
  status: LicenseStatus;
  maxDevices: number;
  expiresAt?: string;
  packageGrantId?: string;
}

export function getPackageGrantStatus(grant: PackageGrantRecord, now: Date): PackageGrantStatus {
  if (grant.withdrawnAt !== undefined) return 'withdrawn';
  if (grant.startsAt === undefined || new Date(grant.startsAt).getTime() > now.getTime()) return 'queued';
  if (grant.expiresAt === undefined || new Date(grant.expiresAt).getTime() > now.getTime()) return 'active';
  return 'completed';
}

export function toPublicPackageGrant(grant: PackageGrantRecord, now: Date): PublicPackageGrantRecord {
  return { ...structuredClone(grant), status: getPackageGrantStatus(grant, now) };
}

export function isDefaultAccessEffective(defaultAccess: DefaultAccessRecord | undefined, now: Date): boolean {
  return defaultAccess?.status === 'active'
    && (defaultAccess.endsAt === undefined || new Date(defaultAccess.endsAt).getTime() > now.getTime());
}

export function toPublicDefaultAccess(
  defaultAccess: DefaultAccessRecord,
  plans: PlanRecord[],
  now: Date,
): PublicDefaultAccessRecord {
  const plan = plans.find((candidate) => candidate.id === defaultAccess.planId);
  if (plan === undefined) {
    throw new Error('全局权益引用了不存在的套餐');
  }
  return {
    ...structuredClone(defaultAccess),
    planName: plan.name,
    planTerm: structuredClone(plan.term),
    effective: isDefaultAccessEffective(defaultAccess, now),
  };
}

export function toPublicNewDeviceDefaultAccess(
  defaultAccess: NewDeviceDefaultAccessRecord,
  plans: PlanRecord[],
): PublicNewDeviceDefaultAccessRecord {
  const plan = plans.find((candidate) => candidate.id === defaultAccess.planId);
  if (plan === undefined) {
    throw new Error('新设备默认权益引用了不存在的套餐');
  }
  return {
    ...structuredClone(defaultAccess),
    planName: plan.name,
    planTerm: structuredClone(plan.term),
    effective: defaultAccess.status === 'active' && plan.status === 'active',
  };
}

export function toPublicRedemptionBatch(
  batch: RedemptionBatchRecord,
  codes: RedemptionCodeRecord[],
): PublicRedemptionBatchRecord {
  const batchCodes = codes.filter((code) => code.batchId === batch.id);
  const redeemedCount = batchCodes.filter((code) => code.status === 'redeemed').length;
  return {
    ...structuredClone(batch),
    redeemedCount,
    availableCount: batchCodes.length - redeemedCount,
  };
}

export function toPublicPackageGrantBatch(
  batch: PackageGrantBatchRecord,
  grants: PackageGrantRecord[],
  now: Date,
): PublicPackageGrantBatchRecord {
  let activeCount = 0;
  let completedCount = 0;
  let withdrawnCount = 0;
  for (const grant of grants) {
    if (grant.batchGrantId !== batch.id) continue;
    const status = getPackageGrantStatus(grant, now);
    if (status === 'withdrawn') withdrawnCount += 1;
    else if (status === 'completed') completedCount += 1;
    else activeCount += 1;
  }
  return {
    ...structuredClone(batch),
    activeCount,
    completedCount,
    withdrawnCount,
  };
}

export function getEffectiveLicenseAccess(
  license: LicenseRecord,
  packageGrants: PackageGrantRecord[],
  defaultAccess: DefaultAccessRecord | undefined,
  plans: PlanRecord[],
  now: Date,
): EffectiveLicenseAccess {
  const ownedGrants = packageGrants.filter((grant) => grant.licenseId === license.id);
  const activeGrant = ownedGrants.find((grant) => getPackageGrantStatus(grant, now) === 'active');
  const nextGrant = ownedGrants.find((grant) => getPackageGrantStatus(grant, now) === 'queued');
  const defaultPlan = defaultAccess === undefined
    ? undefined
    : plans.find((plan) => plan.id === defaultAccess.planId);
  const defaultApplies = defaultPlan !== undefined
    && isDefaultAccessEffective(defaultAccess, now);

  let mode: AccessMode;
  let planId: string | undefined;
  let plan: string;
  let billingCycle: BillingCycle;
  let source: EntitlementSource;
  let maxDevices: number;
  let expiresAt: string | undefined;
  let packageGrantId: string | undefined;

  if (defaultApplies && defaultAccess !== undefined && defaultPlan !== undefined) {
    mode = 'default';
    planId = defaultPlan.id;
    plan = defaultPlan.name;
    billingCycle = getPlanBillingCycle(defaultPlan.term);
    source = 'complimentary';
    maxDevices = defaultPlan.defaultMaxDevices;
    expiresAt = defaultAccess.endsAt;
  } else if (activeGrant !== undefined) {
    mode = 'package';
    planId = activeGrant.planId;
    plan = activeGrant.planName;
    billingCycle = getPlanBillingCycle(activeGrant.term);
    source = activeGrant.source;
    maxDevices = activeGrant.maxDevices;
    expiresAt = activeGrant.expiresAt;
    packageGrantId = activeGrant.id;
  } else if (
    (license.originSource ?? getEntitlementSource(license)) === 'trial'
    && !isLicenseExpired(license, now)
  ) {
    mode = 'trial';
    planId = license.planId;
    plan = license.plan;
    billingCycle = getLicenseBillingCycle(license);
    source = 'trial';
    maxDevices = license.maxDevices;
    expiresAt = license.expiresAt;
  } else if (ownedGrants.length === 0 && getEntitlementSource(license) === 'legacy') {
    mode = 'legacy';
    planId = license.planId;
    plan = license.plan;
    billingCycle = getLicenseBillingCycle(license);
    source = 'legacy';
    maxDevices = license.maxDevices;
    expiresAt = license.expiresAt;
  } else {
    mode = 'none';
    planId = nextGrant?.planId;
    plan = nextGrant?.planName ?? '尚未分配套餐包';
    billingCycle = nextGrant === undefined ? 'custom' : getPlanBillingCycle(nextGrant.term);
    source = nextGrant?.source ?? getEntitlementSource(license);
    maxDevices = nextGrant?.maxDevices ?? license.maxDevices;
  }

  const accessExpired = mode === 'none'
    || (expiresAt !== undefined && new Date(expiresAt).getTime() <= now.getTime());
  const status = license.status === 'suspended' || license.status === 'revoked'
    ? license.status
    : accessExpired ? 'expired' : 'active';
  return {
    mode,
    ...(planId === undefined ? {} : { planId }),
    plan,
    billingCycle,
    source,
    status,
    maxDevices,
    ...(expiresAt === undefined ? {} : { expiresAt }),
    ...(packageGrantId === undefined ? {} : { packageGrantId }),
  };
}

export function isDeviceOnline(
  device: DeviceRecord,
  now: Date,
  activity?: DeviceActivityRecord,
): boolean {
  const lastHeartbeatAt = activity?.lastHeartbeatAt ?? device.lastHeartbeatAt;
  if (device.status !== 'active' || lastHeartbeatAt === undefined) {
    return false;
  }
  return now.getTime() - new Date(lastHeartbeatAt).getTime() <= ONLINE_THRESHOLD_MS;
}

export function toPublicLicense(
  license: LicenseRecord,
  devices: DeviceRecord[],
  now: Date,
  plans: PlanRecord[] = [],
  packageGrants: PackageGrantRecord[] = [],
  defaultAccess?: DefaultAccessRecord,
  activities: DeviceActivityRecord[] = [],
): PublicLicenseRecord {
  const ownedDevices = devices.filter((device) => device.licenseId === license.id);
  const activeDevices = ownedDevices.filter((device) => device.status === 'active');
  const activitiesByDeviceId = new Map(activities.map((activity) => [activity.deviceId, activity]));
  const heartbeatTimes = ownedDevices
    .flatMap((device) => {
      const value = activitiesByDeviceId.get(device.id)?.lastHeartbeatAt ?? device.lastHeartbeatAt;
      return value === undefined ? [] : [value];
    })
    .sort();
  const activityTimes = ownedDevices
    .flatMap((device) => {
      const value = activitiesByDeviceId.get(device.id)?.lastActivityAt ?? device.lastActivityAt;
      return value === undefined ? [] : [value];
    })
    .sort();
  const packages = packageGrants
    .filter((grant) => grant.licenseId === license.id)
    .map((grant) => toPublicPackageGrant(grant, now));
  const effectiveAccess = getEffectiveLicenseAccess(license, packageGrants, defaultAccess, plans, now);

  return {
    id: license.id,
    customerName: license.customerName,
    ...(license.customerEmail === undefined ? {} : { customerEmail: license.customerEmail }),
    ...(license.customerNote === undefined ? {} : { customerNote: license.customerNote }),
    tags: [...license.tags],
    ...(effectiveAccess.planId === undefined ? {} : { planId: effectiveAccess.planId }),
    plan: effectiveAccess.plan,
    billingCycle: effectiveAccess.billingCycle,
    accessSource: effectiveAccess.source,
    accessMode: effectiveAccess.mode,
    status: effectiveAccess.status,
    ...(effectiveAccess.expiresAt === undefined ? {} : { expiresAt: effectiveAccess.expiresAt }),
    createdAt: license.createdAt,
    updatedAt: license.updatedAt,
    activeDeviceCount: activeDevices.length,
    onlineDeviceCount: activeDevices.filter(
      (device) => isDeviceOnline(device, now, activitiesByDeviceId.get(device.id)),
    ).length,
    ...(heartbeatTimes.at(-1) === undefined ? {} : { lastHeartbeatAt: heartbeatTimes.at(-1) }),
    ...(activityTimes.at(-1) === undefined ? {} : { lastActivityAt: activityTimes.at(-1) }),
    packages,
    queuedPackageCount: packages.filter((item) => item.status === 'queued').length,
  };
}

export function toPublicPlan(plan: PlanRecord): PublicPlanRecord {
  const { externalSku: _externalSku, revision: _revision, ...publicPlan } = plan;
  return publicPlan;
}

export function toPublicAdmin(admin: AdminRecord): PublicAdminRecord {
  const {
    passwordHash: _passwordHash,
    failedLoginAttempts: _failedLoginAttempts,
    lockedUntil: _lockedUntil,
    sessionVersion: _sessionVersion,
    ...publicAdmin
  } = admin;
  return publicAdmin;
}

export function toPublicDevice(
  device: DeviceRecord,
  now: Date,
  activity?: DeviceActivityRecord,
  includeDailyUsage = false,
): PublicDeviceRecord {
  const {
    machineFingerprintHash: _machineFingerprintHash,
    deviceCredentialHash: _deviceCredentialHash,
    devicePublicKey: _devicePublicKey,
    installationId: _installationId,
    lastIpHash: _lastIpHash,
    ...publicDevice
  } = device;
  const todayUsage = activity?.dailyUsage.find((item) => item.date === getUsageDate(now));
  const todayForegroundSeconds = normalizeUsageValue(todayUsage?.foregroundSeconds);
  const todayLaunchCount = normalizeUsageValue(todayUsage?.launchCount);
  return {
    ...publicDevice,
    appVersion: activity?.appVersion ?? device.appVersion,
    ...(activity?.lastHeartbeatAt === undefined ? {} : { lastHeartbeatAt: activity.lastHeartbeatAt }),
    ...(activity?.lastActivityAt === undefined ? {} : { lastActivityAt: activity.lastActivityAt }),
    online: isDeviceOnline(device, now, activity),
    foreground: activity?.active === true && isDeviceOnline(device, now, activity),
    todayForegroundSeconds,
    todayLaunchCount,
    ...(includeDailyUsage && activity !== undefined ? {
      dailyUsage: activity.dailyUsage.map((item) => ({
        date: item.date,
        foregroundSeconds: normalizeUsageValue(item.foregroundSeconds),
        launchCount: normalizeUsageValue(item.launchCount),
      })),
    } : {}),
  };
}

function normalizeUsageValue(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

export function getUsageDate(value: Date): string {
  return new Date(value.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function selectCurrentDeviceBindings(devices: DeviceRecord[]): DeviceRecord[] {
  const currentByLicense = new Map<string, DeviceRecord>();
  for (const sourceDevice of devices) {
    const device: DeviceRecord = {
      ...structuredClone(sourceDevice),
      machineFingerprintHint: sourceDevice.machineFingerprintHint || '未记录',
    };
    const current = currentByLicense.get(device.licenseId);
    const currentTime = current === undefined ? Number.NEGATIVE_INFINITY : Date.parse(current.updatedAt);
    if (Date.parse(device.updatedAt) >= currentTime) currentByLicense.set(device.licenseId, device);
  }
  return [...currentByLicense.values()];
}

export function addAuditEvent(
  database: LicenseDatabase,
  event: Omit<AuditEvent, 'id' | 'occurredAt'>,
  now: Date,
): void {
  database.auditEvents.unshift({
    id: randomUUID(),
    occurredAt: now.toISOString(),
    ...event,
  });
  database.auditEvents = database.auditEvents.slice(0, 5000);
}

export function safeCompareHex(actual: string, expected: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(actual) || !/^[a-f0-9]{64}$/i.test(expected)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}
