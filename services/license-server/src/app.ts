import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AdminService } from './admin-service.js';
import { getPublicKeyPem } from './token.js';
import { loadConfig, type LicenseServerConfig } from './config.js';
import type { PublicAdminRecord } from './domain.js';
import { ApiError } from './errors.js';
import { readDeviceRequestProof, verifyDeviceRequestProof } from './device-proof.js';
import { MemoryRateLimiter } from './rate-limit.js';
import {
  GithubReleaseManagement,
  type ReleaseManagement,
} from './release-management.js';
import {
  LicenseService,
  type ClientDeviceInput,
  type PackageGrantBatchInput,
} from './service.js';
import { FileLicenseStorage, TosLicenseStorage, type LicenseStorage } from './storage.js';
import {
  ValidationError,
  asAdminRole,
  asAdminStatus,
  asBoolean,
  asDefaultAccessStatus,
  asDeviceStatus,
  asHttpsUrl,
  asInteger,
  asIsoDate,
  asLicenseStatus,
  asLicenseTags,
  asNullableString,
  asObject,
  asPackageGrantBatchDuplicatePolicy,
  asPackageGrantBatchSelection,
  asPackageGrantSource,
  asPlanStatus,
  asPlanTerm,
  asRedemptionBatchStatus,
  asSecretString,
  asString,
} from './validation.js';

const MAX_BODY_BYTES = 64 * 1024;
const STATIC_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'admin');

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: status < 400, data }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

function errorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ success: false, error: { code, message } }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

async function parseJsonBody(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number.parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_BODY_BYTES) {
    throw new ApiError(413, 'BODY_TOO_LARGE', '请求体过大');
  }
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) {
    throw new ApiError(413, 'BODY_TOO_LARGE', '请求体过大');
  }
  if (text.length === 0) {
    return {};
  }
  try {
    return asObject(JSON.parse(text) as unknown);
  } catch (error: unknown) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('请求体不是有效的 JSON');
  }
}

function getBearerToken(request: Request): string {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new ApiError(401, 'AUTH_REQUIRED', '缺少认证信息');
  }
  const token = authorization.slice('Bearer '.length).trim();
  if (token.length < 16 || token.length > 4096) {
    throw new ApiError(401, 'AUTH_INVALID', '认证信息无效');
  }
  return token;
}

function getSourceIp(request: Request): string {
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

function parseClientDeviceInput(body: Record<string, unknown>): ClientDeviceInput {
  return {
    installationId: asString(body.installationId, 'installationId', { min: 16, max: 128 }) as string,
    devicePublicKey: asString(body.devicePublicKey, 'devicePublicKey', { min: 40, max: 160 }) as string,
    machineFingerprint: asString(body.machineFingerprint, 'machineFingerprint', { min: 64, max: 64 }) as string,
    deviceName: asString(body.deviceName, 'deviceName', { min: 1, max: 120 }) as string,
    platform: asString(body.platform, 'platform', { min: 2, max: 32 }) as string,
    arch: asString(body.arch, 'arch', { min: 2, max: 32 }) as string,
    appVersion: asString(body.appVersion, 'appVersion', { min: 1, max: 40 }) as string,
  };
}

function asAuditReason(value: unknown, fallback: string): string {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string' && value.trim().length === 0) return fallback;
  return asString(value, 'reason', { min: 1, max: 300 }) as string;
}

function parsePackageGrantBatchInput(body: Record<string, unknown>): PackageGrantBatchInput {
  return {
    operationKey: asString(body.operationKey, 'operationKey', { min: 8, max: 120 }) as string,
    selection: asPackageGrantBatchSelection(body.selection),
    planId: asString(body.planId, 'planId', { min: 1, max: 120 }) as string,
    source: asPackageGrantSource(body.source, 'source'),
    duplicatePolicy: asPackageGrantBatchDuplicatePolicy(body.duplicatePolicy, 'duplicatePolicy'),
    reason: asAuditReason(body.reason, '批量发放套餐包'),
  };
}

function getStorage(config: LicenseServerConfig): LicenseStorage {
  if (config.storage.driver === 'file') {
    return new FileLicenseStorage(config.storage.filePath);
  }
  if (!config.storage.accessKeyId || !config.storage.accessKeySecret) {
    throw new Error('TOS 存储缺少访问凭据，请为函数绑定 IAM 角色或配置本地测试凭据');
  }
  return new TosLicenseStorage({
    ...config.storage,
    accessKeyId: config.storage.accessKeyId,
    accessKeySecret: config.storage.accessKeySecret,
  });
}

async function serveStaticAsset(fileName: string, contentType: string): Promise<Response> {
  const filePath = path.resolve(STATIC_ROOT, fileName);
  if (!filePath.startsWith(`${path.resolve(STATIC_ROOT)}${path.sep}`)) {
    throw new ApiError(404, 'NOT_FOUND', '页面资源不存在');
  }
  const content = await readFile(filePath);
  const hasStableFileName = fileName === 'index.html' || fileName === 'app.js' || fileName === 'styles.css';
  return new Response(content, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': hasStableFileName ? 'no-store' : 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    },
  });
}

