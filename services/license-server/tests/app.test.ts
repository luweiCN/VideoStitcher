import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import test from 'node:test';
import { createApplication } from '../src/app.js';
import {
  createEmptyDatabase,
  type DeviceActivityRecord,
  type LicenseDatabase,
} from '../src/domain.js';
import {
  StorageConflictError,
  type LicenseStorage,
  type VersionedDatabase,
  type VersionedDeviceActivity,
} from '../src/storage.js';

class MemoryStorage implements LicenseStorage {
  private database: LicenseDatabase = createEmptyDatabase();
  private readonly activities = new Map<string, DeviceActivityRecord>();
  private bootstrapMarker = false;

  public async read(): Promise<VersionedDatabase> {
    return { database: structuredClone(this.database), version: String(this.database.revision) };
  }

  public async write(database: LicenseDatabase, expectedVersion: string): Promise<string> {
    if (expectedVersion !== String(this.database.revision)) throw new StorageConflictError();
    this.database = { ...structuredClone(database), revision: this.database.revision + 1 };
    return String(this.database.revision);
  }

  public async readDeviceActivity(deviceId: string): Promise<VersionedDeviceActivity> {
    const activity = this.activities.get(deviceId);
    return activity === undefined
      ? { version: '0' }
      : { activity: structuredClone(activity), version: String(activity.revision) };
  }

  public async writeDeviceActivity(
    activity: DeviceActivityRecord,
    expectedVersion: string,
  ): Promise<string> {
    const current = this.activities.get(activity.deviceId);
    if (expectedVersion !== String(current?.revision ?? 0)) throw new StorageConflictError();
    const next = { ...structuredClone(activity), revision: (current?.revision ?? 0) + 1 };
    this.activities.set(activity.deviceId, next);
    return String(next.revision);
  }

  public async hasBootstrapMarker(): Promise<boolean> {
    return this.bootstrapMarker;
  }

  public async writeBootstrapMarker(): Promise<void> {
    this.bootstrapMarker = true;
  }

  public resetMainStateForTest(): void {
    this.database = createEmptyDatabase();
  }
}

const machineFingerprint = 'a'.repeat(64);
const deviceIdentity = generateKeyPairSync('ed25519');
const devicePublicKey = deviceIdentity.publicKey
  .export({ format: 'der', type: 'spki' })
  .toString('base64url');
const deviceRequestTimestamp = new Date('2026-07-17T08:00:00.000Z').getTime().toString();

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const source = value as Record<string, unknown>;
  return `{${Object.keys(source).sort().map((key) => (
    `${JSON.stringify(key)}:${stableStringify(source[key])}`
  )).join(',')}}`;
}

