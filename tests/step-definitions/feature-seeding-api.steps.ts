import { strict as assert } from 'node:assert';
import http from 'node:http';

import { Given, Then, When } from '@cucumber/cucumber';

import type { RequestLogEntry } from '../../src/adapters/api/index.js';
import {
  buildAdminRoutes,
  buildSeedExportRoutes,
  createApp,
  createAuthMiddleware,
  RateLimiter,
} from '../../src/adapters/api/index.js';
import type { ApiKeyProps, ApiKeyScope } from '../../src/domain/entities/api-key.js';
import { ApiKey } from '../../src/domain/entities/api-key.js';
import { Feature } from '../../src/domain/entities/feature.js';
import { Node } from '../../src/domain/entities/node.js';
import { Version } from '../../src/domain/entities/version.js';
import type {
  IApiKeyRepository,
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
} from '../../src/domain/index.js';
import { Edge } from '../../src/domain/index.js';
import type { FeatureFileInput } from '../../src/use-cases/index.js';
import { hashKey, ValidateApiKey } from '../../src/use-cases/index.js';

/* ── World shape ──────────────────────────────────────────────────── */

interface SeedExportWorld {
  nodes: Node[];
  edges: Edge[];
  versions: Version[];
  features: Feature[];
  server: http.Server | null;
  baseUrl: string;
  response: {
    status: number;
    body: unknown;
    headers: Record<string, string>;
  } | null;
  currentApiKey: string | null;
  apiKeys: Map<string, { rawKey: string; scopes: string[]; name: string }>;
  apiKeyRepo: InMemoryApiKeyRepo | null;
  requestLogs: RequestLogEntry[];
  fsFiles: FeatureFileInput[];
  exportedFiles: Map<string, string>;
  createdDirs: Set<string>;
  previousSeedResponse: unknown;
  staleFeature: Feature | null;
  [key: string]: unknown;
}

const GHERKIN = 'Feature: X\n  Scenario: S1\n    Given a step\n    When action\n    Then result';

function ensureNode(world: SeedExportWorld, id: string, name?: string): void {
  if (!world.nodes.some(n => n.id === id)) {
    world.nodes.push(
      new Node({ id, name: name ?? id, type: 'component', layer: 'supervisor-layer' })
    );
  }
}

class InMemoryApiKeyRepo implements IApiKeyRepository {
  private keys: ApiKey[] = [];
  private nextId = 1;

  async save(props: Omit<ApiKeyProps, 'id'>): Promise<void> {
    this.keys.push(new ApiKey({ ...props, id: this.nextId++ }));
  }

  async findAll(): Promise<ApiKey[]> {
    return [...this.keys];
  }

  async findById(id: number): Promise<ApiKey | null> {
    return this.keys.find(k => k.id === id) ?? null;
  }

  async findByName(name: string): Promise<ApiKey | null> {
    return this.keys.find(k => k.name === name) ?? null;
  }

  async revoke(id: number): Promise<void> {
    const idx = this.keys.findIndex(k => k.id === id);
    if (idx === -1) {
      throw new Error(`API key not found: ${id}`);
    }
    this.keys[idx] = this.cloneKey(this.keys[idx], { is_active: false });
  }

  async updateLastUsed(id: number): Promise<void> {
    const idx = this.keys.findIndex(k => k.id === id);
    if (idx === -1) {
      return;
    }
    this.keys[idx] = this.cloneKey(this.keys[idx], { last_used_at: new Date().toISOString() });
  }

  private cloneKey(o: ApiKey, ov: Partial<ApiKeyProps>): ApiKey {
    return new ApiKey({
      id: o.id,
      name: o.name,
      key_hash: o.key_hash,
      salt: o.salt,
      scopes: o.scopes,
      created_at: o.created_at,
      is_active: o.is_active,
      expires_at: o.expires_at,
      last_used_at: o.last_used_at,
      ...ov,
    });
  }

  async findByHash(hash: string): Promise<ApiKey | null> {
    return this.keys.find(k => k.key_hash === hash) ?? null;
  }

  addKey(rawKey: string, info: { name: string; scopes: string[] }): void {
    const salt = 'test-salt';
    const keyHash = hashKey(rawKey, salt);
    this.keys.push(
      new ApiKey({
        id: this.nextId++,
        name: info.name,
        key_hash: keyHash,
        salt,
        scopes: info.scopes as ApiKeyScope[],
        created_at: new Date().toISOString(),
        is_active: true,
        expires_at: null,
        last_used_at: null,
      })
    );
  }
}

