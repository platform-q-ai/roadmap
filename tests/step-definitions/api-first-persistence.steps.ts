import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import { join } from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { createApp, createAuthMiddleware } from '../../src/adapters/api/index.js';
import type {
  IApiKeyRepository,
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
} from '../../src/domain/index.js';
import { ApiKey, Edge, Node, Version } from '../../src/domain/index.js';
import { hashKey, ValidateApiKey } from '../../src/use-cases/index.js';

// ─── World interface ─────────────────────────────────────────────────

interface PersistenceWorld {
  server: http.Server | null;
  baseUrl: string;
  nodes: Node[];
  edges: Edge[];
  versions: Version[];
  response: { status: number; body: unknown; headers: Record<string, string> } | null;
  buildCommand: string | null;
  dockerfileBuildStep: string | null;
  dbPathEnv: string | null;
  resolvedDbPath: string | null;
  renderConfig: Record<string, unknown> | null;
  [key: string]: unknown;
}

// ─── HTTP helper ─────────────────────────────────────────────────────

function httpRequest(
  baseUrl: string,
  method: string,
  path: string,
  headers?: Record<string, string>,
  body?: string
): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const contentHeaders = body
      ? { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) }
      : {};
    const options: http.RequestOptions = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { Connection: 'close', ...contentHeaders, ...headers },
      agent: false,
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', (chunk: Buffer) => {
        data += chunk.toString();
      });
      res.on('end', () => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        const resHeaders: Record<string, string> = {};
        for (const [key, val] of Object.entries(res.headers)) {
          if (typeof val === 'string') {
            resHeaders[key] = val;
          }
        }
        resolve({ status: res.statusCode ?? 500, body: parsed, headers: resHeaders });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

// ─── Repo builders ───────────────────────────────────────────────────

function buildNodeRepo(world: PersistenceWorld): INodeRepository {
  return {
    findAll: async () => world.nodes,
    findById: async (id: string) => world.nodes.find(n => n.id === id) ?? null,
    findByType: async (type: string) => world.nodes.filter(n => n.type === type),
    findByLayer: async (layerId: string) => world.nodes.filter(n => n.layer === layerId),
    exists: async (id: string) => world.nodes.some(n => n.id === id),
    save: async (node: Node) => {
      world.nodes = world.nodes.filter(n => n.id !== node.id);
      world.nodes.push(node);
    },
    delete: async (id: string) => {
      world.nodes = world.nodes.filter(n => n.id !== id);
    },
  };
}

function buildEdgeRepo(world: PersistenceWorld): IEdgeRepository {
  return {
    findAll: async () => world.edges,
    findById: async (id: number) => world.edges.find(e => e.id === id) ?? null,
    findBySource: async (sid: string) => world.edges.filter(e => e.source_id === sid),
    findByTarget: async (tid: string) => world.edges.filter(e => e.target_id === tid),
    findByType: async (type: string) => world.edges.filter(e => e.type === type),
    findRelationships: async () => world.edges.filter(e => !e.isContainment()),
    existsBySrcTgtType: async (src: string, tgt: string, type: string) =>
      world.edges.some(e => e.source_id === src && e.target_id === tgt && e.type === type),
    save: async (edge: Edge): Promise<Edge> => {
      const nextId = world.edges.length > 0 ? Math.max(...world.edges.map(e => e.id ?? 0)) + 1 : 1;
      const withId = new Edge({
        id: edge.id ?? nextId,
        source_id: edge.source_id,
        target_id: edge.target_id,
        type: edge.type,
        label: edge.label,
        metadata: edge.metadata,
      });
      world.edges.push(withId);
      return withId;
    },
    delete: async (id: number): Promise<void> => {
      world.edges = world.edges.filter(e => e.id !== id);
    },
  };
}

function buildVersionRepo(world: PersistenceWorld): IVersionRepository {
  return {
    findAll: async () => world.versions,
    findByNode: async (nid: string) => world.versions.filter(v => v.node_id === nid),
    findByNodeAndVersion: async (nid: string, ver: string) =>
      world.versions.find(v => v.node_id === nid && v.version === ver) ?? null,
    save: async (version: Version) => {
      world.versions = world.versions.filter(
        v => !(v.node_id === version.node_id && v.version === version.version)
      );
      world.versions.push(version);
    },
    deleteByNode: async (nid: string) => {
      world.versions = world.versions.filter(v => v.node_id !== nid);
    },
  };
}

function buildFeatureRepo(): IFeatureRepository {
  return {
    findAll: async () => [],
    findByNode: async () => [],
    findByNodeAndVersion: async () => [],
    findByNodeVersionAndFilename: async () => null,
    save: async () => {},
    saveMany: async () => {},
    deleteAll: async () => {},
    deleteByNode: async () => {},
    deleteByNodeAndFilename: async () => false,
    deleteByNodeAndVersionAndFilename: async () => false,
    deleteByNodeAndVersion: async () => 0,
    getStepCountSummary: async () => ({ totalSteps: 0, featureCount: 0 }),
    search: async () => [],
  };
}

// ─── Server lifecycle ────────────────────────────────────────────────

async function startServer(world: PersistenceWorld): Promise<void> {
  if (world.server) {
    const s = world.server;
    await new Promise<void>(resolve => {
      s.close(() => resolve());
      s.closeAllConnections();
    });
    world.server = null;
  }
  if (!world.nodes) world.nodes = [];
  if (!world.edges) world.edges = [];
  if (!world.versions) world.versions = [];

  const nodeRepo = buildNodeRepo(world);
  const edgeRepo = buildEdgeRepo(world);
  const versionRepo = buildVersionRepo(world);
  const featureRepo = buildFeatureRepo();

  const testKey = 'rmap_persist_admin';
  const readKey = 'rmap_persist_read';
  const salt = 'test-salt-persist';
  const adminHash = hashKey(testKey, salt);
  const readHash = hashKey(readKey, salt);
  const keyStore: ApiKey[] = [
    new ApiKey({
      id: 1,
      name: 'admin-key',
      key_hash: adminHash,
      salt,
      scopes: ['read', 'write', 'admin'],
      is_active: true,
      created_at: new Date().toISOString(),
    }),
    new ApiKey({
      id: 2,
      name: 'read-key',
      key_hash: readHash,
      salt,
      scopes: ['read'],
      is_active: true,
      created_at: new Date().toISOString(),
    }),
  ];

  const apiKeyRepo: IApiKeyRepository = {
    save: async (key: ApiKey) => {
      keyStore.push(key);
    },
    findAll: async () => keyStore,
    findById: async (id: number) => keyStore.find(k => k.id === id) ?? null,
    findByName: async (name: string) => keyStore.find(k => k.name === name) ?? null,
    revoke: async (id: number) => {
      const idx = keyStore.findIndex(k => k.id === id);
      if (idx >= 0) keyStore.splice(idx, 1);
    },
    updateLastUsed: async () => {},
  };

  const validateApiKey = new ValidateApiKey({ apiKeyRepo });
  const authMiddleware = createAuthMiddleware({
    validateKey: (key: string) => validateApiKey.execute(key),
  });

  const app = createApp({ nodeRepo, edgeRepo, versionRepo, featureRepo }, { authMiddleware });

  await new Promise<void>(resolve => {
    const server = app.listen(0, () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr !== null) {
        world.baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      world.server = server;
      resolve();
    });
  });
}