function createSignedDeviceRequest(
  route: string,
  body: Record<string, unknown>,
  token?: string,
  extraHeaders: Record<string, string> = {},
): Request {
  const bodyHash = createHash('sha256').update(stableStringify(body)).digest('hex');
  const tokenHash = createHash('sha256').update(token ?? '').digest('hex');
  const nonce = 'test-device-nonce-0001';
  const signingInput = [
    'VS-DEVICE-REQUEST-V1',
    'POST',
    route,
    deviceRequestTimestamp,
    nonce,
    bodyHash,
    tokenHash,
  ].join('\n');
  return new Request(`https://example.com${route}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-VS-Device-Public-Key': devicePublicKey,
      'X-VS-Request-Timestamp': deviceRequestTimestamp,
      'X-VS-Request-Nonce': nonce,
      'X-VS-Request-Signature': sign(null, Buffer.from(signingInput), deviceIdentity.privateKey).toString('base64url'),
      ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

function fixture() {
  const adminPassword = 'this-is-a-long-test-admin-token';
  const keyPair = generateKeyPairSync('ed25519');
  const privateKey = keyPair.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const storage = new MemoryStorage();
  const application = createApplication({
    adminTokenHash: createHash('sha256').update(adminPassword).digest('hex'),
    licenseKeyPepper: 'test-pepper-at-least-32-random-characters',
    signingPrivateKey: privateKey,
    storage: { driver: 'file', filePath: '/unused' },
  }, { storage, now: () => new Date('2026-07-17T08:00:00.000Z') });
  return { application, adminPassword, storage, privateKey };
}

async function loginAdmin(
  application: ReturnType<typeof createApplication>,
  username: string,
  password: string,
): Promise<string> {
  const response = await application.handle(new Request('https://example.com/v1/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  }));
  assert.equal(response.status, 200);
  const body = await response.json() as { data: { sessionToken: string } };
  return body.data.sessionToken;
}

interface ConnectedTestDevice {
  authorized: boolean;
  sessionToken: string;
  license: {
    id: string;
    billingCycle: string;
    expiresAt?: string;
    accessMode: string;
  };
}

async function connectTestDevice(
  application: ReturnType<typeof createApplication>,
  overrides: Partial<{
    installationId: string;
    machineFingerprint: string;
    deviceName: string;
    platform: string;
    arch: string;
    appVersion: string;
  }> = {},
): Promise<ConnectedTestDevice> {
  const response = await application.handle(createSignedDeviceRequest('/v1/devices/connect', {
      installationId: '018f5810-4f46-7c92-bb85-7c0695c39ea1',
      devicePublicKey,
      machineFingerprint,
      deviceName: '测试设备',
      platform: 'darwin',
      arch: 'arm64',
      appVersion: '0.10.7',
      ...overrides,
    }, undefined, { 'X-Real-IP': '127.0.0.1' }));
  assert.equal(response.status, 201);
  const body = await response.json() as { data: ConnectedTestDevice };
  return body.data;
}

test('后台入口不缓存且构建资源使用内容哈希', async () => {
  const { application } = fixture();
  const indexResponse = await application.handle(new Request('https://example.com/admin'));
  assert.equal(indexResponse.status, 200);
  assert.equal(indexResponse.headers.get('cache-control'), 'no-store');
  const html = await indexResponse.text();
  const assetPaths = [
    html.match(/src="(\/admin\/app-[^"]+\.js)"/)?.[1],
    html.match(/href="(\/admin\/styles-[^"]+\.css)"/)?.[1],
  ];
  assert.equal(assetPaths.every((assetPath) => typeof assetPath === 'string'), true);
  for (const assetPath of assetPaths) {
    const response = await application.handle(new Request(`https://example.com${assetPath}`));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  }
});

test('账号登录拒绝错误密码且不泄露内部信息', async () => {
  const { application } = fixture();
  const response = await application.handle(new Request('https://example.com/v1/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'owner', password: 'this-is-a-wrong-admin-password' }),
  }));
  assert.equal(response.status, 401);
  const body = await response.json() as { error: { code: string } };
  assert.equal(body.error.code, 'ADMIN_LOGIN_INVALID');
});

test('客户端伪造 X-Forwarded-For 不能绕过管理员登录限流', async () => {
  const { application } = fixture();
  for (let index = 0; index < 10; index += 1) {
    const response = await application.handle(new Request('https://example.com/v1/admin/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `203.0.113.${index + 1}`,
      },
      body: JSON.stringify({ username: 'owner', password: 'this-is-a-wrong-admin-password' }),
    }));
    assert.equal(response.status, 401);
  }

  const limited = await application.handle(new Request('https://example.com/v1/admin/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '198.51.100.200',
    },
    body: JSON.stringify({ username: 'owner', password: 'this-is-a-wrong-admin-password' }),
  }));
  assert.equal(limited.status, 429);
});

test('管理员状态丢失后不能再次使用初始化口令重建所有者', async () => {
  const { application, adminPassword, storage, privateKey } = fixture();
  await loginAdmin(application, 'owner', adminPassword);
  storage.resetMainStateForTest();

  const restartedApplication = createApplication({
    adminTokenHash: createHash('sha256').update(adminPassword).digest('hex'),
    licenseKeyPepper: 'test-pepper-at-least-32-random-characters',
    signingPrivateKey: privateKey,
    storage: { driver: 'file', filePath: '/unused' },
  }, { storage, now: () => new Date('2026-07-17T08:00:00.000Z') });
  const response = await restartedApplication.handle(new Request('https://example.com/v1/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'owner', password: adminPassword }),
  }));
  assert.equal(response.status, 503);
  const body = await response.json() as { error: { code: string } };
  assert.equal(body.error.code, 'ADMIN_BOOTSTRAP_DISABLED');
});

