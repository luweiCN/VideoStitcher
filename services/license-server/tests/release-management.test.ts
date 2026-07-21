import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import test from 'node:test';
import { GithubReleaseManagement } from '../src/release-management.js';

const keyPair = generateKeyPairSync('ed25519');
const privateKey = keyPair.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
const catalog = {
  schemaVersion: 1,
  currentVersion: '2.9.5',
  updatedAt: '2026-07-21T00:00:00.000Z',
  releases: [
    createRelease('2.9.5', true),
    createRelease('2.9.4', false),
  ],
};

test('发布请求读取 master 版本并把可选更新说明交给 GitHub Actions', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const management = createManagement(async (input, init) => {
    const url = String(input);
    requests.push({ url, init });
    if (url.includes('/contents/package.json')) {
      return new Response(JSON.stringify({ version: '2.9.6' }));
    }
    if (url.includes('/actions/workflows/') && url.includes('/runs?')) {
      return Response.json({ workflow_runs: [] });
    }
    if (url.includes('/git/ref/tags/v2.9.6')) return new Response(null, { status: 404 });
    if (url.includes('/dispatches')) return new Response(null, { status: 204 });
    if (url.includes('/releases/index.json')) return Response.json(catalog);
    throw new Error(`未处理的测试请求：${url}`);
  });

  const operation = await management.publish('修复批量处理问题');
  assert.equal(operation.kind, 'publish');
  assert.equal(operation.version, '2.9.6');
  const dispatch = requests.find((request) => request.url.endsWith('/actions/workflows/release.yml/dispatches'));
  assert.ok(dispatch);
  const body = JSON.parse(String(dispatch.init?.body)) as { ref: string; inputs: Record<string, string> };
  assert.equal(body.ref, 'master');
  assert.equal(body.inputs.version, '2.9.6');
  assert.equal(body.inputs.release_notes_override, '修复批量处理问题');
  assert.equal(body.inputs.release_request_id, operation.requestId);
});

test('TOS 目录尚未建立时也会通过私有标签阻止重复发布旧版本', async () => {
  const management = createManagement(async (input) => {
    const url = String(input);
    if (url.includes('/contents/package.json')) {
      return new Response(JSON.stringify({ version: '2.9.4' }));
    }
    if (url.includes('/git/ref/tags/v2.9.4')) return Response.json({ ref: 'refs/tags/v2.9.4' });
    if (url.includes('/releases/index.json')) return new Response(null, { status: 404 });
    if (url.includes('/actions/workflows/') && url.includes('/runs?')) {
      return Response.json({ workflow_runs: [] });
    }
    throw new Error(`未处理的测试请求：${url}`);
  });

  const dashboard = await management.getDashboard();
  assert.equal(dashboard.sourceVersionPublished, true);
  await assert.rejects(management.publish(''), /版本 2.9.4 已经发布/);
});

test('降低当前版本时只签发限定来源和目标的短期回退指令', async () => {
  let dispatchBody: { inputs: Record<string, string> } | undefined;
  const management = createManagement(async (input, init) => {
    const url = String(input);
    if (url.includes('/releases/index.json')) return Response.json(catalog);
    if (url.includes('/actions/workflows/') && url.includes('/runs?')) {
      return Response.json({ workflow_runs: [] });
    }
    if (url.endsWith('/actions/workflows/set-current-release.yml/dispatches')) {
      dispatchBody = JSON.parse(String(init?.body)) as { inputs: Record<string, string> };
      return new Response(null, { status: 204 });
    }
    throw new Error(`未处理的测试请求：${url}`);
  });

  const operation = await management.setCurrent('2.9.4');
  assert.equal(operation.kind, 'set-current');
  const token = dispatchBody?.inputs.signed_directive;
  assert.ok(token);
  const [encodedHeader, encodedClaims, encodedSignature] = token.split('.');
  assert.ok(encodedHeader && encodedClaims && encodedSignature);
  const signatureValid = verify(
    null,
    Buffer.from(`${encodedHeader}.${encodedClaims}`),
    keyPair.publicKey,
    Buffer.from(encodedSignature, 'base64url'),
  );
  assert.equal(signatureValid, true);
  const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')) as { type: string };
  const claims = JSON.parse(Buffer.from(encodedClaims, 'base64url').toString('utf8')) as {
    targetVersion: string;
    allowedFromVersions: string[];
    generation: string;
    issuedAt: number;
    expiresAt: number;
  };
  assert.equal(header.type, 'VS-RELEASE-ROLLBACK');
  assert.equal(claims.targetVersion, '2.9.4');
  assert.deepEqual(claims.allowedFromVersions, ['2.9.5']);
  assert.equal(claims.generation, operation.requestId);
  assert.equal(claims.expiresAt - claims.issuedAt, 180 * 24 * 60 * 60);
});

test('不支持受控回退的当前版本不能伪装成可自动回退', async () => {
  const oldCatalog = {
    ...catalog,
    currentVersion: '2.9.4',
    releases: [createRelease('2.9.4', false), createRelease('2.9.3', false)],
  };
  const management = createManagement(async (input) => {
    const url = String(input);
    if (url.includes('/releases/index.json')) return Response.json(oldCatalog);
    if (url.includes('/actions/workflows/') && url.includes('/runs?')) {
      return Response.json({ workflow_runs: [] });
    }
    throw new Error(`未处理的测试请求：${url}`);
  });

  await assert.rejects(
    management.setCurrent('2.9.3'),
    /尚不支持受控回退/,
  );
});

function createManagement(fetchImplementation: typeof fetch): GithubReleaseManagement {
  return new GithubReleaseManagement({
    githubToken: 'github-test-token',
    githubRepository: 'luweiCN/VideoStitcher',
    githubRef: 'master',
    releaseWorkflow: 'release.yml',
    setCurrentWorkflow: 'set-current-release.yml',
    updateBaseUrl: 'https://updates.example.com/stable',
    signingPrivateKey: privateKey,
    fetchImplementation,
    now: () => new Date('2026-07-21T08:00:00.000Z'),
  });
}

function createRelease(version: string, supportsManagedRollback: boolean) {
  return {
    version,
    releaseDate: '2026-07-21T00:00:00.000Z',
    releaseNotes: '测试版本',
    supportsManagedRollback,
    totalSizeBytes: 100,
    manifests: {
      windows: `stable/versions/${version}/latest.yml`,
      macos: `stable/versions/${version}/latest-mac.yml`,
    },
    downloads: [],
  };
}