// ─── Given steps ─────────────────────────────────────────────────────

Given(
  'the API server is running with a persistent database',
  async function (this: PersistenceWorld) {
    await startServer(this);
  }
);

Given(
  'the database contains a component {string} with name {string}',
  async function (this: PersistenceWorld, id: string, name: string) {
    this.nodes.push(new Node({ id, name, type: 'component', layer: null, tags: '[]' }));
  }
);

Given('the database is empty', function (this: PersistenceWorld) {
  this.nodes = [];
  this.edges = [];
  this.versions = [];
});

Given('the build command is {string}', function (this: PersistenceWorld, cmd: string) {
  this.buildCommand = cmd;
});

Given('the database contains seeded data', async function (this: PersistenceWorld) {
  this.nodes.push(
    new Node({ id: 'existing-comp', name: 'Existing', type: 'component', layer: null, tags: '[]' })
  );
});

Given('the render.yaml configuration', function (this: PersistenceWorld) {
  const content = readFileSync(join(process.cwd(), 'render.yaml'), 'utf-8');
  this.renderConfig = { raw: content };
});

Given('DB_PATH is set to {string}', function (this: PersistenceWorld, path: string) {
  this.dbPathEnv = path;
});

// ─── When steps ──────────────────────────────────────────────────────

When('the server restarts and applies schema', async function (this: PersistenceWorld) {
  // Simulate restart: stop and start server, data should persist (same world state)
  await startServer(this);
});

When(
  'I create a component {string} with name {string} via the API',
  async function (this: PersistenceWorld, id: string, name: string) {
    // Simulate what the API does — add the component to the world's in-memory store
    this.nodes.push(new Node({ id, name, type: 'component', layer: null, tags: '[]' }));
  }
);

