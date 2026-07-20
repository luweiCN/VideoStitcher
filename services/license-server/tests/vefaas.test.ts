import assert from 'node:assert/strict';
import test from 'node:test';
import { createRuntimeConfig } from '../src/vefaas.js';

const sharedEnvironment: NodeJS.ProcessEnv = {
  LICENSE_ADMIN_TOKEN_HASH: 'test-admin-token-hash',
  LICENSE_KEY_PEPPER: 'test-license-key-pepper',
  LICENSE_SIGNING_PRIVATE_KEY: 'test-signing-private-key',
};

test('veFaaS 生产入口拒绝使用本地文件存储', () => {
  assert.throws(
    () => createRuntimeConfig({}, {
      ...sharedEnvironment,
      LICENSE_STORAGE_DRIVER: 'file',
      LICENSE_DATA_FILE: '.data/licenses.json',
    }),
    /veFaaS 生产环境必须使用 TOS 存储/,
  );
});

test('veFaaS 生产入口使用平台临时凭证访问 TOS', () => {
  const config = createRuntimeConfig({
    accessKeyId: 'platform-access-key',
    secretAccessKey: 'platform-secret-key',
    sessionToken: 'platform-session-token',
  }, {
    ...sharedEnvironment,
    LICENSE_STORAGE_DRIVER: 'tos',
    TOS_REGION: 'cn-beijing',
    TOS_ENDPOINT: 'tos-cn-beijing.volces.com',
    TOS_BUCKET: 'videostitcher-license-test',
  });

  assert.deepEqual(config.storage, {
    driver: 'tos',
    accessKeyId: 'platform-access-key',
    accessKeySecret: 'platform-secret-key',
    stsToken: 'platform-session-token',
    region: 'cn-beijing',
    endpoint: 'tos-cn-beijing.volces.com',
    bucket: 'videostitcher-license-test',
    objectKey: 'license-platform/state.json',
  });
});
