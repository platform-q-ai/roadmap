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
    save: vi.fn(),
    saveMany: vi.fn(),
    deleteAll: vi.fn(),
    deleteByNode: vi.fn(),
    deleteByNodeAndFilename: vi.fn(async () => false),
    deleteByNodeAndVersionAndFilename: vi.fn(async () => false),
    deleteByNodeAndVersion: vi.fn(async () => 0),
    getStepCountSummary: vi.fn(async (nid: string, ver: string) => {
      const matching = data.features.filter(f => f.node_id === nid && f.version === ver);
      return {
        totalSteps: matching.reduce((sum, f) => sum + f.step_count, 0),
        featureCount: matching.length,
      };
    }),
    search: vi.fn(async () => []),
  };
  return { nodeRepo, edgeRepo, versionRepo, featureRepo };
}

// ─── Test data ──────────────────────────────────────────────────────

function graphData(): WorldData {
  const layer = new Node({ id: 'test-layer', name: 'Test Layer', type: 'layer' });
  const compA = new Node({
    id: 'comp-a',
    name: 'Component A',
    type: 'component',
    layer: 'test-layer',
  });
  const compB = new Node({
    id: 'comp-b',
    name: 'Component B',
    type: 'component',
    layer: 'test-layer',
  });
  const compC = new Node({
    id: 'comp-c',
    name: 'Component C',
    type: 'component',
    layer: 'test-layer',
  });
  return {
    nodes: [layer, compA, compB, compC],
    edges: [
      new Edge({ id: 1, source_id: 'test-layer', target_id: 'comp-a', type: 'CONTAINS' }),
      new Edge({ id: 2, source_id: 'test-layer', target_id: 'comp-b', type: 'CONTAINS' }),
      new Edge({ id: 3, source_id: 'test-layer', target_id: 'comp-c', type: 'CONTAINS' }),
      new Edge({ id: 4, source_id: 'comp-a', target_id: 'comp-b', type: 'DEPENDS_ON' }),
      new Edge({ id: 5, source_id: 'comp-b', target_id: 'comp-c', type: 'DEPENDS_ON' }),
    ],
    versions: [
      new Version({ node_id: 'comp-a', version: 'mvp', progress: 0, status: 'planned' }),
      new Version({ node_id: 'comp-b', version: 'mvp', progress: 50, status: 'in-progress' }),
      new Version({ node_id: 'comp-c', version: 'mvp', progress: 100, status: 'complete' }),
    ],
    features: [
      new Feature({
        node_id: 'comp-c',
        version: 'mvp',
        filename: 'mvp-c.feature',
        title: 'C',
        content: 'Feature: C\n  Scenario: S\n    Given a step',
        step_count: 3,
      }),
    ],
  };
}

// ─── Helper: HTTP request ───────────────────────────────────────────