test('管理员主动退出后服务端立即撤销旧会话', async () => {
  const { application, adminPassword } = fixture();
  const token = await loginAdmin(application, 'owner', adminPassword);
  const headers = { Authorization: `Bearer ${token}` };
  const logout = await application.handle(new Request('https://example.com/v1/admin/auth/logout', {
    method: 'POST',
    headers,
  }));
  assert.equal(logout.status, 200);

  const oldSession = await application.handle(new Request('https://example.com/v1/admin/overview', {
    headers,
  }));
  assert.equal(oldSession.status, 401);
});

test('管理员可验证当前密码并修改自己的密码，改密后旧会话全部失效', async () => {
  const { application, adminPassword } = fixture();
  const oldToken = await loginAdmin(application, 'owner', adminPassword);
  const headers = { Authorization: `Bearer ${oldToken}`, 'Content-Type': 'application/json' };
  const newPassword = 'new-owner-password-2026';

  const wrongCurrentPassword = await application.handle(new Request(
    'https://example.com/v1/admin/auth/password',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        currentPassword: 'wrong-current-password-2026',
        newPassword,
      }),
    },
  ));
  assert.equal(wrongCurrentPassword.status, 401);
  const wrongPasswordBody = await wrongCurrentPassword.json() as { error: { code: string } };
  assert.equal(wrongPasswordBody.error.code, 'ADMIN_CURRENT_PASSWORD_INVALID');

  const sessionStillValid = await application.handle(new Request('https://example.com/v1/admin/overview', {
    headers,
  }));
  assert.equal(sessionStillValid.status, 200);

  const changed = await application.handle(new Request('https://example.com/v1/admin/auth/password', {
    method: 'POST',
    headers,
    body: JSON.stringify({ currentPassword: adminPassword, newPassword }),
  }));
  assert.equal(changed.status, 200);
  const changedBody = await changed.json() as { data: { changed: boolean } };
  assert.equal(changedBody.data.changed, true);

  const invalidatedSession = await application.handle(new Request('https://example.com/v1/admin/overview', {
    headers,
  }));
  assert.equal(invalidatedSession.status, 401);

  const oldPasswordLogin = await application.handle(new Request('https://example.com/v1/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'owner', password: adminPassword }),
  }));
  assert.equal(oldPasswordLogin.status, 401);

  const newToken = await loginAdmin(application, 'owner', newPassword);
  assert.ok(newToken.length > 100);
});

