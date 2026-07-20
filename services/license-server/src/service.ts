import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  HEARTBEAT_INTERVAL_SECONDS,
  OFFLINE_GRACE_SECONDS,
  PACKAGE_GRANT_BATCH_DUPLICATE_POLICIES,
  SESSION_TTL_SECONDS,
  addAuditEvent,
  getMachineFingerprintHint,
  getEntitlementSource,
  getEffectiveLicenseAccess,
  getPackageGrantStatus,
  getPlanBillingCycle,
  getPlanExpiresAt,
  hashSensitiveValue,
  isDeviceOnline,
  isLicenseExpired,
  normalizeLicenseTags,
  normalizeMachineFingerprint,
  toPublicDevice,
  toPublicDefaultAccess,
  toPublicLicense,
  toPublicNewDeviceDefaultAccess,
  toPublicPackageGrant,
  toPublicPackageGrantBatch,
  toPublicPlan,
  toPublicRedemptionBatch,
  type AccessMode,
  type AuthorizedDeviceFilter,
  type DefaultAccessStatus,
  type DeviceActivityRecord,
  type DeviceRecord,
  type DeviceStatus,
  type EntitlementSource,
  type LicenseDatabase,
  type LicenseRecord,
  type LicenseStatus,
  type PackageGrantRecord,
  type PackageGrantBatchDuplicatePolicy,
  type PackageGrantBatchRecord,
  type PackageGrantBatchSelection,
  type PackageGrantSource,
  type PlanRecord,
  type PlanStatus,
  type PlanTerm,
  type RedemptionBatchRecord,
  type RedemptionCodeRecord,
  type RedemptionBatchStatus,
} from './domain.js';
import { ApiError } from './errors.js';
import {
  assertEd25519PublicKey,
  verifyDeviceRequestProof,
  type DeviceRequestProof,
} from './device-proof.js';
import { importLegacyGithubData } from './legacy-import.js';
import type { LicenseStorage } from './storage.js';
import { mutateDatabase, mutateDeviceActivity } from './storage.js';
import { signEntitlementReceipt, signSessionToken, verifySessionToken } from './token.js';