async function request(
  server: http.Server,
  method: string,
  path: string
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const req = http.request({ method, hostname: '127.0.0.1', port, path }, res => {
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
        resolve({ status: res.statusCode ?? 500, body: parsed });
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

// ─── Route tests ────────────────────────────────────────────────────

describe('API Routes — v1 graph traversal', () => {
  describe('GET /api/components/:id/dependencies', () => {
    it('returns 200 with dependency tree', async () => {
      const repos = buildTestRepos(graphData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components/comp-a/dependencies?depth=2');
        expect(res.status).toBe(200);
        const body = res.body as Record<string, unknown>;
        expect(body.dependencies).toBeDefined();
        expect(Array.isArray(body.dependencies)).toBe(true);
      });
    });

    it('returns 404 for non-existent component', async () => {
      const repos = buildTestRepos(graphData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components/missing/dependencies');
        expect(res.status).toBe(404);
      });
    });
  });

  describe('GET /api/components/:id/dependents', () => {
    it('returns 200 with list of dependents', async () => {
      const repos = buildTestRepos(graphData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components/comp-b/dependents');
        expect(res.status).toBe(200);
        const body = res.body as Array<Record<string, unknown>>;
        expect(Array.isArray(body)).toBe(true);
      });
    });
  });

  describe('GET /api/components/:id/context', () => {
    it('returns 200 with full context', async () => {
      const repos = buildTestRepos(graphData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components/comp-a/context');
        expect(res.status).toBe(200);
        const body = res.body as Record<string, unknown>;
        expect(body.component).toBeDefined();
        expect(body.versions).toBeDefined();
        expect(body.features).toBeDefined();
        expect(body.dependencies).toBeDefined();
        expect(body.dependents).toBeDefined();
        expect(body.layer).toBeDefined();
        expect(body.siblings).toBeDefined();
        expect(body.progress).toBeDefined();
      });
    });

    it('returns 404 for non-existent component', async () => {
      const repos = buildTestRepos(graphData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components/ghost/context');
        expect(res.status).toBe(404);
      });
    });
  });

  describe('GET /api/graph/implementation-order', () => {
    it('returns 200 with topological order', async () => {
      const repos = buildTestRepos(graphData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/graph/implementation-order');
        expect(res.status).toBe(200);
        const body = res.body as string[];
        expect(Array.isArray(body)).toBe(true);
      });
    });

    it('returns 409 for cyclic graph', async () => {
      const data = graphData();
      // Create a cycle: comp-c -> comp-a
      data.edges.push(
        new Edge({ id: 99, source_id: 'comp-c', target_id: 'comp-a', type: 'DEPENDS_ON' })
      );
      const repos = buildTestRepos(data);
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/graph/implementation-order');
        expect(res.status).toBe(409);
        const body = res.body as Record<string, unknown>;
        expect(body.cycle).toBeDefined();
      });
    });
  });

  describe('GET /api/graph/components-by-status', () => {
    it('returns 200 with categorised components', async () => {
      const repos = buildTestRepos(graphData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/graph/components-by-status?version=mvp');
        expect(res.status).toBe(200);
        const body = res.body as Record<string, unknown>;
        expect(body.complete).toBeDefined();
        expect(body.in_progress).toBeDefined();
        expect(body.planned).toBeDefined();
      });
    });
  });

  describe('GET /api/graph/next-implementable', () => {
    it('returns 200 with implementable components', async () => {
      const repos = buildTestRepos(graphData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/graph/next-implementable?version=mvp');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      });
    });
  });

  describe('GET /api/graph/path', () => {
    it('returns 200 with shortest path', async () => {
      const repos = buildTestRepos(graphData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/graph/path?from=comp-a&to=comp-c');
        expect(res.status).toBe(200);
        const body = res.body as Record<string, unknown>;
        expect(body.path).toBeDefined();
        expect(body.edges).toBeDefined();
      });
    });

    it('returns empty path for unconnected nodes', async () => {
      const data = graphData();
      data.nodes.push(new Node({ id: 'island', name: 'Island', type: 'component' }));
      const repos = buildTestRepos(data);
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/graph/path?from=comp-a&to=island');
        expect(res.status).toBe(200);
        const body = res.body as Record<string, unknown>;
        expect((body.path as unknown[]).length).toBe(0);
      });
    });

    it('returns 400 when from or to is missing', async () => {
      const repos = buildTestRepos(graphData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/graph/path?from=comp-a');
        expect(res.status).toBe(400);
        const body = res.body as Record<string, unknown>;
        expect(body.error).toBeDefined();
      });
    });
  });

  describe('GET /api/components/:id/neighbourhood', () => {
    it('returns 200 with neighbourhood subgraph', async () => {
      const repos = buildTestRepos(graphData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components/comp-a/neighbourhood?hops=2');
        expect(res.status).toBe(200);
        const body = res.body as Record<string, unknown>;
        expect(body.nodes).toBeDefined();
        expect(body.edges).toBeDefined();
      });
    });

    it('returns 404 for non-existent component', async () => {
      const repos = buildTestRepos(graphData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components/missing/neighbourhood');
        expect(res.status).toBe(404);
      });
    });
  });

  describe('GET /api/components/:id/dependents', () => {
    it('returns 404 for non-existent component', async () => {
      const repos = buildTestRepos(graphData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components/missing/dependents');
        expect(res.status).toBe(404);
      });
    });
  });

  describe('GET /api/graph/layer-overview', () => {
    it('returns 200 with layer summaries', async () => {
      const repos = buildTestRepos(graphData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/graph/layer-overview');
        expect(res.status).toBe(200);
        const body = res.body as Array<Record<string, unknown>>;
        expect(Array.isArray(body)).toBe(true);
        if (body.length > 0) {
          expect(body[0].layer_id).toBeDefined();
          expect(body[0].total_components).toBeDefined();
        }
      });
    });
  });
});
