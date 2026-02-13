import http from 'node:http';

import { createApp } from '@adapters/api/index.js';
import type {
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
} from '@domain/index.js';
import { Edge, Feature, Node, Version } from '@domain/index.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
      data.nodes = data.nodes.filter(n => n.id !== node.id);
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
      data.versions = data.versions.filter(
        v => !(v.node_id === version.node_id && v.version === version.version)
      );
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
    findByNodeVersionAndFilename: vi.fn(async () => null),
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

// ─── Helper: HTTP request ───────────────────────────────────────────

async function request(
  server: http.Server,
  method: string,
  path: string,
  body?: string
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const headers: Record<string, string | number> = { Connection: 'close' };
    if (body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = http.request({ method, hostname: '127.0.0.1', port, path, headers }, res => {
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

// ─── Test data ──────────────────────────────────────────────────────

function versionData(): WorldData {
  const layer = new Node({ id: 'supervisor-layer', name: 'Supervisor Layer', type: 'layer' });
  const comp = new Node({
    id: 'comp-a',
    name: 'Component A',
    type: 'component',
    layer: 'supervisor-layer',
  });
  return {
    nodes: [layer, comp],
    edges: [
      new Edge({ id: 1, source_id: 'supervisor-layer', target_id: 'comp-a', type: 'CONTAINS' }),
    ],
    versions: [
      new Version({ node_id: 'comp-a', version: 'overview', content: 'Overview text' }),
      new Version({ node_id: 'comp-a', version: 'mvp', progress: 50, status: 'in-progress' }),
      new Version({ node_id: 'comp-a', version: 'v1', progress: 0, status: 'planned' }),
    ],
    features: [
      new Feature({
        node_id: 'comp-a',
        version: 'mvp',
        filename: 'mvp-test.feature',
        title: 'Test',
        content: 'Feature: T\n  Scenario: S\n    Given a\n    When b\n    Then c',
        step_count: 3,
      }),
    ],
  };
}

// ─── Route tests ────────────────────────────────────────────────────

describe('API Routes — version management', () => {
  let server: http.Server | null = null;

  afterEach(async () => {
    if (server) {
      await new Promise<void>(resolve => {
        server!.close(() => resolve());
        server!.closeAllConnections();
      });
      server = null;
    }
  });

  // ── GET /api/components/:id/versions ────────────────────────────

  it('GET /api/components/:id/versions returns all versions', async () => {
    const data = versionData();
    const repos = buildTestRepos(data);
    await withServer(repos, async srv => {
      const res = await request(srv, 'GET', '/api/components/comp-a/versions');
      expect(res.status).toBe(200);
      const body = res.body as Array<Record<string, unknown>>;
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(3);
    });
  });

  it('GET /api/components/:id/versions enriches phase versions with step fields', async () => {
    const data = versionData();
    const repos = buildTestRepos(data);
    await withServer(repos, async srv => {
      const res = await request(srv, 'GET', '/api/components/comp-a/versions');
      expect(res.status).toBe(200);
      const body = res.body as Array<Record<string, unknown>>;
      const mvp = body.find(v => v.version === 'mvp');
      expect(mvp).toBeDefined();
      expect(mvp).toHaveProperty('total_steps');
      expect(mvp).toHaveProperty('passing_steps');
      expect(mvp).toHaveProperty('step_progress');
    });
  });

  it('GET /api/components/:id/versions returns 404 for nonexistent component', async () => {
    const data = versionData();
    const repos = buildTestRepos(data);
    await withServer(repos, async srv => {
      const res = await request(srv, 'GET', '/api/components/ghost/versions');
      expect(res.status).toBe(404);
    });
  });

  // ── GET /api/components/:id/versions/:ver ───────────────────────

  it('GET /api/components/:id/versions/:ver returns a single version', async () => {
    const data = versionData();
    const repos = buildTestRepos(data);
    await withServer(repos, async srv => {
      const res = await request(srv, 'GET', '/api/components/comp-a/versions/mvp');
      expect(res.status).toBe(200);
      const body = res.body as Record<string, unknown>;
      expect(body.version).toBe('mvp');
      expect(body).toHaveProperty('total_steps');
    });
  });

  it('GET /api/components/:id/versions/:ver returns 404 for nonexistent component', async () => {
    const data = versionData();
    const repos = buildTestRepos(data);
    await withServer(repos, async srv => {
      const res = await request(srv, 'GET', '/api/components/ghost/versions/mvp');
      expect(res.status).toBe(404);
    });
  });

  it('GET /api/components/:id/versions/:ver returns 404 for nonexistent version', async () => {
    const data = versionData();
    const repos = buildTestRepos(data);
    await withServer(repos, async srv => {
      const res = await request(srv, 'GET', '/api/components/comp-a/versions/v99');
      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /api/components/:id/versions ─────────────────────────

  it('DELETE /api/components/:id/versions returns 204', async () => {
    const data = versionData();
    const repos = buildTestRepos(data);
    await withServer(repos, async srv => {
      const res = await request(srv, 'DELETE', '/api/components/comp-a/versions');
      expect(res.status).toBe(204);
    });
  });

  it('DELETE /api/components/:id/versions returns 404 for nonexistent component', async () => {
    const data = versionData();
    const repos = buildTestRepos(data);
    await withServer(repos, async srv => {
      const res = await request(srv, 'DELETE', '/api/components/ghost/versions');
      expect(res.status).toBe(404);
    });
  });
});
