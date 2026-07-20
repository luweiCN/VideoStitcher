import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import test from 'node:test';
import {
  adminPasswordNeedsRehash,
  hashAdminPassword,
  verifyAdminPassword,
} from '../src/password.js';

test('管理员密码使用增强后的 scrypt 参数并继续兼容旧摘要', async () => {
  const password = 'owner-password-for-scrypt-test';
  const currentHash = await hashAdminPassword(password);
  assert.equal(currentHash.startsWith('scrypt-v2$32768$8$3$'), true);
  assert.equal(await verifyAdminPassword(password, currentHash), true);
  assert.equal(await verifyAdminPassword(`${password}-wrong`, currentHash), false);
  assert.equal(adminPasswordNeedsRehash(currentHash), false);

  const legacySalt = randomBytes(16);
  const legacyKey = scryptSync(password, legacySalt, 64, {
    N: 16_384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  const legacyHash = [
    'scrypt-v1',
    '16384',
    '8',
    '1',
    legacySalt.toString('base64url'),
    legacyKey.toString('base64url'),
  ].join('$');
  assert.equal(await verifyAdminPassword(password, legacyHash), true);
  assert.equal(adminPasswordNeedsRehash(legacyHash), true);
});