test('所有者可添加运营管理员，运营管理员不能管理账号，停用后旧会话立即失效', async () => {
  const { application, adminPassword } = fixture();
  const ownerToken = await loginAdmin(application, 'owner', adminPassword);
  const ownerHeaders = { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' };

  const createResponse = await application.handle(new Request('https://example.com/v1/admin/accounts', {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({
      username: 'operator.li',
      displayName: '运营小李',
      password: 'operator-password-2026',
      role: 'operator',
    }),
  }));
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json() as {
    data: { admin: { id: string; username: string; role: string; passwordHash?: string } };
  };
  assert.equal(created.data.admin.username, 'operator.li');
  assert.equal(created.data.admin.role, 'operator');
  assert.equal(created.data.admin.passwordHash, undefined);

  const operatorToken = await loginAdmin(application, 'operator.li', 'operator-password-2026');
  const operatorOverview = await application.handle(new Request('https://example.com/v1/admin/overview', {
    headers: { Authorization: `Bearer ${operatorToken}` },
  }));
  assert.equal(operatorOverview.status, 200);

  const operatorAccounts = await application.handle(new Request('https://example.com/v1/admin/accounts', {
    headers: { Authorization: `Bearer ${operatorToken}` },
  }));
  assert.equal(operatorAccounts.status, 403);
  const forbidden = await operatorAccounts.json() as { error: { code: string } };
  assert.equal(forbidden.error.code, 'ADMIN_OWNER_REQUIRED');

  const operatorCodeInventory = await application.handle(new Request(
    'https://example.com/v1/admin/redemption-batches/unknown/codes',
    { headers: { Authorization: `Bearer ${operatorToken}` } },
  ));
  assert.equal(operatorCodeInventory.status, 403);

  const operatorReleases = await application.handle(new Request('https://example.com/v1/admin/releases', {
    headers: { Authorization: `Bearer ${operatorToken}` },
  }));
  assert.equal(operatorReleases.status, 403);

  const disableResponse = await application.handle(new Request(
    `https://example.com/v1/admin/accounts/${created.data.admin.id}`,
    {
      method: 'PUT',
      headers: ownerHeaders,
      body: JSON.stringify({ status: 'disabled' }),
    },
  ));
  assert.equal(disableResponse.status, 200);

  const disabledSessionResponse = await application.handle(new Request('https://example.com/v1/admin/overview', {
    headers: { Authorization: `Bearer ${operatorToken}` },
  }));
  assert.equal(disabledSessionResponse.status, 401);

  const meResponse = await application.handle(new Request('https://example.com/v1/admin/auth/me', {
    headers: { Authorization: `Bearer ${ownerToken}` },
  }));
  const me = await meResponse.json() as { data: { admin: { id: string } } };
  const selfDisableResponse = await application.handle(new Request(
    `https://example.com/v1/admin/accounts/${me.data.admin.id}`,
    {
      method: 'PUT',
      headers: ownerHeaders,
      body: JSON.stringify({ status: 'disabled' }),
    },
  ));
  assert.equal(selfDisableResponse.status, 409);
});

test('后台不再支持按设备 ID 建档，设备只由客户端首次连接自动创建', async () => {
  const { application, adminPassword } = fixture();
  const adminToken = await loginAdmin(application, 'owner', adminPassword);
  const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
  const createdResponse = await application.handle(new Request('https://example.com/v1/admin/users', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      machineFingerprint,
      customerName: '测试客户',
      reason: '测试创建用户',
    }),
  }));
  assert.equal(createdResponse.status, 404);

  const connectResponse = await application.handle(createSignedDeviceRequest('/v1/devices/connect', {
      installationId: '018f5810-4f46-7c92-bb85-7c0695c39ea1',
      devicePublicKey,
      machineFingerprint,
      deviceName: '测试设备',
      platform: 'darwin',
      arch: 'arm64',
      appVersion: '0.10.7',
    }, undefined, { 'X-Real-IP': '127.0.0.1' }));
  assert.equal(connectResponse.status, 201);
  const connected = await connectResponse.json() as {
    data: { authorized: boolean; sessionToken: string; license: Record<string, unknown> };
  };
  assert.equal(connected.data.authorized, false);
  assert.ok(connected.data.sessionToken.length > 100);
  assert.equal('claimed' in connected.data.license, false);

  const overviewResponse = await application.handle(new Request('https://example.com/v1/admin/overview', {
    headers,
  }));
  const overview = await overviewResponse.json() as {
    data: { licenses: Array<Record<string, unknown>>; devices: unknown[] };
  };
  assert.equal(overview.data.licenses.length, 1);
  assert.equal(overview.data.devices.length, 1);
  assert.equal('claimed' in (overview.data.licenses[0] ?? {}), false);

  const removedActivationResponse = await application.handle(new Request(
    'https://example.com/v1/licenses/activate',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
  ));
  assert.equal(removedActivationResponse.status, 404);
});

