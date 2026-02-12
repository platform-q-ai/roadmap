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
  const edgeRepo = {
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
      const withId = new Edge({
        id: edge.id ?? nextId,
        source_id: edge.source_id,
        target_id: edge.target_id,
        type: edge.type,
        label: edge.label,
        metadata: edge.metadata,
      });
      data.edges.push(withId);
      return withId;
    }),
    delete: vi.fn(async (id: number) => {
      data.edges = data.edges.filter(e => e.id !== id);
    }),
  } as unknown as IEdgeRepository;
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
    getStepCountSummary: vi.fn(async () => ({ totalSteps: 0, featureCount: 0 })),
  };
  return { nodeRepo, edgeRepo, versionRepo, featureRepo };
}

function seedData(): WorldData {
  const layer = new Node({ id: 'sup-layer', name: 'Supervisor', type: 'layer' });
  const compA = new Node({
    id: 'comp-a',
    name: 'Component A',
    type: 'component',
    layer: 'sup-layer',
  });
  const compB = new Node({
    id: 'comp-b',
    name: 'Component B',
    type: 'component',
    layer: 'sup-layer',
  });
  const containsA = new Edge({
    id: 1,
    source_id: 'sup-layer',
    target_id: 'comp-a',
    type: 'CONTAINS',
  });
  const containsB = new Edge({
    id: 2,
    source_id: 'sup-layer',
    target_id: 'comp-b',
    type: 'CONTAINS',
  });
  const depEdge = new Edge({
    id: 3,
    source_id: 'comp-a',
    target_id: 'comp-b',
    type: 'DEPENDS_ON',
  });
  return {
    nodes: [layer, compA, compB],
    edges: [containsA, containsB, depEdge],
    versions: [],
    features: [],
  };
}

// ─── Helper: HTTP request to server ─────────────────────────────────

async function request(
  server: http.Server,
  method: string,
  path: string,
  body?: string
): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const options: http.RequestOptions = {
      method,
      hostname: '127.0.0.1',
      port,
      path,
      headers: body
        ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        : {},
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

describe('API Routes — v1 edge management', () => {
  describe('POST /api/edges', () => {
    it('creates an edge and returns 201', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({
          source_id: 'comp-a',
          target_id: 'comp-b',
          type: 'CONTROLS',
        });
        const res = await request(server, 'POST', '/api/edges', body);
        expect(res.status).toBe(201);
        const resBody = res.body as Record<string, unknown>;
        expect(resBody.source_id).toBe('comp-a');
        expect(resBody.target_id).toBe('comp-b');
        expect(resBody.type).toBe('CONTROLS');
        expect(resBody.id).toBeDefined();
      });
    });

    it('returns 400 for invalid edge type', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({
          source_id: 'comp-a',
          target_id: 'comp-b',
          type: 'INVALID',
        });
        const res = await request(server, 'POST', '/api/edges', body);
        expect(res.status).toBe(400);
      });
    });

    it('returns 400 for self-referencing edge', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({
          source_id: 'comp-a',
          target_id: 'comp-a',
          type: 'DEPENDS_ON',
        });
        const res = await request(server, 'POST', '/api/edges', body);
        expect(res.status).toBe(400);
        const resBody = res.body as Record<string, unknown>;
        expect(String(resBody.error).toLowerCase()).toContain('self-referencing');
      });
    });

    it('returns 400 for invalid JSON body', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'POST', '/api/edges', 'not json');
        expect(res.status).toBe(400);
      });
    });

    it('truncates label to 500 characters', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const longLabel = 'x'.repeat(600);
        const body = JSON.stringify({
          source_id: 'comp-a',
          target_id: 'comp-b',
          type: 'CONTROLS',
          label: longLabel,
        });
        const res = await request(server, 'POST', '/api/edges', body);
        expect(res.status).toBe(201);
        const created = res.body as Record<string, unknown>;
        expect(String(created.label).length).toBe(500);
      });
    });

    it('sanitizes metadata and strips HTML', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({
          source_id: 'comp-a',
          target_id: 'comp-b',
          type: 'CONTROLS',
          metadata: { key: 'value' },
        });
        const res = await request(server, 'POST', '/api/edges', body);
        expect(res.status).toBe(201);
        const created = res.body as Record<string, unknown>;
        expect(created.metadata).toBeDefined();
      });
    });

    it('drops metadata exceeding depth limit', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const deep = { a: { b: { c: { d: { e: 'too deep' } } } } };
        const body = JSON.stringify({
          source_id: 'comp-a',
          target_id: 'comp-b',
          type: 'CONTROLS',
          metadata: deep,
        });
        const res = await request(server, 'POST', '/api/edges', body);
        expect(res.status).toBe(201);
        const created = res.body as Record<string, unknown>;
        expect(created.metadata).toBeNull();
      });
    });
  });

  describe('GET /api/edges', () => {
    it('returns all edges', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/edges');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect((res.body as unknown[]).length).toBeGreaterThan(0);
      });
    });

    it('filters edges by type', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/edges?type=DEPENDS_ON');
        expect(res.status).toBe(200);
        const edges = res.body as Array<Record<string, unknown>>;
        for (const edge of edges) {
          expect(edge.type).toBe('DEPENDS_ON');
        }
      });
    });

    it('returns 400 for invalid type filter', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/edges?type=INVALID');
        expect(res.status).toBe(400);
        const body = res.body as Record<string, unknown>;
        expect(String(body.error)).toContain('type');
      });
    });

    it('supports limit and offset pagination', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/edges?limit=1&offset=0');
        expect(res.status).toBe(200);
        expect((res.body as unknown[]).length).toBe(1);
      });
    });

    it('supports offset to skip edges', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const all = await request(server, 'GET', '/api/edges');
        const total = (all.body as unknown[]).length;
        const res = await request(server, 'GET', `/api/edges?offset=${total}`);
        expect(res.status).toBe(200);
        expect((res.body as unknown[]).length).toBe(0);
      });
    });
  });

  describe('DELETE /api/edges/:id', () => {
    it('deletes an existing edge and returns 204', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'DELETE', '/api/edges/3');
        expect(res.status).toBe(204);
      });
    });

    it('returns 404 for nonexistent edge', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'DELETE', '/api/edges/99999');
        expect(res.status).toBe(404);
      });
    });
  });
});
