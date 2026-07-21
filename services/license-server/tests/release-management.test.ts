import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import test from 'node:test';
import { createEmptyDatabase, type LicenseDatabase } from '../src/domain.js';
import {
  ReleaseManagementService,
  type ReleaseChannel,
  type ReleaseChannelSwitchInput,
} from '../src/release-management.js';
import {
  StorageConflictError,
  type LicenseStorage,
  type VersionedDatabase,
  type VersionedDeviceActivity,
} from '../src/storage.js';

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

test('更新说明留空时仍然可以提交发布任务', async () => {
  let dispatchBody: { inputs: Record<string, string> } | undefined;
  const management = createManagement(async (input, init) => {
    const url = String(input);
    if (url.includes('/contents/package.json')) {
      return new Response(JSON.stringify({ version: '2.9.6' }));
    }
    if (url.includes('/actions/workflows/') && url.includes('/runs?')) {
      return Response.json({ workflow_runs: [] });
    }
    if (url.includes('/git/ref/tags/v2.9.6')) return new Response(null, { status: 404 });
    if (url.includes('/dispatches')) {
      dispatchBody = JSON.parse(String(init?.body)) as { inputs: Record<string, string> };
      return new Response(null, { status: 204 });
    }
    if (url.includes('/releases/index.json')) return Response.json(catalog);
    throw new Error(`未处理的测试请求：${url}`);
  });

  const operation = await management.publish('');

  assert.equal(operation.version, '2.9.6');
  assert.equal(dispatchBody?.inputs.release_notes_override, '');
});

test('TOS 目录尚未建立时也会通过私有标签阻止重复发布旧版本', async () => {
  const management = createManagement(async (input) => {
    const url = String(input);
    if (url.includes('/contents/package.json')) {
      return new Response(JSON.stringify({ version: '2.9.4' }));
    }
    if (url.includes('/git/ref/tags/v2.9.4')) return Response.json({ ref: 'refs/tags/v2.9.4' });
    if (url.includes('/releases/index.json')) return new Response(null, { status: 404 });
    if (url.includes('/latest.yml')) {
      return new Response([
        'version: 2.9.4',
        "releaseDate: '2026-07-21T02:12:10.074Z'",
      ].join('\n'));
    }
    if (url.includes('/actions/workflows/') && url.includes('/runs?')) {
      return Response.json({ workflow_runs: [] });
    }
    throw new Error(`未处理的测试请求：${url}`);
  });

  const dashboard = await management.getDashboard();
  assert.equal(dashboard.github.status, 'connected');
  assert.equal('sourceVersionPublished' in dashboard, true);
  if ('sourceVersionPublished' in dashboard) {
    assert.equal(dashboard.sourceVersionPublished, true);
  }
  assert.equal(dashboard.tosCurrentVersion, '2.9.4');
  assert.equal(dashboard.tosCurrentVersionUpdatedAt, '2026-07-21T02:12:10.074Z');
  await assert.rejects(management.publish(''), /版本 2.9.4 已经发布/);
});

test('旧发布任务标题缺少版本号时从任务提交读取版本', async () => {
  const releaseCommit = 'd5aa2f9de924c87bfae44428f53743da12109934';
  const management = createManagement(async (input) => {
    const url = String(input);
    if (url.includes(`/contents/package.json?ref=${releaseCommit}`)) {
      return new Response(JSON.stringify({ version: '2.9.4' }));
    }
    if (url.includes('/contents/package.json?ref=master')) {
      return new Response(JSON.stringify({ version: '2.9.6' }));
    }
    if (url.includes('/git/ref/tags/v2.9.6')) return new Response(null, { status: 404 });
    if (url.includes('/releases/index.json')) return Response.json(catalog);
    if (url.includes('/actions/workflows/release.yml/runs?')) {
      return Response.json({
        workflow_runs: [{
          id: 29795047001,
          display_title: '发布桌面客户端到 TOS',
          head_sha: releaseCommit,
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.example/runs/29795047001',
          created_at: '2026-07-21T02:08:34Z',
          updated_at: '2026-07-21T02:20:00Z',
        }],
      });
    }
    throw new Error(`未处理的测试请求：${url}`);
  });

  const dashboard = await management.getDashboard();

  assert.equal(dashboard.tosCurrentVersion, '2.9.5');
  assert.equal(dashboard.github.status, 'connected');
  assert.equal(dashboard.operations[0]?.version, '2.9.4');
});

test('GitHub 发布资源不存在时仍然返回 TOS 版本信息', async () => {
  const management = createManagement(async (input) => {
    const url = String(input);
    if (url.includes('/releases/index.json')) return Response.json(catalog);
    if (url.startsWith('https://api.github.com/')) {
      return Response.json({ message: 'Not Found' }, { status: 404 });
    }
    throw new Error(`未处理的测试请求：${url}`);
  });

  const dashboard = await management.getDashboard();

  assert.equal(dashboard.tosCurrentVersion, '2.9.5');
  assert.equal(dashboard.github.status, 'unavailable');
  if (dashboard.github.status !== 'unavailable') assert.fail('GitHub 应处于不可用状态');
  assert.equal(dashboard.github.code, 'GITHUB_RELEASE_RESOURCE_NOT_FOUND');
  assert.match(dashboard.github.message, /仓库或发布 Workflow 不存在或无权访问/);
});

