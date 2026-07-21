import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TosReleaseChannel,
  type ReleaseObject,
  type ReleaseObjectPutOptions,
  type ReleaseObjectStore,
} from '../src/release-channel.js';

class MemoryReleaseObjectStore implements ReleaseObjectStore {
  public readonly objects = new Map<string, Buffer>();

  public async read(key: string): Promise<ReleaseObject> {
    const content = this.objects.get(key);
    if (content === undefined) throw new Error(`测试对象不存在：${key}`);
    return { content: Buffer.from(content) };
  }

  public async put(key: string, content: Buffer, options: ReleaseObjectPutOptions = {}): Promise<void> {
    if (options.forbidOverwrite === true && this.objects.has(key)) {
      throw new Error(`测试对象已经存在：${key}`);
    }
    this.objects.set(key, Buffer.from(content));
  }

  public async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
}

const catalog = {
  schemaVersion: 1 as const,
  currentVersion: '2.9.4',
  updatedAt: '2026-07-21T00:00:00.000Z',
  releases: [
    createRelease('2.9.5', true),
    createRelease('2.9.4', true),
  ],
};

test('直接切换当前版本时复制归档清单并更新 TOS 指针', async () => {
  const store = createStore();
  const channel = new TosReleaseChannel({
    bucket: 'updates-test',
    prefix: 'stable',
    updateBaseUrl: 'https://updates.example.com/stable',
    objectStore: store,
    fetchImplementation: async (input) => {
      const url = new URL(String(input));
      const content = store.objects.get(url.pathname.replace(/^\//, ''));
      return content === undefined ? new Response(null, { status: 404 }) : new Response(content);
    },
    now: () => new Date('2026-07-21T08:30:00.000Z'),
  });

  const result = await channel.switchCurrent({
    requestId: '2ed21b10-1ef1-40d5-b96d-5f3de053abf5',
    expectedCurrentVersion: '2.9.4',
    targetVersion: '2.9.5',
    signedDirective: '',
  });

  assert.deepEqual(result, {
    previousVersion: '2.9.4',
    currentVersion: '2.9.5',
    updatedAt: '2026-07-21T08:30:00.000Z',
  });
  assert.match(readText(store, 'stable/latest.yml'), /^version: 2\.9\.5$/m);
  assert.match(readText(store, 'stable/latest-mac.yml'), /^version: 2\.9\.5$/m);
  const channelDocument = JSON.parse(readText(store, 'stable/channel.json')) as Record<string, unknown>;
  assert.equal(channelDocument.targetVersion, '2.9.5');
  assert.equal('directive' in channelDocument, false);
  const nextCatalog = JSON.parse(readText(store, 'stable/releases/index.json')) as typeof catalog;
  assert.equal(nextCatalog.currentVersion, '2.9.5');
  assert.equal(nextCatalog.updatedAt, '2026-07-21T08:30:00.000Z');
  assert.equal(store.objects.has('stable/releases/switch.lock'), false);
});

test('降低当前版本时把签名回退指令写入 TOS 通道', async () => {
  const rollbackCatalog = {
    ...catalog,
    currentVersion: '2.9.5',
  };
  const store = createStore(rollbackCatalog);
  const channel = new TosReleaseChannel({
    bucket: 'updates-test',
    prefix: 'stable',
    updateBaseUrl: 'https://updates.example.com/stable',
    objectStore: store,
    fetchImplementation: async (input) => {
      const pathName = new URL(String(input)).pathname.replace(/^\//, '');
      const content = store.objects.get(pathName);
      return content === undefined ? new Response(null, { status: 404 }) : new Response(content);
    },
    now: () => new Date('2026-07-21T08:30:00.000Z'),
  });

  await channel.switchCurrent({
    requestId: '51aa63e2-20b3-49bd-9e5b-90d8caee446e',
    expectedCurrentVersion: '2.9.5',
    targetVersion: '2.9.4',
    signedDirective: 'header.claims.signature',
  });

  const channelDocument = JSON.parse(readText(store, 'stable/channel.json')) as Record<string, unknown>;
  assert.equal(channelDocument.targetVersion, '2.9.4');
  assert.equal(channelDocument.directive, 'header.claims.signature');
});

test('归档清单版本不匹配时拒绝切换且不修改当前版本', async () => {
  const store = createStore();
  store.objects.set('stable/versions/2.9.5/latest-mac.yml', Buffer.from('version: 9.9.9\n'));
  const channel = new TosReleaseChannel({
    bucket: 'updates-test',
    prefix: 'stable',
    updateBaseUrl: 'https://updates.example.com/stable',
    objectStore: store,
    fetchImplementation: async () => new Response(null, { status: 500 }),
    now: () => new Date('2026-07-21T08:30:00.000Z'),
  });

  await assert.rejects(channel.switchCurrent({
    requestId: '08e13fb7-4ee4-40a0-a20f-400c4d47866e',
    expectedCurrentVersion: '2.9.4',
    targetVersion: '2.9.5',
    signedDirective: '',
  }), /归档清单.*版本不一致/);

  const current = JSON.parse(readText(store, 'stable/releases/index.json')) as typeof catalog;
  assert.equal(current.currentVersion, '2.9.4');
  assert.equal(store.objects.has('stable/latest.yml'), false);
  assert.equal(store.objects.has('stable/releases/switch.lock'), false);
});

function createStore(sourceCatalog = catalog): MemoryReleaseObjectStore {
  const store = new MemoryReleaseObjectStore();
  store.objects.set(
    'stable/releases/index.json',
    Buffer.from(`${JSON.stringify(sourceCatalog)}\n`),
  );
  for (const release of sourceCatalog.releases) {
    store.objects.set(
      release.manifests.windows,
      Buffer.from(`version: ${release.version}\nreleaseDate: '2026-07-21T00:00:00.000Z'\n`),
    );
    store.objects.set(
      release.manifests.macos,
      Buffer.from(`version: ${release.version}\nreleaseDate: '2026-07-21T00:00:00.000Z'\n`),
    );
  }
  return store;
}

function readText(store: MemoryReleaseObjectStore, key: string): string {
  const content = store.objects.get(key);
  assert.ok(content, `缺少测试对象 ${key}`);
  return content.toString('utf8');
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