test('管理员可以通过接口给用户追加套餐包', async () => {
  const { application, adminPassword } = fixture();
  const adminToken = await loginAdmin(application, 'owner', adminPassword);
  const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
  const overviewResponse = await application.handle(new Request('https://example.com/v1/admin/overview', {
    headers,
  }));
  const overview = await overviewResponse.json() as {
    data: { plans: Array<{ id: string; code: string }> };
  };
  const monthlyPlan = overview.data.plans.find((plan) => plan.code === 'monthly');
  const yearlyPlan = overview.data.plans.find((plan) => plan.code === 'yearly');
  assert.ok(monthlyPlan);
  assert.ok(yearlyPlan);
  const connected = await connectTestDevice(application, { deviceName: '订阅客户设备' });
  const monthlyResponse = await application.handle(new Request(
    `https://example.com/v1/admin/users/${connected.license.id}/packages`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        planId: monthlyPlan.id,
        source: 'paid',
        reason: '用户购买月度套餐',
      }),
    },
  ));
  assert.equal(monthlyResponse.status, 201);
  const monthly = await monthlyResponse.json() as {
    data: { packageGrant: { status: string; startsAt?: string; expiresAt?: string } };
  };
  assert.equal(monthly.data.packageGrant.status, 'active');
  assert.equal(monthly.data.packageGrant.startsAt, '2026-07-17T08:00:00.000Z');
  assert.equal(monthly.data.packageGrant.expiresAt, '2026-08-17T08:00:00.000Z');

  const grantedResponse = await application.handle(new Request(
    `https://example.com/v1/admin/users/${connected.license.id}/packages`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        planId: yearlyPlan.id,
        source: 'paid',
        reason: '用户购买年度套餐',
      }),
    },
  ));
  assert.equal(grantedResponse.status, 201);
  const granted = await grantedResponse.json() as {
    data: { packageGrant: { status: string; startsAt?: string; expiresAt?: string } };
  };
  assert.equal(granted.data.packageGrant.status, 'queued');
  assert.equal(granted.data.packageGrant.startsAt, '2026-08-17T08:00:00.000Z');
  assert.equal(granted.data.packageGrant.expiresAt, '2027-08-17T08:00:00.000Z');
});

test('管理员生成套餐码后，客户端可查看套餐中心并完成一次性兑换', async () => {
  const { application, adminPassword } = fixture();
  const adminToken = await loginAdmin(application, 'owner', adminPassword);
  const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
  const overviewResponse = await application.handle(new Request('https://example.com/v1/admin/overview', {
    headers: adminHeaders,
  }));
  const overview = await overviewResponse.json() as {
    data: { plans: Array<{ id: string; code: string }> };
  };
  const monthlyPlan = overview.data.plans.find((plan) => plan.code === 'monthly');
  assert.ok(monthlyPlan);

  const batchResponse = await application.handle(new Request('https://example.com/v1/admin/redemption-batches', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: '接口测试月度码',
      planId: monthlyPlan.id,
      quantity: 2,
      source: 'paid',
      salesChannel: '数码荔枝',
    }),
  }));
  assert.equal(batchResponse.status, 201);
  const batch = await batchResponse.json() as {
    data: { batch: { id: string; availableCount: number; reason: string }; codes: string[] };
  };
  assert.equal(batch.data.batch.availableCount, 2);
  assert.equal(batch.data.batch.reason, '生成套餐码批次');
  assert.equal(batch.data.codes.length, 2);

  const inventoryResponse = await application.handle(new Request(
    `https://example.com/v1/admin/redemption-batches/${batch.data.batch.id}/codes`,
    { headers: adminHeaders },
  ));
  assert.equal(inventoryResponse.status, 200);
  const inventory = await inventoryResponse.json() as {
    data: { codes: Array<{ code?: string; status: string }> };
  };
  assert.deepEqual(inventory.data.codes.map((item) => item.code), batch.data.codes);
  assert.ok(inventory.data.codes.every((item) => item.status === 'available'));

  const connectResponse = await application.handle(createSignedDeviceRequest('/v1/devices/connect', {
      installationId: '018f5810-4f46-7c92-bb85-7c0695c39ea1',
      devicePublicKey,
      machineFingerprint,
      deviceName: '套餐码测试设备',
      platform: 'darwin',
      arch: 'arm64',
      appVersion: '0.10.7',
    }, undefined, { 'X-Real-IP': '127.0.0.1' }));
  const connected = await connectResponse.json() as {
    data: { sessionToken: string; license: { customerName: string } };
  };
  assert.equal(connected.data.license.customerName, '套餐码测试设备');
  const centerResponse = await application.handle(createSignedDeviceRequest(
    '/v1/packages/center',
    {},
    connected.data.sessionToken,
  ));
  assert.equal(centerResponse.status, 200);
  const center = await centerResponse.json() as {
    data: { packageCenter: { deviceLabel: string; packages: unknown[] } };
  };
  assert.equal('registered' in center.data.packageCenter, false);
  assert.equal(center.data.packageCenter.deviceLabel, '套餐码测试设备');
  assert.equal(center.data.packageCenter.packages.length, 0);

  const redeemResponse = await application.handle(createSignedDeviceRequest(
    '/v1/packages/redeem',
    { code: batch.data.codes[0] },
    connected.data.sessionToken,
  ));
  assert.equal(redeemResponse.status, 200);
  const redeemed = await redeemResponse.json() as {
    data: {
      alreadyRedeemed: boolean;
      packageCenter: { packages: Array<{ source: string; status: string }> };
    };
  };
  assert.equal(redeemed.data.alreadyRedeemed, false);
  assert.equal('registered' in redeemed.data.packageCenter, false);
  assert.equal(redeemed.data.packageCenter.packages[0]?.source, 'paid');
  assert.equal(redeemed.data.packageCenter.packages[0]?.status, 'active');

  const repeatResponse = await application.handle(createSignedDeviceRequest(
    '/v1/packages/redeem',
    { code: batch.data.codes[0] },
    connected.data.sessionToken,
  ));
  const repeated = await repeatResponse.json() as { data: { alreadyRedeemed: boolean } };
  assert.equal(repeated.data.alreadyRedeemed, true);
});