function buildRepos(world: SeedExportWorld) {
  const nodeRepo: INodeRepository = {
    findAll: async () => world.nodes,
    findById: async (id: string) => world.nodes.find(n => n.id === id) ?? null,
    findByType: async (t: string) => world.nodes.filter(n => n.type === t),
    findByLayer: async (l: string) => world.nodes.filter(n => n.layer === l),
    exists: async (id: string) => world.nodes.some(n => n.id === id),
    save: async (n: Node) => {
      world.nodes.push(n);
    },
    delete: async () => {},
  };
  const edgeRepo: IEdgeRepository = {
    findAll: async () => [],
    findById: async () => null,
    findBySource: async () => [],
    findByTarget: async () => [],
    findByType: async () => [],
    findRelationships: async () => [],
    existsBySrcTgtType: async () => false,
    save: async (edge: Edge) => {
      const nextId = world.edges.length > 0 ? Math.max(...world.edges.map(e => e.id ?? 0)) + 1 : 1;
      const saved = new Edge({ ...edge.toJSON(), id: edge.id ?? nextId });
      world.edges.push(saved);
      return saved;
    },
    delete: async () => {},
  };
  const versionRepo: IVersionRepository = {
    findAll: async () => world.versions,
    findByNode: async (nid: string) => world.versions.filter(v => v.node_id === nid),
    findByNodeAndVersion: async (nid: string, ver: string) =>
      world.versions.find(v => v.node_id === nid && v.version === ver) ?? null,
    save: async (v: Version) => {
      world.versions.push(v);
    },
    deleteByNode: async () => {},
  };
  const featureRepo: IFeatureRepository = {
    findAll: async () => world.features,
    findByNode: async (nid: string) => world.features.filter(f => f.node_id === nid),
    findByNodeAndVersion: async (nid: string, ver: string) =>
      world.features.filter(f => f.node_id === nid && f.version === ver),
    findByNodeVersionAndFilename: async (nid: string, ver: string, fn: string) =>
      world.features.find(f => f.node_id === nid && f.version === ver && f.filename === fn) ?? null,
    getStepCountSummary: async (nid: string, ver: string) => {
      const matched = world.features.filter(f => f.node_id === nid && f.version === ver);
      return {
        totalSteps: matched.reduce((sum, f) => sum + f.step_count, 0),
        featureCount: matched.length,
      };
    },
    save: async (feature: Feature) => {
      world.features.push(feature);
    },
    saveMany: async (features: Feature[]) => {
      world.features.push(...features);
    },
    deleteAll: async () => {
      world.features = [];
    },
    deleteByNode: async () => {},
    deleteByNodeAndFilename: async () => false,
    deleteByNodeAndVersionAndFilename: async () => false,
    deleteByNodeAndVersion: async () => 0,
    search: async () => [],
  };
  return { nodeRepo, edgeRepo, versionRepo, featureRepo };
}

function ensureInit(world: SeedExportWorld): void {
  world.nodes ??= [];
  world.edges ??= [];
  world.versions ??= [];
  world.features ??= [];
  world.apiKeys ??= new Map();
  world.requestLogs ??= [];
  world.fsFiles ??= [];
  world.exportedFiles ??= new Map();
  world.createdDirs ??= new Set();
  world.staleFeature = world.staleFeature ?? null;
  for (const id of ['supervisor-layer', 'shared-state']) {
    if (!world.nodes.some(n => n.id === id)) {
      world.nodes.push(new Node({ id, name: id, type: 'layer' }));
    }
  }
}

async function stopServer(world: SeedExportWorld): Promise<void> {
  if (world.server) {
    const s = world.server;
    world.server = null;
    await new Promise<void>(resolve => {
      s.close(() => resolve());
      s.closeAllConnections();
    });
  }
}

