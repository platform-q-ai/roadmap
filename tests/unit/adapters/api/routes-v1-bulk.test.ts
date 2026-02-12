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
  const shared = new Node({ id: 'shared-state', name: 'Shared State', type: 'layer' });
  const comp = new Node({
    id: 'comp-a',
    name: 'Component A',
    type: 'component',
    layer: 'sup-layer',
  });
  const edge = new Edge({ id: 1, source_id: 'sup-layer', target_id: 'comp-a', type: 'CONTAINS' });
  const ver = new Version({
    node_id: 'comp-a',
    version: 'mvp',
    progress: 50,
    status: 'in-progress',
  });
  return {
    nodes: [layer, shared, comp],
    edges: [edge],
    versions: [ver],
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

describe('API Routes — v1 bulk operations', () => {
  describe('POST /api/bulk/components', () => {
    it('creates multiple components and returns 201 with created count', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({
          components: [
            { id: 'bulk-a', name: 'Bulk A', type: 'component', layer: 'sup-layer' },
            { id: 'bulk-b', name: 'Bulk B', type: 'store', layer: 'shared-state' },
          ],
        });
        const res = await request(server, 'POST', '/api/bulk/components', body);
        expect(res.status).toBe(201);
        const resBody = res.body as Record<string, unknown>;
        expect(resBody.created).toBe(2);
        expect(resBody.errors).toEqual([]);
      });
    });

    it('returns 207 with partial failure when some components already exist', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({
          components: [
            { id: 'new-comp', name: 'New', type: 'component', layer: 'sup-layer' },
            { id: 'comp-a', name: 'Duplicate', type: 'component', layer: 'sup-layer' },
          ],
        });
        const res = await request(server, 'POST', '/api/bulk/components', body);
        expect(res.status).toBe(207);
        const resBody = res.body as Record<string, unknown>;
        expect(resBody.created).toBe(1);
        const errors = resBody.errors as Array<Record<string, unknown>>;
        expect(errors).toHaveLength(1);
        expect(errors[0].id).toBe('comp-a');
        expect(errors[0].status).toBe(409);
      });
    });

    it('returns 400 when components array exceeds 100 items', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const components = Array.from({ length: 101 }, (_, i) => ({
          id: `gen-${i}`,
          name: `Gen ${i}`,
          type: 'component',
          layer: 'sup-layer',
        }));
        const body = JSON.stringify({ components });
        const res = await request(server, 'POST', '/api/bulk/components', body);
        expect(res.status).toBe(400);
        const resBody = res.body as Record<string, unknown>;
        expect(String(resBody.error).toLowerCase()).toContain('maximum 100');
      });
    });

    it('returns 400 for invalid JSON body', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'POST', '/api/bulk/components', 'not json');
        expect(res.status).toBe(400);
      });
    });

    it('returns 400 when components field is missing', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'POST', '/api/bulk/components', JSON.stringify({}));
        expect(res.status).toBe(400);
      });
    });
  });

  describe('POST /api/bulk/edges', () => {
    it('creates multiple edges and returns 201 with created count', async () => {
      const data = seedData();
      data.nodes.push(
        new Node({ id: 'src-1', name: 'Src 1', type: 'component', layer: 'sup-layer' }),
        new Node({ id: 'tgt-1', name: 'Tgt 1', type: 'component', layer: 'sup-layer' })
      );
      const repos = buildTestRepos(data);
      await withServer(repos, async server => {
        const body = JSON.stringify({
          edges: [
            { source_id: 'comp-a', target_id: 'src-1', type: 'DEPENDS_ON' },
            { source_id: 'src-1', target_id: 'tgt-1', type: 'DEPENDS_ON' },
          ],
        });
        const res = await request(server, 'POST', '/api/bulk/edges', body);
        expect(res.status).toBe(201);
        const resBody = res.body as Record<string, unknown>;
        expect(resBody.created).toBe(2);
      });
    });

    it('returns 400 when edges array exceeds 100 items', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const edges = Array.from({ length: 101 }, (_, i) => ({
          source_id: `s-${i}`,
          target_id: `t-${i}`,
          type: 'DEPENDS_ON',
        }));
        const body = JSON.stringify({ edges });
        const res = await request(server, 'POST', '/api/bulk/edges', body);
        expect(res.status).toBe(400);
        const resBody = res.body as Record<string, unknown>;
        expect(String(resBody.error).toLowerCase()).toContain('maximum 100');
      });
    });

    it('returns 400 when edges field is missing', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'POST', '/api/bulk/edges', JSON.stringify({}));
        expect(res.status).toBe(400);
      });
    });
  });

  describe('POST /api/bulk/delete/components', () => {
    it('deletes multiple components and returns 200 with deleted count', async () => {
      const data = seedData();
      data.nodes.push(
        new Node({ id: 'del-a', name: 'Del A', type: 'component', layer: 'sup-layer' }),
        new Node({ id: 'del-b', name: 'Del B', type: 'component', layer: 'sup-layer' })
      );
      const repos = buildTestRepos(data);
      await withServer(repos, async server => {
        const body = JSON.stringify({ ids: ['del-a', 'del-b'] });
        const res = await request(server, 'POST', '/api/bulk/delete/components', body);
        expect(res.status).toBe(200);
        const resBody = res.body as Record<string, unknown>;
        expect(resBody.deleted).toBe(2);
      });
    });

    it('returns 400 when ids array exceeds 100 items', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const ids = Array.from({ length: 101 }, (_, i) => `del-${i}`);
        const body = JSON.stringify({ ids });
        const res = await request(server, 'POST', '/api/bulk/delete/components', body);
        expect(res.status).toBe(400);
        const resBody = res.body as Record<string, unknown>;
        expect(String(resBody.error).toLowerCase()).toContain('maximum 100');
      });
    });

    it('returns 400 when ids field is missing', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(
          server,
          'POST',
          '/api/bulk/delete/components',
          JSON.stringify({})
        );
        expect(res.status).toBe(400);
      });
    });

    it('silently ignores not-found IDs and returns deleted count for existing ones', async () => {
      const data = seedData();
      data.nodes.push(
        new Node({ id: 'del-x', name: 'Del X', type: 'component', layer: 'sup-layer' })
      );
      const repos = buildTestRepos(data);
      await withServer(repos, async server => {
        const body = JSON.stringify({ ids: ['del-x', 'nonexistent-id'] });
        const res = await request(server, 'POST', '/api/bulk/delete/components', body);
        expect(res.status).toBe(200);
        const resBody = res.body as Record<string, unknown>;
        expect(resBody.deleted).toBe(1);
        expect(resBody.errors).toEqual([]);
      });
    });

    it('returns 400 for invalid JSON body', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'POST', '/api/bulk/delete/components', 'not json');
        expect(res.status).toBe(400);
      });
    });
  });

  describe('POST /api/bulk/components — input validation', () => {
    it('returns 400 when all items have invalid input', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({
          components: [
            { id: 'INVALID ID', name: 'Bad', type: 'component', layer: 'sup-layer' },
            { name: 'No ID', type: 'component', layer: 'sup-layer' },
          ],
        });
        const res = await request(server, 'POST', '/api/bulk/components', body);
        expect(res.status).toBe(400);
        const resBody = res.body as Record<string, unknown>;
        expect(resBody.created).toBe(0);
        const errors = resBody.errors as Array<Record<string, unknown>>;
        expect(errors).toHaveLength(2);
      });
    });

    it('reports parse error with item id when input is invalid', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({
          components: [
            { id: 'good-one', name: 'Good', type: 'component', layer: 'sup-layer' },
            { id: 123, type: 'component', layer: 'sup-layer' },
          ],
        });
        const res = await request(server, 'POST', '/api/bulk/components', body);
        expect(res.status).toBe(207);
        const resBody = res.body as Record<string, unknown>;
        expect(resBody.created).toBe(1);
        const errors = resBody.errors as Array<Record<string, unknown>>;
        expect(errors).toHaveLength(1);
      });
    });
  });

  describe('POST /api/bulk/edges — validation and partial failures', () => {
    it('returns error for edge with missing required fields', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({
          edges: [{ source_id: 'comp-a' }],
        });
        const res = await request(server, 'POST', '/api/bulk/edges', body);
        const resBody = res.body as Record<string, unknown>;
        expect(resBody.created).toBe(0);
        const errors = resBody.errors as Array<Record<string, unknown>>;
        expect(errors).toHaveLength(1);
        expect(errors[0].status).toBe(400);
        expect(String(errors[0].error)).toContain('Missing required fields');
      });
    });

    it('returns error for edge with invalid edge type', async () => {
      const data = seedData();
      data.nodes.push(
        new Node({ id: 'n1', name: 'N1', type: 'component', layer: 'sup-layer' }),
        new Node({ id: 'n2', name: 'N2', type: 'component', layer: 'sup-layer' })
      );
      const repos = buildTestRepos(data);
      await withServer(repos, async server => {
        const body = JSON.stringify({
          edges: [{ source_id: 'n1', target_id: 'n2', type: 'INVALID_TYPE' }],
        });
        const res = await request(server, 'POST', '/api/bulk/edges', body);
        const resBody = res.body as Record<string, unknown>;
        expect(resBody.created).toBe(0);
        const errors = resBody.errors as Array<Record<string, unknown>>;
        expect(errors).toHaveLength(1);
        expect(String(errors[0].error)).toContain('Invalid edge type');
      });
    });

    it('returns 404 error for edge referencing non-existent node', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({
          edges: [{ source_id: 'comp-a', target_id: 'no-such-node', type: 'DEPENDS_ON' }],
        });
        const res = await request(server, 'POST', '/api/bulk/edges', body);
        const resBody = res.body as Record<string, unknown>;
        expect(resBody.created).toBe(0);
        const errors = resBody.errors as Array<Record<string, unknown>>;
        expect(errors).toHaveLength(1);
        expect(errors[0].status).toBe(404);
      });
    });

    it('returns 207 with mixed success and failure', async () => {
      const data = seedData();
      data.nodes.push(
        new Node({ id: 'e-a', name: 'EA', type: 'component', layer: 'sup-layer' }),
        new Node({ id: 'e-b', name: 'EB', type: 'component', layer: 'sup-layer' })
      );
      const repos = buildTestRepos(data);
      await withServer(repos, async server => {
        const body = JSON.stringify({
          edges: [
            { source_id: 'e-a', target_id: 'e-b', type: 'DEPENDS_ON' },
            { source_id: 'e-a', target_id: 'missing', type: 'DEPENDS_ON' },
          ],
        });
        const res = await request(server, 'POST', '/api/bulk/edges', body);
        expect(res.status).toBe(207);
        const resBody = res.body as Record<string, unknown>;
        expect(resBody.created).toBe(1);
        const errors = resBody.errors as Array<Record<string, unknown>>;
        expect(errors).toHaveLength(1);
      });
    });

    it('returns 400 for invalid JSON body', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'POST', '/api/bulk/edges', 'not json');
        expect(res.status).toBe(400);
      });
    });

    it('handles non-string source_id and target_id gracefully', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({
          edges: [{ source_id: 123, target_id: null, type: 'DEPENDS_ON' }],
        });
        const res = await request(server, 'POST', '/api/bulk/edges', body);
        const resBody = res.body as Record<string, unknown>;
        expect(resBody.created).toBe(0);
        const errors = resBody.errors as Array<Record<string, unknown>>;
        expect(errors).toHaveLength(1);
        expect(String(errors[0].error)).toContain('Missing required fields');
      });
    });
  });
});
