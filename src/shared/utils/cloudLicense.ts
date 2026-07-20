/**
 * 云端授权 Bridge 客户端
 * 所有敏感凭据都在 Electron 主进程中处理，不暴露给渲染进程
 */

import { app, safeStorage } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
  sign,
  verify,
} from 'crypto';
import { getMachineId } from '@shared/utils/machineId';
import licenseRuntimeConfig from '@shared/config/license-runtime.json';
import type {
  LicenseAccessMode,
  LicenseAccessSource,
  LicensePackageCenter,
  LicensePackageSummary,
} from '@shared/types/license';

const CREDENTIAL_FILENAME = 'cloud-license.dat';
const INSTALLATION_FILENAME = 'cloud-installation.dat';
const LEGACY_INSTALLATION_FILENAME = 'cloud-installation.json';
const DEVICE_KEY_FILENAME = 'cloud-device-key.dat';
const DEFAULT_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_DEVELOPMENT_API_BASE_URL = 'http://127.0.0.1:8787';

interface CloudSession {
  apiBaseUrl: string;
  authorized: boolean;
  sessionToken: string;
  entitlementReceipt: string;
  entitlementValidUntil: string;
  sessionExpiresAt: string;
  lastSuccessfulValidationAt: string;
  heartbeatIntervalSeconds: number;
  offlineGraceSeconds: number;
  license: {
    id: string;
    customerName: string;
    plan: string;
    planId?: string;
    accessSource: LicenseAccessSource;
    accessMode?: LicenseAccessMode;
    status: string;
    expiresAt?: string;
    packages?: LicensePackageSummary[];
    queuedPackageCount?: number;
  };
  device: {
    id: string;
    deviceName: string;
    status: string;
  };
}

export interface CloudLicenseStatus {
  configured: boolean;
  hasCloudCredential: boolean;
  authorized: boolean;
  reason?: string;
  offlineMode?: boolean;
  trialExpired?: boolean;
  accessSource?: LicenseAccessSource;
  userInfo?: { user: string; machineId: string };
  licensePlan?: string;
  licenseExpiresAt?: string;
}

export interface CloudPublicPlan {
  id: string;
  code: string;
  name: string;
  description?: string;
  term:
    | { unit: 'day'; value: number }
    | { unit: 'month'; value: number }
    | { unit: 'perpetual' };
  isPublic: boolean;
  recommended: boolean;
  priceLabel?: string;
  purchaseUrl?: string;
}

interface CloudResponse<T> {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string };
}

interface DeviceKeyPair {
  version: 1;
  publicKey: string;
  privateKey: string;
}

interface EntitlementReceiptClaims {
  issuer: 'videostitcher-entitlement';
  subject: string;
  licenseId: string;
  sessionVersion: number;
  authorized: boolean;
  plan: string;
  planId?: string;
  accessSource: LicenseAccessSource;
  accessMode: LicenseAccessMode;
  status: 'active' | 'suspended' | 'revoked' | 'expired';
  expiresAt?: string;
  issuedAt: number;
  validUntil: number;
  offlineGraceSeconds: number;
  policyVersion: 1;
}

type ServerCloudSession = Omit<
  CloudSession,
  'apiBaseUrl' | 'lastSuccessfulValidationAt' | 'entitlementValidUntil'
>;

interface ServerPackageCenterResponse {
  packageCenter: LicensePackageCenter;
}

interface ServerRedeemResponse extends ServerPackageCenterResponse {
  alreadyRedeemed: boolean;
  session: ServerCloudSession;
}