async function startSeedExportServer(world: SeedExportWorld): Promise<void> {
  ensureInit(world);
  await stopServer(world);
  world.response = null;

  const repo = new InMemoryApiKeyRepo();
  world.apiKeyRepo = repo;
  for (const [, info] of world.apiKeys) {
    repo.addKey(info.rawKey, info);
  }
  const repos = buildRepos(world);
  const validateApiKey = new ValidateApiKey({ apiKeyRepo: repo });
  const authMw = createAuthMiddleware({
    validateKey: async (plaintext: string) => {
      const result = await validateApiKey.execute(plaintext);
      if (result.status !== 'valid') {
        return result;
      }
      return {
        status: 'valid' as const,
        key: {
          id: result.key.id,
          name: result.key.name,
          scopes: [...result.key.scopes],
          is_active: result.key.is_active,
        },
      };
    },
  });

  const rateLimiter = new RateLimiter();
  const adminKeyRoutes = buildAdminRoutes({ apiKeyRepo: repo });
  const extraRoutes = buildSeedExportRoutes({
    featureRepo: repos.featureRepo,
    nodeRepo: repos.nodeRepo,
    scanFeatureFiles: async () => world.fsFiles,
    writeFeatureFile: async (dir: string, filename: string, content: string) => {
      world.createdDirs.add(dir);
      world.exportedFiles.set(`${dir}/${filename}`, content);
    },
    ensureDir: async (dir: string) => {
      world.createdDirs.add(dir);
    },
    buildDir: (nodeId: string) => `components/${nodeId}/features`,
  });
  const adminRoutes = [...adminKeyRoutes, ...extraRoutes];
  const app = createApp(repos, {
    authMiddleware: authMw,
    rateLimiter,
    adminRoutes,
    onLog: (entry: RequestLogEntry) => {
      world.requestLogs.push(entry);
    },
  });

  await new Promise<void>(resolve => {
    world.server = app.listen(0, () => {
      const addr = world.server?.address();
      if (typeof addr === 'object' && addr !== null) {
        world.baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
}

async function httpRequest(
  baseUrl: string,
  method: string,
  path: string,
  apiKey?: string
): Promise<{
  status: number;
  body: unknown;
  headers: Record<string, string>;
}> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers: Record<string, string> = { Connection: 'close' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    const req = http.request(
      {
        method,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers,
        agent: false,
      },
      res => {
        let data = '';
        res.on('data', chunk => {
          data += chunk;
        });
        res.on('end', () => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          const hdrs: Record<string, string> = {};
          for (const [key, val] of Object.entries(res.headers)) {
            if (typeof val === 'string') {
              hdrs[key] = val;
            }
          }
          resolve({
            status: res.statusCode ?? 500,
            body: parsed,
            headers: hdrs,
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

/* ── Given steps ──────────────────────────────────────────────────── */

Given('the seed and export API server is running', async function (this: SeedExportWorld) {
  await startSeedExportServer(this);
});

Given(
  'feature files exist in the {string} directory tree',
  function (this: SeedExportWorld, _dir: string) {
    ensureInit(this);
    ensureNode(this, 'comp-a', 'Comp A');
    this.fsFiles = [
      { nodeId: 'comp-a', filename: 'mvp-basic.feature', content: GHERKIN },
      { nodeId: 'comp-a', filename: 'v1-advanced.feature', content: GHERKIN },
      { nodeId: 'comp-a', filename: 'v2-future.feature', content: GHERKIN },
      { nodeId: 'comp-a', filename: 'no-prefix.feature', content: GHERKIN },
    ];
  }
);

Given(
  'a valid API key with scope {string} but not {string}',
  async function (this: SeedExportWorld, scope: string, _notScope: string) {
    if (!this.apiKeys) {
      this.apiKeys = new Map();
    }
    const rawKey = `rmap_test_${scope}_${Date.now().toString(16)}`;
    const info = {
      rawKey,
      scopes: [scope],
      name: `key-${scope}-only`,
    };
    this.apiKeys.set(rawKey, info);
    this.currentApiKey = rawKey;
    if (!this.server) {
      await startSeedExportServer(this);
    } else if (this.apiKeyRepo) {
      this.apiKeyRepo.addKey(rawKey, info);
    }
  }
);

Given('the database has a feature for a deleted file', function (this: SeedExportWorld) {
  ensureInit(this);
  ensureNode(this, 'comp-a', 'Comp A');
  const stale = new Feature({
    node_id: 'comp-a',
    version: 'mvp',
    filename: 'mvp-deleted.feature',
    title: 'Deleted',
    content: 'Feature: Deleted\n  Scenario: S\n    Given step',
  });
  this.features.push(stale);
  this.staleFeature = stale;
  this.fsFiles = [{ nodeId: 'comp-a', filename: 'mvp-kept.feature', content: GHERKIN }];
});

Given(
  'features exist in the database for components {string} and {string}',
  function (this: SeedExportWorld, compA: string, compB: string) {
    ensureInit(this);
    for (const id of [compA, compB]) {
      ensureNode(this, id);
    }
    this.features.push(
      new Feature({
        node_id: compA,
        version: 'v1',
        filename: 'v1-test-a.feature',
        title: 'Test A',
        content: 'Feature: Test A\n  Scenario: S\n    Given step a',
      }),
      new Feature({
        node_id: compB,
        version: 'v1',
        filename: 'v1-test-b.feature',
        title: 'Test B',
        content: 'Feature: Test B\n  Scenario: S\n    Given step b',
      })
    );
  }
);

Given(
  'a feature exists for component {string} but no directory exists',
  function (this: SeedExportWorld, compId: string) {
    ensureInit(this);
    ensureNode(this, compId);
    this.features.push(
      new Feature({
        node_id: compId,
        version: 'mvp',
        filename: 'mvp-new.feature',
        title: 'New',
        content: 'Feature: New\n  Scenario: S\n    Given step',
      })
    );
  }
);

/* ── When steps ───────────────────────────────────────────────────── */

When('I send a POST request to {string}', async function (this: SeedExportWorld, path: string) {
  assert.ok(this.baseUrl, 'Server not started');
  assert.ok(this.currentApiKey, 'No current API key');
  this.response = await httpRequest(this.baseUrl, 'POST', path, this.currentApiKey);
});

When('I trigger feature re-seed twice', async function (this: SeedExportWorld) {
  assert.ok(this.baseUrl, 'Server not started');
  assert.ok(this.currentApiKey, 'No current API key');

  ensureInit(this);
  ensureNode(this, 'comp-a', 'Comp A');
  this.fsFiles = [{ nodeId: 'comp-a', filename: 'mvp-basic.feature', content: GHERKIN }];

  const first = await httpRequest(
    this.baseUrl,
    'POST',
    '/api/admin/seed-features',
    this.currentApiKey
  );
  assert.equal(first.status, 200, `First seed failed with status ${first.status}`);
  this.previousSeedResponse = first.body;

  const second = await httpRequest(
    this.baseUrl,
    'POST',
    '/api/admin/seed-features',
    this.currentApiKey
  );
  assert.equal(second.status, 200, `Second seed failed with status ${second.status}`);
  this.response = second;
});

When('I trigger feature re-seed', async function (this: SeedExportWorld) {
  assert.ok(this.baseUrl, 'Server not started');
  assert.ok(this.currentApiKey, 'No current API key');
  this.response = await httpRequest(
    this.baseUrl,
    'POST',
    '/api/admin/seed-features',
    this.currentApiKey
  );
});

When('I trigger feature export', async function (this: SeedExportWorld) {
  assert.ok(this.baseUrl, 'Server not started');
  assert.ok(this.currentApiKey, 'No current API key');
  this.response = await httpRequest(
    this.baseUrl,
    'POST',
    '/api/admin/export-features',
    this.currentApiKey
  );
});

/* ── Then steps ───────────────────────────────────────────────────── */

Then(
  'the response body has field {string} with a positive integer',
  function (this: SeedExportWorld, field: string) {
    assert.ok(this.response, 'No response');
    const body = this.response.body as Record<string, unknown>;
    const value = body[field];
    assert.ok(
      typeof value === 'number' && value > 0,
      `Expected ${field} to be a positive integer, got ${value}`
    );
  }
);

Then(
  'the response body has field {string} with an integer',
  function (this: SeedExportWorld, field: string) {
    assert.ok(this.response, 'No response');
    const body = this.response.body as Record<string, unknown>;
    const value = body[field];
    assert.ok(
      typeof value === 'number' && Number.isInteger(value),
      `Expected ${field} to be an integer, got ${value}`
    );
  }
);

Then(
  'features with {string} prefix are stored under version {string}',
  function (this: SeedExportWorld, prefix: string, version: string) {
    const matching = this.features.filter(f => f.filename.startsWith(prefix));
    assert.ok(matching.length > 0, `No features with prefix "${prefix}" found`);
    for (const f of matching) {
      assert.equal(
        f.version,
        version,
        `Feature ${f.filename} has version ${f.version}, expected ${version}`
      );
    }
  }
);

Then(
  'features without a version prefix default to version {string}',
  function (this: SeedExportWorld, version: string) {
    const matching = this.features.filter(f => !f.filename.match(/^v\d+-/));
    assert.ok(matching.length > 0, 'No features without version prefix found');
    for (const f of matching) {
      assert.equal(
        f.version,
        version,
        `Feature ${f.filename} has version ${f.version}, expected ${version}`
      );
    }
  }
);

Then('the second run produces the same result as the first', function (this: SeedExportWorld) {
  assert.ok(this.response, 'No response');
  assert.ok(this.previousSeedResponse, 'No previous response');
  const current = this.response.body as Record<string, unknown>;
  const previous = this.previousSeedResponse as Record<string, unknown>;
  assert.equal(current.seeded, previous.seeded, 'seeded count differs');
  assert.equal(current.skipped, previous.skipped, 'skipped count differs');
});

Then('no duplicate features exist in the database', function (this: SeedExportWorld) {
  const seen = new Set<string>();
  for (const f of this.features) {
    const key = `${f.node_id}:${f.version}:${f.filename}`;
    assert.ok(!seen.has(key), `Duplicate feature found: ${key}`);
    seen.add(key);
  }
});

Then('the stale feature is removed from the database', function (this: SeedExportWorld) {
  assert.ok(this.staleFeature, 'No stale feature was set up');
  const found = this.features.find(
    f => f.node_id === this.staleFeature?.node_id && f.filename === this.staleFeature?.filename
  );
  assert.ok(!found, 'Stale feature still exists in database');
});

Then('only features matching filesystem files remain', function (this: SeedExportWorld) {
  for (const f of this.features) {
    const inFs = this.fsFiles.some(fs => fs.nodeId === f.node_id && fs.filename === f.filename);
    assert.ok(inFs, `Feature ${f.node_id}/${f.filename} not in filesystem`);
  }
});

Then(
  'the response body has field {string} as an object with:',
  function (
    this: SeedExportWorld,
    field: string,
    dataTable: {
      hashes: () => Array<Record<string, string>>;
    }
  ) {
    assert.ok(this.response, 'No response');
    const body = this.response.body as Record<string, unknown>;
    const obj = body[field] as Record<string, Record<string, unknown>>;
    assert.ok(obj && typeof obj === 'object', `Expected ${field} to be an object`);

    const rows = dataTable.hashes();
    for (const row of rows) {
      const version = row.version;
      assert.ok(version in obj, `Missing version "${version}" in ${field}`);
      const entry = obj[version];
      if (row.total_steps === '(integer)') {
        assert.ok(
          typeof entry.total_steps === 'number' && Number.isInteger(entry.total_steps),
          `${version}.total_steps should be an integer`
        );
      }
      if (row.total_scenarios === '(integer)') {
        assert.ok(
          typeof entry.total_scenarios === 'number' && Number.isInteger(entry.total_scenarios),
          `${version}.total_scenarios should be an integer`
        );
      }
    }
  }
);

Then('feature files are written to {string}', function (this: SeedExportWorld, dirPath: string) {
  const dir = dirPath.replace(/\/$/, '');
  const written = [...this.exportedFiles.keys()].filter(p => p.startsWith(dir));
  assert.ok(written.length > 0, `No files written to ${dirPath}`);
});

Then('each file contains the Gherkin content from the database', function (this: SeedExportWorld) {
  for (const [path, content] of this.exportedFiles) {
    assert.ok(content.includes('Feature:'), `File ${path} has no Gherkin content`);
    const matchingFeature = this.features.find(f => {
      const expectedPath = `components/${f.node_id}/features/${f.filename}`;
      return path === expectedPath && f.content === content;
    });
    assert.ok(matchingFeature, `File ${path} content doesn't match any DB feature`);
  }
});

Then('the directory {string} is created', function (this: SeedExportWorld, dirPath: string) {
  const dir = dirPath.replace(/\/$/, '');
  assert.ok(this.createdDirs.has(dir), `Directory ${dir} was not created`);
});

Then('the feature file is written there', function (this: SeedExportWorld) {
  assert.ok(this.exportedFiles.size > 0, 'No feature files were written');
});

Then(
  'only features for {string} are exported to the filesystem',
  function (this: SeedExportWorld, compId: string) {
    for (const path of this.exportedFiles.keys()) {
      assert.ok(
        path.includes(`components/${compId}/`),
        `File ${path} is not for component ${compId}`
      );
    }
  }
);
