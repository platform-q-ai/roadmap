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
  const edge = new Edge({ id: 1, source_id: 'sup-layer', target_id: 'comp-a', type: 'CONTAINS' });
  const ver = new Version({
    node_id: 'comp-a',
    version: 'mvp',
    progress: 50,
    status: 'in-progress',
  });
  const feat = new Feature({
    node_id: 'comp-a',
    version: 'mvp',
    filename: 'mvp-test.feature',
    title: 'Test Feature',
    content: 'Feature: Test',
  });
  return {
    nodes: [layer, comp],
    edges: [edge],
    versions: [ver],
    features: [feat],
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

describe('API Routes — v1 component CRUD', () => {
  it('returns all fields including description, tags, color, icon, sort_order', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const body = JSON.stringify({
        id: 'full-comp',
        name: 'Full Component',
        type: 'component',
        layer: 'sup-layer',
        description: 'A fully specified component',
        tags: ['runtime', 'core'],
        color: '#3498DB',
        icon: 'server',
        sort_order: 42,
      });
      const res = await request(server, 'POST', '/api/components', body);
      expect(res.status).toBe(201);
      const resBody = res.body as Record<string, unknown>;
      expect(resBody.id).toBe('full-comp');
      expect(resBody.description).toBe('A fully specified component');
      expect(resBody.tags).toEqual(expect.arrayContaining(['runtime', 'core']));
      expect(resBody.color).toBe('#3498DB');
      expect(resBody.icon).toBe('server');
      expect(resBody.sort_order).toBe(42);
    });
  });

  it('returns null description and empty tags for minimal component', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const body = JSON.stringify({
        id: 'minimal-comp',
        name: 'Minimal',
        type: 'component',
        layer: 'sup-layer',
      });
      const res = await request(server, 'POST', '/api/components', body);
      expect(res.status).toBe(201);
      const resBody = res.body as Record<string, unknown>;
      expect(resBody.description).toBeNull();
      expect(resBody.tags).toEqual([]);
      expect(resBody.sort_order).toBe(0);
    });
  });

  it('returns 400 for ID longer than 64 characters', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const longId = 'a'.repeat(65);
      const body = JSON.stringify({
        id: longId,
        name: 'Long ID',
        type: 'component',
        layer: 'sup-layer',
      });
      const res = await request(server, 'POST', '/api/components', body);
      expect(res.status).toBe(400);
      const resBody = res.body as Record<string, unknown>;
      expect(resBody.error).toBeDefined();
      expect(String(resBody.error).toLowerCase()).toContain('id');
    });
  });

  it('returns 400 for empty name', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const body = JSON.stringify({
        id: 'no-name',
        name: '',
        type: 'component',
        layer: 'sup-layer',
      });
      const res = await request(server, 'POST', '/api/components', body);
      expect(res.status).toBe(400);
      const resBody = res.body as Record<string, unknown>;
      expect(resBody.error).toBeDefined();
      expect(String(resBody.error).toLowerCase()).toContain('name');
    });
  });

  it('returns 400 for invalid layer reference', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const body = JSON.stringify({
        id: 'bad-layer',
        name: 'Bad Layer',
        type: 'component',
        layer: 'nonexistent-layer',
      });
      const res = await request(server, 'POST', '/api/components', body);
      expect(res.status).toBe(400);
      const resBody = res.body as Record<string, unknown>;
      expect(resBody.error).toBeDefined();
      expect(String(resBody.error).toLowerCase()).toContain('layer');
    });
  });
});
