import { strict as assert } from 'node:assert';
import http from 'node:http';

import { After, Before, Given, When } from '@cucumber/cucumber';

import type { RequestLogEntry } from '../../src/adapters/api/index.js';
import {
  buildAdminRoutes,
  createApp,
  createAuthMiddleware,
  RateLimiter,
} from '../../src/adapters/api/index.js';
import type { ApiKeyProps, ApiKeyScope } from '../../src/domain/entities/api-key.js';
import { ApiKey } from '../../src/domain/entities/api-key.js';
import { Edge } from '../../src/domain/entities/edge.js';
import { Node } from '../../src/domain/entities/node.js';
import { Version } from '../../src/domain/entities/version.js';
import type {
  IApiKeyRepository,
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
} from '../../src/domain/index.js';
import { hashKey, ValidateApiKey } from '../../src/use-cases/index.js';

/** Auth/scopes/management/security/validation step definitions. */
interface AuthApiWorld {
  nodes: Node[];
  edges: Edge[];
  versions: Version[];
  features: unknown[];
  server: http.Server | null;
  baseUrl: string;
  response: {
    status: number;
    body: unknown;
    headers: Record<string, string>;
  } | null;
  currentApiKey: string | null;
  adminApiKey: string | null;
  apiKeys: Map<
    string,
    {
      rawKey: string;
      scopes: string[];
      name: string;
      expired?: boolean;
      revoked?: boolean;
    }
  >;
  apiKeyRepo: InMemoryApiKeyRepo | null;
  requestLogs: RequestLogEntry[];
  envOverrides: Record<string, string | undefined>;
  rateLimiter: RateLimiter | null;
  [key: string]: unknown;
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
    const old = this.keys[idx];
    this.keys[idx] = new ApiKey({
      id: old.id,
      name: old.name,
      key_hash: old.key_hash,
      salt: old.salt,
      scopes: old.scopes,
      created_at: old.created_at,
      is_active: false,
      expires_at: old.expires_at,
      last_used_at: old.last_used_at,
    });
  }

  async updateLastUsed(id: number): Promise<void> {
    const idx = this.keys.findIndex(k => k.id === id);
    if (idx === -1) {
      return;
    }
    const old = this.keys[idx];
    this.keys[idx] = new ApiKey({
      id: old.id,
      name: old.name,
      key_hash: old.key_hash,
      salt: old.salt,
      scopes: old.scopes,
      created_at: old.created_at,
      is_active: old.is_active,
      expires_at: old.expires_at,
      last_used_at: new Date().toISOString(),
    });
  }

  addKey(
    rawKey: string,
    info: {
      name: string;
      scopes: string[];
      expired?: boolean;
      revoked?: boolean;
    }
  ): void {
    const salt = 'test-salt';
    const keyHash = hashKey(rawKey, salt);
    const past = '2020-01-01T00:00:00.000Z';
    this.keys.push(
      new ApiKey({
        id: this.nextId++,
        name: info.name,
        key_hash: keyHash,
        salt,
        scopes: info.scopes as ApiKeyScope[],
        created_at: new Date().toISOString(),
        is_active: !info.revoked,
        expires_at: info.expired ? past : null,
        last_used_at: null,
      })
    );
  }
}