test('管理员可分别配置全局权益和新设备默认权益，并撤回发错的套餐包', async () => {
  const { application, adminPassword } = fixture();
  const adminToken = await loginAdmin(application, 'owner', adminPassword);
  const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
  const overviewResponse = await application.handle(new Request('https://example.com/v1/admin/overview', { headers }));
  const overview = await overviewResponse.json() as {
    data: { plans: Array<{ id: string; code: string }> };
  };
  const monthlyPlan = overview.data.plans.find((plan) => plan.code === 'monthly');
  const yearlyPlan = overview.data.plans.find((plan) => plan.code === 'yearly');
  assert.ok(monthlyPlan);
  assert.ok(yearlyPlan);

  const defaultResponse = await application.handle(new Request('https://example.com/v1/admin/default-access', {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      planId: monthlyPlan.id,
      status: 'active',
      endsAt: null,
      reason: '当前阶段全员免费使用',
    }),
  }));
  assert.equal(defaultResponse.status, 200);

  const newDeviceDefaultResponse = await application.handle(new Request(
    'https://example.com/v1/admin/new-device-default-access',
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        planId: monthlyPlan.id,
        status: 'active',
        reason: '新设备首次接入自动发放',
      }),
    },
  ));
  assert.equal(newDeviceDefaultResponse.status, 200);
  const newDeviceDefault = await newDeviceDefaultResponse.json() as {
    data: { newDeviceDefaultAccess: { planId: string; effective: boolean } };
  };
  assert.equal(newDeviceDefault.data.newDeviceDefaultAccess.planId, monthlyPlan.id);
  assert.equal(newDeviceDefault.data.newDeviceDefaultAccess.effective, true);

  const connected = await connectTestDevice(application, { deviceName: '默认权益设备' });
  assert.equal(connected.license.accessMode, 'default');

  const grantResponse = await application.handle(new Request(
    `https://example.com/v1/admin/users/${connected.license.id}/packages`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        planId: yearlyPlan.id,
        source: 'complimentary',
        reason: '误发年度套餐',
      }),
    },
  ));
  assert.equal(grantResponse.status, 201);
  const grant = await grantResponse.json() as { data: { packageGrant: { id: string; status: string } } };
  assert.equal(grant.data.packageGrant.status, 'queued');

  const withdrawResponse = await application.handle(new Request(
    `https://example.com/v1/admin/users/${connected.license.id}/packages/${grant.data.packageGrant.id}/withdraw`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason: '核实为误发套餐' }),
    },
  ));
  assert.equal(withdrawResponse.status, 200);
  const withdrawn = await withdrawResponse.json() as {
    data: { packageGrant: { status: string; withdrawalReason: string } };
  };
  assert.equal(withdrawn.data.packageGrant.status, 'withdrawn');
  assert.equal(withdrawn.data.packageGrant.withdrawalReason, '核实为误发套餐');
});