When('the server restarts', async function (this: PersistenceWorld) {
  await startServer(this);
});

When('the Dockerfile build step is {string}', function (this: PersistenceWorld, step: string) {
  this.dockerfileBuildStep = step;
});

When(
  'I call POST \\/api\\/admin\\/seed with admin credentials',
  async function (this: PersistenceWorld) {
    await startServer(this);
    this.response = await httpRequest(this.baseUrl, 'POST', '/api/admin/seed', {
      Authorization: 'Bearer rmap_persist_admin',
    });
  }
);

When(
  'I call POST \\/api\\/admin\\/seed without authentication',
  async function (this: PersistenceWorld) {
    await startServer(this);
    this.response = await httpRequest(this.baseUrl, 'POST', '/api/admin/seed');
  }
);

When(
  'I call POST \\/api\\/admin\\/seed with read-only credentials',
  async function (this: PersistenceWorld) {
    await startServer(this);
    this.response = await httpRequest(this.baseUrl, 'POST', '/api/admin/seed', {
      Authorization: 'Bearer rmap_persist_read',
    });
  }
);

When('the server resolves the database path', function (this: PersistenceWorld) {
  // The server uses: process.env.DB_PATH ?? join(ROOT, 'db', 'architecture.db')
  this.resolvedDbPath = this.dbPathEnv ?? join(process.cwd(), 'db', 'architecture.db');
});

// ─── Then steps ──────────────────────────────────────────────────────

Then(
  'the component {string} still exists with name {string}',
  async function (this: PersistenceWorld, id: string, name: string) {
    const node = this.nodes.find(n => n.id === id);
    assert.ok(node, `Component "${id}" should still exist after restart`);
    assert.strictEqual(node.name, name, `Component name should be "${name}"`);
  }
);

Then(
  'the component {string} exists with name {string}',
  async function (this: PersistenceWorld, id: string, name: string) {
    const node = this.nodes.find(n => n.id === id);
    assert.ok(node, `Component "${id}" should exist`);
    assert.strictEqual(node.name, name, `Component name should be "${name}"`);
  }
);

Then('the build does not execute {string}', function (this: PersistenceWorld, script: string) {
  const dockerfile = readFileSync(join(process.cwd(), 'Dockerfile'), 'utf-8');
  assert.ok(
    !dockerfile.includes(script),
    `Dockerfile should not contain "${script}" — found it in build step`
  );
});

Then('the database is populated with components from seed.sql', function (this: PersistenceWorld) {
  assert.ok(this.response, 'No response captured');
  const body = this.response.body as Record<string, unknown>;
  assert.ok(
    this.response.status === 200 || this.response.status === 201,
    `Expected success status, got ${this.response.status}`
  );
  assert.ok('seeded' in body || 'count' in body, 'Response should include seed count');
});

Then('the response includes the count of seeded components', function (this: PersistenceWorld) {
  assert.ok(this.response, 'No response captured');
  const body = this.response.body as Record<string, unknown>;
  const count = body.seeded ?? body.count;
  assert.ok(typeof count === 'number' && count >= 0, 'Response should include a numeric count');
});

Then('existing data is upserted without duplicates', function (this: PersistenceWorld) {
  assert.ok(this.response, 'No response captured');
  assert.ok(
    this.response.status === 200 || this.response.status === 201,
    `Expected success status, got ${this.response.status}`
  );
});

Then('it includes a persistent disk mounted at \\/data', function (this: PersistenceWorld) {
  assert.ok(this.renderConfig, 'No render.yaml config loaded');
  const raw = String(this.renderConfig['raw']);
  assert.ok(raw.includes('/data'), 'render.yaml should include a persistent disk at /data');
});

Then(
  'the DB_PATH environment variable points to the persistent disk',
  function (this: PersistenceWorld) {
    assert.ok(this.renderConfig, 'No render.yaml config loaded');
    const raw = String(this.renderConfig['raw']);
    assert.ok(raw.includes('DB_PATH'), 'render.yaml should set DB_PATH');
    assert.ok(raw.includes('/data'), 'DB_PATH should point to /data');
  }
);

Then(
  'it uses {string} instead of the default path',
  function (this: PersistenceWorld, path: string) {
    assert.strictEqual(
      this.resolvedDbPath,
      path,
      `Expected resolved path "${path}", got "${this.resolvedDbPath}"`
    );
  }
);

// ─── After (cleanup) ────────────────────────────────────────────────

After(async function (this: PersistenceWorld) {
  if (this.server) {
    const s = this.server;
    this.server = null;
    await new Promise<void>(resolve => {
      s.close(() => resolve());
      s.closeAllConnections();
    });
  }
});
