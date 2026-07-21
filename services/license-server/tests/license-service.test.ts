import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import {
  assertLicenseDatabaseIntegrity,
  createEmptyDatabase,
  migrateLicenseDatabase,
  type DeviceActivityRecord,
  type LicenseDatabase,
} from '../src/domain.js';
import { LicenseService } from '../src/service.js';
import {
  StorageConflictError,
  type LicenseStorage,
  type VersionedDatabase,
  type VersionedDeviceActivity,
} from '../src/storage.js';
import { getPublicKeyPem } from '../src/token.js';

class MemoryStorage implements LicenseStorage {
  public database: LicenseDatabase = createEmptyDatabase();
  public readonly activities = new Map<string, DeviceActivityRecord>();

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

  public async writeDeviceActivity(activity: DeviceActivityRecord, expectedVersion: string): Promise<string> {
    const current = this.activities.get(activity.deviceId);
    if (expectedVersion !== String(current?.revision ?? 0)) throw new StorageConflictError();
    const next = { ...structuredClone(activity), revision: (current?.revision ?? 0) + 1 };
    this.activities.set(activity.deviceId, next);
    return String(next.revision);
  }
}

function createFixture() {
  const keyPair = generateKeyPairSync('ed25519');
  const privateKey = keyPair.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const storage = new MemoryStorage();
  let currentTime = new Date('2026-07-17T08:00:00.000Z');
  const service = new LicenseService({
    storage,
    licenseKeyPepper: 'test-pepper-at-least-32-random-characters',
    signingPrivateKey: privateKey,
    signingPublicKey: getPublicKeyPem(privateKey),
    now: () => currentTime,
  });
  return {
    service,
    storage,
    setTime(value: string) {
      currentTime = new Date(value);
    },
  };
}

const machineFingerprint = 'a'.repeat(64);
const secondMachineFingerprint = 'b'.repeat(64);
const deviceIdentity = generateKeyPairSync('ed25519');
const devicePublicKey = deviceIdentity.publicKey
  .export({ format: 'der', type: 'spki' })
  .toString('base64url');
const deviceInput = {
  installationId: '018f5810-4f46-7c92-bb85-7c0695c39ea1',
  devicePublicKey,
  machineFingerprint,
  deviceName: '测试工作站',
  platform: 'win32',
  arch: 'x64',
  appVersion: '0.10.7',
};

test('客户端首次连接只登记设备，不自动创建固定天数试用', async () => {
  const fixture = createFixture();
  const session = await fixture.service.connectDevice(deviceInput, '127.0.0.1');
  const license = session.license as { accessMode: string; accessSource: string; expiresAt?: string };

  assert.equal(session.authorized, false);
  assert.equal(license.accessMode, 'none');
  assert.equal(license.accessSource, 'none');
  assert.equal(license.expiresAt, undefined);
  assert.equal(session.offlineGraceSeconds, 14 * 24 * 60 * 60);
  assert.equal(fixture.storage.database.licenses.length, 1);
  assert.equal(fixture.storage.database.devices.length, 1);
  assert.equal(fixture.storage.database.licenses[0]?.deviceCredentialLockedAt, undefined);
  assert.equal('claimed' in license, false);
  assert.equal(fixture.storage.database.devices[0]?.machineFingerprintHint, 'aaaaaaaa');
  assert.equal(fixture.storage.database.devices[0]?.installationId, undefined);
});

test('同一机器 ID 更换设备私钥后不能静默接管原授权', async () => {
  const fixture = createFixture();
  await fixture.service.connectDevice(deviceInput, '127.0.0.1');
  const replacementIdentity = generateKeyPairSync('ed25519');
  const replacementPublicKey = replacementIdentity.publicKey
    .export({ format: 'der', type: 'spki' })
    .toString('base64url');

  await assert.rejects(
    fixture.service.connectDevice({
      ...deviceInput,
      installationId: 'replacement-installation-id-000001',
      devicePublicKey: replacementPublicKey,
    }, '127.0.0.2'),
    /设备密钥已变化/,
  );
});

