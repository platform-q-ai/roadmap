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
  const feat1 = new Feature({
    node_id: 'comp-a',
    version: 'v1',
    filename: 'v1-test.feature',
    title: 'Test',
    content: 'Feature: Test\n  Scenario: S\n    Given a step',
    step_count: 1,
  });
  const feat2 = new Feature({
    node_id: 'comp-a',
    version: 'v1',
    filename: 'v1-other.feature',
    title: 'Other',
    content: 'Feature: Other\n  Scenario: S\n    Given a step',
    step_count: 1,
  });
  const feat3 = new Feature({
    node_id: 'comp-a',
    version: 'mvp',
    filename: 'mvp-keep.feature',
    title: 'Keep',
    content: 'Feature: Keep\n  Scenario: S\n    Given a step',
    step_count: 1,
  });
  return {
    nodes: [layer, shared, comp],
    edges: [],
    versions: [],
    features: [feat1, feat2, feat3],
  };
}

// ─── Helper: HTTP request to server ─────────────────────────────────

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

describe('API Routes — v1 version-scoped feature deletion', () => {
  describe('DELETE /api/components/:id/versions/:ver/features/:filename', () => {
    it('deletes a single feature and returns 204', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(
          server,
          'DELETE',
          '/api/components/comp-a/versions/v1/features/v1-test.feature'
        );
        expect(res.status).toBe(204);
      });
    });

    it('returns 404 for non-existent component', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(
          server,
          'DELETE',
          '/api/components/no-such/versions/v1/features/test.feature'
        );
        expect(res.status).toBe(404);
      });
    });

    it('returns 404 for non-existent feature', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(
          server,
          'DELETE',
          '/api/components/comp-a/versions/v1/features/ghost.feature'
        );
        expect(res.status).toBe(404);
      });
    });
  });

  describe('DELETE /api/components/:id/versions/:ver/features', () => {
    it('deletes all features for a version and returns 204', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'DELETE', '/api/components/comp-a/versions/v1/features');
        expect(res.status).toBe(204);
      });
    });

    it('returns 404 for non-existent component', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'DELETE', '/api/components/no-such/versions/v1/features');
        expect(res.status).toBe(404);
      });
    });

    it('returns 204 even when no features exist for the version', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'DELETE', '/api/components/comp-a/versions/v2/features');
        expect(res.status).toBe(204);
      });
    });
  });

  describe('DELETE /api/components/:id/features', () => {
    it('deletes all features for a component and returns 204', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'DELETE', '/api/components/comp-a/features');
        expect(res.status).toBe(204);
      });
    });

    it('returns 404 for non-existent component', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'DELETE', '/api/components/no-such/features');
        expect(res.status).toBe(404);
      });
    });

    it('returns 204 even when component has no features', async () => {
      const data = seedData();
      data.features = [];
      const repos = buildTestRepos(data);
      await withServer(repos, async server => {
        const res = await request(server, 'DELETE', '/api/components/comp-a/features');
        expect(res.status).toBe(204);
      });
    });
  });
});
