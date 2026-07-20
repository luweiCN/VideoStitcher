import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { TosClient } from '@volcengine/tos-sdk';

test('火山 TOS SDK 与安全覆盖后的 Axios 保持 Node 请求兼容', async (context) => {
  let requestedUrl = '';
  let authorizationHeader = '';
  const server = createServer((request, response) => {
    requestedUrl = request.url ?? '';
    authorizationHeader = String(request.headers.authorization ?? '');
    response.statusCode = 200;
    response.setHeader('content-length', '2');
    response.setHeader('etag', '"mock-etag"');
    response.end('{}');
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  context.after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  const address = server.address() as AddressInfo;
  const client = new TosClient({
    accessKeyId: '测试访问密钥',
    accessKeySecret: '测试访问密钥密码',
    endpoint: `127.0.0.1:${address.port}`,
    forcePathStyle: true,
    maxRetryCount: 0,
    region: 'cn-beijing',
    secure: false,
  });

  await client.getObjectV2({ bucket: 'test-bucket', key: 'state.json' });

  assert.match(requestedUrl, /test-bucket\/state\.json/);
  assert.match(authorizationHeader, /^TOS4-HMAC-SHA256 Credential=/);
});