export interface LicenseApplication {
  handle(request: Request): Promise<Response>;
  service: LicenseService;
  adminService: AdminService;
  releaseManagement?: ReleaseManagement;
}

export function createApplication(
  config = loadConfig(),
  dependencies: {
    storage?: LicenseStorage;
    now?: () => Date;
    releaseManagement?: ReleaseManagement;
  } = {},
): LicenseApplication {
  const storage = dependencies.storage ?? getStorage(config);
  const signingPublicKey = getPublicKeyPem(config.signingPrivateKey);
  const service = new LicenseService({
    storage,
    licenseKeyPepper: config.licenseKeyPepper,
    signingPrivateKey: config.signingPrivateKey,
    signingPublicKey,
    ...(dependencies.now === undefined ? {} : { now: dependencies.now }),
  });
  const adminService = new AdminService({
    storage,
    signingPrivateKey: config.signingPrivateKey,
    signingPublicKey,
    bootstrapPasswordHash: config.adminTokenHash,
    allowBootstrap: config.allowAdminBootstrap,
    ...(config.bootstrapAdminUsername === undefined ? {} : {
      bootstrapUsername: config.bootstrapAdminUsername,
    }),
    ...(dependencies.now === undefined ? {} : { now: dependencies.now }),
  });
  const releaseManagement = dependencies.releaseManagement ?? (config.releaseManagement
    ? new GithubReleaseManagement({
        ...config.releaseManagement,
        signingPrivateKey: config.signingPrivateKey,
        ...(dependencies.now === undefined ? {} : { now: dependencies.now }),
      })
    : undefined);
  const rateLimiter = new MemoryRateLimiter();

  return {
    service,
    adminService,
    ...(releaseManagement === undefined ? {} : { releaseManagement }),
    async handle(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const sourceIp = getSourceIp(request);
      const pathName = url.pathname.replace(/\/+$/, '') || '/';
      try {
        if (request.method === 'GET' && (pathName === '/' || pathName === '/admin')) {
          return serveStaticAsset('index.html', 'text/html; charset=utf-8');
        }
        const staticAssetMatch = pathName.match(/^\/admin\/(.+)$/);
        if (request.method === 'GET' && staticAssetMatch?.[1]) {
          const extension = path.extname(staticAssetMatch[1]);
          const contentTypes: Record<string, string> = {
            '.css': 'text/css; charset=utf-8',
            '.js': 'text/javascript; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.svg': 'image/svg+xml',
            '.png': 'image/png',
            '.woff2': 'font/woff2',
          };
          return serveStaticAsset(
            staticAssetMatch[1],
            contentTypes[extension] ?? 'application/octet-stream',
          );
        }
        if (request.method === 'GET' && pathName === '/health') {
          return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
        }
        if (request.method === 'GET' && pathName === '/v1/public-key') {
          return jsonResponse({ algorithm: 'Ed25519', publicKey: signingPublicKey });
        }

        if (request.method === 'POST' && pathName === '/v1/admin/auth/login') {
          if (!rateLimiter.consume(`admin-login:${sourceIp}`, 10, 15 * 60_000)) {
            throw new ApiError(429, 'ADMIN_LOGIN_RATE_LIMITED', '登录尝试过于频繁，请稍后重试');
          }
          const body = await parseJsonBody(request);
          return jsonResponse(await adminService.login(
            asString(body.username, 'username', { min: 3, max: 32 }) as string,
            asSecretString(body.password, 'password', { min: 10, max: 128 }) as string,
          ));
        }

        if (!rateLimiter.consume(`public:${sourceIp}`, 120, 60_000)) {
          throw new ApiError(429, 'RATE_LIMITED', '请求过于频繁，请稍后重试');
        }

        if (request.method === 'GET' && pathName === '/v1/plans') {
          return jsonResponse(await service.listPublicPlans());
        }

        if (request.method === 'POST' && pathName === '/v1/devices/connect') {
          if (!rateLimiter.consume(`device-connect:${sourceIp}`, 10, 10 * 60_000)) {
            throw new ApiError(429, 'DEVICE_CONNECT_RATE_LIMITED', '设备连接过于频繁');
          }
          const body = await parseJsonBody(request);
          const deviceInput = parseClientDeviceInput(body);
          verifyDeviceRequestProof(
            readDeviceRequestProof(request, body),
            deviceInput.devicePublicKey,
            dependencies.now?.() ?? new Date(),
          );
          return jsonResponse(await service.connectDevice(deviceInput, sourceIp), 201);
        }
        if (request.method === 'POST' && pathName === '/v1/licenses/validate') {
          const body = await parseJsonBody(request);
          const token = getBearerToken(request);
          await service.verifyDeviceRequest(token, readDeviceRequestProof(request, body, token));
          const result = await service.validate(token, {
            appVersion: asString(body.appVersion, 'appVersion', { min: 1, max: 40 }) as string,
            active: asBoolean(body.active, 'active'),
          }, sourceIp);
          return jsonResponse(result);
        }
        if (request.method === 'POST' && pathName === '/v1/licenses/heartbeat') {
          const body = await parseJsonBody(request);
          const token = getBearerToken(request);
          await service.verifyDeviceRequest(token, readDeviceRequestProof(request, body, token));
          const result = await service.heartbeat(token, {
            appVersion: asString(body.appVersion, 'appVersion', { min: 1, max: 40 }) as string,
            active: asBoolean(body.active, 'active'),
          }, sourceIp);
          return jsonResponse(result);
        }
        if (request.method === 'POST' && pathName === '/v1/packages/center') {
          const body = await parseJsonBody(request);
          const token = getBearerToken(request);
          await service.verifyDeviceRequest(token, readDeviceRequestProof(request, body, token));
          return jsonResponse(await service.getPackageCenter(token));
        }
        if (request.method === 'POST' && pathName === '/v1/packages/redeem') {
          if (!rateLimiter.consume(`package-redeem:${sourceIp}`, 20, 10 * 60_000)) {
            throw new ApiError(429, 'REDEMPTION_RATE_LIMITED', '兑换尝试过于频繁，请稍后重试');
          }
          const body = await parseJsonBody(request);
          const token = getBearerToken(request);
          await service.verifyDeviceRequest(token, readDeviceRequestProof(request, body, token));
          return jsonResponse(await service.redeemPackageCode(
            token,
            asSecretString(body.code, 'code', { min: 10, max: 80 }) as string,
          ));
        }
        let authenticatedAdmin: PublicAdminRecord | undefined;
        if (pathName.startsWith('/v1/admin/')) {
          if (!rateLimiter.consume(`admin:${sourceIp}`, 240, 60_000)) {
            throw new ApiError(429, 'ADMIN_RATE_LIMITED', '管理操作过于频繁');
          }
          authenticatedAdmin = await adminService.authenticate(getBearerToken(request));
        }
        const requireAdmin = (): PublicAdminRecord => {
          if (authenticatedAdmin === undefined) {
            throw new ApiError(401, 'ADMIN_AUTH_REQUIRED', '请先登录管理后台');
          }
          return authenticatedAdmin;
        };
        const requireOwner = (): PublicAdminRecord => {
          const admin = requireAdmin();
          if (admin.role !== 'owner') {
            throw new ApiError(403, 'ADMIN_OWNER_REQUIRED', '只有所有者可以执行该操作');
          }
          return admin;
        };
        if (request.method === 'GET' && pathName === '/v1/admin/auth/me') {
          return jsonResponse({ admin: requireAdmin() });
        }
        if (request.method === 'POST' && pathName === '/v1/admin/auth/logout') {
          return jsonResponse(await adminService.logout(requireAdmin()));
        }
        if (request.method === 'POST' && pathName === '/v1/admin/migrations/legacy-github/preview') {
          const body = await parseJsonBody(request);
          return jsonResponse(await service.previewLegacyGithubImport(body, requireOwner().id));
        }
        if (request.method === 'POST' && pathName === '/v1/admin/migrations/legacy-github/apply') {
          const body = await parseJsonBody(request);
          return jsonResponse(await service.applyLegacyGithubImport(body, requireOwner().id));
        }
        if (request.method === 'POST' && pathName === '/v1/admin/auth/password') {
          const admin = requireAdmin();
          if (!rateLimiter.consume(`admin-password:${admin.id}`, 10, 15 * 60_000)) {
            throw new ApiError(429, 'ADMIN_PASSWORD_RATE_LIMITED', '修改密码尝试过于频繁，请稍后重试');
          }
          const body = await parseJsonBody(request);
          return jsonResponse(await adminService.changeOwnPassword(
            admin,
            asSecretString(body.currentPassword, 'currentPassword', { min: 10, max: 128 }) as string,
            asSecretString(body.newPassword, 'newPassword', { min: 10, max: 128 }) as string,
          ));
        }
        if (request.method === 'GET' && pathName === '/v1/admin/accounts') {
          return jsonResponse(await adminService.listAccounts(requireAdmin()));
        }
        if (request.method === 'POST' && pathName === '/v1/admin/accounts') {
          const body = await parseJsonBody(request);
          return jsonResponse(await adminService.createAccount(requireAdmin(), {
            username: asString(body.username, 'username', { min: 3, max: 32 }) as string,
            displayName: asString(body.displayName, 'displayName', { min: 1, max: 40 }) as string,
            password: asSecretString(body.password, 'password', { min: 10, max: 128 }) as string,
            role: asAdminRole(body.role, 'role'),
          }), 201);
        }
        const adminUpdateMatch = pathName.match(/^\/v1\/admin\/accounts\/([^/]+)$/);
        if (request.method === 'PUT' && adminUpdateMatch?.[1]) {
          const body = await parseJsonBody(request);
          const displayName = asString(body.displayName, 'displayName', {
            min: 1,
            max: 40,
            optional: true,
          });
          const password = asSecretString(body.password, 'password', {
            min: 10,
            max: 128,
            optional: true,
          });
          return jsonResponse(await adminService.updateAccount(requireAdmin(), adminUpdateMatch[1], {
            ...(displayName === undefined ? {} : { displayName }),
            ...(body.role === undefined ? {} : { role: asAdminRole(body.role, 'role') }),
            ...(body.status === undefined ? {} : { status: asAdminStatus(body.status, 'status') }),
            ...(password === undefined ? {} : { password }),
          }));
        }
        if (request.method === 'GET' && pathName === '/v1/admin/overview') {
          return jsonResponse(await service.listAdminOverview());
        }
        if (request.method === 'GET' && pathName === '/v1/admin/releases') {
          requireOwner();
          if (!releaseManagement) {
            throw new ApiError(503, 'RELEASE_MANAGEMENT_DISABLED', '版本管理尚未配置 GitHub 发布凭据');
          }
          return jsonResponse(await releaseManagement.getDashboard());
        }
        if (request.method === 'POST' && pathName === '/v1/admin/releases') {
          requireOwner();
          if (!releaseManagement) {
            throw new ApiError(503, 'RELEASE_MANAGEMENT_DISABLED', '版本管理尚未配置 GitHub 发布凭据');
          }
          const body = await parseJsonBody(request);
          const releaseNotes = asString(body.releaseNotes ?? '', 'releaseNotes', { min: 0, max: 8_000 }) ?? '';
          return jsonResponse(await releaseManagement.publish(releaseNotes), 202);
        }
        const releaseCurrentMatch = pathName.match(/^\/v1\/admin\/releases\/([^/]+)\/current$/);
        if (request.method === 'POST' && releaseCurrentMatch?.[1]) {
          requireOwner();
          if (!releaseManagement) {
            throw new ApiError(503, 'RELEASE_MANAGEMENT_DISABLED', '版本管理尚未配置 GitHub 发布凭据');
          }
          return jsonResponse(await releaseManagement.setCurrent(releaseCurrentMatch[1]), 202);
        }
        const releaseOperationMatch = pathName.match(/^\/v1\/admin\/release-operations\/([^/]+)$/);
        if (request.method === 'GET' && releaseOperationMatch?.[1]) {
          requireOwner();
          if (!releaseManagement) {
            throw new ApiError(503, 'RELEASE_MANAGEMENT_DISABLED', '版本管理尚未配置 GitHub 发布凭据');
          }
          return jsonResponse(await releaseManagement.getOperation(releaseOperationMatch[1]));
        }
        if (request.method === 'POST' && pathName === '/v1/admin/package-grant-batches/preview') {
          const body = await parseJsonBody(request);
          return jsonResponse(await service.previewPackageGrantBatch(parsePackageGrantBatchInput(body)));
        }
        if (request.method === 'POST' && pathName === '/v1/admin/package-grant-batches') {
          const body = await parseJsonBody(request);
          return jsonResponse(await service.createPackageGrantBatch(
            parsePackageGrantBatchInput(body),
            requireAdmin().id,
          ), 201);
        }
        const packageGrantBatchWithdrawMatch = pathName.match(
          /^\/v1\/admin\/package-grant-batches\/([^/]+)\/withdraw$/,
        );
        if (request.method === 'POST' && packageGrantBatchWithdrawMatch?.[1]) {
          const body = await parseJsonBody(request);
          return jsonResponse(await service.withdrawPackageGrantBatch(
            packageGrantBatchWithdrawMatch[1],
            asAuditReason(body.reason, '整批撤回套餐包'),
            requireAdmin().id,
          ));
        }
        if (request.method === 'GET' && pathName === '/v1/admin/audit-events') {
          const limit = Math.min(Number.parseInt(url.searchParams.get('limit') || '200', 10) || 200, 500);
          return jsonResponse(await service.listAuditEvents(limit));
        }
        if (request.method === 'POST' && pathName === '/v1/admin/plans') {
          const body = await parseJsonBody(request);
          return jsonResponse(await service.createPlan({
            code: asString(body.code, 'code', { min: 2, max: 40 }) as string,
            name: asString(body.name, 'name', { min: 1, max: 80 }) as string,
            ...(body.description === undefined ? {} : {
              description: asString(body.description, 'description', { min: 1, max: 300 }) as string,
            }),
            term: asPlanTerm(body.term, 'term'),
            isPublic: asBoolean(body.isPublic, 'isPublic'),
            recommended: asBoolean(body.recommended, 'recommended'),
            ...(body.priceLabel === undefined ? {} : {
              priceLabel: asString(body.priceLabel, 'priceLabel', { min: 1, max: 80 }) as string,
            }),
            ...(body.purchaseUrl === undefined ? {} : {
              purchaseUrl: asHttpsUrl(body.purchaseUrl, 'purchaseUrl'),
            }),
            ...(body.externalSku === undefined ? {} : {
              externalSku: asString(body.externalSku, 'externalSku', { min: 1, max: 120 }) as string,
            }),
          }, requireAdmin().id), 201);
        }
        if (request.method === 'POST' && pathName === '/v1/admin/redemption-batches') {
          const body = await parseJsonBody(request);
          const salesChannel = asString(body.salesChannel, 'salesChannel', {
            min: 1,
            max: 80,
            optional: true,
          });
          return jsonResponse(await service.createRedemptionBatch({
            name: asString(body.name, 'name', { min: 1, max: 100 }) as string,
            planId: asString(body.planId, 'planId', { min: 1, max: 120 }) as string,
            quantity: asInteger(body.quantity, 'quantity', { min: 1, max: 500 }),
            source: asPackageGrantSource(body.source, 'source'),
            ...(salesChannel === undefined ? {} : { salesChannel }),
            reason: asAuditReason(body.reason, '生成套餐码批次'),
          }, requireOwner().id), 201);
        }
        const redemptionBatchCodesMatch = pathName.match(
          /^\/v1\/admin\/redemption-batches\/([^/]+)\/codes$/,
        );
        if (request.method === 'GET' && redemptionBatchCodesMatch?.[1]) {
          requireOwner();
          return jsonResponse(await service.listRedemptionBatchCodes(redemptionBatchCodesMatch[1]));
        }
        const redemptionBatchMatch = pathName.match(/^\/v1\/admin\/redemption-batches\/([^/]+)$/);
        if (request.method === 'PUT' && redemptionBatchMatch?.[1]) {
          const body = await parseJsonBody(request);
          const status = asRedemptionBatchStatus(body.status, 'status');
          return jsonResponse(await service.updateRedemptionBatch(redemptionBatchMatch[1], {
            status,
            reason: asAuditReason(body.reason, status === 'active' ? '恢复套餐码批次' : '暂停套餐码批次'),
          }, requireAdmin().id));
        }
        const planUpdateMatch = pathName.match(/^\/v1\/admin\/plans\/([^/]+)$/);
        if (request.method === 'PUT' && planUpdateMatch?.[1]) {
          const body = await parseJsonBody(request);
          const description = asNullableString(body.description, 'description', { min: 1, max: 300 });
          const priceLabel = asNullableString(body.priceLabel, 'priceLabel', { min: 1, max: 80 });
          const rawPurchaseUrl = asNullableString(body.purchaseUrl, 'purchaseUrl', { min: 8, max: 500 });
          const purchaseUrl = typeof rawPurchaseUrl === 'string'
            ? asHttpsUrl(rawPurchaseUrl, 'purchaseUrl')
            : rawPurchaseUrl;
          const externalSku = asNullableString(body.externalSku, 'externalSku', { min: 1, max: 120 });
          return jsonResponse(await service.updatePlan(planUpdateMatch[1], {
            ...(body.name === undefined ? {} : {
              name: asString(body.name, 'name', { min: 1, max: 80 }) as string,
            }),
            ...(description === undefined ? {} : { description }),
            ...(body.status === undefined ? {} : { status: asPlanStatus(body.status, 'status') }),
            ...(body.term === undefined ? {} : { term: asPlanTerm(body.term, 'term') }),
            ...(body.isPublic === undefined ? {} : { isPublic: asBoolean(body.isPublic, 'isPublic') }),
            ...(body.recommended === undefined ? {} : {
              recommended: asBoolean(body.recommended, 'recommended'),
            }),
            ...(priceLabel === undefined ? {} : { priceLabel }),
            ...(purchaseUrl === undefined ? {} : { purchaseUrl }),
            ...(externalSku === undefined ? {} : { externalSku }),
          }, requireAdmin().id));
        }
        if (request.method === 'PUT' && pathName === '/v1/admin/default-access') {
          const body = await parseJsonBody(request);
          const endsAt = asIsoDate(body.endsAt, 'endsAt');
          return jsonResponse(await service.updateDefaultAccess({
            planId: asString(body.planId, 'planId', { min: 1, max: 120 }) as string,
            status: asDefaultAccessStatus(body.status, 'status'),
            ...(body.endsAt === null ? { endsAt: null } : endsAt === undefined ? {} : { endsAt }),
            reason: asAuditReason(body.reason, '更新全局权益'),
          }, requireAdmin().id));
        }
        if (request.method === 'PUT' && pathName === '/v1/admin/new-device-default-access') {
          const body = await parseJsonBody(request);
          return jsonResponse(await service.updateNewDeviceDefaultAccess({
            planId: asString(body.planId, 'planId', { min: 1, max: 120 }) as string,
            status: asDefaultAccessStatus(body.status, 'status'),
            reason: asAuditReason(body.reason, '更新新设备默认权益'),
          }, requireAdmin().id));
        }
        const licenseProfileMatch = pathName.match(
          /^\/v1\/admin\/(?:authorized-devices|users|licenses)\/([^/]+)\/profile$/,
        );
        if (request.method === 'PUT' && licenseProfileMatch?.[1]) {
          const body = await parseJsonBody(request);
          const customerEmail = asNullableString(body.customerEmail, 'customerEmail', { min: 3, max: 200 });
          const customerNote = asNullableString(body.customerNote, 'customerNote', { min: 1, max: 500 });
          return jsonResponse(await service.updateLicenseProfile(licenseProfileMatch[1], {
            customerName: asString(body.customerName, 'customerName', { min: 1, max: 120 }) as string,
            ...(customerEmail === undefined ? {} : { customerEmail }),
            ...(customerNote === undefined ? {} : { customerNote }),
            ...(body.tags === undefined ? {} : { tags: asLicenseTags(body.tags) }),
            reason: asAuditReason(body.reason, '更新设备资料'),
          }, requireAdmin().id));
        }
        const licensePackagesMatch = pathName.match(
          /^\/v1\/admin\/(?:authorized-devices|users|licenses)\/([^/]+)\/packages$/,
        );
        if (request.method === 'POST' && licensePackagesMatch?.[1]) {
          const body = await parseJsonBody(request);
          return jsonResponse(await service.grantPackage(licensePackagesMatch[1], {
            planId: asString(body.planId, 'planId', { min: 1, max: 120 }) as string,
            source: asPackageGrantSource(body.source, 'source'),
            reason: asAuditReason(body.reason, '发放套餐包'),
          }, requireAdmin().id), 201);
        }
        const packageWithdrawMatch = pathName.match(
          /^\/v1\/admin\/(?:authorized-devices|users|licenses)\/([^/]+)\/packages\/([^/]+)\/withdraw$/,
        );
        if (request.method === 'POST' && packageWithdrawMatch?.[1] && packageWithdrawMatch[2]) {
          const body = await parseJsonBody(request);
          return jsonResponse(await service.withdrawPackage(
            packageWithdrawMatch[1],
            packageWithdrawMatch[2],
            asAuditReason(body.reason, '撤回套餐包'),
            requireAdmin().id,
          ));
        }
        const licenseStatusMatch = pathName.match(
          /^\/v1\/admin\/(?:authorized-devices|users|licenses)\/([^/]+)\/status$/,
        );
        if (request.method === 'POST' && licenseStatusMatch?.[1]) {
          const body = await parseJsonBody(request);
          return jsonResponse(await service.changeLicenseStatus(
            licenseStatusMatch[1],
            asLicenseStatus(body.status, 'status'),
            asAuditReason(body.reason, '更新授权设备状态'),
            requireAdmin().id,
          ));
        }
        const deviceRebindMatch = pathName.match(
          /^\/v1\/admin\/(?:authorized-devices|users)\/([^/]+)\/device$/,
        );
        if (request.method === 'PUT' && deviceRebindMatch?.[1]) {
          const body = await parseJsonBody(request);
          return jsonResponse(await service.rebindDevice(
            deviceRebindMatch[1],
            asString(body.machineFingerprint, 'machineFingerprint', { min: 64, max: 64 }) as string,
            asAuditReason(body.reason, '更换绑定设备'),
            requireAdmin().id,
          ));
        }
        const deviceStatusMatch = pathName.match(/^\/v1\/admin\/devices\/([^/]+)\/status$/);
        if (request.method === 'POST' && deviceStatusMatch?.[1]) {
          const body = await parseJsonBody(request);
          return jsonResponse(await service.changeDeviceStatus(
            deviceStatusMatch[1],
            asDeviceStatus(body.status, 'status'),
            asAuditReason(body.reason, '更新设备状态'),
            requireAdmin().id,
          ));
        }
        return errorResponse(404, 'NOT_FOUND', '接口不存在');
      } catch (error: unknown) {
        if (error instanceof ApiError || error instanceof ValidationError) {
          return errorResponse(error.statusCode, error.code, error.message);
        }
        console.error('[授权服务] 未处理的请求错误:', error);
        return errorResponse(500, 'INTERNAL_ERROR', '授权服务暂时不可用');
      }
    },
  };
}