function buildRepos(world: AuthApiWorld) {
  const nodeRepo: INodeRepository = {
    findAll: async () => world.nodes,
    findById: async (id: string) => {
      if (id === 'trigger-500') {
        throw new Error('DB connection lost');
      }
      return world.nodes.find(n => n.id === id) ?? null;
    },
    findByType: async (type: string) => world.nodes.filter(n => n.type === type),
    findByLayer: async (lid: string) => world.nodes.filter(n => n.layer === lid),
    exists: async (id: string) => world.nodes.some(n => n.id === id),
    save: async (node: Node) => {
      world.nodes.push(node);
    },
    delete: async (id: string) => {
      world.nodes = world.nodes.filter(n => n.id !== id);
    },
  };
  const edgeRepo: IEdgeRepository = {
    findAll: async () => world.edges,
    findById: async (id: number) => world.edges.find(e => e.id === id) ?? null,
    findBySource: async (sid: string) => world.edges.filter(e => e.source_id === sid),
    findByTarget: async (tid: string) => world.edges.filter(e => e.target_id === tid),
    findByType: async (type: string) => world.edges.filter(e => e.type === type),
    findRelationships: async () => world.edges.filter(e => !e.isContainment()),
    existsBySrcTgtType: async (src: string, tgt: string, type: string) =>
      world.edges.some(e => e.source_id === src && e.target_id === tgt && e.type === type),
    save: async (edge: Edge) => {
      const nextId = world.edges.length > 0 ? Math.max(...world.edges.map(e => e.id ?? 0)) + 1 : 1;
      const saved = new Edge({ ...edge.toJSON(), id: edge.id ?? nextId });
      world.edges.push(saved);
      return saved;
    },
    delete: async (id: number) => {
      world.edges = world.edges.filter(e => e.id !== id);
    },
  };
  const versionRepo: IVersionRepository = {
    findAll: async () => world.versions,
    findByNode: async (nid: string) => world.versions.filter(v => v.node_id === nid),
    findByNodeAndVersion: async (nid: string, ver: string) =>
      world.versions.find(v => v.node_id === nid && v.version === ver) ?? null,
    save: async (version: Version) => {
      world.versions.push(version);
    },
    deleteByNode: async (nid: string) => {
      world.versions = world.versions.filter(v => v.node_id !== nid);
    },
  };
  const featureRepo: IFeatureRepository = {
    findAll: async () => world.features as never[],
    findByNode: async () => [],
    findByNodeAndVersion: async () => [],
    save: async () => {},
    deleteAll: async () => {
      world.features = [];
    },
    deleteByNode: async () => {},
    deleteByNodeAndFilename: async () => false,
    getStepCountSummary: async () => ({ totalSteps: 0, featureCount: 0 }),
  };
  return { nodeRepo, edgeRepo, versionRepo, featureRepo };
}

function ensureWorldInit(world: AuthApiWorld): void {
  world.nodes ??= [];
  world.edges ??= [];
  world.versions ??= [];
  world.features ??= [];
  world.apiKeys ??= new Map();
  world.requestLogs ??= [];
  world.envOverrides ??= {};
  // Ensure default layers exist for component creation
  for (const id of ['supervisor-layer', 'shared-state']) {
    if (!world.nodes.some(n => n.id === id)) {
      world.nodes.push(new Node({ id, name: id, type: 'layer' }));
    }
  }
}

async function stopServer(world: AuthApiWorld): Promise<void> {
  if (world.server) {
    const s = world.server;
    world.server = null;
    await new Promise<void>(resolve => {
      s.close(() => resolve());
      s.closeAllConnections();
    });
  }
}

function addKeyToRepo(
  world: AuthApiWorld,
  rawKey: string,
  info: {
    name: string;
    scopes: string[];
    expired?: boolean;
    revoked?: boolean;
  }
): void {
  if (world.apiKeyRepo && typeof world.apiKeyRepo.addKey === 'function') {
    world.apiKeyRepo.addKey(rawKey, info);
  }
}

