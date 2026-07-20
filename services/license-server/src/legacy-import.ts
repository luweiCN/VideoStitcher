import { randomUUID } from 'node:crypto';
import {
  addAuditEvent,
  getMachineFingerprintHint,
  hashSensitiveValue,
  normalizeMachineFingerprint,
  type DeviceRecord,
  type LicenseDatabase,
  type LicenseRecord,
  type PackageGrantRecord,
  type PlanRecord,
} from './domain.js';
import { ApiError } from './errors.js';

const LEGACY_PLAN_ID = 'plan-legacy-github-perpetual';

interface LegacyGithubLicense {
  machineId: string;
  user: string;
  enabled: boolean;
  createdAt: string;
}

interface ParsedLegacyGithubData {
  licenses: LegacyGithubLicense[];
  ignoredSpecialKeyCount: number;
}

export interface LegacyGithubImportRow {
  deviceHint: string;
  customerName: string;
  enabled: boolean;
  action: 'import' | 'skip';
}

export interface LegacyGithubImportResult {
  dryRun: boolean;
  sourceCount: number;
  importedCount: number;
  skippedCount: number;
  disabledCount: number;
  ignoredSpecialKeyCount: number;
  rows: LegacyGithubImportRow[];
}

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'LEGACY_IMPORT_INVALID', `${label}格式无效`);
  }
  return value as Record<string, unknown>;
}

function parseDate(value: unknown, fallback: Date): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return fallback.toISOString();
  return new Date(value).toISOString();
}

function parseLegacyGithubData(value: unknown, now: Date): ParsedLegacyGithubData {
  const source = asObject(value, '旧版授权数据');
  if (!Array.isArray(source.licenses) || source.licenses.length > 5000) {
    throw new ApiError(400, 'LEGACY_IMPORT_INVALID', '旧版授权列表缺失或数量超过 5000');
  }
  const fallbackDate = parseDate(source.updatedAt, now);
  const seen = new Set<string>();
  const licenses = source.licenses.map((rawEntry, index) => {
    const entry = asObject(rawEntry, `第 ${index + 1} 条旧版授权`);
    if (typeof entry.machineId !== 'string') {
      throw new ApiError(400, 'LEGACY_IMPORT_INVALID', `第 ${index + 1} 条旧版授权缺少设备 ID`);
    }
    const machineId = normalizeMachineFingerprint(entry.machineId);
    if (!/^[a-f0-9]{64}$/.test(machineId)) {
      throw new ApiError(400, 'LEGACY_IMPORT_INVALID', `第 ${index + 1} 条旧版授权设备 ID 无效`);
    }
    if (seen.has(machineId)) {
      throw new ApiError(400, 'LEGACY_IMPORT_DUPLICATED', '旧版授权数据包含重复设备 ID');
    }
    seen.add(machineId);
    const user = typeof entry.user === 'string' && entry.user.trim()
      ? entry.user.trim().slice(0, 120)
      : `历史用户 ${getMachineFingerprintHint(machineId)}`;
    if (typeof entry.enabled !== 'boolean') {
      throw new ApiError(400, 'LEGACY_IMPORT_INVALID', `第 ${index + 1} 条旧版授权状态无效`);
    }
    return {
      machineId,
      user,
      enabled: entry.enabled,
      createdAt: parseDate(entry.createdAt ?? fallbackDate, now),
    };
  });
  return {
    licenses,
    ignoredSpecialKeyCount: Array.isArray(source.specialKeys) ? source.specialKeys.length : 0,
  };
}

function ensureLegacyPlan(database: LicenseDatabase, now: Date): PlanRecord {
  const existing = database.plans.find((plan) => plan.id === LEGACY_PLAN_ID);
  if (existing !== undefined) return existing;
  const plan: PlanRecord = {
    id: LEGACY_PLAN_ID,
    code: 'legacy-github',
    name: '历史永久授权',
    description: '从旧版 GitHub 授权名单迁移，仅用于兼容已有用户',
    status: 'archived',
    term: { unit: 'perpetual' },
    defaultMaxDevices: 1,
    isPublic: false,
    recommended: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    revision: 1,
  };
  database.plans.push(plan);
  return plan;
}