test('旧版 GitHub 授权支持预览、幂等导入和首次透明绑定', async () => {
  const fixture = createFixture();
  const legacyMachineId = 'f'.repeat(64);
  const source = {
    version: '1.0',
    updatedAt: '2026-07-01T00:00:00.000Z',
    specialKeys: [{ key: 'obsolete-master-key', enabled: true }],
    licenses: [
      { machineId: legacyMachineId, user: '历史用户甲', enabled: true },
      { machineId: 'e'.repeat(64), user: '历史用户乙', enabled: false },
    ],
  };
  const preview = await fixture.service.previewLegacyGithubImport(source, 'admin-owner') as {
    migration: { dryRun: boolean; importedCount: number; ignoredSpecialKeyCount: number };
  };
  assert.equal(preview.migration.dryRun, true);
  assert.equal(preview.migration.importedCount, 2);
  assert.equal(preview.migration.ignoredSpecialKeyCount, 1);
  assert.equal(fixture.storage.database.licenses.length, 0);

  const applied = await fixture.service.applyLegacyGithubImport(source, 'admin-owner') as {
    migration: { importedCount: number; skippedCount: number };
  };
  assert.equal(applied.migration.importedCount, 2);
  assert.equal(fixture.storage.database.licenses.length, 2);
  assert.equal(fixture.storage.database.licenses.find((license) => license.customerName === '历史用户乙')?.status, 'suspended');

  const repeated = await fixture.service.applyLegacyGithubImport(source, 'admin-owner') as {
    migration: { importedCount: number; skippedCount: number };
  };
  assert.equal(repeated.migration.importedCount, 0);
  assert.equal(repeated.migration.skippedCount, 2);
  assert.equal(fixture.storage.database.licenses.length, 2);

  const connected = await fixture.service.connectDevice({
    ...deviceInput,
    machineFingerprint: legacyMachineId,
    deviceName: '历史用户甲的新客户端',
  }, '127.0.0.3');
  assert.equal(connected.authorized, true);
  assert.equal((connected.license as { accessSource: string }).accessSource, 'legacy');
});

test('已发放设备套餐的隐藏凭据变化后需要管理员执行设备更换', async () => {
  const fixture = createFixture();
  const monthlyPlan = fixture.storage.database.plans.find((plan) => plan.code === 'monthly');
  assert.ok(monthlyPlan);
  const connected = await fixture.service.connectDevice(deviceInput, '127.0.0.1');
  const licenseId = (connected.license as { id: string }).id;
  await fixture.service.grantPackage(licenseId, {
    planId: monthlyPlan.id,
    source: 'complimentary',
    reason: '发放社群月度套餐',
  });

  await assert.rejects(
    fixture.service.connectDevice({ ...deviceInput, installationId: 'new-installation-id-000000000001' }, '127.0.0.2'),
    /设备凭据已变化/,
  );

  await fixture.service.rebindDevice(licenseId, machineFingerprint, '用户重装系统后重新绑定');
  const reconnected = await fixture.service.connectDevice({
    ...deviceInput,
    installationId: 'new-installation-id-000000000001',
  }, '127.0.0.2');
  assert.equal(reconnected.authorized, true);
  assert.equal(fixture.storage.database.devices.length, 1);
});

test('更换绑定设备后，旧设备不能重新创建设备档案', async () => {
  const fixture = createFixture();
  const monthlyPlan = fixture.storage.database.plans.find((plan) => plan.code === 'monthly');
  assert.ok(monthlyPlan);
  const connected = await fixture.service.connectDevice(deviceInput, '127.0.0.1');
  const licenseId = (connected.license as { id: string }).id;
  await fixture.service.grantPackage(licenseId, {
    planId: monthlyPlan.id,
    source: 'complimentary',
    reason: '发放正式套餐',
  });
  await fixture.service.rebindDevice(
    licenseId,
    secondMachineFingerprint,
    '用户更换电脑',
  );

  await assert.rejects(
    fixture.service.connectDevice(deviceInput, '127.0.0.1'),
    /不能自动创建新的设备档案/,
  );
  assert.equal(fixture.storage.database.licenses.length, 1);
  assert.equal(fixture.storage.database.devices.length, 1);
});

test('同一设备 ID 不能属于两份授权档案', async () => {
  const fixture = createFixture();
  const first = await fixture.service.connectDevice(deviceInput, '127.0.0.1');
  const second = await fixture.service.connectDevice({
    ...deviceInput,
    installationId: 'second-device-installation-00000001',
    machineFingerprint: secondMachineFingerprint,
  }, '127.0.0.2');
  await assert.rejects(
    fixture.service.rebindDevice(
      (second.license as { id: string }).id,
      machineFingerprint,
      '尝试绑定已占用设备',
    ),
    /已属于其他授权档案/,
  );
  assert.notEqual((first.license as { id: string }).id, (second.license as { id: string }).id);
});