async function startAuthServer(world: AuthApiWorld): Promise<void> {
  ensureWorldInit(world);
  await stopServer(world);
  world.response = null;
  world.requestLogs = [];

  const repo = new InMemoryApiKeyRepo();
  world.apiKeyRepo = repo;

  // Sync pre-existing keys
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

  const writeLimit = (world.writeRateLimit as number | undefined) ?? undefined;
  const rateLimiter = world.rateLimiter ?? new RateLimiter(writeLimit ? { writeLimit } : undefined);
  world.rateLimiter = rateLimiter;

  const adminRoutes = buildAdminRoutes({ apiKeyRepo: repo });

  const allowedOrigins = world.envOverrides?.ALLOWED_ORIGINS
    ? world.envOverrides.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : undefined;

  const app = createApp(repos, {
    authMiddleware: authMw,
    rateLimiter,
    adminRoutes,
    allowedOrigins,
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

async function authHttpRequest(
  baseUrl: string,
  method: string,
  path: string,
  options?: { body?: string; headers?: Record<string, string> }
): Promise<{
  status: number;
  body: unknown;
  headers: Record<string, string>;
}> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const extraHeaders = options?.headers ?? {};
    const body = options?.body;
    const contentHeaders = body
      ? {
          'Content-Type': 'application/json',
          'Content-Length': String(Buffer.byteLength(body)),
        }
      : {};
    const reqOptions: http.RequestOptions = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: {
        Connection: 'close',
        ...contentHeaders,
        ...extraHeaders,
      },
      agent: false,
    };

    const req = http.request(reqOptions, res => {
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
        const headers: Record<string, string> = {};
        for (const [key, val] of Object.entries(res.headers)) {
          if (typeof val === 'string') {
            headers[key] = val;
          }
        }
        resolve({
          status: res.statusCode ?? 500,
          body: parsed,
          headers,
        });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

// ─── Before hook: auto-start auth server for @v1 scenarios ──────────

Before({ tags: '@v1' }, async function (this: AuthApiWorld) {
  ensureWorldInit(this);
  this.currentApiKey = null;
  this.adminApiKey = null;
  this.rateLimiter = null;
  this.apiKeyRepo = null;
});

// ─── Given steps ─────────────────────────────────────────────────────

Given('the API server is running with authentication enabled', async function (this: AuthApiWorld) {
  await startAuthServer(this);
});

Given(
  'a valid API key {string} with scope {string} exists',
  function (this: AuthApiWorld, rawKey: string, scope: string) {
    if (!this.apiKeys) {
      this.apiKeys = new Map();
    }
    const info = { rawKey, scopes: [scope], name: `key-${rawKey}` };
    this.apiKeys.set(rawKey, info);
    this.currentApiKey = rawKey;
    addKeyToRepo(this, rawKey, info);
  }
);

Given('a valid API key with scope {string}', async function (this: AuthApiWorld, scope: string) {
  if (!this.apiKeys) {
    this.apiKeys = new Map();
  }
  const rawKey = `rmap_test_${scope}_${Date.now().toString(16)}`;
  const info = { rawKey, scopes: [scope], name: `key-${scope}` };
  this.apiKeys.set(rawKey, info);
  this.currentApiKey = rawKey;
  if (scope === 'admin') {
    this.adminApiKey = rawKey;
  }
  if (!this.server) {
    await startAuthServer(this);
  } else {
    addKeyToRepo(this, rawKey, info);
  }
});

Given(
  'a valid API key with scopes {string} and {string}',
  async function (this: AuthApiWorld, s1: string, s2: string) {
    if (!this.apiKeys) {
      this.apiKeys = new Map();
    }
    const rawKey = `rmap_test_${s1}_${s2}_${Date.now().toString(16)}`;
    const info = { rawKey, scopes: [s1, s2], name: `key-${s1}-${s2}` };
    this.apiKeys.set(rawKey, info);
    this.currentApiKey = rawKey;
    if (!this.server) {
      await startAuthServer(this);
    } else {
      addKeyToRepo(this, rawKey, info);
    }
  }
);

Given(
  'a valid API key with scopes {string} and {string} but not {string}',
  async function (this: AuthApiWorld, s1: string, s2: string, _notScope: string) {
    if (!this.apiKeys) {
      this.apiKeys = new Map();
    }
    const rawKey = `rmap_test_${s1}_${s2}_${Date.now().toString(16)}`;
    const info = { rawKey, scopes: [s1, s2], name: `key-${s1}-${s2}` };
    this.apiKeys.set(rawKey, info);
    this.currentApiKey = rawKey;
    if (!this.server) {
      await startAuthServer(this);
    } else {
      addKeyToRepo(this, rawKey, info);
    }
  }
);

Given(
  'a valid API key with scope {string} only',
  async function (this: AuthApiWorld, scope: string) {
    if (!this.apiKeys) {
      this.apiKeys = new Map();
    }
    const rawKey = `rmap_test_${scope}_only_${Date.now().toString(16)}`;
    const info = { rawKey, scopes: [scope], name: `key-${scope}-only` };
    this.apiKeys.set(rawKey, info);
    this.currentApiKey = rawKey;
    if (!this.server) {
      await startAuthServer(this);
    } else {
      addKeyToRepo(this, rawKey, info);
    }
  }
);

Given('an expired API key {string} exists', function (this: AuthApiWorld, rawKey: string) {
  if (!this.apiKeys) {
    this.apiKeys = new Map();
  }
  const info = { rawKey, scopes: ['read'], name: `expired-${rawKey}`, expired: true };
  this.apiKeys.set(rawKey, info);
  addKeyToRepo(this, rawKey, info);
});

Given('a revoked API key {string} exists', function (this: AuthApiWorld, rawKey: string) {
  if (!this.apiKeys) {
    this.apiKeys = new Map();
  }
  const info = { rawKey, scopes: ['read'], name: `revoked-${rawKey}`, revoked: true };
  this.apiKeys.set(rawKey, info);
  addKeyToRepo(this, rawKey, info);
});

Given('{int} API keys exist in the database', function (this: AuthApiWorld, count: number) {
  if (!this.apiKeys) {
    this.apiKeys = new Map();
  }
  for (let i = 0; i < count; i++) {
    const rawKey = `rmap_bulk_${i}_${Date.now().toString(16)}`;
    const info = { rawKey, scopes: ['read'], name: `bulk-key-${i}` };
    this.apiKeys.set(rawKey, info);
    addKeyToRepo(this, rawKey, info);
  }
});

Given('a key with name {string} exists and is active', function (this: AuthApiWorld, name: string) {
  if (!this.apiKeys) {
    this.apiKeys = new Map();
  }
  const rawKey = `rmap_active_${name}_${Date.now().toString(16)}`;
  const info = { rawKey, scopes: ['read'], name };
  this.apiKeys.set(rawKey, info);
  addKeyToRepo(this, rawKey, info);
});

Given(
  'I generate a fresh key with name {string} and scopes {string}',
  function (this: AuthApiWorld, name: string, scopesStr: string) {
    if (!this.apiKeys) {
      this.apiKeys = new Map();
    }
    const scopes = scopesStr.split(',').map(s => s.trim());
    const rawKey = `rmap_fresh_${Date.now().toString(16)}`;
    this.apiKeys.set(rawKey, { rawKey, scopes, name });
    this.currentApiKey = rawKey;
  }
);

Given('the API server is running with max body size of 1MB', async function (this: AuthApiWorld) {
  await startAuthServer(this);
});

Given(
  'the API server is running with request logging enabled',
  async function (this: AuthApiWorld) {
    await startAuthServer(this);
    this.requestLogs = [];
  }
);

Given(
  'the API server is running with default rate limit of {int} requests per minute',
  async function (this: AuthApiWorld, limit: number) {
    this.rateLimiter = new RateLimiter({ defaultLimit: limit });
    await startAuthServer(this);
  }
);

Given(
  'the API server is running with rate limit of {int} requests per minute',
  async function (this: AuthApiWorld, limit: number) {
    this.rateLimiter = new RateLimiter({ defaultLimit: limit });
    await startAuthServer(this);
  }
);

Given(
  'the environment variable {string} is set to {string}',
  function (this: AuthApiWorld, envVar: string, value: string) {
    if (!this.envOverrides) {
      this.envOverrides = {};
    }
    this.envOverrides[envVar] = value;
  }
);

Given(
  'the environment variable {string} is not set',
  function (this: AuthApiWorld, envVar: string) {
    if (!this.envOverrides) {
      this.envOverrides = {};
    }
    this.envOverrides[envVar] = undefined;
  }
);

Given(
  'a valid API key {string} with scope {string}',
  function (this: AuthApiWorld, rawKey: string, scope: string) {
    if (!this.apiKeys) {
      this.apiKeys = new Map();
    }
    const info = { rawKey, scopes: [scope], name: `key-${rawKey}` };
    this.apiKeys.set(rawKey, info);
    this.currentApiKey = rawKey;
    addKeyToRepo(this, rawKey, info);
  }
);

// ─── When steps ──────────────────────────────────────────────────────

When(
  'I send a GET request to {string} without an API key',
  async function (this: AuthApiWorld, path: string) {
    this.response = await authHttpRequest(this.baseUrl, 'GET', path);
  }
);

When(
  'I send a GET request to {string} with header {string}',
  async function (this: AuthApiWorld, path: string, header: string) {
    const [name, ...valueParts] = header.split(':');
    const value = valueParts.join(':').trim();
    this.response = await authHttpRequest(this.baseUrl, 'GET', path, {
      headers: { [name.trim()]: value },
    });
  }
);

When(
  'I send a GET request to {string} with the key in X-API-Key header',
  async function (this: AuthApiWorld, path: string) {
    assert.ok(this.currentApiKey, 'No current API key');
    this.response = await authHttpRequest(this.baseUrl, 'GET', path, {
      headers: { 'X-API-Key': this.currentApiKey },
    });
  }
);

When(
  'I send an authenticated GET request to {string}',
  async function (this: AuthApiWorld, path: string) {
    assert.ok(this.currentApiKey, 'No current API key');
    this.response = await authHttpRequest(this.baseUrl, 'GET', path, {
      headers: { Authorization: `Bearer ${this.currentApiKey}` },
    });
  }
);

When(
  'I send an authenticated GET request to {string} with the expired key',
  async function (this: AuthApiWorld, path: string) {
    const expired = [...(this.apiKeys?.values() ?? [])].find(k => k.expired);
    assert.ok(expired, 'No expired key found');
    this.response = await authHttpRequest(this.baseUrl, 'GET', path, {
      headers: { Authorization: `Bearer ${expired.rawKey}` },
    });
  }
);

When(
  'I send an authenticated GET request to {string} with the revoked key',
  async function (this: AuthApiWorld, path: string) {
    const revoked = [...(this.apiKeys?.values() ?? [])].find(k => k.revoked);
    assert.ok(revoked, 'No revoked key found');
    this.response = await authHttpRequest(this.baseUrl, 'GET', path, {
      headers: { Authorization: `Bearer ${revoked.rawKey}` },
    });
  }
);

When(
  'I send a GET request to {string} with that key',
  async function (this: AuthApiWorld, path: string) {
    assert.ok(this.currentApiKey, 'No current API key');
    this.response = await authHttpRequest(this.baseUrl, 'GET', path, {
      headers: { Authorization: `Bearer ${this.currentApiKey}` },
    });
  }
);

When(
  'I send a GET request to {string} with the generated key as Bearer token',
  async function (this: AuthApiWorld, path: string) {
    assert.ok(this.currentApiKey, 'No current API key');
    this.response = await authHttpRequest(this.baseUrl, 'GET', path, {
      headers: { Authorization: `Bearer ${this.currentApiKey}` },
    });
  }
);

When(
  'I send a POST request to {string} with that key and body:',
  async function (this: AuthApiWorld, path: string, body: string) {
    assert.ok(this.currentApiKey, 'No current API key');
    this.response = await authHttpRequest(this.baseUrl, 'POST', path, {
      body,
      headers: { Authorization: `Bearer ${this.currentApiKey}` },
    });
  }
);

When(
  'I send an authenticated POST request to {string} with body:',
  async function (this: AuthApiWorld, path: string, body: string) {
    assert.ok(this.currentApiKey, 'No current API key');
    this.response = await authHttpRequest(this.baseUrl, 'POST', path, {
      body,
      headers: { Authorization: `Bearer ${this.currentApiKey}` },
    });
  }
);

When(
  'I send an authenticated PUT request to {string} with body:',
  async function (this: AuthApiWorld, path: string, body: string) {
    assert.ok(this.currentApiKey, 'No current API key');
    this.response = await authHttpRequest(this.baseUrl, 'PUT', path, {
      body,
      headers: { Authorization: `Bearer ${this.currentApiKey}` },
    });
  }
);

When(
  'I send an authenticated DELETE request to {string}',
  async function (this: AuthApiWorld, path: string) {
    assert.ok(this.currentApiKey, 'No current API key');
    this.response = await authHttpRequest(this.baseUrl, 'DELETE', path, {
      headers: {
        Authorization: `Bearer ${this.currentApiKey}`,
      },
    });
  }
);

When(
  'I send a POST request to {string} with that key',
  async function (this: AuthApiWorld, path: string) {
    assert.ok(this.currentApiKey, 'No current API key');
    this.response = await authHttpRequest(this.baseUrl, 'POST', path, {
      headers: { Authorization: `Bearer ${this.currentApiKey}` },
    });
  }
);

When(
  'I send a PUT request to {string} with that key',
  async function (this: AuthApiWorld, path: string) {
    assert.ok(this.currentApiKey, 'No current API key');
    this.response = await authHttpRequest(this.baseUrl, 'PUT', path, {
      headers: { Authorization: `Bearer ${this.currentApiKey}` },
    });
  }
);

After({ tags: '@v1' }, async function (this: AuthApiWorld) {
  await stopServer(this);
});
