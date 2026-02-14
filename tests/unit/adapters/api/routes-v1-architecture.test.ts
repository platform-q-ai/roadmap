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
    save: vi.fn(),
    saveMany: vi.fn(),
    deleteAll: vi.fn(),
    deleteByNode: vi.fn(),
    deleteByNodeAndFilename: vi.fn(async () => false),
    deleteByNodeAndVersionAndFilename: vi.fn(async () => false),
    deleteByNodeAndVersion: vi.fn(async () => 0),
    getStepCountSummary: vi.fn(async () => ({ totalSteps: 0, featureCount: 0 })),
    search: async () => [],
  };
  return { nodeRepo, edgeRepo, versionRepo, featureRepo };
}

function architectureSeedData(): WorldData {
  const layer = new Node({ id: 'sup-layer', name: 'Supervisor', type: 'layer' });
  const comp = new Node({
    id: 'worker',
    name: 'Worker',
    type: 'component',
    layer: 'sup-layer',
  });
  const appA = new Node({
    id: 'cli-app',
    name: 'CLI App',
    type: 'app',
    layer: 'sup-layer',
  });
  const appB = new Node({
    id: 'web-app',
    name: 'Web App',
    type: 'app',
    layer: 'sup-layer',
  });

  const edges = [
    new Edge({ id: 1, source_id: 'sup-layer', target_id: 'worker', type: 'CONTAINS' }),
    new Edge({ id: 2, source_id: 'sup-layer', target_id: 'cli-app', type: 'CONTAINS' }),
    new Edge({ id: 3, source_id: 'sup-layer', target_id: 'web-app', type: 'CONTAINS' }),
    new Edge({ id: 4, source_id: 'worker', target_id: 'cli-app', type: 'DEPENDS_ON' }),
    new Edge({ id: 5, source_id: 'cli-app', target_id: 'web-app', type: 'DEPENDS_ON' }),
  ];

  const versions = [
    new Version({ node_id: 'worker', version: 'mvp', progress: 50, status: 'in-progress' }),
    new Version({ node_id: 'cli-app', version: 'mvp', progress: 30, status: 'in-progress' }),
  ];

  const features = [
    new Feature({
      node_id: 'worker',
      version: 'mvp',
      filename: 'mvp-exec.feature',
      title: 'Execution',
      content: 'Feature: Exec\n  Scenario: Run\n    Given something',
    }),
  ];

  return {
    nodes: [layer, comp, appA, appB],
    edges,
    versions,
    features,
  };
}

// ─── Helper: HTTP request ───────────────────────────────────────────

async function request(
  server: http.Server,
  method: string,
  path: string
): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
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

describe('GET /api/architecture — v1 enriched graph', () => {
  it('returns generated_at as a valid ISO 8601 timestamp', async () => {
    const repos = buildTestRepos(architectureSeedData());
    await withServer(repos, async server => {
      const res = await request(server, 'GET', '/api/architecture');
      expect(res.status).toBe(200);
      const body = res.body as Record<string, unknown>;
      const ts = body['generated_at'] as string;
      expect(ts).toBeDefined();
      expect(new Date(ts).toISOString()).toBe(ts);
    });
  });

  it('returns non-empty layers, nodes, and edges arrays', async () => {
    const repos = buildTestRepos(architectureSeedData());
    await withServer(repos, async server => {
      const res = await request(server, 'GET', '/api/architecture');
      const body = res.body as Record<string, unknown>;
      expect(Array.isArray(body['layers'])).toBe(true);
      expect((body['layers'] as unknown[]).length).toBeGreaterThan(0);
      expect(Array.isArray(body['nodes'])).toBe(true);
      expect((body['nodes'] as unknown[]).length).toBeGreaterThan(0);
      expect(Array.isArray(body['edges'])).toBe(true);
      expect((body['edges'] as unknown[]).length).toBeGreaterThan(0);
    });
  });

  it('includes accurate stats matching actual counts', async () => {
    const data = architectureSeedData();
    const repos = buildTestRepos(data);
    await withServer(repos, async server => {
      const res = await request(server, 'GET', '/api/architecture');
      const body = res.body as Record<string, unknown>;
      const stats = body['stats'] as Record<string, number>;
      const nodes = body['nodes'] as unknown[];
      expect(stats['total_nodes']).toBe(nodes.length);
      expect(stats['total_edges']).toBe(data.edges.length);
      expect(stats['total_versions']).toBe(data.versions.length);
      expect(stats['total_features']).toBe(data.features.length);
    });
  });

  it('enriches nodes with versions, features, and display_state', async () => {
    const repos = buildTestRepos(architectureSeedData());
    await withServer(repos, async server => {
      const res = await request(server, 'GET', '/api/architecture');
      const body = res.body as Record<string, unknown>;
      const nodes = body['nodes'] as Array<Record<string, unknown>>;
      const worker = nodes.find(n => n['id'] === 'worker');
      expect(worker).toBeDefined();
      expect(worker).toHaveProperty('versions');
      expect(worker).toHaveProperty('features');
      expect(worker).toHaveProperty('display_state');
    });
  });

  it('progression_tree contains only app-type nodes', async () => {
    const repos = buildTestRepos(architectureSeedData());
    await withServer(repos, async server => {
      const res = await request(server, 'GET', '/api/architecture');
      const body = res.body as Record<string, unknown>;
      const tree = body['progression_tree'] as Record<string, unknown>;
      const treeNodes = tree['nodes'] as Array<Record<string, unknown>>;
      expect(treeNodes.length).toBeGreaterThan(0);
      for (const node of treeNodes) {
        expect(node['type']).toBe('app');
      }
    });
  });

  it('progression_tree edges exclude CONTAINS type', async () => {
    const repos = buildTestRepos(architectureSeedData());
    await withServer(repos, async server => {
      const res = await request(server, 'GET', '/api/architecture');
      const body = res.body as Record<string, unknown>;
      const tree = body['progression_tree'] as Record<string, unknown>;
      const treeEdges = tree['edges'] as Array<Record<string, unknown>>;
      for (const edge of treeEdges) {
        expect(edge['type']).not.toBe('CONTAINS');
      }
    });
  });

  it('applies derived progress from current_version', async () => {
    const data = architectureSeedData();
    // Add a component with current_version 0.7.5 → mvp progress should be 75
    data.nodes.push(
      new Node({
        id: 'derived-comp',
        name: 'Derived',
        type: 'component',
        layer: 'sup-layer',
        current_version: '0.7.5',
      })
    );
    data.versions.push(
      new Version({ node_id: 'derived-comp', version: 'mvp', progress: 0, status: 'planned' })
    );
    const repos = buildTestRepos(data);
    await withServer(repos, async server => {
      const res = await request(server, 'GET', '/api/architecture');
      const body = res.body as Record<string, unknown>;
      const nodes = body['nodes'] as Array<Record<string, unknown>>;
      const derived = nodes.find(n => n['id'] === 'derived-comp');
      expect(derived).toBeDefined();
      const versions = derived!['versions'] as Record<string, Record<string, unknown>>;
      expect(versions['mvp']['progress']).toBe(75);
    });
  });
});