test('降低当前版本时只签发限定来源和目标的短期回退指令', async () => {
  const requests: string[] = [];
  let switchInput: ReleaseChannelSwitchInput | undefined;
  const management = createManagement(async (input) => {
    const url = String(input);
    requests.push(url);
    if (url.includes('/releases/index.json')) return Response.json(catalog);
    throw new Error(`未处理的测试请求：${url}`);
  }, {
    async switchCurrent(input) {
      switchInput = input;
      return {
        previousVersion: input.expectedCurrentVersion,
        currentVersion: input.targetVersion,
        updatedAt: '2026-07-21T08:00:00.000Z',
      };
    },
  });

  const operation = await management.setCurrent('2.9.4');
  assert.equal(operation.kind, 'set-current');
  assert.equal(operation.status, 'completed');
  assert.equal(operation.conclusion, 'success');
  assert.equal(requests.some((url) => url.startsWith('https://api.github.com/')), false);
  const token = switchInput?.signedDirective;
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
  assert.equal(switchInput?.expectedCurrentVersion, '2.9.5');
});

test('不支持受控回退的当前版本不能伪装成可自动回退', async () => {
  const oldCatalog = {
    ...catalog,
    currentVersion: '2.9.4',
    releases: [createRelease('2.9.4', false), createRelease('2.9.3', false)],
  };
  let switched = false;
  const management = createManagement(async (input) => {
    const url = String(input);
    if (url.includes('/releases/index.json')) return Response.json(oldCatalog);
    throw new Error(`未处理的测试请求：${url}`);
  }, {
    async switchCurrent(input) {
      switched = true;
      return {
        previousVersion: input.expectedCurrentVersion,
        currentVersion: input.targetVersion,
        updatedAt: '2026-07-21T08:00:00.000Z',
      };
    },
  });

  await assert.rejects(
    management.setCurrent('2.9.3'),
    /尚不支持受控回退/,
  );
  assert.equal(switched, false);
});

test('直接切换成功后把操作人和版本变化写入审计记录', async () => {
  const storage = new MemoryLicenseStorage();
  const management = createManagement(async (input) => {
    const url = String(input);
    if (url.includes('/releases/index.json')) return Response.json(catalog);
    throw new Error(`未处理的测试请求：${url}`);
  }, createReleaseChannel(), storage);

  const operation = await management.setCurrent('2.9.4', 'admin-owner-1');
  const persisted = await management.getOperation(operation.requestId);
  const { database } = await storage.read();
  const event = database.auditEvents[0];

  assert.equal(persisted.kind, 'set-current');
  assert.equal(persisted.conclusion, 'success');
  assert.equal(event?.actorId, 'admin-owner-1');
  assert.equal(event?.action, 'release.current_changed');
  assert.equal(event?.metadata?.previousVersion, '2.9.5');
  assert.equal(event?.metadata?.targetVersion, '2.9.4');
});

function createManagement(
  fetchImplementation: typeof fetch,
  releaseChannel: ReleaseChannel = createReleaseChannel(),
  storage?: LicenseStorage,
): ReleaseManagementService {
  return new ReleaseManagementService({
    githubToken: 'github-test-token',
    githubRepository: 'luweiCN/VideoStitcher',
    githubRef: 'master',
    releaseWorkflow: 'release.yml',
    updateBaseUrl: 'https://updates.example.com/stable',
    signingPrivateKey: privateKey,
    releaseChannel,
    ...(storage === undefined ? {} : { storage }),
    fetchImplementation,
    now: () => new Date('2026-07-21T08:00:00.000Z'),
  });
}

class MemoryLicenseStorage implements LicenseStorage {
  private database: LicenseDatabase = createEmptyDatabase();

  public async read(): Promise<VersionedDatabase> {
    return { database: structuredClone(this.database), version: String(this.database.revision) };
  }

  public async write(database: LicenseDatabase, expectedVersion: string): Promise<string> {
    if (expectedVersion !== String(this.database.revision)) throw new StorageConflictError();
    this.database = { ...structuredClone(database), revision: this.database.revision + 1 };
    return String(this.database.revision);
  }

  public async readDeviceActivity(): Promise<VersionedDeviceActivity> {
    return { version: '0' };
  }

  public async writeDeviceActivity(): Promise<string> {
    throw new Error('此测试不会写入设备活动');
  }
}

function createReleaseChannel(): ReleaseChannel {
  return {
    async switchCurrent(input) {
      return {
        previousVersion: input.expectedCurrentVersion,
        currentVersion: input.targetVersion,
        updatedAt: '2026-07-21T08:00:00.000Z',
      };
    },
  };
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