class CloudRequestError extends Error {
  public constructor(
    message: string,
    public readonly code?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

function isTransientCloudError(error: unknown): boolean {
  if (error instanceof CloudRequestError) {
    return error.statusCode !== undefined && error.statusCode >= 500;
  }
  return error instanceof TypeError
    || (error instanceof Error && error.name === 'AbortError');
}

let heartbeatTimer: NodeJS.Timeout | null = null;
let statusListener: ((status: CloudLicenseStatus) => void) | null = null;
let activityProvider: (() => boolean) | null = null;
let developmentSigningPublicKey: string | null = null;

function getApiBaseUrl(): string | null {
  const developmentValue = process.env.VIDEO_STITCHER_LICENSE_API_URL?.trim()
    || licenseRuntimeConfig.apiBaseUrl?.trim();
  const value = app.isPackaged
    ? __LICENSE_API_BASE_URL__.trim()
    : developmentValue || DEFAULT_DEVELOPMENT_API_BASE_URL;
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) {
    throw new Error('授权服务必须使用 HTTPS');
  }
  return url.toString().replace(/\/$/, '');
}

function getCredentialPath(): string {
  return path.join(app.getPath('userData'), CREDENTIAL_FILENAME);
}

function getInstallationPath(): string {
  return path.join(app.getPath('userData'), INSTALLATION_FILENAME);
}

function getDeviceKeyPath(): string {
  return path.join(app.getPath('userData'), DEVICE_KEY_FILENAME);
}

function saveDeviceKeyPair(keyPair: DeviceKeyPair): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('当前系统无法安全保存设备密钥');
  }
  fs.writeFileSync(
    getDeviceKeyPath(),
    safeStorage.encryptString(JSON.stringify(keyPair)),
    { mode: 0o600 },
  );
}

function getDeviceKeyPair(): DeviceKeyPair {
  try {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('系统安全存储不可用');
    const parsed = JSON.parse(
      safeStorage.decryptString(fs.readFileSync(getDeviceKeyPath())),
    ) as Partial<DeviceKeyPair>;
    if (
      parsed.version === 1
      && typeof parsed.publicKey === 'string'
      && typeof parsed.privateKey === 'string'
    ) {
      createPrivateKey({
        key: Buffer.from(parsed.privateKey, 'base64url'),
        format: 'der',
        type: 'pkcs8',
      });
      return parsed as DeviceKeyPair;
    }
  } catch {
    // 首次启动或设备密钥损坏时生成新的密钥；已购套餐需要管理员确认重绑。
  }
  const generated = generateKeyPairSync('ed25519');
  const keyPair: DeviceKeyPair = {
    version: 1,
    publicKey: generated.publicKey.export({ format: 'der', type: 'spki' }).toString('base64url'),
    privateKey: generated.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64url'),
  };
  saveDeviceKeyPair(keyPair);
  return keyPair;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const source = value as Record<string, unknown>;
  return `{${Object.keys(source).sort().map((key) => (
    `${JSON.stringify(key)}:${stableStringify(source[key])}`
  )).join(',')}}`;
}

function createDeviceProof(
  method: 'GET' | 'POST',
  route: string,
  body: Record<string, unknown>,
  token?: string,
): Record<string, string> {
  const keyPair = getDeviceKeyPair();
  const timestamp = Date.now().toString();
  const nonce = randomBytes(16).toString('base64url');
  const bodyHash = createHash('sha256').update(stableStringify(body)).digest('hex');
  const tokenHash = createHash('sha256').update(token ?? '').digest('hex');
  const signingInput = [
    'VS-DEVICE-REQUEST-V1',
    method,
    route,
    timestamp,
    nonce,
    bodyHash,
    tokenHash,
  ].join('\n');
  const privateKey = createPrivateKey({
    key: Buffer.from(keyPair.privateKey, 'base64url'),
    format: 'der',
    type: 'pkcs8',
  });
  return {
    'X-VS-Device-Public-Key': keyPair.publicKey,
    'X-VS-Request-Timestamp': timestamp,
    'X-VS-Request-Nonce': nonce,
    'X-VS-Request-Signature': sign(null, Buffer.from(signingInput), privateKey).toString('base64url'),
  };
}

async function getSigningPublicKey(apiBaseUrl: string): Promise<string> {
  const compiledKey = __LICENSE_SIGNING_PUBLIC_KEY__.trim();
  if (compiledKey) {
    createPublicKey(compiledKey);
    return compiledKey;
  }
  if (app.isPackaged) throw new Error('正式版缺少授权签名公钥');
  if (developmentSigningPublicKey !== null) return developmentSigningPublicKey;
  const result = await request<{ algorithm: string; publicKey: string }>(
    apiBaseUrl,
    '/v1/public-key',
    { method: 'GET' },
  );
  if (result.algorithm !== 'Ed25519') throw new Error('授权服务签名算法不受支持');
  createPublicKey(result.publicKey);
  developmentSigningPublicKey = result.publicKey;
  return result.publicKey;
}