test('套餐管理、权益调整和公共套餐读取形成完整接口', async () => {
  const { application, adminPassword } = fixture();
  const adminToken = await loginAdmin(application, 'owner', adminPassword);
  const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
  const planResponse = await application.handle(new Request('https://example.com/v1/admin/plans', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      code: 'public-45d',
      name: '45 天体验包',
      description: '适合社群用户',
      term: { unit: 'day', value: 45 },
      isPublic: true,
      priceLabel: '免费领取',
      purchaseUrl: 'https://lizhi.shop/example',
      externalSku: 'lizhi-sku-45d',
    }),
  }));
  assert.equal(planResponse.status, 201);
  const planBody = await planResponse.json() as { data: { plan: { id: string } } };

  const updatePlanResponse = await application.handle(new Request(
    `https://example.com/v1/admin/plans/${planBody.data.plan.id}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        name: '社群 45 天体验包',
        recommended: true,
      }),
    },
  ));
  assert.equal(updatePlanResponse.status, 200);
  const updatedPlanBody = await updatePlanResponse.json() as {
    data: { plan: { name: string; defaultMaxDevices: number; recommended: boolean } };
  };
  assert.equal(updatedPlanBody.data.plan.name, '社群 45 天体验包');
  assert.equal(updatedPlanBody.data.plan.defaultMaxDevices, 1);
  assert.equal(updatedPlanBody.data.plan.recommended, true);

  const publicResponse = await application.handle(new Request('https://example.com/v1/plans'));
  assert.equal(publicResponse.status, 200);
  const publicBody = await publicResponse.json() as { data: { plans: Array<{ code: string }> } };
  assert.deepEqual(publicBody.data.plans.map((plan) => plan.code), ['public-45d']);

  const connected = await connectTestDevice(application, { deviceName: '社群设备' });
  const grantResponse = await application.handle(new Request(
    `https://example.com/v1/admin/users/${connected.license.id}/packages`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        planId: planBody.data.plan.id,
        source: 'complimentary',
        reason: '发放社群体验套餐',
      }),
    },
  ));
  assert.equal(grantResponse.status, 201);

  const profileResponse = await application.handle(new Request(
    `https://example.com/v1/admin/users/${connected.license.id}/profile`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        customerName: '社群正式用户',
        customerEmail: 'community@example.com',
        reason: '补充用户基础资料',
      }),
    },
  ));
  assert.equal(profileResponse.status, 200);
  const updated = await profileResponse.json() as {
    data: { license: { customerName: string; customerEmail: string } };
  };
  assert.equal(updated.data.license.customerName, '社群正式用户');
  assert.equal(updated.data.license.customerEmail, 'community@example.com');
});