test('心跳写入独立活动 JSON，不改写主业务状态', async () => {
  const fixture = createFixture();
  const session = await fixture.service.connectDevice(deviceInput, '127.0.0.1');
  const stateRevision = fixture.storage.database.revision;
  fixture.setTime('2026-07-17T08:05:00.000Z');
  await fixture.service.heartbeat(
    String(session.sessionToken),
    { appVersion: '0.10.8', active: true },
    '127.0.0.2',
  );

  assert.equal(fixture.storage.database.revision, stateRevision);
  const overview = await fixture.service.listAdminOverview();
  assert.equal(overview.devices[0]?.online, true);
  assert.equal(overview.devices[0]?.appVersion, '0.10.8');
  assert.equal(overview.devices[0]?.lastActivityAt, '2026-07-17T08:05:00.000Z');
  assert.equal(overview.devices[0]?.todayLaunchCount, 1);
  assert.equal(overview.devices[0]?.todayForegroundSeconds, 300);
  assert.equal(overview.metrics.todayForegroundSeconds, 300);
});

test('异常使用计数不会让后台汇总出现 NaN', async () => {
  const fixture = createFixture();
  await fixture.service.connectDevice(deviceInput, '127.0.0.1');
  const activity = [...fixture.storage.activities.values()][0];
  assert.ok(activity);
  const today = activity.dailyUsage[0];
  assert.ok(today);
  today.foregroundSeconds = Number.NaN;
  today.launchCount = Number.POSITIVE_INFINITY;

  const overview = await fixture.service.listAdminOverview();
  assert.equal(overview.devices[0]?.todayForegroundSeconds, 0);
  assert.equal(overview.devices[0]?.todayLaunchCount, 0);
  assert.equal(overview.metrics.todayForegroundSeconds, 0);
});

test('管理员暂停授权设备后旧会话立即失效，恢复后设备可重新连接', async () => {
  const fixture = createFixture();
  const monthlyPlan = fixture.storage.database.plans.find((plan) => plan.code === 'monthly');
  assert.ok(monthlyPlan);
  const session = await fixture.service.connectDevice(deviceInput, '127.0.0.1');
  const licenseId = (session.license as { id: string }).id;
  await fixture.service.grantPackage(licenseId, {
    planId: monthlyPlan.id,
    source: 'complimentary',
    reason: '开通测试套餐',
  });

  await fixture.service.changeLicenseStatus(licenseId, 'suspended', '测试暂停');
  await assert.rejects(
    fixture.service.heartbeat(String(session.sessionToken), { appVersion: '0.10.7', active: false }, '127.0.0.1'),
    /授权当前状态为 suspended/,
  );
  await fixture.service.changeLicenseStatus(licenseId, 'active', '测试恢复');
  assert.equal((await fixture.service.connectDevice(deviceInput, '127.0.0.1')).authorized, true);
});

test('月度套餐结束后自动切换到排队中的年度套餐', async () => {
  const fixture = createFixture();
  const monthlyPlan = fixture.storage.database.plans.find((plan) => plan.code === 'monthly');
  const yearlyPlan = fixture.storage.database.plans.find((plan) => plan.code === 'yearly');
  assert.ok(monthlyPlan);
  assert.ok(yearlyPlan);
  const connected = await fixture.service.connectDevice(deviceInput, '127.0.0.1');
  const licenseId = (connected.license as { id: string }).id;
  await fixture.service.grantPackage(licenseId, {
    planId: monthlyPlan.id,
    source: 'paid',
    reason: '购买月度套餐',
  });
  const granted = await fixture.service.grantPackage(licenseId, {
    planId: yearlyPlan.id,
    source: 'paid',
    reason: '从月度升级为年度套餐',
  });
  const queued = granted.packageGrant as { status: string; startsAt?: string; expiresAt?: string };
  assert.equal(queued.status, 'queued');
  assert.equal(queued.startsAt, '2026-08-17T08:00:00.000Z');
  assert.equal(queued.expiresAt, '2027-08-17T08:00:00.000Z');

  fixture.setTime('2026-08-17T08:00:00.000Z');
  const overview = await fixture.service.listAdminOverview();
  assert.equal(overview.licenses[0]?.plan, '年度套餐');
  assert.deepEqual(overview.licenses[0]?.packages.map((item) => item.status), ['completed', 'active']);
});

