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
    deleteAll: vi.fn(async () => {
      data.features.length = 0;
    }),
    deleteByNode: vi.fn(),
    deleteByNodeAndFilename: vi.fn(async () => false),
    deleteByNodeAndVersionAndFilename: vi.fn(async () => false),
    deleteByNodeAndVersion: vi.fn(async () => 0),
    getStepCountSummary: vi.fn(async () => ({
      totalSteps: 0,
      featureCount: 0,
    })),
  };
  return { nodeRepo, edgeRepo, versionRepo, featureRepo };
}

function seedData(): WorldData {
  const layer = new Node({
    id: 'sup-layer',
    name: 'Supervisor',
    type: 'layer',
  });
  const comp = new Node({
    id: 'comp-a',
    name: 'Component A',
    type: 'component',
    layer: 'sup-layer',
  });
  return {
    nodes: [layer, comp],
    edges: [],
    versions: [],
    features: [],
  };
}

/* ── HTTP helpers ─────────────────────────────────────────────────── */

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
        resolve({
          status: res.statusCode ?? 500,
          body: parsed,
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

/* ── Tests ────────────────────────────────────────────────────────── */

describe('Admin Routes — seed and export', () => {
  it('POST /api/admin/seed-features returns 200 with seeded count', async () => {
    const { buildSeedExportRoutes } = await import('@adapters/api/routes-seed-export.js');
    const data = seedData();
    const repos = buildTestRepos(data);
    const scanFn = vi.fn(async () => [
      {
        nodeId: 'comp-a',
        filename: 'mvp-test.feature',
        content: 'Feature: Test\n  Scenario: S\n    Given a step',
      },
    ]);
    const writeFn = vi.fn(async () => {});
    const ensureDirFn = vi.fn(async () => {});
    const routes = buildSeedExportRoutes({
      featureRepo: repos.featureRepo,
      nodeRepo: repos.nodeRepo,
      scanFeatureFiles: scanFn,
      writeFeatureFile: writeFn,
      ensureDir: ensureDirFn,
    });

    const app = createApp(repos, { adminRoutes: routes });
    const server = app.listen(0);
    try {
      const res = await request(server, 'POST', '/api/admin/seed-features');
      expect(res.status).toBe(200);
      const body = res.body as Record<string, unknown>;
      expect(body.seeded).toBe(1);
      expect(body.skipped).toBe(0);
      expect(body.step_totals).toBeDefined();
    } finally {
      await new Promise<void>(resolve => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
    }
  });

  it('POST /api/admin/export-features returns 200 with exported count', async () => {
    const { buildSeedExportRoutes } = await import('@adapters/api/routes-seed-export.js');
    const data = seedData();
    data.features.push(
      new Feature({
        node_id: 'comp-a',
        version: 'v1',
        filename: 'v1-test.feature',
        title: 'Test',
        content: 'Feature: Test\n  Scenario: S\n    Given a step',
      })
    );
    const repos = buildTestRepos(data);
    const scanFn = vi.fn(async () => []);
    const writeFn = vi.fn(async () => {});
    const ensureDirFn = vi.fn(async () => {});
    const routes = buildSeedExportRoutes({
      featureRepo: repos.featureRepo,
      nodeRepo: repos.nodeRepo,
      scanFeatureFiles: scanFn,
      writeFeatureFile: writeFn,
      ensureDir: ensureDirFn,
    });

    const app = createApp(repos, { adminRoutes: routes });
    const server = app.listen(0);
    try {
      const res = await request(server, 'POST', '/api/admin/export-features');
      expect(res.status).toBe(200);
      const body = res.body as Record<string, unknown>;
      expect(body.exported).toBe(1);
      expect(writeFn).toHaveBeenCalledOnce();
    } finally {
      await new Promise<void>(resolve => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
    }
  });

  it('export filters by component query param', async () => {
    const { buildSeedExportRoutes } = await import('@adapters/api/routes-seed-export.js');
    const data = seedData();
    data.nodes.push(
      new Node({
        id: 'comp-b',
        name: 'B',
        type: 'component',
        layer: 'sup-layer',
      })
    );
    data.features.push(
      new Feature({
        node_id: 'comp-a',
        version: 'v1',
        filename: 'v1-a.feature',
        title: 'A',
        content: 'Feature: A\n  Scenario: S\n    Given a',
      }),
      new Feature({
        node_id: 'comp-b',
        version: 'v1',
        filename: 'v1-b.feature',
        title: 'B',
        content: 'Feature: B\n  Scenario: S\n    Given b',
      })
    );
    const repos = buildTestRepos(data);
    const scanFn = vi.fn(async () => []);
    const writeFn = vi.fn(async () => {});
    const ensureDirFn = vi.fn(async () => {});
    const routes = buildSeedExportRoutes({
      featureRepo: repos.featureRepo,
      nodeRepo: repos.nodeRepo,
      scanFeatureFiles: scanFn,
      writeFeatureFile: writeFn,
      ensureDir: ensureDirFn,
    });

    const app = createApp(repos, { adminRoutes: routes });
    const server = app.listen(0);
    try {
      const res = await request(server, 'POST', '/api/admin/export-features?component=comp-a');
      expect(res.status).toBe(200);
      const body = res.body as Record<string, unknown>;
      expect(body.exported).toBe(1);
      // Should only have written comp-a features
      expect(writeFn).toHaveBeenCalledTimes(1);
    } finally {
      await new Promise<void>(resolve => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
    }
  });

  it('seed response includes step_totals per version', async () => {
    const { buildSeedExportRoutes } = await import('@adapters/api/routes-seed-export.js');
    const data = seedData();
    const repos = buildTestRepos(data);
    const scanFn = vi.fn(async () => [
      {
        nodeId: 'comp-a',
        filename: 'mvp-test.feature',
        content: 'Feature: MVP\n  Scenario: S1\n    Given a\n    When b\n    Then c',
      },
      {
        nodeId: 'comp-a',
        filename: 'v1-test.feature',
        content:
          'Feature: V1\n  Scenario: S1\n    Given a\n  Scenario: S2\n    Given b\n    Then c',
      },
    ]);
    const writeFn = vi.fn(async () => {});
    const ensureDirFn = vi.fn(async () => {});
    const routes = buildSeedExportRoutes({
      featureRepo: repos.featureRepo,
      nodeRepo: repos.nodeRepo,
      scanFeatureFiles: scanFn,
      writeFeatureFile: writeFn,
      ensureDir: ensureDirFn,
    });

    const app = createApp(repos, { adminRoutes: routes });
    const server = app.listen(0);
    try {
      const res = await request(server, 'POST', '/api/admin/seed-features');
      expect(res.status).toBe(200);
      const body = res.body as Record<string, unknown>;
      const totals = body.step_totals as Record<string, Record<string, number>>;
      expect(totals).toBeDefined();
      // Should have entries for mvp and v1
      expect(totals.mvp).toBeDefined();
      expect(totals.v1).toBeDefined();
      expect(totals.mvp.total_steps).toBeGreaterThan(0);
      expect(totals.mvp.total_scenarios).toBeGreaterThan(0);
    } finally {
      await new Promise<void>(resolve => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
    }
  });
});
