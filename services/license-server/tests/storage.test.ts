import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createEmptyDatabase, type DeviceActivityRecord } from '../src/domain.js';
import { FileLicenseStorage } from '../src/storage.js';

test('文件存储把主业务状态和设备活动写入不同 JSON', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'videostitcher-license-'));
  const statePath = path.join(directory, 'state.json');
  const storage = new FileLicenseStorage(statePath);
  try {
    await storage.write(createEmptyDatabase(), '0');
    const stateBeforeHeartbeat = await readFile(statePath, 'utf8');
    const activity: DeviceActivityRecord = {
      schemaVersion: 1,
      revision: 0,
      deviceId: 'device-1',
      licenseId: 'user-1',
      appVersion: '0.10.7',
      active: true,
      lastHeartbeatAt: '2026-07-18T08:00:00.000Z',
      lastActivityAt: '2026-07-18T08:00:00.000Z',
      dailyUsage: [{ date: '2026-07-18', foregroundSeconds: 300, launchCount: 1 }],
    };

    await storage.writeDeviceActivity(activity, '0');
    assert.equal(await storage.hasBootstrapMarker(), false);
    await storage.writeBootstrapMarker();
    await storage.writeBootstrapMarker();
    assert.equal(await storage.hasBootstrapMarker(), true);

    assert.equal(await readFile(statePath, 'utf8'), stateBeforeHeartbeat);
    const savedActivity = JSON.parse(
      await readFile(path.join(directory, 'activity', 'device-1.json'), 'utf8'),
    ) as DeviceActivityRecord;
    assert.equal(savedActivity.revision, 1);
    assert.equal(savedActivity.dailyUsage[0]?.foregroundSeconds, 300);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('文件存储在写入前拒绝破坏唯一约束的主状态', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'videostitcher-license-invalid-'));
  const statePath = path.join(directory, 'state.json');
  const storage = new FileLicenseStorage(statePath);
  const database = createEmptyDatabase();
  const firstPlan = database.plans[0];
  const secondPlan = database.plans[1];
  assert.ok(firstPlan && secondPlan);
  secondPlan.code = firstPlan.code;

  try {
    await assert.rejects(
      storage.write(database, '0'),
      /套餐代码存在重复值/,
    );
    await assert.rejects(readFile(statePath, 'utf8'), (error: unknown) => (
      error instanceof Error && 'code' in error && error.code === 'ENOENT'
    ));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