test('客户端首次连接只登记设备且没有默认套餐时保持未授权', async () => {
  const { application } = fixture();
  const connectRequest = () => createSignedDeviceRequest('/v1/devices/connect', {
      installationId: '018f5810-4f46-7c92-bb85-7c0695c39ea1',
      devicePublicKey,
      machineFingerprint,
      deviceName: '测试设备',
      platform: 'darwin',
      arch: 'arm64',
      appVersion: '0.10.7',
    }, undefined, { 'X-Real-IP': '127.0.0.1' });
  const response = await application.handle(connectRequest());
  assert.equal(response.status, 201);
  const body = await response.json() as {
    data: { authorized: boolean; license: { accessMode: string; accessSource: string; expiresAt?: string } };
  };
  assert.equal(body.data.authorized, false);
  assert.equal(body.data.license.accessMode, 'none');
  assert.equal(body.data.license.accessSource, 'none');
  assert.equal(body.data.license.expiresAt, undefined);
});

test('设备会话令牌离开本机私钥后不能调用套餐接口', async () => {
  const { application } = fixture();
  const connected = await connectTestDevice(application);
  const response = await application.handle(new Request('https://example.com/v1/packages/center', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${connected.sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  }));
  assert.equal(response.status, 401);
  const body = await response.json() as { error: { code: string } };
  assert.equal(body.error.code, 'DEVICE_PROOF_REQUIRED');
});

test('管理员可通过接口预览、执行和撤回批量套餐发放', async () => {
  const { application, adminPassword } = fixture();
  const adminToken = await loginAdmin(application, 'owner', adminPassword);
  const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
  const overviewResponse = await application.handle(new Request('https://example.com/v1/admin/overview', { headers }));
  const overview = await overviewResponse.json() as {
    data: { plans: Array<{ id: string; code: string }> };
  };
  const quarterlyPlan = overview.data.plans.find((plan) => plan.code === 'quarterly');
  assert.ok(quarterlyPlan);

  const connected = await connectTestDevice(application, { deviceName: '批量接口测试设备' });
  const licenseId = connected.license.id;
  const profileResponse = await application.handle(new Request(
    `https://example.com/v1/admin/users/${licenseId}/profile`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        customerName: '批量接口测试设备',
        tags: ['QQ 群', '接口测试'],
        reason: '设置筛选标签',
      }),
    },
  ));
  assert.equal(profileResponse.status, 200);

  const requestBody = {
    operationKey: 'app-batch-operation-2026',
    selection: {
      mode: 'filter',
      filter: { tags: ['QQ 群'], tagMatch: 'all' },
    },
    planId: quarterlyPlan.id,
    source: 'complimentary',
    duplicatePolicy: 'append',
    reason: '通过接口批量赠送季度套餐',
  };
  const previewResponse = await application.handle(new Request(
    'https://example.com/v1/admin/package-grant-batches/preview',
    { method: 'POST', headers, body: JSON.stringify(requestBody) },
  ));
  assert.equal(previewResponse.status, 200);
  const preview = await previewResponse.json() as { data: { matchedCount: number; grantCount: number } };
  assert.equal(preview.data.matchedCount, 1);
  assert.equal(preview.data.grantCount, 1);

  const grantResponse = await application.handle(new Request(
    'https://example.com/v1/admin/package-grant-batches',
    { method: 'POST', headers, body: JSON.stringify(requestBody) },
  ));
  assert.equal(grantResponse.status, 201);
  const granted = await grantResponse.json() as {
    data: { alreadyApplied: boolean; batch: { id: string; grantedCount: number } };
  };
  assert.equal(granted.data.alreadyApplied, false);
  assert.equal(granted.data.batch.grantedCount, 1);

  const repeatedResponse = await application.handle(new Request(
    'https://example.com/v1/admin/package-grant-batches',
    { method: 'POST', headers, body: JSON.stringify(requestBody) },
  ));
  const repeated = await repeatedResponse.json() as { data: { alreadyApplied: boolean } };
  assert.equal(repeated.data.alreadyApplied, true);

  const withdrawResponse = await application.handle(new Request(
    `https://example.com/v1/admin/package-grant-batches/${granted.data.batch.id}/withdraw`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason: '接口测试整批撤回' }),
    },
  ));
  assert.equal(withdrawResponse.status, 200);
  const withdrawn = await withdrawResponse.json() as { data: { withdrawnCount: number } };
  assert.equal(withdrawn.data.withdrawnCount, 1);
});
