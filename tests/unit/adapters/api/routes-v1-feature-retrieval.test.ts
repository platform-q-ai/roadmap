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
    save: vi.fn(),
    delete: vi.fn(),
  };
  const edgeRepo: IEdgeRepository = {
    findAll: vi.fn(async () => data.edges),
    findById: vi.fn(async (id: number) => data.edges.find(e => e.id === id) ?? null),
    findBySource: vi.fn(async (sid: string) => data.edges.filter(e => e.source_id === sid)),
    findByTarget: vi.fn(async (tid: string) => data.edges.filter(e => e.target_id === tid)),
    findByType: vi.fn(async (type: string) => data.edges.filter(e => e.type === type)),
    findRelationships: vi.fn(async () => data.edges.filter(e => !e.isContainment())),
    existsBySrcTgtType: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
  const versionRepo: IVersionRepository = {
    findAll: vi.fn(async () => data.versions),
    findByNode: vi.fn(async (nid: string) => data.versions.filter(v => v.node_id === nid)),
    findByNodeAndVersion: vi.fn(
      async (nid: string, ver: string) =>
        data.versions.find(v => v.node_id === nid && v.version === ver) ?? null
    ),
    save: vi.fn(),
    deleteByNode: vi.fn(),
  };
  const featureRepo: IFeatureRepository = {
    findAll: vi.fn(async () => data.features),
    findByNode: vi.fn(async (nid: string) => data.features.filter(f => f.node_id === nid)),
    findByNodeAndVersion: vi.fn(async (nid: string, ver: string) =>
      data.features.filter(f => f.node_id === nid && f.version === ver)
    ),
    findByNodeVersionAndFilename: vi.fn(
      async (nid: string, ver: string, fname: string) =>
        data.features.find(f => f.node_id === nid && f.version === ver && f.filename === fname) ??
        null
    ),
    save: vi.fn(),
    saveMany: vi.fn(),
    deleteAll: vi.fn(),
    deleteByNode: vi.fn(),
    deleteByNodeAndFilename: vi.fn(async () => false),
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
  const gherkin =
    'Feature: Test\n  Scenario: S1\n    Given a step\n    When action\n    Then result';
  const feat1 = new Feature({
    node_id: 'comp-a',
    version: 'v1',
    filename: 'v1-test.feature',
    title: 'Test',
    content: gherkin,
    step_count: 3,
  });
  const feat2 = new Feature({
    node_id: 'comp-a',
    version: 'v1',
    filename: 'v1-other.feature',
    title: 'Other',
    content: gherkin,
    step_count: 3,
  });
  const feat3 = new Feature({
    node_id: 'comp-a',
    version: 'mvp',
    filename: 'mvp-keep.feature',
    title: 'Keep',
    content: gherkin,
    step_count: 3,
  });
  return { nodes: [layer, shared, comp], edges: [], versions: [], features: [feat1, feat2, feat3] };
}

// ─── Helper: HTTP request with optional headers ─────────────────────

async function request(
  server: http.Server,
  method: string,
  path: string,
  headers?: Record<string, string>
): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
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
        const rh: Record<string, string> = {};
        for (const [key, val] of Object.entries(res.headers)) {
          if (typeof val === 'string') {
            rh[key] = val;
          }
        }
        resolve({ status: res.statusCode ?? 500, body: parsed, headers: rh });
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

describe('API Routes — v1 version-scoped feature retrieval', () => {
  describe('GET /api/components/:id/versions/:ver/features', () => {
    it('returns features for a specific version with 200', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components/comp-a/versions/v1/features');
        expect(res.status).toBe(200);
        const body = res.body as { features: unknown[] };
        expect(body.features).toHaveLength(2);
      });
    });

    it('returns 404 for nonexistent component', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components/no-such/versions/v1/features');
        expect(res.status).toBe(404);
      });
    });

    it('includes totals in the response', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components/comp-a/versions/v1/features');
        expect(res.status).toBe(200);
        const body = res.body as { totals: Record<string, number> };
        expect(body.totals).toBeDefined();
        expect(body.totals.total_features).toBe(2);
        expect(body.totals.total_steps).toBeGreaterThan(0);
      });
    });

    it('handles features with null content gracefully', async () => {
      const data = seedData();
      const nullFeat = new Feature({
        node_id: 'comp-a',
        version: 'v1',
        filename: 'v1-null.feature',
        title: 'Null',
        content: null as unknown as string,
        step_count: 0,
      });
      data.features.push(nullFeat);
      const repos = buildTestRepos(data);
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components/comp-a/versions/v1/features');
        expect(res.status).toBe(200);
        const body = res.body as { features: Array<Record<string, unknown>> };
        const nullEntry = body.features.find(f => f.filename === 'v1-null.feature');
        expect(nullEntry).toBeDefined();
        expect(nullEntry?.scenario_count).toBe(0);
      });
    });
  });

  describe('GET /api/components/:id/versions/:ver/features/:filename', () => {
    it('returns a single feature as JSON by default', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(
          server,
          'GET',
          '/api/components/comp-a/versions/v1/features/v1-test.feature'
        );
        expect(res.status).toBe(200);
        const body = res.body as Record<string, unknown>;
        expect(body.filename).toBe('v1-test.feature');
        expect(body.version).toBe('v1');
        expect(body.content).toContain('Feature:');
      });
    });

    it('returns 404 for nonexistent component', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(
          server,
          'GET',
          '/api/components/no-such/versions/v1/features/test.feature'
        );
        expect(res.status).toBe(404);
      });
    });

    it('returns 404 for nonexistent feature', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(
          server,
          'GET',
          '/api/components/comp-a/versions/v1/features/ghost.feature'
        );
        expect(res.status).toBe(404);
      });
    });

    it('returns raw text when Accept is text/plain', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(
          server,
          'GET',
          '/api/components/comp-a/versions/v1/features/v1-test.feature',
          { Accept: 'text/plain' }
        );
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('text/plain');
        expect(typeof res.body).toBe('string');
        expect(res.body as string).toContain('Feature:');
      });
    });
  });
});
