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
  const compB = new Node({
    id: 'comp-b',
    name: 'Component B',
    type: 'component',
    layer: 'sup-layer',
  });
  return {
    nodes: [layer, shared, comp, compB],
    edges: [],
    versions: [],
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

describe('API Routes — v1 batch feature publishing', () => {
  describe('POST /api/components/:id/versions/:ver/features/batch', () => {
    it('uploads multiple features and returns 201 with totals', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({
          features: [
            {
              filename: 'first.feature',
              content:
                'Feature: First\n  Scenario: S1\n    Given a step\n    When an action\n    Then a result',
            },
            {
              filename: 'second.feature',
              content:
                'Feature: Second\n  Scenario: S2\n    Given another step\n    Then another result',
            },
          ],
        });
        const res = await request(
          server,
          'POST',
          '/api/components/comp-a/versions/v1/features/batch',
          body
        );
        expect(res.status).toBe(201);
        const resBody = res.body as Record<string, unknown>;
        expect(resBody.uploaded).toBe(2);
        expect(resBody.version).toBe('v1');
        expect(resBody.total_steps).toBe(5);
        expect(resBody.errors).toEqual([]);
      });
    });

    it('returns 207 on partial failure with invalid Gherkin', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({
          features: [
            {
              filename: 'valid.feature',
              content: 'Feature: Valid\n  Scenario: S1\n    Given a step',
            },
            {
              filename: 'invalid.feature',
              content: 'This is not valid Gherkin',
            },
          ],
        });
        const res = await request(
          server,
          'POST',
          '/api/components/comp-a/versions/v1/features/batch',
          body
        );
        expect(res.status).toBe(207);
        const resBody = res.body as Record<string, unknown>;
        expect(resBody.uploaded).toBe(1);
        const errors = resBody.errors as Array<Record<string, unknown>>;
        expect(errors).toHaveLength(1);
        expect(errors[0].filename).toBe('invalid.feature');
      });
    });

    it('returns 400 when features array exceeds 50 items', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const features = Array.from({ length: 51 }, (_, i) => ({
          filename: `f-${i}.feature`,
          content: `Feature: F${i}\n  Scenario: S\n    Given a step`,
        }));
        const body = JSON.stringify({ features });
        const res = await request(
          server,
          'POST',
          '/api/components/comp-a/versions/v1/features/batch',
          body
        );
        expect(res.status).toBe(400);
        const resBody = res.body as Record<string, unknown>;
        expect(String(resBody.error)).toContain('maximum 50');
      });
    });

    it('returns 400 for empty features array', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({ features: [] });
        const res = await request(
          server,
          'POST',
          '/api/components/comp-a/versions/v1/features/batch',
          body
        );
        expect(res.status).toBe(400);
        const resBody = res.body as Record<string, unknown>;
        expect(String(resBody.error)).toContain('features array must not be empty');
      });
    });

    it('returns 400 for invalid JSON body', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(
          server,
          'POST',
          '/api/components/comp-a/versions/v1/features/batch',
          'not-json'
        );
        expect(res.status).toBe(400);
        const resBody = res.body as Record<string, unknown>;
        expect(String(resBody.error)).toContain('Invalid JSON');
      });
    });

    it('returns 400 when features field is missing', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(
          server,
          'POST',
          '/api/components/comp-a/versions/v1/features/batch',
          '{}'
        );
        expect(res.status).toBe(400);
      });
    });

    it('returns 404 for non-existent component', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({
          features: [
            {
              filename: 'test.feature',
              content: 'Feature: Test\n  Scenario: S\n    Given a step',
            },
          ],
        });
        const res = await request(
          server,
          'POST',
          '/api/components/no-such/versions/v1/features/batch',
          body
        );
        expect(res.status).toBe(404);
      });
    });

    it('returns 207 with errors for feature entry missing filename', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({
          features: [{ content: 'Feature: No Name\n  Scenario: S\n    Given a step' }],
        });
        const res = await request(
          server,
          'POST',
          '/api/components/comp-a/versions/v1/features/batch',
          body
        );
        expect(res.status).toBe(207);
        const resBody = res.body as Record<string, unknown>;
        expect(resBody.uploaded).toBe(0);
        const errors = resBody.errors as Array<Record<string, unknown>>;
        expect(errors).toHaveLength(1);
      });
    });
  });

  describe('POST /api/features/batch (cross-component)', () => {
    it('uploads features to different components with different versions', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({
          features: [
            {
              node_id: 'comp-a',
              version: 'v1',
              filename: 'a.feature',
              content: 'Feature: A\n  Scenario: S\n    Given a step',
            },
            {
              node_id: 'comp-b',
              version: 'v2',
              filename: 'b.feature',
              content: 'Feature: B\n  Scenario: S\n    Given a step\n    Then a result',
            },
          ],
        });
        const res = await request(server, 'POST', '/api/features/batch', body);
        expect(res.status).toBe(201);
        const resBody = res.body as Record<string, unknown>;
        expect(resBody.uploaded).toBe(2);
        expect(resBody.errors).toEqual([]);
      });
    });

    it('returns 400 when entry is missing version', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({
          features: [
            {
              node_id: 'comp-a',
              filename: 'no-ver.feature',
              content: 'Feature: No Ver\n  Scenario: S\n    Given a step',
            },
          ],
        });
        const res = await request(server, 'POST', '/api/features/batch', body);
        expect(res.status).toBe(400);
        const resBody = res.body as Record<string, unknown>;
        expect(String(resBody.error)).toContain('version is required');
      });
    });

    it('returns 400 when entry is missing node_id', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({
          features: [
            {
              version: 'v1',
              filename: 'no-node.feature',
              content: 'Feature: No Node\n  Scenario: S\n    Given a step',
            },
          ],
        });
        const res = await request(server, 'POST', '/api/features/batch', body);
        expect(res.status).toBe(400);
        const resBody = res.body as Record<string, unknown>;
        expect(String(resBody.error)).toContain('node_id is required');
      });
    });

    it('returns 400 for empty features array in cross-component', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({ features: [] });
        const res = await request(server, 'POST', '/api/features/batch', body);
        expect(res.status).toBe(400);
        const resBody = res.body as Record<string, unknown>;
        expect(String(resBody.error)).toContain('features array must not be empty');
      });
    });

    it('returns 400 for invalid JSON body', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'POST', '/api/features/batch', 'not-json');
        expect(res.status).toBe(400);
        const resBody = res.body as Record<string, unknown>;
        expect(String(resBody.error)).toContain('Invalid JSON');
      });
    });

    it('returns 400 when features field is missing in cross-component', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const res = await request(server, 'POST', '/api/features/batch', '{}');
        expect(res.status).toBe(400);
      });
    });

    it('returns 207 for non-existent component in cross-component batch', async () => {
      const repos = buildTestRepos(seedData());
      await withServer(repos, async server => {
        const body = JSON.stringify({
          features: [
            {
              node_id: 'nonexistent',
              version: 'v1',
              filename: 'ghost.feature',
              content: 'Feature: Ghost\n  Scenario: S\n    Given a step',
            },
          ],
        });
        const res = await request(server, 'POST', '/api/features/batch', body);
        expect(res.status).toBe(207);
        const resBody = res.body as Record<string, unknown>;
        expect(resBody.uploaded).toBe(0);
        const errors = resBody.errors as Array<Record<string, unknown>>;
        expect(errors).toHaveLength(1);
      });
    });
  });
});