function readEntitlementReceipt(
  receipt: string,
  publicKey: string,
): EntitlementReceiptClaims {
  const segments = receipt.split('.');
  if (segments.length !== 3 || receipt.length > 8192) {
    throw new Error('授权权益凭据格式无效');
  }
  const [encodedHeader, encodedClaims, encodedSignature] = segments;
  if (!encodedHeader || !encodedClaims || !encodedSignature) {
    throw new Error('授权权益凭据格式无效');
  }
  try {
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')) as {
      algorithm?: unknown;
      type?: unknown;
      version?: unknown;
    };
    if (header.algorithm !== 'EdDSA' || header.type !== 'VS-ENTITLEMENT' || header.version !== 1) {
      throw new Error('授权权益凭据类型无效');
    }
    const signingInput = `${encodedHeader}.${encodedClaims}`;
    const valid = verify(
      null,
      Buffer.from(signingInput),
      createPublicKey(publicKey),
      Buffer.from(encodedSignature, 'base64url'),
    );
    if (!valid) throw new Error('授权权益凭据签名无效');
    const claims = JSON.parse(
      Buffer.from(encodedClaims, 'base64url').toString('utf8'),
    ) as Partial<EntitlementReceiptClaims>;
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
      claims.issuer !== 'videostitcher-entitlement'
      || typeof claims.subject !== 'string'
      || typeof claims.licenseId !== 'string'
      || !Number.isInteger(claims.sessionVersion)
      || typeof claims.authorized !== 'boolean'
      || typeof claims.plan !== 'string'
      || !['trial', 'complimentary', 'paid', 'legacy'].includes(claims.accessSource ?? '')
      || !['package', 'default', 'trial', 'legacy', 'none'].includes(claims.accessMode ?? '')
      || !['active', 'suspended', 'revoked', 'expired'].includes(claims.status ?? '')
      || !Number.isInteger(claims.issuedAt)
      || !Number.isInteger(claims.validUntil)
      || !Number.isInteger(claims.offlineGraceSeconds)
      || claims.policyVersion !== 1
      || (claims.issuedAt as number) > nowSeconds + 5 * 60
      || (claims.validUntil as number) <= nowSeconds - 5 * 60
      || (claims.validUntil as number) <= (claims.issuedAt as number)
      || (claims.offlineGraceSeconds as number) < 0
      || (claims.expiresAt !== undefined && Number.isNaN(Date.parse(claims.expiresAt)))
    ) {
      throw new Error('授权权益凭据内容无效');
    }
    return claims as EntitlementReceiptClaims;
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith('授权权益凭据')) throw error;
    throw new Error('授权权益凭据解析失败');
  }
}

async function createVerifiedSession(
  apiBaseUrl: string,
  serverSession: ServerCloudSession,
): Promise<CloudSession> {
  const publicKey = await getSigningPublicKey(apiBaseUrl);
  const claims = readEntitlementReceipt(serverSession.entitlementReceipt, publicKey);
  if (
    claims.subject !== serverSession.device.id
    || claims.licenseId !== serverSession.license.id
  ) {
    throw new Error('授权权益凭据与当前设备不匹配');
  }
  const {
    planId: _untrustedPlanId,
    expiresAt: _untrustedExpiresAt,
    ...displayLicense
  } = serverSession.license;
  return {
    ...serverSession,
    authorized: claims.authorized && claims.status === 'active',
    offlineGraceSeconds: Math.min(
      serverSession.offlineGraceSeconds,
      claims.offlineGraceSeconds,
    ),
    license: {
      ...displayLicense,
      plan: claims.plan,
      ...(claims.planId === undefined ? {} : { planId: claims.planId }),
      accessSource: claims.accessSource,
      accessMode: claims.accessMode,
      status: claims.status,
      ...(claims.expiresAt === undefined ? {} : { expiresAt: claims.expiresAt }),
    },
    apiBaseUrl,
    lastSuccessfulValidationAt: new Date(claims.issuedAt * 1000).toISOString(),
    entitlementValidUntil: new Date(claims.validUntil * 1000).toISOString(),
  };
}

