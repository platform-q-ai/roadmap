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
    search: vi.fn(async (query: string, version?: string, _limit?: number) => {
      const lower = query.toLowerCase();
      return data.features.filter(f => {
        const match = (f.content ?? '').toLowerCase().includes(lower);
        if (version) {
          return match && f.version === version;
        }
        return match;
      });
    }),
    save: vi.fn(),
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
  const authContent =
    'Feature: Auth\n  Scenario: Login\n    Given authentication is enabled\n    When action\n    Then result';
  const otherContent =
    'Feature: Other\n  Scenario: S1\n    Given something else\n    When action\n    Then result';
  const feat1 = new Feature({
    node_id: 'comp-a',
    version: 'v1',
    filename: 'v1-auth.feature',
    title: 'Auth',
    content: authContent,
    step_count: 3,
  });
  const feat2 = new Feature({
    node_id: 'comp-a',
    version: 'v1',
    filename: 'v1-other.feature',
    title: 'Other',
    content: otherContent,
    step_count: 3,
  });
  return { nodes: [layer, comp], edges: [], versions: [], features: [feat1, feat2] };
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

// ─── Tests ──────────────────────────────────────────────────────────

describe('API Routes — feature search', () => {
  it('returns matching features with 200', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const res = await request(server, 'GET', '/api/features/search?q=authentication');
      expect(res.status).toBe(200);
      const body = res.body as Array<Record<string, unknown>>;
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].filename).toBe('v1-auth.feature');
    });
  });

  it('returns empty array when no features match', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const res = await request(server, 'GET', '/api/features/search?q=xyznonexistent');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  it('returns 400 when q parameter is missing', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const res = await request(server, 'GET', '/api/features/search');
      expect(res.status).toBe(400);
    });
  });

  it('returns 400 when q parameter is empty', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const res = await request(server, 'GET', '/api/features/search?q=');
      expect(res.status).toBe(400);
    });
  });

  it('includes snippet field and excludes content field', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const res = await request(server, 'GET', '/api/features/search?q=authentication');
      expect(res.status).toBe(200);
      const body = res.body as Array<Record<string, unknown>>;
      expect(body[0]).toHaveProperty('snippet');
      expect(body[0]).not.toHaveProperty('content');
    });
  });

  it('filters by version when version query param is provided', async () => {
    const data = seedData();
    // Add an mvp feature that also matches
    data.features.push(
      new Feature({
        node_id: 'comp-a',
        version: 'mvp',
        filename: 'mvp-auth.feature',
        title: 'Auth MVP',
        content:
          'Feature: Auth MVP\n  Scenario: S\n    Given authentication\n    When x\n    Then y',
        step_count: 3,
      })
    );
    const repos = buildTestRepos(data);
    await withServer(repos, async server => {
      const res = await request(server, 'GET', '/api/features/search?q=authentication&version=v1');
      expect(res.status).toBe(200);
      const body = res.body as Array<Record<string, unknown>>;
      expect(body.length).toBe(1);
      expect(body[0].version).toBe('v1');
    });
  });

  it('includes all required fields in results', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const res = await request(server, 'GET', '/api/features/search?q=authentication');
      expect(res.status).toBe(200);
      const body = res.body as Array<Record<string, unknown>>;
      const result = body[0];
      expect(result).toHaveProperty('node_id');
      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('step_count');
      expect(result).toHaveProperty('snippet');
    });
  });

  it('returns 400 when query exceeds max length', async () => {
    const repos = buildTestRepos(seedData());
    const longQuery = 'a'.repeat(201);
    await withServer(repos, async server => {
      const res = await request(server, 'GET', `/api/features/search?q=${longQuery}`);
      expect(res.status).toBe(400);
      const body = res.body as Record<string, unknown>;
      expect(body.error).toContain('too long');
    });
  });

  it('returns 400 when search throws an error', async () => {
    const repos = buildTestRepos(seedData());
    repos.featureRepo.search = vi.fn(async () => {
      throw new Error('DB failure');
    });
    await withServer(repos, async server => {
      const res = await request(server, 'GET', '/api/features/search?q=anything');
      expect(res.status).toBe(400);
      const body = res.body as Record<string, unknown>;
      expect(body.error).toBe('DB failure');
    });
  });
});