test('发错的当前套餐可撤回，下一份套餐立即接续并保留记录', async () => {
  const fixture = createFixture();
  const monthlyPlan = fixture.storage.database.plans.find((plan) => plan.code === 'monthly');
  const yearlyPlan = fixture.storage.database.plans.find((plan) => plan.code === 'yearly');
  assert.ok(monthlyPlan);
  assert.ok(yearlyPlan);
  const connected = await fixture.service.connectDevice(deviceInput, '127.0.0.1');
  const licenseId = (connected.license as { id: string }).id;
  await fixture.service.grantPackage(licenseId, {
    planId: monthlyPlan.id,
    source: 'complimentary',
    reason: '误发月度套餐',
  });
  const currentPackageId = fixture.storage.database.packageGrants[0]?.id;
  assert.ok(currentPackageId);
  await fixture.service.grantPackage(licenseId, {
    planId: yearlyPlan.id,
    source: 'complimentary',
    reason: '补发年度套餐',
  });

  const withdrawn = await fixture.service.withdrawPackage(licenseId, currentPackageId, '月度套餐发放错误');
  const license = withdrawn.license as { plan: string; packages: Array<{ status: string }> };
  assert.equal(license.plan, '年度套餐');
  assert.deepEqual(license.packages.map((item) => item.status), ['withdrawn', 'active']);
  assert.equal(fixture.storage.database.packageGrants[0]?.withdrawalReason, '月度套餐发放错误');
});

test('全局权益同时覆盖新设备和已有设备', async () => {
  const fixture = createFixture();
  const existingDevice = await fixture.service.connectDevice(deviceInput, '127.0.0.1');
  const freePlan = (await fixture.service.createPlan({
    code: 'community-default',
    name: '社群默认免费包',
    term: { unit: 'day', value: 30 },
    isPublic: false,
  })).plan as { id: string };
  await fixture.service.updateDefaultAccess({
    planId: freePlan.id,
    status: 'active',
    endsAt: null,
    reason: '当前阶段所有设备免费使用',
  });

  const overview = await fixture.service.listAdminOverview();
  const existingLicenseId = (existingDevice.license as { id: string }).id;
  assert.equal(
    overview.licenses.find((license) => license.id === existingLicenseId)?.accessMode,
    'default',
  );

  const newDevice = await fixture.service.connectDevice({
    ...deviceInput,
    machineFingerprint: secondMachineFingerprint,
  }, '127.0.0.2');
  const newDeviceLicense = newDevice.license as {
    accessMode: string;
    accessSource: string;
    expiresAt?: string;
  };
  assert.equal(newDeviceLicense.accessMode, 'default');
  assert.equal(newDeviceLicense.accessSource, 'complimentary');
  assert.equal(newDeviceLicense.expiresAt, undefined);

  await fixture.service.connectDevice({
    ...deviceInput,
    installationId: 'global-access-reinstalled-device-01',
    machineFingerprint: secondMachineFingerprint,
  }, '127.0.0.3');
  assert.equal(fixture.storage.database.licenses.length, 2);
});

test('全局权益会暂停已经生效的付费套餐并在关闭后续用剩余时长', async () => {
  const fixture = createFixture();
  const connected = await fixture.service.connectDevice(deviceInput, '127.0.0.1');
  const licenseId = (connected.license as { id: string }).id;
  const monthlyPlan = fixture.storage.database.plans.find((plan) => plan.code === 'monthly');
  assert.ok(monthlyPlan);

  fixture.setTime('2026-07-25T08:00:00.000Z');
  await fixture.service.grantPackage(licenseId, {
    planId: monthlyPlan.id,
    source: 'paid',
    reason: '购买月度套餐',
  });
  assert.equal(fixture.storage.database.packageGrants[0]?.expiresAt, '2026-08-25T08:00:00.000Z');

  const freePlan = (await fixture.service.createPlan({
    code: 'summer-global-access',
    name: '暑期全局权益',
    term: { unit: 'day', value: 30 },
    isPublic: false,
  })).plan as { id: string };
  fixture.setTime('2026-08-01T08:00:00.000Z');
  await fixture.service.updateDefaultAccess({
    planId: freePlan.id,
    status: 'active',
    endsAt: '2026-09-01T08:00:00.000Z',
    reason: '开启暑期全局权益',
  });
  const pausedGrant = fixture.storage.database.packageGrants[0];
  assert.equal(pausedGrant?.waitsForDefault, true);
  assert.equal(pausedGrant?.startsAt, '2026-09-01T08:00:00.000Z');
  assert.equal(pausedGrant?.expiresAt, '2026-09-25T08:00:00.000Z');
  assert.equal((await fixture.service.listAdminOverview()).licenses[0]?.accessMode, 'default');

  fixture.setTime('2026-08-10T08:00:00.000Z');
  await fixture.service.updateDefaultAccess({
    planId: freePlan.id,
    status: 'disabled',
    endsAt: null,
    reason: '提前结束暑期全局权益',
  });
  const resumedGrant = fixture.storage.database.packageGrants[0];
  assert.equal(resumedGrant?.waitsForDefault, false);
  assert.equal(resumedGrant?.startsAt, '2026-08-10T08:00:00.000Z');
  assert.equal(resumedGrant?.expiresAt, '2026-09-03T08:00:00.000Z');
  assert.equal((await fixture.service.listAdminOverview()).licenses[0]?.accessMode, 'package');
});