function getInstallationId(): string {
  const filePath = getInstallationPath();
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const installationId = safeStorage.decryptString(fs.readFileSync(filePath));
      if (installationId.length >= 16) return installationId;
    }
  } catch {
    // 首次升级时继续尝试迁移旧版明文安装凭据
  }
  const legacyPath = path.join(app.getPath('userData'), LEGACY_INSTALLATION_FILENAME);
  try {
    const parsed = JSON.parse(fs.readFileSync(legacyPath, 'utf8')) as { installationId?: string };
    if (typeof parsed.installationId === 'string' && parsed.installationId.length >= 16) {
      saveInstallationId(parsed.installationId);
      try {
        fs.unlinkSync(legacyPath);
      } catch {
        // 加密迁移已完成，旧文件清理失败不影响继续使用
      }
      return parsed.installationId;
    }
  } catch {
    // 首次启动或旧文件损坏时生成新的安装凭据
  }
  const installationId = randomUUID();
  saveInstallationId(installationId);
  return installationId;
}

function saveInstallationId(installationId: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('当前系统无法安全保存设备凭据');
  }
  fs.writeFileSync(
    getInstallationPath(),
    safeStorage.encryptString(installationId),
    { mode: 0o600 },
  );
}

function saveSession(session: CloudSession): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('当前系统无法安全保存授权凭据');
  }
  const encrypted = safeStorage.encryptString(JSON.stringify(session));
  fs.writeFileSync(getCredentialPath(), encrypted, { mode: 0o600 });
}

function readSession(): CloudSession | null {
  try {
    const encrypted = fs.readFileSync(getCredentialPath());
    if (!safeStorage.isEncryptionAvailable()) return null;
    return JSON.parse(safeStorage.decryptString(encrypted)) as CloudSession;
  } catch {
    return null;
  }
}

async function request<T>(
  apiBaseUrl: string,
  route: string,
  options: {
    method?: 'GET' | 'POST';
    token?: string;
    body?: Record<string, unknown>;
    deviceProof?: boolean;
  } = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const method = options.method ?? 'POST';
    const body = options.body ?? {};
    const response = await fetch(`${apiBaseUrl}${route}`, {
      method,
      headers: {
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token === undefined ? {} : { Authorization: `Bearer ${options.token}` }),
        ...(options.deviceProof === true
          ? createDeviceProof(method, route, body, options.token)
          : {}),
      },
      ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
    const responseText = await response.text();
    if (responseText.length > 1024 * 1024) {
      throw new CloudRequestError('授权服务响应过大', 'RESPONSE_TOO_LARGE', response.status);
    }
    let payload: CloudResponse<T> | undefined;
    try {
      payload = JSON.parse(responseText) as CloudResponse<T>;
    } catch {
      // 网关的 HTML 错误页仍按 HTTP 状态分类，避免把 5xx 误判为授权失效。
    }
    if (!response.ok) {
      throw new CloudRequestError(
        payload?.error?.message || `授权服务返回 HTTP ${response.status}`,
        payload?.error?.code,
        response.status,
      );
    }
    if (payload === undefined || !payload.success || payload.data === undefined) {
      throw new CloudRequestError('授权服务响应格式无效', 'RESPONSE_INVALID', response.status);
    }
    return payload.data;
  } finally {
    clearTimeout(timeout);
  }
}

function toCloudStatus(session: CloudSession, offlineMode = false): CloudLicenseStatus {
  const authorized = session.authorized ?? session.license.status === 'active';
  const trialExpired = !authorized
    && session.license.accessSource === 'trial'
    && session.license.status === 'expired';
  return {
    configured: true,
    hasCloudCredential: true,
    authorized,
    offlineMode,
    ...(trialExpired ? {
      trialExpired: true,
      reason: '7 天免费试用已结束，可加入 QQ 群领取套餐兑换码',
    } : {}),
    userInfo: {
      user: session.license.customerName,
      machineId: getMachineId(),
    },
    licensePlan: session.license.plan,
    accessSource: session.license.accessSource,
    ...(session.license.expiresAt === undefined ? {} : { licenseExpiresAt: session.license.expiresAt }),
  };
}

function getDevicePayload(): Record<string, string> {
  const keyPair = getDeviceKeyPair();
  return {
    installationId: getInstallationId(),
    devicePublicKey: keyPair.publicKey,
    machineFingerprint: getMachineId(),
    deviceName: os.hostname(),
    platform: process.platform,
    arch: process.arch,
    appVersion: app.getVersion(),
  };
}

