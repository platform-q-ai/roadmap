import http from 'node:http';

import { createApp } from '@adapters/api/index.js';
import type {
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
} from '@domain/index.js';
import { Edge, Feature, Node, Version } from '@domain/index.js';
import { describe, expect, it, vi } from 'vitest';

// ─── Helper: in-memory repos ────────────────────────────────────────

interface WorldData {
  nodes: Node[];
  edges: Edge[];
  versions: Version[];
  features: Feature[];
}

function buildTestRepos(data: WorldData) {
  const nodeRepo: INodeRepository = {
    findAll: vi.fn(async () => data.nodes),
    findById: vi.fn(async (id: string) => data.nodes.find(n => n.id === id) ?? null),
    findByType: vi.fn(async (type: string) => data.nodes.filter(n => n.type === type)),
    findByLayer: vi.fn(async (layerId: string) => data.nodes.filter(n => n.layer === layerId)),
    exists: vi.fn(async (id: string) => data.nodes.some(n => n.id === id)),
    save: vi.fn(async (node: Node) => {
      data.nodes.push(node);
    }),
    delete: vi.fn(async (id: string) => {
      data.nodes = data.nodes.filter(n => n.id !== id);
    }),
  };
  const edgeRepo: IEdgeRepository = {
    findAll: vi.fn(async () => data.edges),
    findById: vi.fn(async (id: number) => data.edges.find(e => e.id === id) ?? null),
    findBySource: vi.fn(async (sid: string) => data.edges.filter(e => e.source_id === sid)),
    findByTarget: vi.fn(async (tid: string) => data.edges.filter(e => e.target_id === tid)),
    findByType: vi.fn(async (type: string) => data.edges.filter(e => e.type === type)),
    findRelationships: vi.fn(async () => data.edges.filter(e => !e.isContainment())),
    existsBySrcTgtType: vi.fn(async (src: string, tgt: string, type: string) =>
      data.edges.some(e => e.source_id === src && e.target_id === tgt && e.type === type)
    ),
    save: vi.fn(async (edge: Edge) => {
      const nextId = data.edges.length > 0 ? Math.max(...data.edges.map(e => e.id ?? 0)) + 1 : 1;
      const saved = new Edge({ ...edge.toJSON(), id: edge.id ?? nextId });
      data.edges.push(saved);
      return saved;
    }),
    delete: vi.fn(async (id: number) => {
      data.edges = data.edges.filter(e => e.id !== id);
    }),
  };
  const versionRepo: IVersionRepository = {
    findAll: vi.fn(async () => data.versions),
    findByNode: vi.fn(async (nid: string) => data.versions.filter(v => v.node_id === nid)),
    findByNodeAndVersion: vi.fn(
      async (nid: string, ver: string) =>
        data.versions.find(v => v.node_id === nid && v.version === ver) ?? null
    ),
    save: vi.fn(async (version: Version) => {
      data.versions.push(version);
    }),
    deleteByNode: vi.fn(async (nid: string) => {
      data.versions = data.versions.filter(v => v.node_id !== nid);
    }),
  };
  const featureRepo: IFeatureRepository = {
    findAll: vi.fn(async () => data.features),
    findByNode: vi.fn(async (nid: string) => data.features.filter(f => f.node_id === nid)),
    findByNodeAndVersion: vi.fn(async (nid: string, ver: string) =>
      data.features.filter(f => f.node_id === nid && f.version === ver)
    ),
    save: vi.fn(async (feature: Feature) => {
      data.features.push(feature);
    }),
    saveMany: vi.fn(async (features: Feature[]) => {
      for (const f of features) {
        data.features.push(f);
      }
    }),
    deleteAll: vi.fn(async () => {
      data.features = [];
    }),
    deleteByNode: vi.fn(async (nid: string) => {
      data.features = data.features.filter(f => f.node_id !== nid);
    }),
    deleteByNodeAndFilename: vi.fn(async (nid: string, filename: string) => {
      const before = data.features.length;
      data.features = data.features.filter(f => !(f.node_id === nid && f.filename === filename));
      return data.features.length < before;
    }),
    deleteByNodeAndVersionAndFilename: vi.fn(async (nid: string, ver: string, filename: string) => {
      const before = data.features.length;
      data.features = data.features.filter(
        f => !(f.node_id === nid && f.version === ver && f.filename === filename)
      );
      return data.features.length < before;
    }),
    deleteByNodeAndVersion: vi.fn(async (nid: string, ver: string) => {
      const before = data.features.length;
      data.features = data.features.filter(f => !(f.node_id === nid && f.version === ver));
      return before - data.features.length;
    }),
    getStepCountSummary: vi.fn(async () => ({ totalSteps: 0, featureCount: 0 })),
    search: async () => [],
  };
  return { nodeRepo, edgeRepo, versionRepo, featureRepo };
}