test('新设备默认权益只在首次接入时自动发放一次，并等待全局权益结束', async () => {
  const fixture = createFixture();
  await fixture.service.connectDevice(deviceInput, '127.0.0.1');
  const starterPlan = (await fixture.service.createPlan({
    code: 'new-device-starter',
    name: '新设备 30 天体验包',
    term: { unit: 'day', value: 30 },
    isPublic: false,
  })).plan as { id: string };
  await fixture.service.updateDefaultAccess({
    planId: starterPlan.id,
    status: 'active',
    endsAt: '2026-07-20T08:00:00.000Z',
    reason: '当前阶段全局免费开放',
  });
  await fixture.service.updateNewDeviceDefaultAccess({
    planId: starterPlan.id,
    status: 'active',
    reason: '新设备首次接入自动赠送',
  });

  await fixture.service.connectDevice(deviceInput, '127.0.0.1');
  assert.equal(fixture.storage.database.packageGrants.length, 0);

  const newSession = await fixture.service.connectDevice({
    ...deviceInput,
    installationId: 'second-device-installation-00000001',
    machineFingerprint: secondMachineFingerprint,
  }, '127.0.0.2');
  const newLicense = newSession.license as {
    accessMode: string;
    packages: Array<{ status: string; waitsForDefault: boolean; startsAt?: string; expiresAt?: string }>;
  };
  assert.equal(newLicense.accessMode, 'default');
  assert.equal(newLicense.packages.length, 1);
  assert.equal(newLicense.packages[0]?.status, 'queued');
  assert.equal(newLicense.packages[0]?.waitsForDefault, true);
  assert.equal(newLicense.packages[0]?.startsAt, '2026-07-20T08:00:00.000Z');
  assert.equal(newLicense.packages[0]?.expiresAt, '2026-08-19T08:00:00.000Z');

  await fixture.service.connectDevice({
    ...deviceInput,
    installationId: 'second-device-installation-00000001',
    machineFingerprint: secondMachineFingerprint,
  }, '127.0.0.2');
  assert.equal(fixture.storage.database.packageGrants.length, 1);
});

test('未获套餐设备重装不会重复建档，获得套餐后不允许静默换凭据', async () => {
  const fixture = createFixture();
  const first = await fixture.service.connectDevice(deviceInput, '127.0.0.1');
  fixture.setTime('2026-07-20T08:00:00.000Z');
  const reinstalledInput = { ...deviceInput, installationId: 'new-installation-id-000000000001' };
  const resumed = await fixture.service.connectDevice(reinstalledInput, '127.0.0.2');
  assert.equal((resumed.license as { id: string }).id, (first.license as { id: string }).id);
  assert.equal(fixture.storage.database.licenses.length, 1);
  assert.equal(fixture.storage.database.devices.length, 1);

  const monthlyPlan = fixture.storage.database.plans.find((plan) => plan.code === 'monthly');
  assert.ok(monthlyPlan);
  await fixture.service.grantPackage((first.license as { id: string }).id, {
    planId: monthlyPlan.id,
    source: 'complimentary',
    reason: '发放月度套餐',
  });
  await assert.rejects(
    fixture.service.connectDevice({ ...deviceInput, installationId: 'third-installation-id-0000000001' }, '127.0.0.3'),
    /设备凭据已变化/,
  );
});