function isWithinOfflineGrace(session: CloudSession): boolean {
  const now = Date.now();
  if (
    session.license.expiresAt !== undefined
    && new Date(session.license.expiresAt).getTime() <= now
  ) {
    return false;
  }
  const lastValidationAt = new Date(session.lastSuccessfulValidationAt).getTime();
  if (!Number.isFinite(lastValidationAt) || now < lastValidationAt - 5 * 60 * 1000) return false;
  const entitlementValidUntil = new Date(session.entitlementValidUntil).getTime();
  if (!Number.isFinite(entitlementValidUntil) || now > entitlementValidUntil) return false;
  const graceMs = Math.min(
    Math.max(session.offlineGraceSeconds * 1000, 0),
    DEFAULT_OFFLINE_GRACE_MS,
  );
  return now - lastValidationAt <= graceMs;
}

export async function connectCloudDevice(): Promise<CloudLicenseStatus> {
  const apiBaseUrl = getApiBaseUrl();
  if (apiBaseUrl === null) {
    return { configured: false, hasCloudCredential: false, authorized: false, reason: '云授权服务尚未配置' };
  }
  try {
    const activated = await request<ServerCloudSession>(apiBaseUrl, '/v1/devices/connect', {
      body: getDevicePayload(),
      deviceProof: true,
    });
    const session = await createVerifiedSession(apiBaseUrl, activated);
    saveSession(session);
    if (session.authorized) scheduleCloudHeartbeat();
    else stopCloudHeartbeat();
    return toCloudStatus(session);
  } catch (error: unknown) {
    if (error instanceof CloudRequestError && [
      'TRIAL_EXPIRED',
      'DEVICE_CREDENTIAL_INVALID',
      'DEVICE_REVOKED',
      'LICENSE_INACTIVE',
    ].includes(error.code ?? '')) {
      return {
        configured: true,
        hasCloudCredential: readSession() !== null,
        authorized: false,
        ...(error.code === 'TRIAL_EXPIRED' ? { trialExpired: true, accessSource: 'trial' as const } : {}),
        reason: error.message,
      };
    }
    throw error;
  }
}

export async function getCloudPublicPlans(): Promise<CloudPublicPlan[]> {
  const apiBaseUrl = getApiBaseUrl();
  if (apiBaseUrl === null) return [];
  const result = await request<{ plans: CloudPublicPlan[] }>(apiBaseUrl, '/v1/plans', { method: 'GET' });
  return result.plans;
}

async function withCurrentCloudSession<T>(
  operation: (session: CloudSession) => Promise<T>,
): Promise<T> {
  const apiBaseUrl = getApiBaseUrl();
  if (apiBaseUrl === null) throw new Error('云授权服务尚未配置');
  let session = readSession();
  if (session === null || session.apiBaseUrl !== apiBaseUrl) {
    await connectCloudDevice();
    session = readSession();
  }
  if (session === null) throw new Error('无法建立当前设备的授权会话');
  try {
    return await operation(session);
  } catch (error: unknown) {
    if (!(error instanceof CloudRequestError) || !['SESSION_INVALID', 'SESSION_REVOKED'].includes(error.code ?? '')) {
      throw error;
    }
    await connectCloudDevice();
    const recoveredSession = readSession();
    if (recoveredSession === null) throw error;
    return operation(recoveredSession);
  }
}

export async function getCloudPackageCenter(): Promise<LicensePackageCenter> {
  return withCurrentCloudSession(async (session) => {
    const result = await request<ServerPackageCenterResponse>(
      session.apiBaseUrl,
      '/v1/packages/center',
      { token: session.sessionToken, deviceProof: true },
    );
    return result.packageCenter;
  });
}

export async function redeemCloudPackageCode(code: string): Promise<{
  center: LicensePackageCenter;
  alreadyRedeemed: boolean;
}> {
  return withCurrentCloudSession(async (session) => {
    const result = await request<ServerRedeemResponse>(
      session.apiBaseUrl,
      '/v1/packages/redeem',
      { token: session.sessionToken, body: { code }, deviceProof: true },
    );
    const nextSession = await createVerifiedSession(session.apiBaseUrl, result.session);
    saveSession(nextSession);
    if (nextSession.authorized) scheduleCloudHeartbeat();
    else stopCloudHeartbeat();
    return {
      center: result.packageCenter,
      alreadyRedeemed: result.alreadyRedeemed,
    };
  });
}