export function importLegacyGithubData(
  database: LicenseDatabase,
  value: unknown,
  licenseKeyPepper: string,
  actorId: string,
  now: Date,
  dryRun: boolean,
): LegacyGithubImportResult {
  const parsed = parseLegacyGithubData(value, now);
  const rows: LegacyGithubImportRow[] = [];
  const pending: Array<{
    source: LegacyGithubLicense;
    fingerprintHash: string;
    fingerprintHint: string;
  }> = [];

  for (const source of parsed.licenses) {
    const fingerprintHash = hashSensitiveValue(source.machineId, licenseKeyPepper);
    const fingerprintHint = getMachineFingerprintHint(source.machineId);
    const existing = database.devices.find((device) => device.machineFingerprintHash === fingerprintHash);
    if (existing !== undefined) {
      rows.push({
        deviceHint: fingerprintHint,
        customerName: source.user,
        enabled: source.enabled,
        action: 'skip',
      });
      continue;
    }
    if (database.licenses.some((license) => (
      license.retiredMachineFingerprintHashes?.includes(fingerprintHash) === true
    ))) {
      throw new ApiError(409, 'LEGACY_IMPORT_RETIRED_DEVICE', `设备尾号 ${fingerprintHint} 已在撤销历史中`);
    }
    pending.push({ source, fingerprintHash, fingerprintHint });
    rows.push({
      deviceHint: fingerprintHint,
      customerName: source.user,
      enabled: source.enabled,
      action: 'import',
    });
  }

  if (!dryRun && pending.length > 0) {
    const plan = ensureLegacyPlan(database, now);
    for (const item of pending) {
      const licenseId = randomUUID();
      const deviceId = randomUUID();
      const status = item.source.enabled ? 'active' : 'suspended';
      const license: LicenseRecord = {
        id: licenseId,
        customerName: item.source.user,
        customerNote: '从旧版 GitHub 授权名单迁移',
        tags: ['历史迁移'],
        deviceCredentialLockedAt: now.toISOString(),
        planId: plan.id,
        plan: plan.name,
        billingCycle: 'perpetual',
        accessSource: 'legacy',
        originSource: 'legacy',
        status,
        maxDevices: 1,
        createdAt: item.source.createdAt,
        updatedAt: now.toISOString(),
        revision: 1,
      };
      const device: DeviceRecord = {
        id: deviceId,
        licenseId,
        machineFingerprintHash: item.fingerprintHash,
        machineFingerprintHint: item.fingerprintHint,
        deviceName: item.source.user,
        platform: 'unknown',
        arch: 'unknown',
        appVersion: 'legacy-github',
        status: item.source.enabled ? 'pending' : 'deactivated',
        activatedAt: item.source.createdAt,
        sessionVersion: 1,
        updatedAt: now.toISOString(),
      };
      const grant: PackageGrantRecord = {
        id: `legacy-github-${licenseId}`,
        licenseId,
        planId: plan.id,
        planCode: plan.code,
        planName: plan.name,
        term: { unit: 'perpetual' },
        maxDevices: 1,
        source: 'legacy',
        reason: '从旧版 GitHub 授权名单迁移',
        assignedAt: item.source.createdAt,
        assignedBy: actorId,
        waitsForDefault: false,
        startsAt: item.source.createdAt,
      };
      database.licenses.push(license);
      database.devices.push(device);
      database.packageGrants.push(grant);
      addAuditEvent(database, {
        actorType: 'admin',
        actorId,
        action: 'legacy_github.device_imported',
        targetType: 'license',
        targetId: licenseId,
        reason: '导入旧版 GitHub 授权',
        metadata: {
          deviceHint: item.fingerprintHint,
          enabled: item.source.enabled,
        },
      }, now);
    }
    addAuditEvent(database, {
      actorType: 'admin',
      actorId,
      action: 'legacy_github.import_completed',
      targetType: 'system',
      targetId: 'legacy-github-v1',
      reason: '导入旧版 GitHub 授权',
      metadata: {
        sourceCount: parsed.licenses.length,
        importedCount: pending.length,
        ignoredSpecialKeyCount: parsed.ignoredSpecialKeyCount,
      },
    }, now);
  }

  return {
    dryRun,
    sourceCount: parsed.licenses.length,
    importedCount: pending.length,
    skippedCount: parsed.licenses.length - pending.length,
    disabledCount: parsed.licenses.filter((license) => !license.enabled).length,
    ignoredSpecialKeyCount: parsed.ignoredSpecialKeyCount,
    rows,
  };
}
