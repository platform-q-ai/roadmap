import http from 'node:http';

import { createApp } from '@adapters/api/index.js';
import type {
  IComponentPositionRepository,
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
} from '@domain/index.js';
import { ComponentPosition, Edge, Feature, Node, Version } from '@domain/index.js';
import { describe, expect, it, vi } from 'vitest';

// ─── Helper: in-memory repos ────────────────────────────────────────

interface WorldData {
  nodes: Node[];
  edges: Edge[];
  versions: Version[];
  features: Feature[];
  positions: ComponentPosition[];
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
    search: async () => [],
  };
  const componentPositionRepo: IComponentPositionRepository = {
    findAll: vi.fn(() => data.positions),
    findByComponentId: vi.fn(
      (id: string) => data.positions.find(p => p.componentId === id) ?? null
    ),
    save: vi.fn((position: ComponentPosition) => {
      const existing = data.positions.find(p => p.componentId === position.componentId);
      if (existing) {
        existing.x = position.x;
        existing.y = position.y;
        existing.updatedAt = position.updatedAt;
      } else {
        data.positions.push(position);
      }
      return position;
    }),
    delete: vi.fn((id: string) => {
      const before = data.positions.length;
      data.positions = data.positions.filter(p => p.componentId !== id);
      return data.positions.length < before;
    }),
  };
  return { nodeRepo, edgeRepo, versionRepo, featureRepo, componentPositionRepo };
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
    positions: [],
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
        resolve({ status: res.statusCode ?? 0, body: parsed, headers });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('Component Position Routes', () => {
  describe('GET /api/component-positions', () => {
    it('returns empty array when no positions exist', async () => {
      const data = seedData();
      const repos = buildTestRepos(data);
      const server = createApp(repos, { staticDir: '' }).listen(0);

      const res = await request(server, 'GET', '/api/component-positions');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);

      server.close();
    });

    it('returns all saved positions', async () => {
      const data = seedData();
      data.positions = [
        new ComponentPosition({ componentId: 'comp-a', x: 100, y: 200 }),
        new ComponentPosition({ componentId: 'comp-b', x: 300, y: 400 }),
      ];
      const repos = buildTestRepos(data);
      const server = createApp(repos, { staticDir: '' }).listen(0);

      const res = await request(server, 'GET', '/api/component-positions');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect((res.body as Array<unknown>).length).toBe(2);

      server.close();
    });

    it('handles errors when listing positions', async () => {
      const data = seedData();
      const repos = buildTestRepos(data);
      repos.componentPositionRepo.findAll = vi.fn(() => {
        throw new Error('Database error');
      });
      const server = createApp(repos, { staticDir: '' }).listen(0);

      const res = await request(server, 'GET', '/api/component-positions');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');

      server.close();
    });
  });

  describe('GET /api/component-positions/:id', () => {
    it('returns 400 for invalid component id format (not kebab-case)', async () => {
      const data = seedData();
      const repos = buildTestRepos(data);
      const server = createApp(repos, { staticDir: '' }).listen(0);

      const res = await request(server, 'GET', '/api/component-positions/InvalidId');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Component ID must be kebab-case' });

      server.close();
    });

    it('returns 400 for component id too long', async () => {
      const data = seedData();
      const repos = buildTestRepos(data);
      const server = createApp(repos, { staticDir: '' }).listen(0);

      const longId = 'a'.repeat(65);
      const res = await request(server, 'GET', `/api/component-positions/${longId}`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Component ID must be 64 characters or less' });

      server.close();
    });

    it('returns 404 when position does not exist', async () => {
      const data = seedData();
      const repos = buildTestRepos(data);
      const server = createApp(repos, { staticDir: '' }).listen(0);

      const res = await request(server, 'GET', '/api/component-positions/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Position not found' });

      server.close();
    });

    it('returns position when it exists', async () => {
      const data = seedData();
      data.positions = [new ComponentPosition({ componentId: 'comp-a', x: 100, y: 200 })];
      const repos = buildTestRepos(data);
      const server = createApp(repos, { staticDir: '' }).listen(0);

      const res = await request(server, 'GET', '/api/component-positions/comp-a');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        componentId: 'comp-a',
        x: 100,
        y: 200,
      });

      server.close();
    });

    it('handles repository errors gracefully', async () => {
      const data = seedData();
      const repos = buildTestRepos(data);
      repos.componentPositionRepo.findByComponentId = vi.fn(() => {
        throw new Error('Database connection lost');
      });
      const server = createApp(repos, { staticDir: '' }).listen(0);

      const res = await request(server, 'GET', '/api/component-positions/comp-a');

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body).toHaveProperty('error');

      server.close();
    });
  });

  describe('POST /api/component-positions', () => {
    it('returns 400 for missing componentId', async () => {
      const data = seedData();
      const repos = buildTestRepos(data);
      const server = createApp(repos, { staticDir: '' }).listen(0);

      const res = await request(
        server,
        'POST',
        '/api/component-positions',
        JSON.stringify({ x: 100, y: 200 })
      );

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'componentId is required' });

      server.close();
    });

    it('returns 400 for invalid component id format', async () => {
      const data = seedData();
      const repos = buildTestRepos(data);
      const server = createApp(repos, { staticDir: '' }).listen(0);

      const res = await request(
        server,
        'POST',
        '/api/component-positions',
        JSON.stringify({ componentId: 'InvalidId', x: 100, y: 200 })
      );

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Component ID must be kebab-case' });

      server.close();
    });

    it('returns 404 when component does not exist', async () => {
      const data = seedData();
      const repos = buildTestRepos(data);
      const server = createApp(repos, { staticDir: '' }).listen(0);

      const res = await request(
        server,
        'POST',
        '/api/component-positions',
        JSON.stringify({ componentId: 'nonexistent-component', x: 100, y: 200 })
      );

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Component not found' });

      server.close();
    });

    it('creates position for existing component', async () => {
      const data = seedData();
      const repos = buildTestRepos(data);
      const server = createApp(repos, { staticDir: '' }).listen(0);

      const res = await request(
        server,
        'POST',
        '/api/component-positions',
        JSON.stringify({ componentId: 'comp-a', x: 150, y: 250 })
      );

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        componentId: 'comp-a',
        x: 150,
        y: 250,
      });

      server.close();
    });

    it('returns 400 for invalid coordinates', async () => {
      const data = seedData();
      const repos = buildTestRepos(data);
      const server = createApp(repos, { staticDir: '' }).listen(0);

      const res = await request(
        server,
        'POST',
        '/api/component-positions',
        JSON.stringify({ componentId: 'comp-a', x: 'invalid', y: 200 })
      );

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: 'Invalid request body. Expected { x: number, y: number }',
      });

      server.close();
    });

    it('returns 400 for NaN coordinates', async () => {
      const data = seedData();
      const repos = buildTestRepos(data);
      const server = createApp(repos, { staticDir: '' }).listen(0);

      const res = await request(
        server,
        'POST',
        '/api/component-positions',
        JSON.stringify({ componentId: 'comp-a', x: NaN, y: 200 })
      );

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: 'Invalid request body. Expected { x: number, y: number }',
      });

      server.close();
    });

    it('returns 400 when POST body is not valid JSON', async () => {
      const data = seedData();
      const repos = buildTestRepos(data);
      const server = createApp(repos, { staticDir: '' }).listen(0);

      const res = await request(server, 'POST', '/api/component-positions', 'not valid json');

      expect(res.status).toBe(400);

      server.close();
    });
  });

  describe('DELETE /api/component-positions/:id', () => {
    it('returns 400 for invalid component id format', async () => {
      const data = seedData();
      const repos = buildTestRepos(data);
      const server = createApp(repos, { staticDir: '' }).listen(0);

      const res = await request(server, 'DELETE', '/api/component-positions/InvalidId');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Component ID must be kebab-case' });

      server.close();
    });

    it('returns 404 when position does not exist', async () => {
      const data = seedData();
      const repos = buildTestRepos(data);
      const server = createApp(repos, { staticDir: '' }).listen(0);

      const res = await request(server, 'DELETE', '/api/component-positions/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Position not found' });

      server.close();
    });

    it('deletes existing position and returns 204', async () => {
      const data = seedData();
      data.positions = [new ComponentPosition({ componentId: 'comp-a', x: 100, y: 200 })];
      const repos = buildTestRepos(data);
      const server = createApp(repos, { staticDir: '' }).listen(0);

      const res = await request(server, 'DELETE', '/api/component-positions/comp-a');

      expect(res.status).toBe(204);
      expect(data.positions.length).toBe(0);

      server.close();
    });

    it('handles database errors during deletion', async () => {
      const data = seedData();
      data.positions = [new ComponentPosition({ componentId: 'comp-a', x: 100, y: 200 })];
      const repos = buildTestRepos(data);
      repos.componentPositionRepo.delete = vi.fn(() => {
        throw new Error('Database error');
      });
      const server = createApp(repos, { staticDir: '' }).listen(0);

      const res = await request(server, 'DELETE', '/api/component-positions/comp-a');

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body).toHaveProperty('error');

      server.close();
    });
  });
});