function seedFilterData(): WorldData {
  const layer = new Node({ id: 'sup-layer', name: 'Supervisor', type: 'layer' });
  const layer2 = new Node({ id: 'infra-layer', name: 'Infrastructure', type: 'layer' });
  const comp1 = new Node({
    id: 'worker',
    name: 'Worker',
    type: 'component',
    layer: 'sup-layer',
    tags: ['runtime', 'core'],
  });
  const comp2 = new Node({
    id: 'proxy-handler',
    name: 'Proxy Handler',
    type: 'component',
    layer: 'sup-layer',
    tags: ['network'],
  });
  const store1 = new Node({
    id: 'event-store',
    name: 'Event Store',
    type: 'store',
    layer: 'infra-layer',
    tags: ['runtime'],
  });
  const appNode = new Node({
    id: 'cli-app',
    name: 'CLI App',
    type: 'app',
    layer: 'sup-layer',
  });
  return {
    nodes: [layer, layer2, comp1, comp2, store1, appNode],
    edges: [new Edge({ id: 1, source_id: 'sup-layer', target_id: 'worker', type: 'CONTAINS' })],
    versions: [],
    features: [],
  };
}

// ─── Helper: HTTP request ───────────────────────────────────────────

async function request(
  server: http.Server,
  method: string,
  path: string
): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const options: http.RequestOptions = {
      method,
      hostname: '127.0.0.1',
      port,
      path,
      headers: {},
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
    req.end();
  });
}

async function withServer(
  repos: ReturnType<typeof buildTestRepos>,
  fn: (server: http.Server) => Promise<void>
) {
  const app = createApp(repos);
  const server = app.listen(0);
  try {
    await fn(server);
  } finally {
    await new Promise<void>(resolve => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('API Component Filtering (GET /api/components)', () => {
  describe('Filter by type', () => {
    it('returns only store-type components when ?type=store', async () => {
      const repos = buildTestRepos(seedFilterData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components?type=store');
        expect(res.status).toBe(200);
        const items = res.body as Array<Record<string, unknown>>;
        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBeGreaterThan(0);
        for (const item of items) {
          expect(item.type).toBe('store');
        }
      });
    });

    it('returns only component-type when ?type=component', async () => {
      const repos = buildTestRepos(seedFilterData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components?type=component');
        expect(res.status).toBe(200);
        const items = res.body as Array<Record<string, unknown>>;
        expect(items.length).toBe(2); // worker + proxy-handler
        for (const item of items) {
          expect(item.type).toBe('component');
        }
      });
    });
  });

  describe('Filter by layer', () => {
    it('returns only components in the specified layer', async () => {
      const repos = buildTestRepos(seedFilterData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components?layer=infra-layer');
        expect(res.status).toBe(200);
        const items = res.body as Array<Record<string, unknown>>;
        expect(items.length).toBe(1);
        expect(items[0].id).toBe('event-store');
        expect(items[0].layer).toBe('infra-layer');
      });
    });
  });

  describe('Filter by tag', () => {
    it('returns only components with the specified tag', async () => {
      const repos = buildTestRepos(seedFilterData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components?tag=runtime');
        expect(res.status).toBe(200);
        const items = res.body as Array<Record<string, unknown>>;
        expect(items.length).toBe(2); // worker + event-store
        for (const item of items) {
          expect((item.tags as string[]).includes('runtime')).toBe(true);
        }
      });
    });

    it('returns empty array for a tag that no component has', async () => {
      const repos = buildTestRepos(seedFilterData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components?tag=nonexistent');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
      });
    });
  });

  describe('Search by name', () => {
    it('returns components whose name contains the search term (case-insensitive)', async () => {
      const repos = buildTestRepos(seedFilterData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components?search=proxy');
        expect(res.status).toBe(200);
        const items = res.body as Array<Record<string, unknown>>;
        expect(items.length).toBe(1);
        expect(items[0].id).toBe('proxy-handler');
      });
    });

    it('search is case-insensitive', async () => {
      const repos = buildTestRepos(seedFilterData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components?search=WORKER');
        expect(res.status).toBe(200);
        const items = res.body as Array<Record<string, unknown>>;
        expect(items.length).toBe(1);
        expect(items[0].id).toBe('worker');
      });
    });
  });

  describe('Combined filters', () => {
    it('filters by type AND layer simultaneously', async () => {
      const repos = buildTestRepos(seedFilterData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components?type=component&layer=sup-layer');
        expect(res.status).toBe(200);
        const items = res.body as Array<Record<string, unknown>>;
        for (const item of items) {
          expect(item.type).toBe('component');
          expect(item.layer).toBe('sup-layer');
        }
      });
    });

    it('filters by type AND tag simultaneously', async () => {
      const repos = buildTestRepos(seedFilterData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components?type=component&tag=runtime');
        expect(res.status).toBe(200);
        const items = res.body as Array<Record<string, unknown>>;
        expect(items.length).toBe(1);
        expect(items[0].id).toBe('worker');
      });
    });
  });

  describe('Empty results', () => {
    it('returns empty array for nonexistent type', async () => {
      const repos = buildTestRepos(seedFilterData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components?type=nonexistent');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
      });
    });
  });

  describe('No filters', () => {
    it('returns all non-layer components when no query params', async () => {
      const repos = buildTestRepos(seedFilterData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components');
        expect(res.status).toBe(200);
        const items = res.body as Array<Record<string, unknown>>;
        // Should exclude layers (sup-layer, infra-layer) = 4 non-layer nodes
        expect(items.length).toBe(4);
        for (const item of items) {
          expect(item.type).not.toBe('layer');
        }
      });
    });
  });

  describe('Layers always excluded', () => {
    it('never includes layer nodes even if ?type=layer', async () => {
      const repos = buildTestRepos(seedFilterData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components?type=layer');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
      });
    });
  });
});