export async function getCloudLicenseStatus(): Promise<CloudLicenseStatus> {
  let apiBaseUrl: string | null = null;
  try {
    apiBaseUrl = getApiBaseUrl();
  } catch (error: unknown) {
    return { configured: true, hasCloudCredential: false, authorized: false, reason: error instanceof Error ? error.message : String(error) };
  }
  const configured = apiBaseUrl !== null;
  const session = readSession();
  if (session === null || session.apiBaseUrl !== apiBaseUrl) {
    return { configured, hasCloudCredential: false, authorized: false };
  }
  try {
    const refreshed = await request<ServerCloudSession>(
      session.apiBaseUrl,
      '/v1/licenses/validate',
      {
        token: session.sessionToken,
        body: { appVersion: app.getVersion(), active: activityProvider?.() ?? false },
        deviceProof: true,
      },
    );
    const nextSession = await createVerifiedSession(session.apiBaseUrl, refreshed);
    saveSession(nextSession);
    scheduleCloudHeartbeat();
    return toCloudStatus(nextSession);
  } catch (error: unknown) {
    let failure: unknown = error;
    if (error instanceof CloudRequestError && ['SESSION_INVALID', 'SESSION_REVOKED'].includes(error.code ?? '')) {
      try {
        return await connectCloudDevice();
      } catch (recoveryError: unknown) {
        failure = recoveryError;
      }
    }
    if (failure instanceof CloudRequestError && failure.code === 'TRIAL_EXPIRED') {
      stopCloudHeartbeat();
      return {
        configured: true,
        hasCloudCredential: true,
        authorized: false,
        trialExpired: true,
        accessSource: 'trial',
        reason: failure.message,
      };
    }
    const message = failure instanceof Error ? failure.message : String(failure);
    if (isWithinOfflineGrace(session) && isTransientCloudError(failure)) {
      return toCloudStatus(session, true);
    }
    stopCloudHeartbeat();
    return {
      configured: true,
      hasCloudCredential: true,
      authorized: false,
      reason: message,
    };
  }
}

export function configureCloudLicenseHeartbeat(options: {
  onStatus: (status: CloudLicenseStatus) => void;
  isActive: () => boolean;
}): void {
  statusListener = options.onStatus;
  activityProvider = options.isActive;
  scheduleCloudHeartbeat();
}

export function stopCloudHeartbeat(): void {
  if (heartbeatTimer !== null) {
    clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function scheduleCloudHeartbeat(): void {
  stopCloudHeartbeat();
  const session = readSession();
  let apiBaseUrl: string | null;
  try {
    apiBaseUrl = getApiBaseUrl();
  } catch {
    return;
  }
  if (session === null || statusListener === null || session.apiBaseUrl !== apiBaseUrl) return;
  const intervalMs = Math.max(
    session.heartbeatIntervalSeconds * 1000 || DEFAULT_HEARTBEAT_INTERVAL_MS,
    60_000,
  );
  heartbeatTimer = setTimeout(async () => {
    const currentSession = readSession();
    if (currentSession === null) return;
    try {
      const refreshed = await request<ServerCloudSession>(
        currentSession.apiBaseUrl,
        '/v1/licenses/heartbeat',
        {
          token: currentSession.sessionToken,
          body: { appVersion: app.getVersion(), active: activityProvider?.() ?? false },
          deviceProof: true,
        },
      );
      const nextSession = await createVerifiedSession(currentSession.apiBaseUrl, refreshed);
      saveSession(nextSession);
      statusListener?.(toCloudStatus(nextSession));
    } catch (error: unknown) {
      if (error instanceof CloudRequestError && ['SESSION_INVALID', 'SESSION_REVOKED'].includes(error.code ?? '')) {
        try {
          const recovered = await connectCloudDevice();
          statusListener?.(recovered);
          return;
        } catch (recoveryError: unknown) {
          error = recoveryError;
        }
      }
      if (error instanceof CloudRequestError && error.code === 'TRIAL_EXPIRED') {
        statusListener?.({
          configured: true,
          hasCloudCredential: true,
          authorized: false,
          trialExpired: true,
          accessSource: 'trial',
          reason: error.message,
        });
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      if (!isWithinOfflineGrace(currentSession) || !isTransientCloudError(error)) {
        statusListener?.({ configured: true, hasCloudCredential: true, authorized: false, reason: message });
        return;
      }
    }
    scheduleCloudHeartbeat();
  }, intervalMs);
}
