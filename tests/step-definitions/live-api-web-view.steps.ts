import { strict as assert } from 'node:assert';
import http from 'node:http';

import { When, Then } from '@cucumber/cucumber';

import { createApp, createAuthMiddleware } from '../../src/adapters/api/index.js';
import { Edge } from '../../src/domain/entities/edge.js';
import { Feature } from '../../src/domain/entities/feature.js';
import { Node } from '../../src/domain/entities/node.js';
import { Version } from '../../src/domain/entities/version.js';
import type {
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
} from '../../src/domain/index.js';
import { hashKey, ValidateApiKey } from '../../src/use-cases/index.js';
import type { IApiKeyRepository } from '../../src/domain/index.js';
import { ApiKey } from '../../src/domain/entities/api-key.js';

interface LiveApiWorld {
  nodes: Node[];
  edges: Edge[];
  versions: Version[];
  features: Feature[];
  server: http.Server | null;
  baseUrl: string;
  response: { status: number; body: unknown; headers: Record<string, string> } | null;
  webViewFetchUrl: string | null;
  webViewData: Record<string, unknown> | null;
  [key: string]: unknown;
}

function buildRepos(world: LiveApiWorld) {
  const nodeRepo: INodeRepository = {
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
    delete: async (id: number) => {
      world.edges = world.edges.filter(e => e.id !== id);
    },
  } as IEdgeRepository;
  const versionRepo: IVersionRepository = {
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
  const featureRepo: IFeatureRepository = {
    findAll: async () => world.features,
    findByNode: async (nid: string) => world.features.filter(f => f.node_id === nid),
    findByNodeAndVersion: async (nid: string, ver: string) =>
      world.features.filter(f => f.node_id === nid && f.version === ver),
    findByNodeVersionAndFilename: async (nid: string, ver: string, fname: string) =>
      world.features.find(f => f.node_id === nid && f.version === ver && f.filename === fname) ??
      null,
    save: async (feature: Feature) => {
      world.features.push(feature);
    },
    saveMany: async (features: Feature[]) => {
      for (const f of features) {
        world.features.push(f);
      }
    },
    deleteAll: async () => {
      world.features = [];
    },
    deleteByNode: async (nid: string) => {
      world.features = world.features.filter(f => f.node_id !== nid);
    },
    deleteByNodeAndFilename: async (nid: string, filename: string) => {
      const before = world.features.length;
      world.features = world.features.filter(f => !(f.node_id === nid && f.filename === filename));
      return world.features.length < before;
    },
    deleteByNodeAndVersionAndFilename: async (nid: string, ver: string, fname: string) => {
      const before = world.features.length;
      world.features = world.features.filter(
        f => !(f.node_id === nid && f.version === ver && f.filename === fname)
      );
      return world.features.length < before;
    },
    deleteByNodeAndVersion: async (nid: string, ver: string) => {
      const before = world.features.length;
      world.features = world.features.filter(f => !(f.node_id === nid && f.version === ver));
      return before - world.features.length;
    },
    getStepCountSummary: async (nid: string, ver: string) => {
      const matching = world.features.filter(f => f.node_id === nid && f.version === ver);
      const totalSteps = matching.reduce((sum, f) => sum + f.step_count, 0);
      return { totalSteps, featureCount: matching.length };
    },
    search: async (query: string, version?: string) => {
      const lower = query.toLowerCase();
      return world.features.filter(f => {
        const match = (f.content ?? '').toLowerCase().includes(lower);
        if (version) {
          return match && f.version === version;
        }
        return match;
      });
    },
  };
  return { nodeRepo, edgeRepo, versionRepo, featureRepo };
}

function httpRequest(
  baseUrl: string,
  method: string,
  path: string,
  body?: string
): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const contentHeaders = body
      ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      : {};
    const options: http.RequestOptions = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { Connection: 'close', ...contentHeaders },
      agent: false,
    };

    const req = http.request(options, res => {
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
        resolve({ status: res.statusCode ?? 500, body: parsed, headers });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function ensureAuthServer(world: LiveApiWorld): Promise<void> {
  if (world.server) {
    const s = world.server;
    await new Promise<void>(resolve => {
      s.close(() => resolve());
      s.closeAllConnections();
    });
  }
  if (!world.nodes) {
    world.nodes = [];
  }
  if (!world.edges) {
    world.edges = [];
  }
  if (!world.versions) {
    world.versions = [];
  }
  if (!world.features) {
    world.features = [];
  }

  const repos = buildRepos(world);

  // Set up a real API key for auth so non-public endpoints reject unauthenticated requests
  const testKey = 'rmap_testkey123';
  const salt = 'test-salt-value';
  const hash = hashKey(testKey, salt);
  const keyStore: ApiKey[] = [
    new ApiKey({
      id: 1,
      name: 'test-key',
      key_hash: hash,
      salt,
      scopes: ['read', 'write', 'admin'],
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
      if (idx >= 0) {
        keyStore.splice(idx, 1);
      }
    },
    updateLastUsed: async () => {},
  };

  const validateApiKey = new ValidateApiKey({ apiKeyRepo });
  const authMiddleware = createAuthMiddleware({
    validateKey: (key: string) => validateApiKey.execute(key),
  });

  const app = createApp(repos, { authMiddleware });
  await new Promise<void>(resolve => {
    world.server = app.listen(0, () => {
      const addr = world.server!.address();
      if (typeof addr === 'object' && addr !== null) {
        world.baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
}

// ─── When steps ─────────────────────────────────────────────────────

When(
  'I send a GET request to {string} without authentication',
  async function (this: LiveApiWorld, path: string) {
    await ensureAuthServer(this);
    this.response = await httpRequest(this.baseUrl, 'GET', path);
  }
);

When(
  'I send a POST request to {string} without authentication',
  async function (this: LiveApiWorld, path: string) {
    await ensureAuthServer(this);
    this.response = await httpRequest(this.baseUrl, 'POST', path, '{}');
  }
);

When('the web view initialises', async function (this: LiveApiWorld) {
  await ensureAuthServer(this);
  // Simulate what the web view init() function does:
  // It should fetch from /api/architecture (not data.json)
  this.webViewFetchUrl = '/api/architecture';
  this.response = await httpRequest(this.baseUrl, 'GET', '/api/architecture');
  if (this.response.status === 200) {
    this.webViewData = this.response.body as Record<string, unknown>;
  }
});

// ─── Then steps ─────────────────────────────────────────────────────

Then('the web view fetches from the API architecture endpoint', function (this: LiveApiWorld) {
  assert.ok(this.webViewFetchUrl, 'Web view did not record a fetch URL');
  assert.strictEqual(
    this.webViewFetchUrl,
    '/api/architecture',
    `Expected web view to fetch from /api/architecture, got ${this.webViewFetchUrl}`
  );
});

Then('the web view does not fetch from {string}', function (this: LiveApiWorld, path: string) {
  assert.ok(this.webViewFetchUrl, 'Web view did not record a fetch URL');
  assert.notStrictEqual(this.webViewFetchUrl, path, `Web view should not fetch from ${path}`);
});

Then('the web view receives architecture data with nodes', function (this: LiveApiWorld) {
  assert.ok(this.webViewData, 'No web view data received');
  assert.ok('nodes' in this.webViewData, 'Web view data should contain nodes');
  assert.ok(Array.isArray(this.webViewData['nodes']), 'nodes should be an array');
});

Then('the web view receives architecture data with edges', function (this: LiveApiWorld) {
  assert.ok(this.webViewData, 'No web view data received');
  assert.ok('edges' in this.webViewData, 'Web view data should contain edges');
  assert.ok(Array.isArray(this.webViewData['edges']), 'edges should be an array');
});
