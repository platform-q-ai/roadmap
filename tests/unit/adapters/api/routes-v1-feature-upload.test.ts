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

/* ── In-memory repos ─────────────────────────────────────────────── */

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
    findByNodeVersionAndFilename: vi.fn(async () => null),
    search: vi.fn(async () => []),
    save: vi.fn(async (f: Feature) => {
      data.features.push(f);
    }),
    saveMany: vi.fn(),
    deleteAll: vi.fn(),
    deleteByNode: vi.fn(),
    deleteByNodeAndFilename: vi.fn(async () => false),
    deleteByNodeAndVersionAndFilename: vi.fn(async () => false),
    deleteByNodeAndVersion: vi.fn(async () => 0),
    getStepCountSummary: vi.fn(async () => ({ totalSteps: 0, featureCount: 0 })),
  };
  return { nodeRepo, edgeRepo, versionRepo, featureRepo };
}

function seedData(): WorldData {
  const layer = new Node({ id: 'sup-layer', name: 'Supervisor', type: 'layer' });
  const comp = new Node({
    id: 'comp-a',
    name: 'Component A',
    type: 'component',
    layer: 'sup-layer',
  });
  return { nodes: [layer, comp], edges: [], versions: [], features: [] };
}

/* ── HTTP helper ──────────────────────────────────────────────────── */

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
      headers['Content-Type'] = 'text/plain';
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
): Promise<void> {
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

/* ── Tests ────────────────────────────────────────────────────────── */

const GHERKIN = 'Feature: Test\n  Scenario: S1\n    Given a step\n    When action\n    Then result';

describe('PUT /api/components/:id/versions/:ver/features/:filename', () => {
  it('uploads a feature with explicit version and returns 200', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const res = await request(
        server,
        'PUT',
        '/api/components/comp-a/versions/v1/features/test.feature',
        GHERKIN
      );
      expect(res.status).toBe(200);
      const body = res.body as Record<string, unknown>;
      expect(body.version).toBe('v1');
      expect(body.filename).toBe('test.feature');
      expect(body.node_id).toBe('comp-a');
      expect(body.step_count).toBe(3);
    });
  });

  it('returns 404 for nonexistent component', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const res = await request(
        server,
        'PUT',
        '/api/components/ghost/versions/v1/features/test.feature',
        GHERKIN
      );
      expect(res.status).toBe(404);
    });
  });

  it('returns 400 for invalid version', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const res = await request(
        server,
        'PUT',
        '/api/components/comp-a/versions/invalid/features/test.feature',
        GHERKIN
      );
      expect(res.status).toBe(400);
      const body = res.body as Record<string, unknown>;
      expect(String(body.error).toLowerCase()).toContain('version');
    });
  });

  it('includes scenario_count and keyword counts in response', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const content = `Feature: T
  Scenario: A
    Given x
    When y
    Then z
  Scenario: B
    Given a
    Then b`;
      const res = await request(
        server,
        'PUT',
        '/api/components/comp-a/versions/v1/features/test.feature',
        content
      );
      expect(res.status).toBe(200);
      const body = res.body as Record<string, unknown>;
      expect(body.scenario_count).toBe(2);
      expect(body.given_count).toBe(2);
      expect(body.when_count).toBe(1);
      expect(body.then_count).toBe(2);
    });
  });
});

describe('PUT /api/components/:id/features/:filename (old MVP-style)', () => {
  it('returns 400 with version is required message', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const res = await request(
        server,
        'PUT',
        '/api/components/comp-a/features/test.feature',
        GHERKIN
      );
      expect(res.status).toBe(400);
      const body = res.body as Record<string, unknown>;
      expect(String(body.error).toLowerCase()).toContain('version is required');
    });
  });
});