const REDEMPTION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function normalizeUsageCounter(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

export interface ClientDeviceInput {
  installationId: string;
  devicePublicKey: string;
  machineFingerprint: string;
  deviceName: string;
  platform: string;
  arch: string;
  appVersion: string;
}

export interface ActivityInput {
  appVersion: string;
  active: boolean;
}

export interface CreateRedemptionBatchInput {
  name: string;
  planId: string;
  quantity: number;
  source: PackageGrantSource;
  salesChannel?: string;
  reason: string;
}

export interface UpdateRedemptionBatchInput {
  status: RedemptionBatchStatus;
  reason: string;
}

export interface CreatePlanInput {
  code: string;
  name: string;
  description?: string;
  term: PlanTerm;
  isPublic: boolean;
  recommended?: boolean;
  priceLabel?: string;
  purchaseUrl?: string;
  externalSku?: string;
}

export interface UpdatePlanInput {
  name?: string;
  description?: string | null;
  status?: PlanStatus;
  term?: PlanTerm;
  isPublic?: boolean;
  recommended?: boolean;
  priceLabel?: string | null;
  purchaseUrl?: string | null;
  externalSku?: string | null;
}

export interface UpdateLicenseProfileInput {
  customerName: string;
  customerEmail?: string | null;
  customerNote?: string | null;
  tags?: string[];
  reason: string;
}

export interface GrantPackageInput {
  planId: string;
  source: PackageGrantSource;
  reason: string;
}

export interface PackageGrantBatchInput {
  operationKey: string;
  selection: PackageGrantBatchSelection;
  planId: string;
  source: PackageGrantSource;
  duplicatePolicy: PackageGrantBatchDuplicatePolicy;
  reason: string;
}

export interface PackageGrantBatchPreview {
  matchedCount: number;
  grantCount: number;
  skippedDuplicateCount: number;
  skippedBlockedCount: number;
  exceedsLimit: boolean;
  sample: Array<{
    licenseId: string;
    customerName: string;
    currentPlan: string;
    status: LicenseStatus;
    tags: string[];
  }>;
}

export interface UpdateDefaultAccessInput {
  planId: string;
  status: DefaultAccessStatus;
  endsAt?: string | null;
  reason: string;
}

export interface UpdateNewDeviceDefaultAccessInput {
  planId: string;
  status: DefaultAccessStatus;
  reason: string;
}

export interface AdminListResult {
  generatedAt: string;
  licenses: ReturnType<typeof toPublicLicense>[];
  devices: ReturnType<typeof toPublicDevice>[];
  plans: PlanRecord[];
  redemptionBatches: ReturnType<typeof toPublicRedemptionBatch>[];
  packageGrantBatches: ReturnType<typeof toPublicPackageGrantBatch>[];
  availableTags: string[];
  defaultAccess?: ReturnType<typeof toPublicDefaultAccess>;
  newDeviceDefaultAccess?: ReturnType<typeof toPublicNewDeviceDefaultAccess>;
  metrics: {
    totalEntitlements: number;
    activeEntitlements: number;
    trialEntitlements: number;
    complimentaryEntitlements: number;
    paidEntitlements: number;
    activeDevices: number;
    onlineDevices: number;
    todayForegroundSeconds: number;
  };
}

interface ServiceOptions {
  storage: LicenseStorage;
  licenseKeyPepper: string;
  signingPrivateKey: string;
  signingPublicKey: string;
  trialDays?: number;
  now?: () => Date;
}

interface PackageGrantBatchEvaluation {
  targets: LicenseRecord[];
  grantable: LicenseRecord[];
  duplicates: LicenseRecord[];
  blocked: LicenseRecord[];
}

export class LicenseService {
  private readonly now: () => Date;
  private readonly trialDays: number;
  private readonly redemptionCodeEncryptionKey: Buffer;

  public constructor(private readonly options: ServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.trialDays = options.trialDays ?? 7;
    this.redemptionCodeEncryptionKey = Buffer.from(
      hashSensitiveValue('redemption-code-inventory-key:v1', options.licenseKeyPepper),
      'hex',
    );
  }

  public async validate(
    sessionToken: string,
    activity: ActivityInput,
    sourceIp: string,
  ): Promise<Record<string, unknown>> {
    return this.updateDeviceSession(sessionToken, activity, sourceIp);
  }

  public async heartbeat(
    sessionToken: string,
    activity: ActivityInput,
    sourceIp: string,
  ): Promise<Record<string, unknown>> {
    return this.updateDeviceSession(sessionToken, activity, sourceIp);
  }

  public async verifyDeviceRequest(
    sessionToken: string,
    proof: DeviceRequestProof,
  ): Promise<void> {
    const { database } = await this.options.storage.read();
    const { device } = this.getDeviceSession(database, sessionToken);
    if (device.devicePublicKey === undefined) {
      throw new ApiError(401, 'DEVICE_KEY_REQUIRED', '当前设备需要重新连接以绑定设备密钥');
    }
    verifyDeviceRequestProof(proof, device.devicePublicKey, this.now());
  }

  public async previewLegacyGithubImport(
    value: unknown,
    actorId = 'admin',
  ): Promise<Record<string, unknown>> {
    const now = this.now();
    const { database } = await this.options.storage.read();
    return {
      migration: importLegacyGithubData(
        database,
        value,
        this.options.licenseKeyPepper,
        actorId,
        now,
        true,
      ),
    };
  }

  public async applyLegacyGithubImport(
    value: unknown,
    actorId = 'admin',
  ): Promise<Record<string, unknown>> {
    const now = this.now();
    return mutateDatabase(this.options.storage, (database) => ({
      migration: importLegacyGithubData(
        database,
        value,
        this.options.licenseKeyPepper,
        actorId,
        now,
        false,
      ),
    }));
  }

  public async connectDevice(
    deviceInput: ClientDeviceInput,
    sourceIp: string,
  ): Promise<Record<string, unknown>> {
    const now = this.now();
    const normalizedFingerprint = normalizeMachineFingerprint(deviceInput.machineFingerprint);
    this.assertMachineFingerprint(normalizedFingerprint);
    assertEd25519PublicKey(deviceInput.devicePublicKey);
    const fingerprintHash = hashSensitiveValue(
      normalizedFingerprint,
      this.options.licenseKeyPepper,
    );
    const credentialHash = this.hashDeviceCredential(deviceInput.installationId);
    const connection = await mutateDatabase(this.options.storage, (database) => {
      const existingDevice = database.devices.find((candidate) => (
        candidate.machineFingerprintHash === fingerprintHash
      ));
      const existingLicense = existingDevice === undefined
        ? undefined
        : database.licenses.find((license) => license.id === existingDevice.licenseId);

      if (
        existingDevice === undefined
        && database.licenses.some((license) => (
          license.retiredMachineFingerprintHashes?.includes(fingerprintHash) === true
        ))
      ) {
        throw new ApiError(403, 'DEVICE_REVOKED', '该设备 ID 已从原授权档案移除，不能自动创建新的试用');
      }

      if (existingLicense !== undefined && existingDevice !== undefined) {
        if (existingDevice.status === 'revoked') {
          throw new ApiError(403, 'DEVICE_REVOKED', '当前设备绑定已被管理员撤销');
        }
        const legacyCredentialMatches = existingDevice.installationId === deviceInput.installationId;
        const credentialMatches = existingDevice.deviceCredentialHash === credentialHash;
        const canBindCredential = existingDevice.deviceCredentialHash === undefined
          && (existingDevice.installationId === undefined
            || legacyCredentialMatches
            || existingDevice.status === 'pending');
        const canRotateTrialCredential = existingLicense.originSource === 'trial'
          && !isLicenseExpired(existingLicense, now)
          && existingLicense.deviceCredentialLockedAt === undefined;
        const publicKeyMatches = existingDevice.devicePublicKey === deviceInput.devicePublicKey;
        const canBindPublicKey = existingDevice.devicePublicKey === undefined
          && (credentialMatches || canBindCredential || canRotateTrialCredential);
        if (!publicKeyMatches && !canBindPublicKey) {
          throw new ApiError(403, 'DEVICE_CREDENTIAL_INVALID', '设备密钥已变化，请联系管理员重新绑定设备');
        }
        if (!credentialMatches && !canBindCredential && !canRotateTrialCredential) {
          throw new ApiError(403, 'DEVICE_CREDENTIAL_INVALID', '设备凭据已变化，请联系管理员重新绑定设备');
        }
        const credentialChanged = !credentialMatches;
        existingDevice.deviceCredentialHash = credentialHash;
        existingDevice.devicePublicKey = deviceInput.devicePublicKey;
        delete existingDevice.installationId;
        existingDevice.machineFingerprintHint = getMachineFingerprintHint(normalizedFingerprint);
        existingDevice.deviceName = deviceInput.deviceName;
        existingDevice.platform = deviceInput.platform;
        existingDevice.arch = deviceInput.arch;
        existingDevice.appVersion = deviceInput.appVersion;
        existingDevice.status = 'active';
        existingDevice.lastHeartbeatAt = now.toISOString();
        existingDevice.lastActivityAt = now.toISOString();
        existingDevice.lastIpHash = hashSensitiveValue(sourceIp, this.options.licenseKeyPepper);
        existingDevice.sessionVersion += 1;
        existingDevice.updatedAt = now.toISOString();
        if (credentialChanged) {
          addAuditEvent(database, {
            actorType: 'device',
            actorId: existingDevice.id,
            action: canRotateTrialCredential ? 'trial.credential_rotated' : 'device.credential_bound',
            targetType: 'device',
            targetId: existingDevice.id,
          }, now);
        }
        return {
          deviceId: existingDevice.id,
          licenseId: existingLicense.id,
          session: this.createClientSession(database, existingLicense, existingDevice, now),
        };
      }

      const newDeviceDefaultAccess = database.newDeviceDefaultAccess;
      const newDeviceDefaultPlan = newDeviceDefaultAccess?.status === 'active'
        ? database.plans.find((plan) => (
          plan.id === newDeviceDefaultAccess.planId && plan.status === 'active'
        ))
        : undefined;
      const license: LicenseRecord = newDeviceDefaultPlan === undefined
        ? {
          id: randomUUID(),
          customerName: deviceInput.deviceName,
          tags: [],
          plan: `${this.trialDays} 天免费试用`,
          billingCycle: 'custom',
          accessSource: 'trial',
          originSource: 'trial',
          status: 'active',
          maxDevices: 1,
          expiresAt: new Date(now.getTime() + this.trialDays * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          revision: 1,
        }
        : {
          id: randomUUID(),
          customerName: deviceInput.deviceName,
          tags: [],
          planId: newDeviceDefaultPlan.id,
          plan: newDeviceDefaultPlan.name,
          billingCycle: getPlanBillingCycle(newDeviceDefaultPlan.term),
          accessSource: 'complimentary',
          originSource: 'complimentary',
          status: 'active',
          maxDevices: 1,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          revision: 1,
        };
      const device: DeviceRecord = {
        id: randomUUID(),
        licenseId: license.id,
        deviceCredentialHash: credentialHash,
        devicePublicKey: deviceInput.devicePublicKey,
        machineFingerprintHash: fingerprintHash,
        machineFingerprintHint: getMachineFingerprintHint(normalizedFingerprint),
        deviceName: deviceInput.deviceName,
        platform: deviceInput.platform,
        arch: deviceInput.arch,
        appVersion: deviceInput.appVersion,
        status: 'active',
        activatedAt: now.toISOString(),
        lastHeartbeatAt: now.toISOString(),
        lastActivityAt: now.toISOString(),
        lastIpHash: hashSensitiveValue(sourceIp, this.options.licenseKeyPepper),
        sessionVersion: 1,
        updatedAt: now.toISOString(),
      };
      database.licenses.push(license);
      database.devices.push(device);
      if (newDeviceDefaultPlan === undefined || newDeviceDefaultAccess === undefined) {
        addAuditEvent(database, {
          actorType: 'device',
          actorId: device.id,
          action: 'trial.started',
          targetType: 'license',
          targetId: license.id,
          metadata: { trialDays: this.trialDays },
        }, now);
      } else {
        const packageGrant = this.createPackageGrant(
          database,
          license,
          newDeviceDefaultPlan,
          'complimentary',
          newDeviceDefaultAccess.reason,
          'system:new-device-default-access',
          now,
        );
        addAuditEvent(database, {
          actorType: 'system',
          actorId: 'new-device-default-access',
          action: 'new_device_default_access.granted',
          targetType: 'package_grant',
          targetId: packageGrant.id,
          reason: newDeviceDefaultAccess.reason,
          metadata: { licenseId: license.id, planId: newDeviceDefaultPlan.id },
        }, now);
      }
      return {
        deviceId: device.id,
        licenseId: license.id,
        session: this.createClientSession(database, license, device, now),
      };
    });
    await this.recordDeviceActivity(
      connection.deviceId,
      connection.licenseId,
      deviceInput.appVersion,
      true,
      true,
      now,
    );
    return connection.session;
  }

  public async getPackageCenter(sessionToken: string): Promise<Record<string, unknown>> {
    const now = this.now();
    const { database } = await this.options.storage.read();
    const { license, device } = this.getDeviceSession(database, sessionToken);
    return { packageCenter: this.createPackageCenterView(database, license, device, now) };
  }

  public async redeemPackageCode(
    sessionToken: string,
    rawCode: string,
  ): Promise<Record<string, unknown>> {
    const normalizedCode = this.normalizeRedemptionCode(rawCode);
    const codeHash = this.hashRedemptionCode(normalizedCode);
    const now = this.now();
    return mutateDatabase(this.options.storage, (database) => {
      const { license, device } = this.getDeviceSession(database, sessionToken);
      if (license.status === 'suspended' || license.status === 'revoked') {
        throw new ApiError(403, 'LICENSE_INACTIVE', '当前授权设备已被暂停或撤销，不能兑换套餐');
      }
      const redemptionCode = database.redemptionCodes.find((candidate) => candidate.codeHash === codeHash);
      if (redemptionCode === undefined) {
        throw new ApiError(404, 'REDEMPTION_CODE_INVALID', '套餐兑换码无效，请检查后重试');
      }
      const batch = database.redemptionBatches.find((candidate) => candidate.id === redemptionCode.batchId);
      if (batch === undefined) {
        throw new ApiError(409, 'REDEMPTION_BATCH_NOT_FOUND', '套餐兑换码所属批次不存在');
      }
      if (redemptionCode.status === 'redeemed') {
        if (redemptionCode.redeemedDeviceId !== device.id) {
          throw new ApiError(409, 'REDEMPTION_CODE_REDEEMED', '该套餐兑换码已经被其他设备使用');
        }
        const existingGrant = database.packageGrants.find(
          (grant) => grant.id === redemptionCode.packageGrantId,
        );
        return {
          alreadyRedeemed: true,
          ...(existingGrant === undefined ? {} : { packageGrant: toPublicPackageGrant(existingGrant, now) }),
          packageCenter: this.createPackageCenterView(database, license, device, now),
          session: this.createClientSession(database, license, device, now),
        };
      }
      if (batch.status !== 'active') {
        throw new ApiError(409, 'REDEMPTION_BATCH_DISABLED', '该套餐兑换码批次已暂停使用');
      }

      license.deviceCredentialLockedAt ??= now.toISOString();
      license.accessSource = batch.source;
      if (license.status === 'expired') license.status = 'active';
      license.updatedAt = now.toISOString();
      license.revision += 1;
      const packageGrant = this.createPackageGrant(
        database,
        license,
        {
          id: batch.planId,
          code: batch.planCode,
          name: batch.planName,
          term: batch.term,
        },
        batch.source,
        `兑换套餐码批次：${batch.name}`,
        `redemption-code:${redemptionCode.id}`,
        now,
      );
      redemptionCode.status = 'redeemed';
      redemptionCode.redeemedAt = now.toISOString();
      redemptionCode.redeemedLicenseId = license.id;
      redemptionCode.redeemedDeviceId = device.id;
      redemptionCode.packageGrantId = packageGrant.id;
      addAuditEvent(database, {
        actorType: 'device',
        actorId: device.id,
        action: 'redemption_code.redeemed',
        targetType: 'redemption_code',
        targetId: redemptionCode.id,
        metadata: {
          batchId: batch.id,
          planId: batch.planId,
          licenseId: license.id,
          deviceHint: device.machineFingerprintHint,
        },
      }, now);
      return {
        alreadyRedeemed: false,
        packageGrant: toPublicPackageGrant(packageGrant, now),
        packageCenter: this.createPackageCenterView(database, license, device, now),
        session: this.createClientSession(database, license, device, now),
      };
    });
  }

  public async createPlan(input: CreatePlanInput, actorId = 'admin'): Promise<Record<string, unknown>> {
    const now = this.now();
    this.assertPlanInput(input.code, input.term);
    const record: PlanRecord = {
      id: randomUUID(),
      code: input.code,
      name: input.name,
      ...(input.description === undefined ? {} : { description: input.description }),
      status: 'active',
      term: input.term,
      defaultMaxDevices: 1,
      isPublic: input.isPublic,
      recommended: input.recommended ?? false,
      ...(input.priceLabel === undefined ? {} : { priceLabel: input.priceLabel }),
      ...(input.purchaseUrl === undefined ? {} : { purchaseUrl: input.purchaseUrl }),
      ...(input.externalSku === undefined ? {} : { externalSku: input.externalSku }),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      revision: 1,
    };
    return mutateDatabase(this.options.storage, (database) => {
      this.assertPlanUniqueness(database, record.code, record.externalSku);
      database.plans.push(record);
      addAuditEvent(database, {
        actorType: 'admin',
        actorId,
        action: 'plan.created',
        targetType: 'plan',
        targetId: record.id,
        metadata: { code: record.code },
      }, now);
      return { plan: structuredClone(record) };
    });
  }

  public async updatePlan(
    planId: string,
    input: UpdatePlanInput,
    actorId = 'admin',
  ): Promise<Record<string, unknown>> {
    const now = this.now();
    return mutateDatabase(this.options.storage, (database) => {
      const plan = database.plans.find((candidate) => candidate.id === planId);
      if (plan === undefined) {
        throw new ApiError(404, 'PLAN_NOT_FOUND', '套餐不存在');
      }
      const nextTerm = input.term ?? plan.term;
      this.assertPlanInput(plan.code, nextTerm);
      const nextExternalSku = input.externalSku === undefined
        ? plan.externalSku
        : input.externalSku ?? undefined;
      this.assertPlanUniqueness(database, plan.code, nextExternalSku, plan.id);

      if (input.name !== undefined) plan.name = input.name;
      if (input.description !== undefined) {
        if (input.description === null) delete plan.description;
        else plan.description = input.description;
      }
      if (input.status !== undefined) plan.status = input.status;
      if (input.term !== undefined) plan.term = input.term;
      plan.defaultMaxDevices = 1;
      if (input.isPublic !== undefined) plan.isPublic = input.isPublic;
      if (input.recommended !== undefined) plan.recommended = input.recommended;
      this.assignOptionalPlanField(plan, 'priceLabel', input.priceLabel);
      this.assignOptionalPlanField(plan, 'purchaseUrl', input.purchaseUrl);
      this.assignOptionalPlanField(plan, 'externalSku', input.externalSku);
      plan.updatedAt = now.toISOString();
      plan.revision += 1;
      addAuditEvent(database, {
        actorType: 'admin',
        actorId,
        action: 'plan.updated',
        targetType: 'plan',
        targetId: plan.id,
        metadata: { code: plan.code },
      }, now);
      return { plan: structuredClone(plan) };
    });
  }

  public async createRedemptionBatch(
    input: CreateRedemptionBatchInput,
    actorId = 'admin',
  ): Promise<Record<string, unknown>> {
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 500) {
      throw new ApiError(400, 'REDEMPTION_BATCH_QUANTITY_INVALID', '每批套餐兑换码数量必须是 1 到 500');
    }
    if (input.source !== 'paid' && input.source !== 'complimentary') {
      throw new ApiError(400, 'REDEMPTION_BATCH_SOURCE_INVALID', '套餐码批次只能用于购买兑换或运营赠送');
    }
    const now = this.now();
    return mutateDatabase(this.options.storage, (database) => {
      const plan = database.plans.find((candidate) => candidate.id === input.planId);
      if (plan === undefined) throw new ApiError(404, 'PLAN_NOT_FOUND', '套餐不存在');
      if (plan.status !== 'active') {
        throw new ApiError(409, 'PLAN_ARCHIVED', '已归档套餐不能生成新的兑换码');
      }
      const batch: RedemptionBatchRecord = {
        id: randomUUID(),
        name: input.name,
        planId: plan.id,
        planCode: plan.code,
        planName: plan.name,
        term: structuredClone(plan.term),
        source: input.source,
        ...(input.salesChannel === undefined ? {} : { salesChannel: input.salesChannel }),
        reason: input.reason,
        status: 'active',
        quantity: input.quantity,
        createdAt: now.toISOString(),
        createdBy: actorId,
        updatedAt: now.toISOString(),
      };
      const existingHashes = new Set(database.redemptionCodes.map((code) => code.codeHash));
      const plaintextCodes: string[] = [];
      const records: RedemptionCodeRecord[] = [];
      while (records.length < input.quantity) {
        const plaintextCode = this.generateRedemptionCode();
        const codeHash = this.hashRedemptionCode(plaintextCode);
        if (existingHashes.has(codeHash)) continue;
        existingHashes.add(codeHash);
        plaintextCodes.push(plaintextCode);
        records.push({
          id: randomUUID(),
          batchId: batch.id,
          codeHash,
          codeCiphertext: this.encryptRedemptionCode(plaintextCode),
          codeHint: plaintextCode.slice(-4),
          status: 'available',
          createdAt: now.toISOString(),
        });
      }
      database.redemptionBatches.unshift(batch);
      database.redemptionCodes.push(...records);
      addAuditEvent(database, {
        actorType: 'admin',
        actorId,
        action: 'redemption_batch.created',
        targetType: 'redemption_batch',
        targetId: batch.id,
        reason: input.reason,
        metadata: {
          planId: plan.id,
          quantity: input.quantity,
          source: input.source,
          salesChannel: input.salesChannel ?? null,
        },
      }, now);
      return {
        batch: toPublicRedemptionBatch(batch, records),
        codes: plaintextCodes,
      };
    });
  }

  public async updateRedemptionBatch(
    batchId: string,
    input: UpdateRedemptionBatchInput,
    actorId = 'admin',
  ): Promise<Record<string, unknown>> {
    const now = this.now();
    return mutateDatabase(this.options.storage, (database) => {
      const batch = database.redemptionBatches.find((candidate) => candidate.id === batchId);
      if (batch === undefined) {
        throw new ApiError(404, 'REDEMPTION_BATCH_NOT_FOUND', '套餐码批次不存在');
      }
      batch.status = input.status;
      batch.updatedAt = now.toISOString();
      if (input.status === 'disabled') {
        batch.disabledAt = now.toISOString();
        batch.disabledBy = actorId;
        batch.disabledReason = input.reason;
      } else {
        delete batch.disabledAt;
        delete batch.disabledBy;
        delete batch.disabledReason;
      }
      addAuditEvent(database, {
        actorType: 'admin',
        actorId,
        action: `redemption_batch.${input.status}`,
        targetType: 'redemption_batch',
        targetId: batch.id,
        reason: input.reason,
      }, now);
      return { batch: toPublicRedemptionBatch(batch, database.redemptionCodes) };
    });
  }

  public async listRedemptionBatchCodes(batchId: string): Promise<Record<string, unknown>> {
    const { database } = await this.options.storage.read();
    const batch = database.redemptionBatches.find((candidate) => candidate.id === batchId);
    if (batch === undefined) {
      throw new ApiError(404, 'REDEMPTION_BATCH_NOT_FOUND', '套餐码批次不存在');
    }
    const batchCodes = database.redemptionCodes.filter((code) => code.batchId === batchId);
    return {
      batch: toPublicRedemptionBatch(batch, batchCodes),
      codes: batchCodes.map((code) => ({
        id: code.id,
        codeHint: code.codeHint,
        status: code.status,
        createdAt: code.createdAt,
        ...(code.codeCiphertext === undefined ? {} : {
          code: this.decryptRedemptionCode(code.codeCiphertext),
        }),
        ...(code.redeemedAt === undefined ? {} : { redeemedAt: code.redeemedAt }),
      })),
    };
  }

  public async listPublicPlans(): Promise<Record<string, unknown>> {
    const { database } = await this.options.storage.read();
    return {
      plans: database.plans
        .filter((plan) => plan.status === 'active' && plan.isPublic)
        .map(toPublicPlan),
    };
  }

  public async listAdminOverview(): Promise<AdminListResult> {
    const now = this.now();
    const { database } = await this.options.storage.read();
    const activityResults = await Promise.all(
      database.devices.map((device) => this.options.storage.readDeviceActivity(device.id)),
    );
    const activities = activityResults.flatMap((result) => (
      result.activity === undefined ? [] : [result.activity]
    ));
    const activitiesByDeviceId = new Map(activities.map((activity) => [activity.deviceId, activity]));
    const publicLicenses = database.licenses.map(
      (license) => toPublicLicense(
        license,
        database.devices,
        now,
        database.plans,
        database.packageGrants,
        database.defaultAccess,
        activities,
      ),
    );
    const activeDevices = database.devices.filter((device) => device.status === 'active');
    const publicDevices = database.devices.map(
      (device) => toPublicDevice(device, now, activitiesByDeviceId.get(device.id), true),
    );
    return {
      generatedAt: now.toISOString(),
      licenses: publicLicenses,
      devices: publicDevices,
      plans: structuredClone(database.plans),
      redemptionBatches: database.redemptionBatches.map(
        (batch) => toPublicRedemptionBatch(batch, database.redemptionCodes),
      ),
      packageGrantBatches: database.packageGrantBatches
        .map((batch) => toPublicPackageGrantBatch(batch, database.packageGrants, now))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
      availableTags: [...new Set(database.licenses.flatMap((license) => license.tags))]
        .sort(),
      ...(database.defaultAccess === undefined ? {} : {
        defaultAccess: toPublicDefaultAccess(database.defaultAccess, database.plans, now),
      }),
      ...(database.newDeviceDefaultAccess === undefined ? {} : {
        newDeviceDefaultAccess: toPublicNewDeviceDefaultAccess(
          database.newDeviceDefaultAccess,
          database.plans,
        ),
      }),
      metrics: {
        totalEntitlements: publicLicenses.length,
        activeEntitlements: publicLicenses.filter((license) => license.status === 'active').length,
        trialEntitlements: publicLicenses.filter((license) => license.accessSource === 'trial').length,
        complimentaryEntitlements: publicLicenses.filter((license) => license.accessSource === 'complimentary').length,
        paidEntitlements: publicLicenses.filter((license) => license.accessSource === 'paid').length,
        activeDevices: activeDevices.length,
        onlineDevices: activeDevices.filter(
          (device) => isDeviceOnline(device, now, activitiesByDeviceId.get(device.id)),
        ).length,
        todayForegroundSeconds: publicDevices.reduce(
          (total, device) => total + (
            Number.isFinite(device.todayForegroundSeconds) ? device.todayForegroundSeconds : 0
          ),
          0,
        ),
      },
    };
  }

  public async listAuditEvents(limit = 200): Promise<Record<string, unknown>> {
    const { database } = await this.options.storage.read();
    return { events: database.auditEvents.slice(0, limit) };
  }

  public async changeLicenseStatus(
    licenseId: string,
    status: LicenseStatus,
    reason: string,
    actorId = 'admin',
  ): Promise<Record<string, unknown>> {
    const now = this.now();
    return mutateDatabase(this.options.storage, (database) => {
      const license = database.licenses.find((candidate) => candidate.id === licenseId);
      if (license === undefined) {
        throw new ApiError(404, 'LICENSE_NOT_FOUND', '授权不存在');
      }
      license.status = status;
      license.updatedAt = now.toISOString();
      license.revision += 1;
      if (status !== 'active') {
        for (const device of database.devices.filter((candidate) => candidate.licenseId === license.id)) {
          device.sessionVersion += 1;
          device.updatedAt = now.toISOString();
        }
      }
      addAuditEvent(database, {
        actorType: 'admin',
        actorId,
        action: `license.${status}`,
        targetType: 'license',
        targetId: license.id,
        reason,
      }, now);
      return {
        license: toPublicLicense(
          license,
          database.devices,
          now,
          database.plans,
          database.packageGrants,
          database.defaultAccess,
        ),
      };
    });
  }

  public async updateLicenseProfile(
    licenseId: string,
    input: UpdateLicenseProfileInput,
    actorId = 'admin',
  ): Promise<Record<string, unknown>> {
    const now = this.now();
    return mutateDatabase(this.options.storage, (database) => {
      const license = database.licenses.find((candidate) => candidate.id === licenseId);
      if (license === undefined) {
        throw new ApiError(404, 'LICENSE_NOT_FOUND', '授权不存在');
      }
      const previousName = license.customerName;
      const previousEmail = license.customerEmail;
      const previousNote = license.customerNote;
      const previousTags = [...license.tags];
      license.customerName = input.customerName;
      if (input.customerEmail !== undefined) {
        if (input.customerEmail === null) delete license.customerEmail;
        else license.customerEmail = input.customerEmail;
      }
      if (input.customerNote !== undefined) {
        if (input.customerNote === null) delete license.customerNote;
        else license.customerNote = input.customerNote;
      }
      if (input.tags !== undefined) license.tags = normalizeLicenseTags(input.tags);
      license.updatedAt = now.toISOString();
      license.revision += 1;
      addAuditEvent(database, {
        actorType: 'admin',
        actorId,
        action: 'license.profile_updated',
        targetType: 'license',
        targetId: license.id,
        reason: input.reason,
        metadata: {
          previousName,
          nextName: license.customerName,
          previousEmail: previousEmail ?? null,
          nextEmail: license.customerEmail ?? null,
          previousNote: previousNote ?? null,
          nextNote: license.customerNote ?? null,
          previousTags: previousTags.join(', '),
          nextTags: license.tags.join(', '),
        },
      }, now);
      return {
        license: toPublicLicense(
          license,
          database.devices,
          now,
          database.plans,
          database.packageGrants,
          database.defaultAccess,
        ),
      };
    });
  }

  public async grantPackage(
    licenseId: string,
    input: GrantPackageInput,
    actorId = 'admin',
  ): Promise<Record<string, unknown>> {
    const now = this.now();
    return mutateDatabase(this.options.storage, (database) => {
      const license = database.licenses.find((candidate) => candidate.id === licenseId);
      if (license === undefined) {
        throw new ApiError(404, 'LICENSE_NOT_FOUND', '授权设备不存在');
      }
      const plan = database.plans.find((candidate) => candidate.id === input.planId);
      if (plan === undefined) {
        throw new ApiError(404, 'PLAN_NOT_FOUND', '套餐不存在');
      }
      if (plan.status === 'archived') {
        throw new ApiError(409, 'PLAN_ARCHIVED', '已归档套餐不能继续发放');
      }
      const packageGrant = this.createPackageGrant(
        database,
        license,
        plan,
        input.source,
        input.reason,
        actorId,
        now,
      );
      license.accessSource = input.source;
      license.deviceCredentialLockedAt ??= now.toISOString();
      if (license.status === 'expired') license.status = 'active';
      license.updatedAt = now.toISOString();
      license.revision += 1;
      addAuditEvent(database, {
        actorType: 'admin',
        actorId,
        action: 'package_grant.created',
        targetType: 'package_grant',
        targetId: packageGrant.id,
        reason: input.reason,
        metadata: {
          licenseId: license.id,
          planId: plan.id,
          source: input.source,
          startsAt: packageGrant.startsAt ?? null,
          expiresAt: packageGrant.expiresAt ?? null,
        },
      }, now);
      return {
        packageGrant: toPublicPackageGrant(packageGrant, now),
        license: toPublicLicense(
          license,
          database.devices,
          now,
          database.plans,
          database.packageGrants,
          database.defaultAccess,
        ),
      };
    });
  }

  public async previewPackageGrantBatch(
    input: PackageGrantBatchInput,
  ): Promise<PackageGrantBatchPreview> {
    this.assertPackageGrantBatchInput(input);
    const now = this.now();
    const { database } = await this.options.storage.read();
    this.getActivePlan(database, input.planId);
    const activities = await this.readActivityMap(database, input.selection);
    const evaluation = this.evaluatePackageGrantBatch(database, activities, input, now);
    return this.createPackageGrantBatchPreview(database, evaluation, now);
  }

  public async createPackageGrantBatch(
    input: PackageGrantBatchInput,
    actorId = 'admin',
  ): Promise<{
    alreadyApplied: boolean;
    batch: ReturnType<typeof toPublicPackageGrantBatch>;
  }> {
    this.assertPackageGrantBatchInput(input);
    const initial = await this.options.storage.read();
    const existing = initial.database.packageGrantBatches.find(
      (batch) => batch.operationKey === input.operationKey,
    );
    if (existing !== undefined) {
      this.assertPackageGrantBatchRetryMatches(existing, input);
      return {
        alreadyApplied: true,
        batch: toPublicPackageGrantBatch(existing, initial.database.packageGrants, this.now()),
      };
    }
    const activities = await this.readActivityMap(initial.database, input.selection);
    const now = this.now();
    return mutateDatabase(this.options.storage, (database) => {
      const concurrentExisting = database.packageGrantBatches.find(
        (batch) => batch.operationKey === input.operationKey,
      );
      if (concurrentExisting !== undefined) {
        this.assertPackageGrantBatchRetryMatches(concurrentExisting, input);
        return {
          alreadyApplied: true,
          batch: toPublicPackageGrantBatch(concurrentExisting, database.packageGrants, now),
        };
      }
      const plan = this.getActivePlan(database, input.planId);
      const evaluation = this.evaluatePackageGrantBatch(database, activities, input, now);
      if (evaluation.targets.length > 500) {
        throw new ApiError(409, 'PACKAGE_GRANT_BATCH_TOO_LARGE', '单次批量发放最多支持 500 台设备');
      }
      const batch: PackageGrantBatchRecord = {
        id: randomUUID(),
        operationKey: input.operationKey,
        selection: structuredClone(input.selection),
        planId: plan.id,
        planCode: plan.code,
        planName: plan.name,
        term: structuredClone(plan.term),
        source: input.source,
        duplicatePolicy: input.duplicatePolicy,
        reason: input.reason,
        matchedCount: evaluation.targets.length,
        grantedCount: evaluation.grantable.length,
        skippedDuplicateCount: evaluation.duplicates.length,
        skippedBlockedCount: evaluation.blocked.length,
        createdAt: now.toISOString(),
        createdBy: actorId,
      };
      database.packageGrantBatches.push(batch);
      for (const license of evaluation.grantable) {
        this.createPackageGrant(
          database,
          license,
          plan,
          input.source,
          input.reason,
          actorId,
          now,
          batch.id,
        );
        license.accessSource = input.source;
        license.deviceCredentialLockedAt ??= now.toISOString();
        if (license.status === 'expired') license.status = 'active';
        license.updatedAt = now.toISOString();
        license.revision += 1;
      }
      addAuditEvent(database, {
        actorType: 'admin',
        actorId,
        action: 'package_grant_batch.created',
        targetType: 'package_grant_batch',
        targetId: batch.id,
        reason: input.reason,
        metadata: {
          operationKey: batch.operationKey,
          planId: batch.planId,
          matchedCount: batch.matchedCount,
          grantedCount: batch.grantedCount,
          skippedDuplicateCount: batch.skippedDuplicateCount,
          skippedBlockedCount: batch.skippedBlockedCount,
        },
      }, now);
      return {
        alreadyApplied: false,
        batch: toPublicPackageGrantBatch(batch, database.packageGrants, now),
      };
    });
  }

  public async withdrawPackageGrantBatch(
    batchId: string,
    reason: string,
    actorId = 'admin',
  ): Promise<{
    withdrawnCount: number;
    skippedCount: number;
    batch: ReturnType<typeof toPublicPackageGrantBatch>;
  }> {
    const now = this.now();
    return mutateDatabase(this.options.storage, (database) => {
      const batch = database.packageGrantBatches.find((candidate) => candidate.id === batchId);
      if (batch === undefined) {
        throw new ApiError(404, 'PACKAGE_GRANT_BATCH_NOT_FOUND', '批量发放记录不存在');
      }
      const batchGrants = database.packageGrants.filter((grant) => grant.batchGrantId === batch.id);
      let withdrawnCount = 0;
      let skippedCount = 0;
      for (const grant of batchGrants) {
        const previousStatus = getPackageGrantStatus(grant, now);
        if (previousStatus === 'completed' || previousStatus === 'withdrawn') {
          skippedCount += 1;
          continue;
        }
        grant.withdrawnAt = now.toISOString();
        grant.withdrawnBy = actorId;
        grant.withdrawalReason = reason;
        this.reflowPackageQueue(database, grant.licenseId, grant.id, now);
        const license = database.licenses.find((candidate) => candidate.id === grant.licenseId);
        if (license !== undefined) {
          license.updatedAt = now.toISOString();
          license.revision += 1;
          if (previousStatus === 'active') {
            for (const device of database.devices.filter((candidate) => candidate.licenseId === license.id)) {
              device.sessionVersion += 1;
              device.updatedAt = now.toISOString();
            }
          }
        }
        withdrawnCount += 1;
      }
      if (batch.withdrawnAt === undefined) {
        batch.withdrawnAt = now.toISOString();
        batch.withdrawnBy = actorId;
        batch.withdrawalReason = reason;
        addAuditEvent(database, {
          actorType: 'admin',
          actorId,
          action: 'package_grant_batch.withdrawn',
          targetType: 'package_grant_batch',
          targetId: batch.id,
          reason,
          metadata: { withdrawnCount, skippedCount },
        }, now);
      }
      return {
        withdrawnCount,
        skippedCount,
        batch: toPublicPackageGrantBatch(batch, database.packageGrants, now),
      };
    });
  }

  public async withdrawPackage(
    licenseId: string,
    packageGrantId: string,
    reason: string,
    actorId = 'admin',
  ): Promise<Record<string, unknown>> {
    const now = this.now();
    return mutateDatabase(this.options.storage, (database) => {
      const license = database.licenses.find((candidate) => candidate.id === licenseId);
      if (license === undefined) {
        throw new ApiError(404, 'LICENSE_NOT_FOUND', '授权设备不存在');
      }
      const packageGrant = database.packageGrants.find(
        (candidate) => candidate.id === packageGrantId && candidate.licenseId === license.id,
      );
      if (packageGrant === undefined) {
        throw new ApiError(404, 'PACKAGE_GRANT_NOT_FOUND', '套餐包不存在');
      }
      const previousStatus = getPackageGrantStatus(packageGrant, now);
      if (previousStatus === 'completed') {
        throw new ApiError(409, 'PACKAGE_GRANT_COMPLETED', '已经使用完的套餐包不能撤回');
      }
      if (previousStatus === 'withdrawn') {
        throw new ApiError(409, 'PACKAGE_GRANT_WITHDRAWN', '该套餐包已经撤回');
      }
      packageGrant.withdrawnAt = now.toISOString();
      packageGrant.withdrawnBy = actorId;
      packageGrant.withdrawalReason = reason;
      this.reflowPackageQueue(database, license.id, packageGrant.id, now);
      license.updatedAt = now.toISOString();
      license.revision += 1;
      if (previousStatus === 'active') {
        for (const device of database.devices.filter((candidate) => candidate.licenseId === license.id)) {
          device.sessionVersion += 1;
          device.updatedAt = now.toISOString();
        }
      }
      addAuditEvent(database, {
        actorType: 'admin',
        actorId,
        action: 'package_grant.withdrawn',
        targetType: 'package_grant',
        targetId: packageGrant.id,
        reason,
        metadata: { licenseId: license.id, previousStatus },
      }, now);
      return {
        packageGrant: toPublicPackageGrant(packageGrant, now),
        license: toPublicLicense(
          license,
          database.devices,
          now,
          database.plans,
          database.packageGrants,
          database.defaultAccess,
        ),
      };
    });
  }

  public async updateDefaultAccess(
    input: UpdateDefaultAccessInput,
    actorId = 'admin',
  ): Promise<Record<string, unknown>> {
    const now = this.now();
    return mutateDatabase(this.options.storage, (database) => {
      const plan = database.plans.find((candidate) => candidate.id === input.planId);
      if (plan === undefined) {
        throw new ApiError(404, 'PLAN_NOT_FOUND', '套餐不存在');
      }
      if (plan.status === 'archived') {
        throw new ApiError(409, 'PLAN_ARCHIVED', '已归档套餐不能设为全局权益');
      }
      const previous = database.defaultAccess;
      database.defaultAccess = {
        planId: plan.id,
        status: input.status,
        ...(input.endsAt === undefined || input.endsAt === null ? {} : { endsAt: input.endsAt }),
        reason: input.reason,
        updatedAt: now.toISOString(),
        updatedBy: actorId,
        revision: (previous?.revision ?? 0) + 1,
      };
      this.reschedulePackagesWaitingForDefault(database, now);
      addAuditEvent(database, {
        actorType: 'admin',
        actorId,
        action: 'default_access.updated',
        targetType: 'default_access',
        targetId: 'global',
        reason: input.reason,
        metadata: {
          planId: plan.id,
          status: input.status,
          endsAt: input.endsAt ?? null,
        },
      }, now);
      return { defaultAccess: toPublicDefaultAccess(database.defaultAccess, database.plans, now) };
    });
  }

  public async updateNewDeviceDefaultAccess(
    input: UpdateNewDeviceDefaultAccessInput,
    actorId = 'admin',
  ): Promise<Record<string, unknown>> {
    const now = this.now();
    return mutateDatabase(this.options.storage, (database) => {
      const plan = database.plans.find((candidate) => candidate.id === input.planId);
      if (plan === undefined) {
        throw new ApiError(404, 'PLAN_NOT_FOUND', '套餐不存在');
      }
      if (plan.status === 'archived') {
        throw new ApiError(409, 'PLAN_ARCHIVED', '已归档套餐不能设为新设备默认权益');
      }
      const previous = database.newDeviceDefaultAccess;
      database.newDeviceDefaultAccess = {
        planId: plan.id,
        status: input.status,
        reason: input.reason,
        updatedAt: now.toISOString(),
        updatedBy: actorId,
        revision: (previous?.revision ?? 0) + 1,
      };
      addAuditEvent(database, {
        actorType: 'admin',
        actorId,
        action: 'new_device_default_access.updated',
        targetType: 'default_access',
        targetId: 'new-device',
        reason: input.reason,
        metadata: { planId: plan.id, status: input.status },
      }, now);
      return {
        newDeviceDefaultAccess: toPublicNewDeviceDefaultAccess(
          database.newDeviceDefaultAccess,
          database.plans,
        ),
      };
    });
  }

  public async changeDeviceStatus(
    deviceId: string,
    status: DeviceStatus,
    reason: string,
    actorId = 'admin',
  ): Promise<Record<string, unknown>> {
    const now = this.now();
    return mutateDatabase(this.options.storage, (database) => {
      const device = database.devices.find((candidate) => candidate.id === deviceId);
      if (device === undefined) {
        throw new ApiError(404, 'DEVICE_NOT_FOUND', '设备不存在');
      }
      device.status = status;
      device.sessionVersion += 1;
      device.updatedAt = now.toISOString();
      addAuditEvent(database, {
        actorType: 'admin',
        actorId,
        action: `device.${status}`,
        targetType: 'device',
        targetId: device.id,
        reason,
      }, now);
      return { device: toPublicDevice(device, now) };
    });
  }

  public async rebindDevice(
    licenseId: string,
    machineFingerprint: string,
    reason: string,
    actorId = 'admin',
  ): Promise<Record<string, unknown>> {
    const now = this.now();
    const normalizedFingerprint = normalizeMachineFingerprint(machineFingerprint);
    this.assertMachineFingerprint(normalizedFingerprint);
    const fingerprintHash = hashSensitiveValue(normalizedFingerprint, this.options.licenseKeyPepper);
    return mutateDatabase(this.options.storage, (database) => {
      const license = database.licenses.find((candidate) => candidate.id === licenseId);
      if (license === undefined) throw new ApiError(404, 'LICENSE_NOT_FOUND', '授权设备不存在');
      const duplicatedBinding = database.devices.find((candidate) => (
        candidate.licenseId !== license.id && candidate.machineFingerprintHash === fingerprintHash
      ));
      if (duplicatedBinding !== undefined) {
        throw new ApiError(409, 'DEVICE_ALREADY_BOUND', '该设备 ID 已属于其他授权档案');
      }
      const retiredByOtherUser = database.licenses.find((candidate) => (
        candidate.id !== license.id
        && candidate.retiredMachineFingerprintHashes?.includes(fingerprintHash) === true
      ));
      if (retiredByOtherUser !== undefined) {
        throw new ApiError(409, 'DEVICE_PREVIOUSLY_BOUND', '该设备 ID 曾从其他授权档案移除，不能直接转移');
      }

      const previousDevice = database.devices.find((candidate) => candidate.licenseId === license.id);
      const device: DeviceRecord = {
        id: randomUUID(),
        licenseId: license.id,
        machineFingerprintHash: fingerprintHash,
        machineFingerprintHint: getMachineFingerprintHint(normalizedFingerprint),
        deviceName: '等待设备重新连接',
        platform: 'unknown',
        arch: 'unknown',
        appVersion: 'unknown',
        status: 'pending',
        activatedAt: now.toISOString(),
        sessionVersion: 1,
        updatedAt: now.toISOString(),
      };
      database.devices = database.devices.filter((candidate) => candidate.licenseId !== license.id);
      database.devices.push(device);
      const retiredFingerprints = new Set(license.retiredMachineFingerprintHashes ?? []);
      retiredFingerprints.delete(fingerprintHash);
      if (
        previousDevice !== undefined
        && previousDevice.machineFingerprintHash !== fingerprintHash
      ) {
        retiredFingerprints.add(previousDevice.machineFingerprintHash);
      }
      if (retiredFingerprints.size === 0) delete license.retiredMachineFingerprintHashes;
      else license.retiredMachineFingerprintHashes = [...retiredFingerprints];
      license.updatedAt = now.toISOString();
      license.revision += 1;
      addAuditEvent(database, {
        actorType: 'admin',
        actorId,
        action: 'device.rebound',
        targetType: 'device',
        targetId: device.id,
        reason,
        metadata: {
          licenseId: license.id,
          previousDeviceId: previousDevice?.id ?? null,
          deviceHint: device.machineFingerprintHint,
        },
      }, now);
      return {
        device: toPublicDevice(device, now),
        license: toPublicLicense(
          license,
          [device],
          now,
          database.plans,
          database.packageGrants,
          database.defaultAccess,
        ),
      };
    });
  }

  private assertPackageGrantBatchInput(input: PackageGrantBatchInput): void {
    if (!/^[A-Za-z0-9][A-Za-z0-9:_-]{7,119}$/.test(input.operationKey)) {
      throw new ApiError(400, 'PACKAGE_GRANT_BATCH_KEY_INVALID', '批量发放操作编号格式无效');
    }
    if (input.reason.trim().length < 1 || input.reason.length > 300) {
      throw new ApiError(400, 'PACKAGE_GRANT_BATCH_REASON_INVALID', '批量发放原因长度必须在 1 到 300 个字符之间');
    }
    if (!PACKAGE_GRANT_BATCH_DUPLICATE_POLICIES.includes(input.duplicatePolicy)) {
      throw new ApiError(400, 'PACKAGE_GRANT_BATCH_DUPLICATE_POLICY_INVALID', '批量发放重复策略无效');
    }
    if (input.selection.mode === 'selected') {
      const uniqueIds = new Set(input.selection.licenseIds);
      if (uniqueIds.size === 0 || uniqueIds.size > 500 || uniqueIds.size !== input.selection.licenseIds.length) {
        throw new ApiError(400, 'PACKAGE_GRANT_BATCH_SELECTION_INVALID', '勾选设备必须是 1 到 500 个不重复的授权档案');
      }
    } else if ((input.selection.excludedLicenseIds?.length ?? 0) > 500) {
      throw new ApiError(400, 'PACKAGE_GRANT_BATCH_EXCLUSIONS_INVALID', '单次最多排除 500 台设备');
    }
  }

  private assertPackageGrantBatchRetryMatches(
    batch: PackageGrantBatchRecord,
    input: PackageGrantBatchInput,
  ): void {
    const matchesOriginalRequest = batch.planId === input.planId
      && batch.source === input.source
      && batch.duplicatePolicy === input.duplicatePolicy
      && batch.reason === input.reason
      && isDeepStrictEqual(batch.selection, input.selection);
    if (!matchesOriginalRequest) {
      throw new ApiError(
        409,
        'PACKAGE_GRANT_BATCH_KEY_REUSED',
        '这个批量操作编号已用于其他发放请求，请重新发起操作',
      );
    }
  }

  private getActivePlan(database: LicenseDatabase, planId: string): PlanRecord {
    const plan = database.plans.find((candidate) => candidate.id === planId);
    if (plan === undefined) throw new ApiError(404, 'PLAN_NOT_FOUND', '套餐不存在');
    if (plan.status === 'archived') {
      throw new ApiError(409, 'PLAN_ARCHIVED', '已归档套餐不能继续发放');
    }
    return plan;
  }

  private async readActivityMap(
    database: LicenseDatabase,
    selection: PackageGrantBatchSelection,
  ): Promise<Map<string, DeviceActivityRecord>> {
    const selectedLicenseIds = selection.mode === 'selected'
      ? new Set(selection.licenseIds)
      : undefined;
    const devices = selectedLicenseIds === undefined
      ? database.devices
      : database.devices.filter((device) => selectedLicenseIds.has(device.licenseId));
    const results = await Promise.all(devices.map(async (device) => ({
      deviceId: device.id,
      result: await this.options.storage.readDeviceActivity(device.id),
    })));
    return new Map(results.flatMap(({ deviceId, result }) => (
      result.activity === undefined ? [] : [[deviceId, result.activity] as const]
    )));
  }

  private selectPackageGrantBatchTargets(
    database: LicenseDatabase,
    activities: Map<string, DeviceActivityRecord>,
    selection: PackageGrantBatchSelection,
    now: Date,
  ): LicenseRecord[] {
    if (selection.mode === 'selected') {
      const selectedIds = new Set(selection.licenseIds);
      const targets = database.licenses.filter((license) => selectedIds.has(license.id));
      if (targets.length !== selectedIds.size) {
        throw new ApiError(
          404,
          'PACKAGE_GRANT_BATCH_TARGET_NOT_FOUND',
          '勾选范围中包含已不存在的授权设备，请刷新后重试',
        );
      }
      return targets;
    }
    const excludedIds = new Set(selection.excludedLicenseIds ?? []);
    return database.licenses.filter((license) => (
      !excludedIds.has(license.id)
      && this.matchesAuthorizedDeviceFilter(database, activities, license, selection.filter, now)
    ));
  }

  private matchesAuthorizedDeviceFilter(
    database: LicenseDatabase,
    activities: Map<string, DeviceActivityRecord>,
    license: LicenseRecord,
    filter: AuthorizedDeviceFilter,
    now: Date,
  ): boolean {
    const device = database.devices.find((candidate) => candidate.licenseId === license.id);
    const activity = device === undefined ? undefined : activities.get(device.id);
    const publicLicense = toPublicLicense(
      license,
      device === undefined ? [] : [device],
      now,
      database.plans,
      database.packageGrants,
      database.defaultAccess,
      activity === undefined ? [] : [activity],
    );
    const publicDevice = device === undefined ? undefined : toPublicDevice(device, now, activity);
    const includes = <T>(values: readonly T[] | undefined, value: T | undefined): boolean => (
      values === undefined || values.length === 0 || (value !== undefined && values.includes(value))
    );
    if (!includes(filter.licenseStatuses, publicLicense.status)) return false;
    if (!includes(filter.deviceStatuses, publicDevice?.status)) return false;
    if (!includes(filter.accessModes, publicLicense.accessMode as AccessMode)) return false;
    if (!includes(filter.accessSources, publicLicense.accessSource)) return false;
    if (!includes(filter.currentPlanIds, publicLicense.planId)) return false;
    if (!includes(filter.platforms, publicDevice?.platform)) return false;
    if (!includes(filter.archs, publicDevice?.arch)) return false;
    if (!includes(filter.appVersions, publicDevice?.appVersion)) return false;
    if (filter.online !== undefined && (publicDevice?.online ?? false) !== filter.online) return false;
    if (filter.foregroundNow !== undefined && (publicDevice?.foreground ?? false) !== filter.foregroundNow) return false;
    const activeToday = (publicDevice?.todayForegroundSeconds ?? 0) > 0
      || (publicDevice?.todayLaunchCount ?? 0) > 0;
    if (filter.activeToday !== undefined && activeToday !== filter.activeToday) return false;

    const activeOwnedGrants = publicLicense.packages.filter(
      (grant) => grant.status === 'active' || grant.status === 'queued',
    );
    if (filter.ownedPlanIds !== undefined && filter.ownedPlanIds.length > 0
      && !filter.ownedPlanIds.some((planId) => activeOwnedGrants.some((grant) => grant.planId === planId))) {
      return false;
    }
    if (filter.missingPlanIds !== undefined && filter.missingPlanIds.length > 0
      && !filter.missingPlanIds.every((planId) => activeOwnedGrants.every((grant) => grant.planId !== planId))) {
      return false;
    }
    if (filter.tags !== undefined && filter.tags.length > 0) {
      const matchesTags = filter.tagMatch === 'all'
        ? filter.tags.every((tag) => license.tags.includes(tag))
        : filter.tags.some((tag) => license.tags.includes(tag));
      if (!matchesTags) return false;
    }
    const query = filter.query?.trim().toLowerCase();
    if (query) {
      const searchable = [
        license.customerName,
        license.customerEmail,
        license.customerNote,
        publicLicense.plan,
        ...license.tags,
        device?.machineFingerprintHint,
        device?.deviceName,
        device?.platform,
        device?.arch,
        device?.appVersion,
        ...publicLicense.packages.map((grant) => grant.planName),
      ];
      if (!searchable.some((value) => value?.toLowerCase().includes(query))) return false;
    }

    const matchesDateRange = (value: string | undefined, from?: string, to?: string): boolean => {
      if (from === undefined && to === undefined) return true;
      if (value === undefined) return false;
      const timestamp = Date.parse(value);
      return (from === undefined || timestamp >= Date.parse(from))
        && (to === undefined || timestamp <= Date.parse(to));
    };
    if (!matchesDateRange(license.createdAt, filter.createdFrom, filter.createdTo)) return false;
    if (!matchesDateRange(publicLicense.lastActivityAt, filter.lastActivityFrom, filter.lastActivityTo)) return false;
    if (!matchesDateRange(publicLicense.expiresAt, filter.expiresFrom, filter.expiresTo)) return false;

    const foregroundSeconds = publicDevice?.todayForegroundSeconds ?? 0;
    const launchCount = publicDevice?.todayLaunchCount ?? 0;
    if (filter.minTodayForegroundSeconds !== undefined && foregroundSeconds < filter.minTodayForegroundSeconds) return false;
    if (filter.maxTodayForegroundSeconds !== undefined && foregroundSeconds > filter.maxTodayForegroundSeconds) return false;
    if (filter.minTodayLaunchCount !== undefined && launchCount < filter.minTodayLaunchCount) return false;
    if (filter.maxTodayLaunchCount !== undefined && launchCount > filter.maxTodayLaunchCount) return false;
    return true;
  }

  private evaluatePackageGrantBatch(
    database: LicenseDatabase,
    activities: Map<string, DeviceActivityRecord>,
    input: PackageGrantBatchInput,
    now: Date,
  ): PackageGrantBatchEvaluation {
    const targets = this.selectPackageGrantBatchTargets(database, activities, input.selection, now);
    const grantable: LicenseRecord[] = [];
    const duplicates: LicenseRecord[] = [];
    const blocked: LicenseRecord[] = [];
    for (const license of targets) {
      const hasSamePlan = database.packageGrants.some((grant) => (
        grant.licenseId === license.id
        && grant.planId === input.planId
        && ['active', 'queued'].includes(getPackageGrantStatus(grant, now))
      ));
      if (input.duplicatePolicy === 'skip_existing' && hasSamePlan) {
        duplicates.push(license);
        continue;
      }
      try {
        this.getNextPackageSchedule(database, license.id, now);
        grantable.push(license);
      } catch (error: unknown) {
        if (error instanceof ApiError && error.code === 'PACKAGE_QUEUE_BLOCKED') {
          blocked.push(license);
          continue;
        }
        throw error;
      }
    }
    return { targets, grantable, duplicates, blocked };
  }

  private createPackageGrantBatchPreview(
    database: LicenseDatabase,
    evaluation: PackageGrantBatchEvaluation,
    now: Date,
  ): PackageGrantBatchPreview {
    return {
      matchedCount: evaluation.targets.length,
      grantCount: evaluation.grantable.length,
      skippedDuplicateCount: evaluation.duplicates.length,
      skippedBlockedCount: evaluation.blocked.length,
      exceedsLimit: evaluation.targets.length > 500,
      sample: evaluation.targets.slice(0, 10).map((license) => {
        const publicLicense = toPublicLicense(
          license,
          database.devices,
          now,
          database.plans,
          database.packageGrants,
          database.defaultAccess,
        );
        return {
          licenseId: license.id,
          customerName: license.customerName,
          currentPlan: publicLicense.plan,
          status: publicLicense.status,
          tags: [...license.tags],
        };
      }),
    };
  }

  private createPackageGrant(
    database: LicenseDatabase,
    license: LicenseRecord,
    plan: Pick<PlanRecord, 'id' | 'code' | 'name' | 'term'>,
    source: PackageGrantSource,
    reason: string,
    actorId: string,
    now: Date,
    batchGrantId?: string,
  ): PackageGrantRecord {
    const schedule = this.getNextPackageSchedule(database, license.id, now);
    const packageGrant: PackageGrantRecord = {
      id: randomUUID(),
      licenseId: license.id,
      planId: plan.id,
      planCode: plan.code,
      planName: plan.name,
      term: structuredClone(plan.term),
      maxDevices: 1,
      source,
      reason,
      assignedAt: now.toISOString(),
      assignedBy: actorId,
      ...(batchGrantId === undefined ? {} : { batchGrantId }),
      waitsForDefault: schedule.waitsForDefault,
      ...(schedule.startsAt === undefined ? {} : {
        startsAt: schedule.startsAt.toISOString(),
        ...(getPlanExpiresAt(schedule.startsAt, plan.term) === undefined ? {} : {
          expiresAt: getPlanExpiresAt(schedule.startsAt, plan.term),
        }),
      }),
    };
    database.packageGrants.push(packageGrant);
    return packageGrant;
  }

  private getDeviceSession(
    database: LicenseDatabase,
    sessionToken: string,
  ): { license: LicenseRecord; device: DeviceRecord } {
    const claims = this.readSessionClaims(sessionToken);
    const license = database.licenses.find((candidate) => candidate.id === claims.licenseId);
    const device = database.devices.find((candidate) => candidate.id === claims.subject);
    if (license === undefined || device === undefined || device.licenseId !== license.id) {
      throw new ApiError(401, 'SESSION_INVALID', '设备会话无效');
    }
    if (device.sessionVersion !== claims.sessionVersion) {
      throw new ApiError(401, 'SESSION_REVOKED', '设备会话已被撤销');
    }
    if (device.status !== 'active') {
      throw new ApiError(403, 'DEVICE_INACTIVE', '当前授权设备已失效');
    }
    return { license, device };
  }

  private createPackageCenterView(
    database: LicenseDatabase,
    license: LicenseRecord,
    device: DeviceRecord,
    now: Date,
  ): Record<string, unknown> {
    const access = getEffectiveLicenseAccess(
      license,
      database.packageGrants,
      database.defaultAccess,
      database.plans,
      now,
    );
    const packages = database.packageGrants
      .filter((grant) => grant.licenseId === license.id)
      .map((grant) => {
        const publicGrant = toPublicPackageGrant(grant, now);
        return {
          id: publicGrant.id,
          planId: publicGrant.planId,
          planName: publicGrant.planName,
          term: publicGrant.term,
          source: publicGrant.source,
          reason: publicGrant.reason,
          assignedAt: publicGrant.assignedAt,
          waitsForDefault: publicGrant.waitsForDefault,
          status: publicGrant.status,
          ...(publicGrant.startsAt === undefined ? {} : { startsAt: publicGrant.startsAt }),
          ...(publicGrant.expiresAt === undefined ? {} : { expiresAt: publicGrant.expiresAt }),
          ...(publicGrant.withdrawnAt === undefined ? {} : { withdrawnAt: publicGrant.withdrawnAt }),
        };
      });
    return {
      authorized: access.status === 'active',
      deviceLabel: device.deviceName,
      access: {
        mode: access.mode,
        ...(access.planId === undefined ? {} : { planId: access.planId }),
        planName: access.plan,
        source: access.source,
        status: access.status,
        ...(access.expiresAt === undefined ? {} : { expiresAt: access.expiresAt }),
      },
      packages,
      queuedPackageCount: packages.filter((grant) => grant.status === 'queued').length,
      device: {
        id: device.id,
        machineFingerprintHint: device.machineFingerprintHint,
        deviceName: device.deviceName,
        platform: device.platform,
        arch: device.arch,
        appVersion: device.appVersion,
        status: device.status,
      },
    };
  }

  private normalizeRedemptionCode(rawCode: string): string {
    const compact = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^VS[A-HJ-NP-Z2-9]{20}$/.test(compact)) {
      throw new ApiError(400, 'REDEMPTION_CODE_FORMAT_INVALID', '套餐兑换码格式不正确');
    }
    const body = compact.slice(2);
    return `VS-${body.match(/.{4}/g)?.join('-') ?? body}`;
  }

  private hashRedemptionCode(code: string): string {
    return hashSensitiveValue(`redemption-code:${code}`, this.options.licenseKeyPepper);
  }

  private encryptRedemptionCode(code: string): string {
    const initializationVector = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.redemptionCodeEncryptionKey, initializationVector);
    const encrypted = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
    return [
      'v1',
      initializationVector.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }

  private decryptRedemptionCode(ciphertext: string): string {
    const [version, encodedIv, encodedAuthTag, encodedContent, extra] = ciphertext.split('.');
    if (
      version !== 'v1'
      || encodedIv === undefined
      || encodedAuthTag === undefined
      || encodedContent === undefined
      || extra !== undefined
    ) {
      throw new ApiError(500, 'REDEMPTION_CODE_DECRYPT_FAILED', '套餐兑换码库存数据无法读取');
    }
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.redemptionCodeEncryptionKey,
        Buffer.from(encodedIv, 'base64url'),
      );
      decipher.setAuthTag(Buffer.from(encodedAuthTag, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(encodedContent, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new ApiError(500, 'REDEMPTION_CODE_DECRYPT_FAILED', '套餐兑换码库存数据无法读取');
    }
  }

  private generateRedemptionCode(): string {
    const bytes = randomBytes(20);
    const body = Array.from(bytes, (value) => REDEMPTION_CODE_ALPHABET[value & 31]).join('');
    return `VS-${body.match(/.{4}/g)?.join('-') ?? body}`;
  }

  private getNextPackageSchedule(
    database: LicenseDatabase,
    licenseId: string,
    now: Date,
  ): { startsAt?: Date; waitsForDefault: boolean } {
    const ownedGrants = database.packageGrants.filter(
      (grant) => grant.licenseId === licenseId && grant.withdrawnAt === undefined,
    );
    const latestRelevantGrant = [...ownedGrants].reverse().find((grant) => {
      const status = getPackageGrantStatus(grant, now);
      return status === 'active' || status === 'queued';
    });
    let base = now;
    const license = database.licenses.find((candidate) => candidate.id === licenseId);
    if (
      latestRelevantGrant === undefined
      && license?.originSource === 'trial'
      && license.expiresAt !== undefined
      && new Date(license.expiresAt).getTime() > now.getTime()
    ) {
      base = new Date(license.expiresAt);
    }
    if (latestRelevantGrant !== undefined) {
      if (latestRelevantGrant.startsAt === undefined) {
        return { waitsForDefault: true };
      }
      if (latestRelevantGrant.expiresAt === undefined) {
        throw new ApiError(409, 'PACKAGE_QUEUE_BLOCKED', '长期有效套餐后不能继续追加套餐包');
      }
      const previousEnd = new Date(latestRelevantGrant.expiresAt);
      if (previousEnd.getTime() > base.getTime()) base = previousEnd;
    }

    const defaultAccess = database.defaultAccess;
    if (defaultAccess?.status === 'active'
      && (defaultAccess.endsAt === undefined || new Date(defaultAccess.endsAt).getTime() > now.getTime())) {
      if (defaultAccess.endsAt === undefined) return { waitsForDefault: true };
      const defaultEnd = new Date(defaultAccess.endsAt);
      if (defaultEnd.getTime() > base.getTime()) {
        return { startsAt: defaultEnd, waitsForDefault: true };
      }
    }
    return { startsAt: base, waitsForDefault: false };
  }

  private applyPackageSchedule(
    grant: PackageGrantRecord,
    startsAt: Date | undefined,
    waitsForDefault: boolean,
  ): Date | undefined {
    grant.waitsForDefault = waitsForDefault;
    if (startsAt === undefined) {
      delete grant.startsAt;
      delete grant.expiresAt;
      return undefined;
    }
    grant.startsAt = startsAt.toISOString();
    const expiresAt = getPlanExpiresAt(startsAt, grant.term);
    if (expiresAt === undefined) delete grant.expiresAt;
    else grant.expiresAt = expiresAt;
    return expiresAt === undefined ? undefined : new Date(expiresAt);
  }

  private reschedulePackagesWaitingForDefault(database: LicenseDatabase, now: Date): void {
    const defaultAccess = database.defaultAccess;
    const keepWaiting = defaultAccess?.status === 'active'
      && (defaultAccess.endsAt === undefined || new Date(defaultAccess.endsAt).getTime() > now.getTime());

    for (const license of database.licenses) {
      const ownedGrants = database.packageGrants.filter((grant) => (
        grant.licenseId === license.id
        && grant.withdrawnAt === undefined
      ));
      if (ownedGrants.length === 0) continue;

      if (keepWaiting) {
        const activeGrant = ownedGrants.find((grant) => (
          grant.pausedForDefault === true || getPackageGrantStatus(grant, now) === 'active'
        ));
        if (activeGrant !== undefined) {
          const activeStatus = getPackageGrantStatus(activeGrant, now);
          if (activeGrant.pausedForDefault !== true || activeStatus === 'active') {
            activeGrant.pausedForDefault = true;
            delete activeGrant.pausedRemainingSeconds;
            if (activeGrant.expiresAt !== undefined) {
              activeGrant.pausedRemainingSeconds = Math.max(
                1,
                Math.ceil((new Date(activeGrant.expiresAt).getTime() - now.getTime()) / 1000),
              );
            }
          }
        }
        let base = defaultAccess?.endsAt === undefined ? undefined : new Date(defaultAccess.endsAt);
        for (const grant of ownedGrants) {
          const status = getPackageGrantStatus(grant, now);
          if (grant.pausedForDefault === true) {
            grant.waitsForDefault = true;
            if (base === undefined) {
              delete grant.startsAt;
              delete grant.expiresAt;
            } else {
              grant.startsAt = base.toISOString();
              if (grant.pausedRemainingSeconds === undefined) {
                delete grant.expiresAt;
                base = undefined;
              } else {
                base = new Date(base.getTime() + grant.pausedRemainingSeconds * 1000);
                grant.expiresAt = base.toISOString();
              }
            }
          } else if (status === 'queued' || grant.waitsForDefault) {
            base = this.applyPackageSchedule(grant, base, true);
          }
        }
        continue;
      }

      let base: Date | undefined = now;
      for (const grant of ownedGrants) {
        const status = getPackageGrantStatus(grant, now);
        if (grant.pausedForDefault === true) {
          grant.waitsForDefault = false;
          grant.startsAt = now.toISOString();
          if (grant.pausedRemainingSeconds === undefined) {
            delete grant.expiresAt;
            base = undefined;
          } else {
            base = new Date(now.getTime() + grant.pausedRemainingSeconds * 1000);
            grant.expiresAt = base.toISOString();
          }
          delete grant.pausedForDefault;
          delete grant.pausedRemainingSeconds;
        } else if (grant.waitsForDefault || status === 'queued') {
          base = this.applyPackageSchedule(grant, base, false);
        } else if (status === 'active') {
          base = grant.expiresAt === undefined ? undefined : new Date(grant.expiresAt);
        }
      }
    }
  }

  private reflowPackageQueue(
    database: LicenseDatabase,
    licenseId: string,
    withdrawnGrantId: string,
    now: Date,
  ): void {
    const ownedGrants = database.packageGrants.filter((grant) => grant.licenseId === licenseId);
    const withdrawnIndex = ownedGrants.findIndex((grant) => grant.id === withdrawnGrantId);
    const previousGrant = ownedGrants
      .slice(0, withdrawnIndex)
      .reverse()
      .find((grant) => {
        const status = getPackageGrantStatus(grant, now);
        return grant.withdrawnAt === undefined && (status === 'active' || status === 'queued');
      });
    let base: Date | undefined = now;
    let waitsForDefault = false;
    if (previousGrant !== undefined) {
      base = previousGrant.startsAt === undefined || previousGrant.expiresAt === undefined
        ? undefined
        : new Date(previousGrant.expiresAt);
    }

    const defaultAccess = database.defaultAccess;
    if (defaultAccess?.status === 'active'
      && (defaultAccess.endsAt === undefined || new Date(defaultAccess.endsAt).getTime() > now.getTime())) {
      waitsForDefault = true;
      if (defaultAccess.endsAt === undefined) base = undefined;
      else if (base === undefined || new Date(defaultAccess.endsAt).getTime() > base.getTime()) {
        base = new Date(defaultAccess.endsAt);
      }
    }

    const followingGrants = ownedGrants.slice(withdrawnIndex + 1).filter((grant) => {
      const status = getPackageGrantStatus(grant, now);
      return grant.withdrawnAt === undefined && status !== 'completed';
    });
    for (const grant of followingGrants) {
      base = this.applyPackageSchedule(grant, base, waitsForDefault);
    }
  }

  private async updateDeviceSession(
    sessionToken: string,
    activity: ActivityInput,
    _sourceIp: string,
  ): Promise<Record<string, unknown>> {
    const claims = this.readSessionClaims(sessionToken);
    const now = this.now();
    const { database } = await this.options.storage.read();
    const license = database.licenses.find((candidate) => candidate.id === claims.licenseId);
    const device = database.devices.find((candidate) => candidate.id === claims.subject);
    if (license === undefined || device === undefined || device.licenseId !== license.id) {
      throw new ApiError(401, 'SESSION_INVALID', '设备会话无效');
    }
    this.assertLicenseActive(database, license, now);
    if (device.status !== 'active') {
      throw new ApiError(403, 'DEVICE_INACTIVE', '设备授权已失效');
    }
    if (device.sessionVersion !== claims.sessionVersion) {
      throw new ApiError(401, 'SESSION_REVOKED', '设备会话已被撤销');
    }
    const deviceActivity = await this.recordDeviceActivity(
      device.id,
      license.id,
      activity.appVersion,
      activity.active,
      false,
      now,
    );
    return this.createClientSession(database, license, device, now, deviceActivity);
  }

  private async recordDeviceActivity(
    deviceId: string,
    licenseId: string,
    appVersion: string,
    active: boolean,
    launched: boolean,
    now: Date,
  ): Promise<DeviceActivityRecord> {
    const timestamp = now.toISOString();
    const usageDate = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { activity } = await mutateDeviceActivity(
      this.options.storage,
      deviceId,
      () => ({
        schemaVersion: 1,
        revision: 0,
        deviceId,
        licenseId,
        appVersion,
        active,
        lastHeartbeatAt: timestamp,
        ...(active ? { lastActivityAt: timestamp } : {}),
        dailyUsage: [],
      }),
      (record) => {
        let today = record.dailyUsage.find((item) => item.date === usageDate);
        if (today === undefined) {
          today = { date: usageDate, foregroundSeconds: 0, launchCount: 0 };
          record.dailyUsage.push(today);
        }
        today.foregroundSeconds = normalizeUsageCounter(today.foregroundSeconds);
        today.launchCount = normalizeUsageCounter(today.launchCount);
        const previousHeartbeatTime = Date.parse(record.lastHeartbeatAt);
        const elapsedSinceHeartbeat = Number.isFinite(previousHeartbeatTime)
          ? Math.floor((now.getTime() - previousHeartbeatTime) / 1000)
          : 0;
        const elapsedSeconds = Math.max(0, Math.min(
          HEARTBEAT_INTERVAL_SECONDS * 2,
          elapsedSinceHeartbeat,
        ));
        if (record.active) today.foregroundSeconds += elapsedSeconds;
        if (launched) today.launchCount += 1;
        record.licenseId = licenseId;
        record.appVersion = appVersion;
        record.active = active;
        record.lastHeartbeatAt = timestamp;
        if (active) record.lastActivityAt = timestamp;
        record.dailyUsage = record.dailyUsage
          .sort((left, right) => left.date.localeCompare(right.date))
          .slice(-120);
      },
    );
    return activity;
  }

  private createClientSession(
    database: LicenseDatabase,
    license: LicenseRecord,
    device: DeviceRecord,
    now: Date,
    activity?: DeviceActivityRecord,
  ): Record<string, unknown> {
    const effectiveAccess = getEffectiveLicenseAccess(
      license,
      database.packageGrants,
      database.defaultAccess,
      database.plans,
      now,
    );
    const issuedAt = Math.floor(now.getTime() / 1000);
    const packages = database.packageGrants
      .filter((grant) => grant.licenseId === license.id)
      .map((grant) => {
        const publicGrant = toPublicPackageGrant(grant, now);
        return {
          id: publicGrant.id,
          planId: publicGrant.planId,
          planName: publicGrant.planName,
          term: publicGrant.term,
          source: publicGrant.source,
          status: publicGrant.status,
          assignedAt: publicGrant.assignedAt,
          waitsForDefault: publicGrant.waitsForDefault,
          ...(publicGrant.startsAt === undefined ? {} : { startsAt: publicGrant.startsAt }),
          ...(publicGrant.expiresAt === undefined ? {} : { expiresAt: publicGrant.expiresAt }),
        };
      });
    const token = signSessionToken({
      issuer: 'videostitcher-license',
      subject: device.id,
      licenseId: license.id,
      sessionVersion: device.sessionVersion,
      issuedAt,
      expiresAt: issuedAt + SESSION_TTL_SECONDS,
    }, this.options.signingPrivateKey);
    const entitlementReceipt = signEntitlementReceipt({
      issuer: 'videostitcher-entitlement',
      subject: device.id,
      licenseId: license.id,
      sessionVersion: device.sessionVersion,
      authorized: effectiveAccess.status === 'active',
      plan: effectiveAccess.plan,
      ...(effectiveAccess.planId === undefined ? {} : { planId: effectiveAccess.planId }),
      accessSource: effectiveAccess.source,
      accessMode: effectiveAccess.mode,
      status: effectiveAccess.status,
      ...(effectiveAccess.expiresAt === undefined ? {} : { expiresAt: effectiveAccess.expiresAt }),
      issuedAt,
      validUntil: issuedAt + OFFLINE_GRACE_SECONDS,
      offlineGraceSeconds: OFFLINE_GRACE_SECONDS,
      policyVersion: 1,
    }, this.options.signingPrivateKey);
    return {
      authorized: effectiveAccess.status === 'active',
      sessionToken: token,
      entitlementReceipt,
      sessionExpiresAt: new Date((issuedAt + SESSION_TTL_SECONDS) * 1000).toISOString(),
      heartbeatIntervalSeconds: HEARTBEAT_INTERVAL_SECONDS,
      offlineGraceSeconds: OFFLINE_GRACE_SECONDS,
      license: {
        id: license.id,
        customerName: device.deviceName,
        plan: effectiveAccess.plan,
        ...(effectiveAccess.planId === undefined ? {} : { planId: effectiveAccess.planId }),
        accessSource: effectiveAccess.source,
        accessMode: effectiveAccess.mode,
        status: effectiveAccess.status,
        ...(effectiveAccess.expiresAt === undefined ? {} : { expiresAt: effectiveAccess.expiresAt }),
        packages,
        queuedPackageCount: packages.filter((grant) => grant.status === 'queued').length,
      },
      device: toPublicDevice(device, now, activity),
    };
  }

  private readSessionClaims(sessionToken: string) {
    const claims = verifySessionToken(
      sessionToken,
      this.options.signingPublicKey,
      Math.floor(this.now().getTime() / 1000),
    );
    if (claims === null) {
      throw new ApiError(401, 'SESSION_INVALID', '设备会话无效或已过期');
    }
    return claims;
  }

  private assertLicenseActive(
    database: LicenseDatabase,
    license: LicenseRecord,
    now: Date,
  ): ReturnType<typeof getEffectiveLicenseAccess> {
    const effectiveAccess = getEffectiveLicenseAccess(
      license,
      database.packageGrants,
      database.defaultAccess,
      database.plans,
      now,
    );
    const status = effectiveAccess.status;
    if (status === 'expired' && getEntitlementSource(license) === 'trial') {
      throw new ApiError(403, 'TRIAL_EXPIRED', '7 天免费试用已结束，请加入 QQ 群领取套餐兑换码');
    }
    if (status !== 'active') {
      throw new ApiError(403, 'LICENSE_INACTIVE', `授权当前状态为 ${status}`);
    }
    return effectiveAccess;
  }

  private assertPlanInput(code: string, term: PlanTerm): void {
    if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(code)) {
      throw new ApiError(400, 'PLAN_CODE_INVALID', '套餐代码只能包含小写字母、数字和连字符');
    }
    if (term.unit !== 'perpetual' && (!Number.isInteger(term.value) || term.value < 1 || term.value > 1200)) {
      throw new ApiError(400, 'PLAN_TERM_INVALID', '套餐期限必须是 1 到 1200 的整数');
    }
  }

  private assertMachineFingerprint(value: string): void {
    if (!/^[a-f0-9]{64}$/.test(value)) {
      throw new ApiError(400, 'DEVICE_ID_INVALID', '设备 ID 必须是 64 位十六进制字符串');
    }
  }

  private hashDeviceCredential(installationId: string): string {
    return hashSensitiveValue(`device-credential:${installationId}`, this.options.licenseKeyPepper);
  }

  private assertPlanUniqueness(
    database: LicenseDatabase,
    code: string,
    externalSku?: string,
    excludedPlanId?: string,
  ): void {
    const duplicatedCode = database.plans.some(
      (plan) => plan.id !== excludedPlanId && plan.code.toLowerCase() === code.toLowerCase(),
    );
    if (duplicatedCode) {
      throw new ApiError(409, 'PLAN_CODE_EXISTS', '套餐代码已存在');
    }
    if (externalSku !== undefined && database.plans.some(
      (plan) => plan.id !== excludedPlanId && plan.externalSku === externalSku,
    )) {
      throw new ApiError(409, 'PLAN_SKU_EXISTS', '外部商品 SKU 已绑定其他套餐');
    }
  }

  private assignOptionalPlanField(
    plan: PlanRecord,
    key: 'priceLabel' | 'purchaseUrl' | 'externalSku',
    value: string | null | undefined,
  ): void {
    if (value === undefined) return;
    if (value === null) delete plan[key];
    else plan[key] = value;
  }
}
