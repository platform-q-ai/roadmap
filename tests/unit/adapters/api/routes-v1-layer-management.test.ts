import http from 'node:http';

import { createApp } from '@adapters/api/index.js';
import type {
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
} from '@domain/index.js';
import { Edge, Node, Version } from '@domain/index.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ─── Helper: in-memory repos ────────────────────────────────────────

interface WorldData {
  nodes: Node[];
  edges: Edge[];
  versions: Version[];
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
    findAll: vi.fn(async () => []),
    findByNode: vi.fn(async () => []),
    findByNodeAndVersion: vi.fn(async () => []),
    findByNodeVersionAndFilename: vi.fn(async () => null),
    save: vi.fn(),
    saveMany: vi.fn(),
    deleteAll: vi.fn(),
    deleteByNode: vi.fn(),
    deleteByNodeAndFilename: vi.fn(async () => false),
    deleteByNodeAndVersionAndFilename: vi.fn(async () => false),
    deleteByNodeAndVersion: vi.fn(async () => 0),
    getStepCountSummary: vi.fn(async () => ({ totalSteps: 0, featureCount: 0 })),
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

function layerData(): WorldData {
  const layerA = new Node({ id: 'layer-a', name: 'Layer A', type: 'layer' });
  const layerB = new Node({ id: 'layer-b', name: 'Layer B', type: 'layer' });
  const comp = new Node({
    id: 'comp-1',
    name: 'Component 1',
    type: 'component',
    layer: 'layer-a',
  });
  return {
    nodes: [layerA, layerB, comp],
    edges: [new Edge({ id: 1, source_id: 'layer-a', target_id: 'comp-1', type: 'CONTAINS' })],
    versions: [new Version({ node_id: 'comp-1', version: 'mvp', progress: 0, status: 'planned' })],
  };
}

// ─── Route tests ────────────────────────────────────────────────────

describe('API Routes — v1 layer management', () => {
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

  it('GET /api/layers returns all layers', async () => {
    const data = layerData();
    const repos = buildTestRepos(data);
    await withServer(repos, async srv => {
      const res = await request(srv, 'GET', '/api/layers');
      expect(res.status).toBe(200);
      const body = res.body as Array<Record<string, unknown>>;
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(2);
      expect(body.every(n => n.type === 'layer')).toBe(true);
    });
  });

  it('GET /api/layers/:id returns layer with children', async () => {
    const data = layerData();
    const repos = buildTestRepos(data);
    await withServer(repos, async srv => {
      const res = await request(srv, 'GET', '/api/layers/layer-a');
      expect(res.status).toBe(200);
      const body = res.body as Record<string, unknown>;
      expect(body.id).toBe('layer-a');
      expect(Array.isArray(body.children)).toBe(true);
      expect((body.children as unknown[]).length).toBe(1);
    });
  });

  it('GET /api/layers/:id returns 404 for non-existent layer', async () => {
    const data = layerData();
    const repos = buildTestRepos(data);
    await withServer(repos, async srv => {
      const res = await request(srv, 'GET', '/api/layers/ghost');
      expect(res.status).toBe(404);
    });
  });

  it('POST /api/layers creates a new layer', async () => {
    const data = layerData();
    const repos = buildTestRepos(data);
    await withServer(repos, async srv => {
      const res = await request(
        srv,
        'POST',
        '/api/layers',
        JSON.stringify({ id: 'new-layer', name: 'New Layer' })
      );
      expect(res.status).toBe(201);
      const body = res.body as Record<string, unknown>;
      expect(body.id).toBe('new-layer');
      expect(body.type).toBe('layer');
    });
  });

  it('POST /api/layers returns 409 for duplicate', async () => {
    const data = layerData();
    const repos = buildTestRepos(data);
    await withServer(repos, async srv => {
      const res = await request(
        srv,
        'POST',
        '/api/layers',
        JSON.stringify({ id: 'layer-a', name: 'Dup' })
      );
      expect(res.status).toBe(409);
    });
  });

  it('POST /api/layers returns 400 for missing name', async () => {
    const data = layerData();
    const repos = buildTestRepos(data);
    await withServer(repos, async srv => {
      const res = await request(srv, 'POST', '/api/layers', JSON.stringify({ id: 'no-name' }));
      expect(res.status).toBe(400);
    });
  });

  it('PATCH /api/components/:id with layer moves component', async () => {
    const data = layerData();
    const repos = buildTestRepos(data);
    await withServer(repos, async srv => {
      const res = await request(
        srv,
        'PATCH',
        '/api/components/comp-1',
        JSON.stringify({ layer: 'layer-b' })
      );
      expect(res.status).toBe(200);
      const body = res.body as Record<string, unknown>;
      expect(body.layer).toBe('layer-b');
    });
  });

  it('PATCH /api/components/:id with non-existent layer returns 400', async () => {
    const data = layerData();
    const repos = buildTestRepos(data);
    await withServer(repos, async srv => {
      const res = await request(
        srv,
        'PATCH',
        '/api/components/comp-1',
        JSON.stringify({ layer: 'ghost-layer' })
      );
      expect(res.status).toBe(400);
    });
  });
});
