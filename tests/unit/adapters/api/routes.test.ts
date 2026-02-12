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
    findBySource: vi.fn(async (sid: string) => data.edges.filter(e => e.source_id === sid)),
    findByTarget: vi.fn(async (tid: string) => data.edges.filter(e => e.target_id === tid)),
    findByType: vi.fn(async (type: string) => data.edges.filter(e => e.type === type)),
    findRelationships: vi.fn(async () => data.edges.filter(e => !e.isContainment())),
    save: vi.fn(async (edge: Edge) => {
      data.edges.push(edge);
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

describe('API Routes', () => {
  describe('GET /api/health', () => {
    it('returns 200 with status ok', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/health');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(expect.objectContaining({ status: 'ok' }));
      });
    });
  });

  describe('GET /api/architecture', () => {
    it('returns full architecture graph', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/architecture');
        expect(res.status).toBe(200);
        const body = res.body as Record<string, unknown>;
        expect(body).toHaveProperty('layers');
        expect(body).toHaveProperty('nodes');
        expect(body).toHaveProperty('edges');
        expect(body).toHaveProperty('progression_tree');
        expect(body).toHaveProperty('stats');
      });
    });
  });

  describe('GET /api/components', () => {
    it('returns list of non-layer nodes', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      });
    });
  });

  describe('GET /api/components/:id', () => {
    it('returns a component by ID', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components/comp-a');
        expect(res.status).toBe(200);
        expect((res.body as Record<string, unknown>).id).toBe('comp-a');
      });
    });

    it('returns 404 for missing component', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components/missing');
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
      });
    });
  });

  describe('POST /api/components', () => {
    it('creates a new component and returns 201', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({
          id: 'new-comp',
          name: 'New Component',
          type: 'component',
          layer: 'sup-layer',
        });
        const res = await request(server, 'POST', '/api/components', body);
        expect(res.status).toBe(201);
        expect((res.body as Record<string, unknown>).id).toBe('new-comp');
      });
    });

    it('returns 409 for duplicate ID', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({
          id: 'comp-a',
          name: 'Duplicate',
          type: 'component',
          layer: 'sup-layer',
        });
        const res = await request(server, 'POST', '/api/components', body);
        expect(res.status).toBe(409);
        expect(res.body).toHaveProperty('error');
      });
    });

    it('returns 400 for invalid node type', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({
          id: 'bad',
          name: 'Bad',
          type: 'invalid',
          layer: 'sup-layer',
        });
        const res = await request(server, 'POST', '/api/components', body);
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
      });
    });

    it('returns 400 for missing required fields', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({ id: 'only-id' });
        const res = await request(server, 'POST', '/api/components', body);
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
      });
    });
  });

  describe('DELETE /api/components/:id', () => {
    it('deletes a component and returns 204', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'DELETE', '/api/components/comp-a');
        expect(res.status).toBe(204);
      });
    });

    it('returns 404 for missing component', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'DELETE', '/api/components/ghost');
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
      });
    });
  });

  describe('GET /api/components/:id/features', () => {
    it('returns feature files for a component', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components/comp-a/features');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect((res.body as unknown[]).length).toBeGreaterThan(0);
      });
    });

    it('returns 404 for nonexistent component', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components/ghost/features');
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
      });
    });
  });

  describe('PUT /api/components/:id/features/:filename', () => {
    it('uploads a feature file and returns 200', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const content = 'Feature: New\n  Scenario: Test\n    Given something';
        const res = await request(
          server,
          'PUT',
          '/api/components/comp-a/features/mvp-new.feature',
          content
        );
        expect(res.status).toBe(200);
        expect((res.body as Record<string, unknown>).filename).toBe('mvp-new.feature');
      });
    });

    it('returns 404 for nonexistent component', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const content = 'Feature: Ghost\n  Scenario: Test\n    Given something';
        const res = await request(
          server,
          'PUT',
          '/api/components/ghost/features/mvp-test.feature',
          content
        );
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
      });
    });
  });

  describe('GET /api/components/:id/edges', () => {
    it('returns inbound and outbound edges', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components/comp-a/edges');
        expect(res.status).toBe(200);
        const body = res.body as Record<string, unknown>;
        expect(body).toHaveProperty('inbound');
        expect(body).toHaveProperty('outbound');
      });
    });

    it('returns 404 for nonexistent component', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components/ghost/edges');
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
      });
    });
  });

  describe('GET /api/components/:id/dependencies', () => {
    it('returns dependencies and dependents', async () => {
      const data = seedData();
      const compB = new Node({ id: 'comp-b', name: 'B', type: 'component', layer: 'sup-layer' });
      data.nodes.push(compB);
      data.edges.push(
        new Edge({ id: 2, source_id: 'comp-a', target_id: 'comp-b', type: 'DEPENDS_ON' })
      );
      const repos = buildTestRepos(data);
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components/comp-a/dependencies');
        expect(res.status).toBe(200);
        const body = res.body as Record<string, unknown>;
        expect(body).toHaveProperty('dependencies');
        expect(body).toHaveProperty('dependents');
      });
    });

    it('returns 404 for nonexistent component', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components/ghost/dependencies');
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
      });
    });
  });

  describe('DELETE /api/components/:id/features/:filename', () => {
    it('deletes a feature and returns 204', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(
          server,
          'DELETE',
          '/api/components/comp-a/features/mvp-test.feature'
        );
        expect(res.status).toBe(204);
      });
    });

    it('returns 404 for nonexistent component', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(
          server,
          'DELETE',
          '/api/components/ghost/features/mvp-test.feature'
        );
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
      });
    });

    it('returns 404 for nonexistent feature file', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(
          server,
          'DELETE',
          '/api/components/comp-a/features/mvp-missing.feature'
        );
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
      });
    });

    it('does not affect other features for the same component', async () => {
      const data = seedData();
      data.features.push(
        new Feature({
          node_id: 'comp-a',
          version: 'v1',
          filename: 'v1-other.feature',
          title: 'Other',
          content: 'Feature: Other',
        })
      );
      const repos = buildTestRepos(data);
      await withServer(repos, async server => {
        const res = await request(
          server,
          'DELETE',
          '/api/components/comp-a/features/mvp-test.feature'
        );
        expect(res.status).toBe(204);
        const listRes = await request(server, 'GET', '/api/components/comp-a/features');
        const features = listRes.body as Array<Record<string, unknown>>;
        expect(features).toHaveLength(1);
        expect(features[0].filename).toBe('v1-other.feature');
      });
    });
  });

  describe('Unknown routes', () => {
    it('returns 404 for unknown paths', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/nonexistent');
        expect(res.status).toBe(404);
      });
    });
  });

  describe('OPTIONS (CORS preflight)', () => {
    it('returns 204 for OPTIONS requests', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'OPTIONS', '/api/components');
        expect(res.status).toBe(204);
      });
    });
  });

  describe('POST /api/components with invalid JSON', () => {
    it('returns 400 for non-JSON body', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'POST', '/api/components', 'not json');
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
      });
    });

    it('returns 400 for JSON array body', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'POST', '/api/components', '[1,2,3]');
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
      });
    });
  });

  describe('Server error handling', () => {
    it('returns 500 when a route handler throws', async () => {
      const repos = buildTestRepos(seedData());
      repos.nodeRepo.findAll = vi.fn(async () => {
        throw new Error('DB connection lost');
      });
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components');
        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
      });
    });
  });

  describe('POST /api/components with description and tags', () => {
    it('creates a component with optional description and tags', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({
          id: 'tagged',
          name: 'Tagged',
          type: 'app',
          layer: 'sup-layer',
          description: 'A desc',
          tags: ['a', 'b'],
        });
        const res = await request(server, 'POST', '/api/components', body);
        expect(res.status).toBe(201);
      });
    });
  });

  // ─── Update Version ─────────────────────────────────────────────────

  describe('PUT /api/components/:id/versions/:version', () => {
    it('updates version content and returns 200', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({ content: 'Updated MVP description.' });
        const res = await request(server, 'PUT', '/api/components/comp-a/versions/mvp', body);
        expect(res.status).toBe(200);
        const resBody = res.body as Record<string, unknown>;
        expect(resBody.version).toBe('mvp');
        expect(resBody.content).toBe('Updated MVP description.');
        expect(resBody.node_id).toBe('comp-a');
      });
    });

    it('updates progress and status alongside content', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({
          content: 'In progress.',
          progress: 75,
          status: 'in-progress',
        });
        const res = await request(server, 'PUT', '/api/components/comp-a/versions/mvp', body);
        expect(res.status).toBe(200);
        const resBody = res.body as Record<string, unknown>;
        expect(resBody.progress).toBe(75);
        expect(resBody.status).toBe('in-progress');
      });
    });

    it('returns 404 for nonexistent component', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({ content: 'Nope' });
        const res = await request(server, 'PUT', '/api/components/ghost/versions/mvp', body);
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
      });
    });

    it('returns 400 for invalid JSON body', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'PUT', '/api/components/comp-a/versions/mvp', 'not json');
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
      });
    });

    it('returns 400 for empty body (no content)', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'PUT', '/api/components/comp-a/versions/mvp', '{}');
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
      });
    });

    it('returns 400 for progress out of range', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({ content: 'Test', progress: 150 });
        const res = await request(server, 'PUT', '/api/components/comp-a/versions/mvp', body);
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
      });
    });

    it('returns 400 for invalid status', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({ content: 'Test', status: 'invalid' });
        const res = await request(server, 'PUT', '/api/components/comp-a/versions/mvp', body);
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
      });
    });
  });

  // ─── Security Headers ───────────────────────────────────────────────

  describe('Security headers', () => {
    it('includes X-Content-Type-Options: nosniff on all responses', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/health');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
      });
    });

    it('includes X-Frame-Options: DENY on all responses', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/health');
        expect(res.headers['x-frame-options']).toBe('DENY');
      });
    });

    it('includes X-Request-Id header on all responses', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/health');
        expect(res.headers['x-request-id']).toBeDefined();
        expect(res.headers['x-request-id'].length).toBeGreaterThan(0);
      });
    });

    it('includes security headers on error responses', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components/nonexistent');
        expect(res.status).toBe(404);
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['x-frame-options']).toBe('DENY');
        expect(res.headers['x-request-id']).toBeDefined();
      });
    });

    it('includes request_id in error response body', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'GET', '/api/components/nonexistent');
        expect(res.status).toBe(404);
        const body = res.body as Record<string, unknown>;
        expect(body).toHaveProperty('request_id');
        expect(typeof body.request_id).toBe('string');
      });
    });
  });

  // ─── Input Validation ───────────────────────────────────────────────

  describe('Input validation', () => {
    it('rejects component ID that is not kebab-case', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({
          id: 'Invalid ID!',
          name: 'Bad',
          type: 'component',
          layer: 'sup-layer',
        });
        const res = await request(server, 'POST', '/api/components', body);
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
      });
    });

    it('accepts valid kebab-case component ID', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({
          id: 'valid-kebab-id',
          name: 'Valid',
          type: 'component',
          layer: 'sup-layer',
        });
        const res = await request(server, 'POST', '/api/components', body);
        expect(res.status).toBe(201);
      });
    });

    it('rejects request body exceeding 1MB', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const largeBody = 'x'.repeat(1024 * 1024 + 1);
        const res = await request(server, 'PUT', '/api/components/comp-a/versions/mvp', largeBody);
        expect(res.status).toBe(413);
        expect(res.body).toHaveProperty('error');
      });
    });
  });
});
