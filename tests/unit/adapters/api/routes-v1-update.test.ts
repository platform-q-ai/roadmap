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
      const idx = data.nodes.findIndex(n => n.id === node.id);
      if (idx >= 0) {
        data.nodes[idx] = node;
      } else {
        data.nodes.push(node);
      }
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
      const idx = data.versions.findIndex(
        v => v.node_id === version.node_id && v.version === version.version
      );
      if (idx >= 0) {
        data.versions[idx] = version;
      } else {
        data.versions.push(version);
      }
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

function seedData(): WorldData {
  const layer = new Node({ id: 'sup-layer', name: 'Supervisor', type: 'layer' });
  const comp = new Node({
    id: 'comp-a',
    name: 'Component A',
    type: 'component',
    layer: 'sup-layer',
    description: 'Original description',
    tags: ['old-tag'],
    sort_order: 5,
  });
  const edge = new Edge({ id: 1, source_id: 'sup-layer', target_id: 'comp-a', type: 'CONTAINS' });
  const ver = new Version({
    node_id: 'comp-a',
    version: 'mvp',
    content: 'mvp content',
    progress: 0,
    status: 'planned',
  });
  return {
    nodes: [layer, comp],
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
    const contentType = method === 'PATCH' ? 'application/merge-patch+json' : 'application/json';
    const options: http.RequestOptions = {
      method,
      hostname: '127.0.0.1',
      port,
      path,
      headers: body
        ? { 'Content-Type': contentType, 'Content-Length': Buffer.byteLength(body) }
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

describe('API Routes — v1 component PATCH update', () => {
  it('returns 200 and updated name for PATCH /api/components/:id', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const body = JSON.stringify({ name: 'New Name' });
      const res = await request(server, 'PATCH', '/api/components/comp-a', body);
      expect(res.status).toBe(200);
      const resBody = res.body as Record<string, unknown>;
      expect(resBody.name).toBe('New Name');
      expect(resBody.id).toBe('comp-a');
    });
  });

  it('returns 200 and updated description', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const body = JSON.stringify({ description: 'Updated desc' });
      const res = await request(server, 'PATCH', '/api/components/comp-a', body);
      expect(res.status).toBe(200);
      const resBody = res.body as Record<string, unknown>;
      expect(resBody.description).toBe('Updated desc');
    });
  });

  it('returns 200 and updated tags', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const body = JSON.stringify({ tags: ['new', 'updated'] });
      const res = await request(server, 'PATCH', '/api/components/comp-a', body);
      expect(res.status).toBe(200);
      const resBody = res.body as Record<string, unknown>;
      expect(resBody.tags).toEqual(['new', 'updated']);
    });
  });

  it('preserves fields not in the patch body', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const body = JSON.stringify({ name: 'Changed' });
      const res = await request(server, 'PATCH', '/api/components/comp-a', body);
      expect(res.status).toBe(200);
      const resBody = res.body as Record<string, unknown>;
      expect(resBody.name).toBe('Changed');
      expect(resBody.description).toBe('Original description');
      expect(resBody.tags).toEqual(['old-tag']);
    });
  });

  it('returns 404 for nonexistent component', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const body = JSON.stringify({ name: 'Ghost' });
      const res = await request(server, 'PATCH', '/api/components/nonexistent', body);
      expect(res.status).toBe(404);
    });
  });

  it('returns 400 for invalid current_version format', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const body = JSON.stringify({ current_version: 'not-semver' });
      const res = await request(server, 'PATCH', '/api/components/comp-a', body);
      expect(res.status).toBe(400);
      const resBody = res.body as Record<string, unknown>;
      expect(String(resBody.error).toLowerCase()).toContain('version');
    });
  });

  it('returns 400 for invalid JSON body', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const res = await request(server, 'PATCH', '/api/components/comp-a', 'not json');
      expect(res.status).toBe(400);
    });
  });

  it('strips HTML from string fields', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const body = JSON.stringify({ name: '<script>alert("xss")</script>Safe Name' });
      const res = await request(server, 'PATCH', '/api/components/comp-a', body);
      expect(res.status).toBe(200);
      const resBody = res.body as Record<string, unknown>;
      expect(resBody.name).toBe('alert("xss")Safe Name');
    });
  });

  it('recalculates version progress when current_version changes', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const body = JSON.stringify({ current_version: '0.7.5' });
      const res = await request(server, 'PATCH', '/api/components/comp-a', body);
      expect(res.status).toBe(200);
      const resBody = res.body as Record<string, unknown>;
      expect(resBody.current_version).toBe('0.7.5');
    });
  });

  it('returns 400 for empty patch body with no recognised fields', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const body = JSON.stringify({ unknown_field: 'value' });
      const res = await request(server, 'PATCH', '/api/components/comp-a', body);
      expect(res.status).toBe(400);
      const resBody = res.body as Record<string, unknown>;
      expect(String(resBody.error).toLowerCase()).toContain('no updatable fields');
    });
  });

  it('returns 400 for empty name', async () => {
    const repos = buildTestRepos(seedData());
    await withServer(repos, async server => {
      const body = JSON.stringify({ name: '' });
      const res = await request(server, 'PATCH', '/api/components/comp-a', body);
      expect(res.status).toBe(400);
      const resBody = res.body as Record<string, unknown>;
      expect(String(resBody.error).toLowerCase()).toContain('name');
    });
  });
});