test('未获套餐设备可用一次性套餐码自助开通，重复请求不会重复发包', async () => {
  const fixture = createFixture();
  const monthlyPlan = fixture.storage.database.plans.find((plan) => plan.code === 'monthly');
  assert.ok(monthlyPlan);
  await fixture.service.connectDevice(deviceInput, '127.0.0.1');
  const created = await fixture.service.createRedemptionBatch({
    name: '数码荔枝首批月度套餐',
    planId: monthlyPlan.id,
    quantity: 2,
    source: 'paid',
    salesChannel: '数码荔枝',
    reason: '准备月度套餐销售码',
  });
  const codes = created.codes as string[];
  assert.equal(codes.length, 2);
  assert.match(codes[0] ?? '', /^VS-(?:[A-HJ-NP-Z2-9]{4}-){4}[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(JSON.stringify(fixture.storage.database).includes(codes[0] ?? ''), false);
  const inventory = await fixture.service.listRedemptionBatchCodes(
    (created.batch as { id: string }).id,
  );
  assert.deepEqual(
    (inventory.codes as Array<{ code?: string }>).map((item) => item.code),
    codes,
  );

  const unlicensedSession = await fixture.service.connectDevice(deviceInput, '127.0.0.1');
  assert.equal(unlicensedSession.authorized, false);
  const before = await fixture.service.getPackageCenter(String(unlicensedSession.sessionToken));
  assert.equal((before.packageCenter as { access: { status: string } }).access.status, 'expired');

  const compactCode = (codes[0] ?? '').replaceAll('-', '').toLowerCase();
  const redeemed = await fixture.service.redeemPackageCode(
    String(unlicensedSession.sessionToken),
    compactCode,
  );
  assert.equal(redeemed.alreadyRedeemed, false);
  assert.equal((redeemed.session as { authorized: boolean }).authorized, true);
  assert.equal((redeemed.packageGrant as { status: string }).status, 'active');
  assert.equal(fixture.storage.database.packageGrants.length, 1);
  assert.equal(
    fixture.storage.database.licenses[0]?.deviceCredentialLockedAt,
    '2026-07-17T08:00:00.000Z',
  );

  const repeated = await fixture.service.redeemPackageCode(
    String(unlicensedSession.sessionToken),
    codes[0] ?? '',
  );
  assert.equal(repeated.alreadyRedeemed, true);
  assert.equal(fixture.storage.database.packageGrants.length, 1);

  const secondSession = await fixture.service.connectDevice({
    ...deviceInput,
    installationId: 'second-device-installation-00000001',
    machineFingerprint: secondMachineFingerprint,
  }, '127.0.0.2');
  await assert.rejects(
    fixture.service.redeemPackageCode(String(secondSession.sessionToken), codes[0] ?? ''),
    /已经被其他设备使用/,
  );
});

test('套餐码批次可暂停，当前免费权益下兑换的付费套餐会进入队列', async () => {
  const fixture = createFixture();
  const monthlyPlan = fixture.storage.database.plans.find((plan) => plan.code === 'monthly');
  const yearlyPlan = fixture.storage.database.plans.find((plan) => plan.code === 'yearly');
  assert.ok(monthlyPlan);
  assert.ok(yearlyPlan);
  await fixture.service.updateDefaultAccess({
    planId: monthlyPlan.id,
    status: 'active',
    endsAt: null,
    reason: '当前阶段所有设备免费使用',
  });
  const session = await fixture.service.connectDevice(deviceInput, '127.0.0.1');
  const created = await fixture.service.createRedemptionBatch({
    name: '年度套餐预售码',
    planId: yearlyPlan.id,
    quantity: 1,
    source: 'paid',
    reason: '验证全局权益与付费套餐接续',
  });
  const batch = created.batch as { id: string };
  const code = (created.codes as string[])[0] ?? '';
  await fixture.service.updateRedemptionBatch(batch.id, {
    status: 'disabled',
    reason: '暂停售卖检查库存',
  });
  await assert.rejects(
    fixture.service.redeemPackageCode(String(session.sessionToken), code),
    /批次已暂停使用/,
  );
  await fixture.service.updateRedemptionBatch(batch.id, {
    status: 'active',
    reason: '恢复套餐码兑换',
  });
  const redeemed = await fixture.service.redeemPackageCode(String(session.sessionToken), code);
  const center = redeemed.packageCenter as {
    authorized: boolean;
    access: { mode: string };
    packages: Array<{ status: string; waitsForDefault: boolean }>;
  };
  assert.equal(center.authorized, true);
  assert.equal(center.access.mode, 'default');
  assert.equal(center.packages.length, 1);
  assert.equal(center.packages[0]?.status, 'queued');
  assert.equal(center.packages[0]?.waitsForDefault, true);
});

test('旧版 JSON 迁移到版本九并收敛为一份授权档案一台设备', () => {
  const migrated = migrateLicenseDatabase({
    schemaVersion: 1,
    revision: 8,
    licenses: [{
      id: 'license-1',
      keyHash: 'a'.repeat(64),
      keyHint: 'ABC123',
      customerName: '未认领 · 旧客户',
      plan: '旧版授权',
      status: 'active',
      maxDevices: 3,
      claimedAt: '2026-01-02T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      revision: 1,
    }],
    devices: [
      {
        id: 'old-device', licenseId: 'license-1', installationId: 'old', machineFingerprintHash: '1',
        deviceName: '旧设备', platform: 'win32', arch: 'x64', appVersion: '1', status: 'active',
        activatedAt: '2026-01-01T00:00:00.000Z', sessionVersion: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'new-device', licenseId: 'license-1', installationId: 'new', machineFingerprintHash: '2',
        deviceName: '新设备', platform: 'win32', arch: 'x64', appVersion: '1', status: 'active',
        activatedAt: '2026-02-01T00:00:00.000Z', sessionVersion: 1,
        updatedAt: '2026-02-01T00:00:00.000Z',
      },
    ],
    auditEvents: [],
  }, new Date('2026-07-17T08:00:00.000Z'));

  assert.equal(migrated.schemaVersion, 9);
  assert.equal(migrated.licenses[0]?.maxDevices, 1);
  assert.equal(migrated.licenses[0]?.customerName, '旧客户');
  assert.equal('keyHint' in (migrated.licenses[0] ?? {}), false);
  assert.equal(
    migrated.licenses[0]?.deviceCredentialLockedAt,
    '2026-01-02T00:00:00.000Z',
  );
  assert.equal('claimedAt' in (migrated.licenses[0] ?? {}), false);
  assert.equal(migrated.devices.length, 1);
  assert.equal(migrated.devices[0]?.id, 'new-device');
  assert.equal(migrated.devices[0]?.machineFingerprintHint, '未记录');
  assert.equal(migrated.packageGrants[0]?.source, 'legacy');
  assert.deepEqual(migrated.redemptionBatches, []);
  assert.deepEqual(migrated.redemptionCodes, []);
});

test('版本六 JSON 会迁移到版本九，并拒绝悬空设备关系', () => {
  const versionSix = {
    ...createEmptyDatabase(),
    schemaVersion: 6 as const,
  } as unknown as Record<string, unknown>;
  delete versionSix.packageGrantBatches;
  const migrated = migrateLicenseDatabase(versionSix);

  assert.equal(migrated.schemaVersion, 9);
  assert.deepEqual(migrated.licenses.map((license) => license.tags), []);
  assert.deepEqual(migrated.packageGrantBatches, []);

  const invalid = structuredClone(migrated);
  invalid.devices.push({
    id: 'dangling-device',
    licenseId: 'missing-license',
    machineFingerprintHash: 'f'.repeat(64),
    machineFingerprintHint: 'ffffffff',
    deviceName: '悬空设备',
    platform: 'win32',
    arch: 'x64',
    appVersion: '0.10.7',
    status: 'active',
    activatedAt: '2026-07-17T08:00:00.000Z',
    sessionVersion: 1,
    updatedAt: '2026-07-17T08:00:00.000Z',
  });
  assert.throws(() => assertLicenseDatabaseIntegrity(invalid), /引用了不存在的授权档案/);
});

test('多维筛选可批量发放套餐，同一操作幂等且支持整批撤回', async () => {
  const fixture = createFixture();
  const monthlyPlan = fixture.storage.database.plans.find((plan) => plan.code === 'monthly');
  const yearlyPlan = fixture.storage.database.plans.find((plan) => plan.code === 'yearly');
  assert.ok(monthlyPlan);
  assert.ok(yearlyPlan);
  await fixture.service.updateDefaultAccess({
    planId: monthlyPlan.id,
    status: 'active',
    endsAt: null,
    reason: '批量筛选测试期间全局可用',
  });
  const devices = [
    { fingerprint: 'c'.repeat(64), platform: 'win32', name: '社群一号', tags: ['QQ 群', '活跃用户'] },
    { fingerprint: 'd'.repeat(64), platform: 'darwin', name: '社群二号', tags: ['QQ 群'] },
    { fingerprint: 'e'.repeat(64), platform: 'win32', name: '社群三号', tags: ['QQ 群', '内测'] },
  ];

  for (const [index, item] of devices.entries()) {
    const connected = await fixture.service.connectDevice({
      ...deviceInput,
      installationId: `batch-device-installation-${index}`,
      machineFingerprint: item.fingerprint,
      deviceName: item.name,
      platform: item.platform,
    }, `127.0.0.${index + 1}`);
    await fixture.service.updateLicenseProfile(
      (connected.license as { id: string }).id,
      {
        customerName: item.name,
        tags: item.tags,
        reason: '设置运营标签',
      },
    );
  }

  const input = {
    operationKey: 'summer-community-gift-2026',
    selection: {
      mode: 'filter' as const,
      filter: {
        tags: ['QQ 群'],
        tagMatch: 'all' as const,
        platforms: ['win32'],
        licenseStatuses: ['active' as const],
        online: true,
        foregroundNow: true,
      },
    },
    planId: yearlyPlan.id,
    source: 'complimentary' as const,
    duplicatePolicy: 'append' as const,
    reason: '暑期社群活动批量赠送',
  };
  const preview = await fixture.service.previewPackageGrantBatch(input);
  assert.equal(preview.matchedCount, 2);
  assert.equal(preview.grantCount, 2);
  assert.deepEqual(preview.sample.map((item) => item.customerName), ['社群一号', '社群三号']);

  const created = await fixture.service.createPackageGrantBatch(input, 'owner-admin');
  assert.equal(created.alreadyApplied, false);
  assert.equal(created.batch.grantedCount, 2);
  assert.equal(fixture.storage.database.packageGrants.length, 2);
  assert.equal(fixture.storage.database.packageGrantBatches.length, 1);
  assert.ok(fixture.storage.database.packageGrants.every((grant) => grant.batchGrantId === created.batch.id));

  const repeated = await fixture.service.createPackageGrantBatch(input, 'owner-admin');
  assert.equal(repeated.alreadyApplied, true);
  assert.equal(fixture.storage.database.packageGrants.length, 2);
  await assert.rejects(
    fixture.service.createPackageGrantBatch({ ...input, reason: '使用相同编号的另一次活动' }, 'owner-admin'),
    (error: unknown) => (
      error instanceof Error
      && 'code' in error
      && error.code === 'PACKAGE_GRANT_BATCH_KEY_REUSED'
    ),
  );

  const overview = await fixture.service.listAdminOverview();
  assert.deepEqual(overview.availableTags, ['QQ 群', '内测', '活跃用户']);
  assert.equal(overview.packageGrantBatches[0]?.activeCount, 2);

  const withdrawn = await fixture.service.withdrawPackageGrantBatch(
    created.batch.id,
    '活动配置错误，整批撤回',
    'owner-admin',
  );
  assert.equal(withdrawn.withdrawnCount, 2);
  assert.ok(fixture.storage.database.packageGrants.every((grant) => grant.withdrawalReason === '活动配置错误，整批撤回'));
});

test('批量发放可以跳过已经拥有的同套餐，同时允许不同批次继续追加', async () => {
  const fixture = createFixture();
  const monthlyPlan = fixture.storage.database.plans.find((plan) => plan.code === 'monthly');
  assert.ok(monthlyPlan);
  const connected = await fixture.service.connectDevice(deviceInput, '127.0.0.1');
  const licenseId = (connected.license as { id: string }).id;
  await fixture.service.grantPackage(licenseId, {
    planId: monthlyPlan.id,
    source: 'complimentary',
    reason: '先发一份月度套餐',
  });

  await assert.rejects(
    fixture.service.previewPackageGrantBatch({
      operationKey: 'missing-selected-license',
      selection: { mode: 'selected', licenseIds: ['missing-license'] },
      planId: monthlyPlan.id,
      source: 'complimentary',
      duplicatePolicy: 'append',
      reason: '验证过期勾选范围',
    }),
    (error: unknown) => (
      error instanceof Error
      && 'code' in error
      && error.code === 'PACKAGE_GRANT_BATCH_TARGET_NOT_FOUND'
    ),
  );

  const skipped = await fixture.service.createPackageGrantBatch({
    operationKey: 'skip-existing-monthly',
    selection: { mode: 'selected', licenseIds: [licenseId] },
    planId: monthlyPlan.id,
    source: 'complimentary',
    duplicatePolicy: 'skip_existing',
    reason: '避免重复发放测试',
  });
  assert.equal(skipped.batch.grantedCount, 0);
  assert.equal(skipped.batch.skippedDuplicateCount, 1);
  assert.equal(fixture.storage.database.packageGrants.length, 1);

  await fixture.service.createPackageGrantBatch({
    operationKey: 'append-another-monthly',
    selection: { mode: 'selected', licenseIds: [licenseId] },
    planId: monthlyPlan.id,
    source: 'complimentary',
    duplicatePolicy: 'append',
    reason: '明确允许继续追加',
  });
  assert.equal(fixture.storage.database.packageGrants.length, 2);
});
