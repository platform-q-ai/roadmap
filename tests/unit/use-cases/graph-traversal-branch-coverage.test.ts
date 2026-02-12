import type {
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
} from '@domain/index.js';
import { Edge, Feature, Node, Version } from '@domain/index.js';
import {
  GetComponentContext,
  GetImplementationOrder,
  GetNextImplementable,
} from '@use-cases/index.js';
import { describe, expect, it, vi } from 'vitest';

// ─── Helper: mock repos ─────────────────────────────────────────────

function createMockRepos(overrides: {
  nodes?: Node[];
  edges?: Edge[];
  versions?: Version[];
  features?: Feature[];
}) {
  const nodes = overrides.nodes ?? [];
  const edges = overrides.edges ?? [];
  const versions = overrides.versions ?? [];
  const features = overrides.features ?? [];

  const nodeRepo: INodeRepository = {
    findAll: vi.fn().mockResolvedValue(nodes),
    findById: vi.fn(async (id: string) => nodes.find(n => n.id === id) ?? null),
    findByType: vi.fn(async (type: string) => nodes.filter(n => n.type === type)),
    findByLayer: vi.fn(async (layerId: string) => nodes.filter(n => n.layer === layerId)),
    exists: vi.fn(async (id: string) => nodes.some(n => n.id === id)),
    save: vi.fn(),
    delete: vi.fn(),
  };
  const edgeRepo: IEdgeRepository = {
    findAll: vi.fn().mockResolvedValue(edges),
    findById: vi.fn(),
    findBySource: vi.fn(async (sid: string) => edges.filter(e => e.source_id === sid)),
    findByTarget: vi.fn(async (tid: string) => edges.filter(e => e.target_id === tid)),
    findByType: vi.fn(async (type: string) => edges.filter(e => e.type === type)),
    findRelationships: vi.fn(async () => edges.filter(e => !e.isContainment())),
    existsBySrcTgtType: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
  const versionRepo: IVersionRepository = {
    findAll: vi.fn().mockResolvedValue(versions),
    findByNode: vi.fn(async (nid: string) => versions.filter(v => v.node_id === nid)),
    findByNodeAndVersion: vi.fn(
      async (nid: string, ver: string) =>
        versions.find(v => v.node_id === nid && v.version === ver) ?? null
    ),
    save: vi.fn(),
    deleteByNode: vi.fn(),
  };
  const featureRepo: IFeatureRepository = {
    findAll: vi.fn().mockResolvedValue(features),
    findByNode: vi.fn(async (nid: string) => features.filter(f => f.node_id === nid)),
    findByNodeAndVersion: vi.fn(async (nid: string, ver: string) =>
      features.filter(f => f.node_id === nid && f.version === ver)
    ),
    getStepCountSummary: vi.fn(async (nid: string, ver: string) => {
      const matching = features.filter(f => f.node_id === nid && f.version === ver);
      return {
        totalSteps: matching.reduce((sum, f) => sum + f.step_count, 0),
        featureCount: matching.length,
      };
    }),
    save: vi.fn(),
    saveMany: vi.fn(),
    deleteAll: vi.fn(),
    deleteByNode: vi.fn(),
    deleteByNodeAndFilename: vi.fn(),
    deleteByNodeAndVersionAndFilename: vi.fn(),
    deleteByNodeAndVersion: vi.fn(),
    search: vi.fn(async () => []),
  };

  return { nodeRepo, edgeRepo, versionRepo, featureRepo };
}

// ─── Shared test data ───────────────────────────────────────────────

function makeNode(id: string, type = 'component', layer = 'test-layer'): Node {
  return new Node({
    id,
    name: `Node ${id}`,
    type: type as Node['type'],
    layer: type === 'layer' ? undefined : layer,
  });
}

function makeEdge(id: number, src: string, tgt: string, type = 'DEPENDS_ON'): Edge {
  return new Edge({
    id,
    source_id: src,
    target_id: tgt,
    type: type as Edge['type'],
  });
}

// ─── GetComponentContext — branch coverage ──────────────────────────

describe('GetComponentContext — branch coverage', () => {
  it('buildStepSummaries fallback: feature version not in versions list', async () => {
    const comp = makeNode('ctx-comp');
    const nodes = [comp];
    const versions = [
      new Version({ node_id: 'ctx-comp', version: 'mvp', progress: 50, status: 'in-progress' }),
    ];
    // Feature with version 'v2' which is NOT in the versions list
    const features = [
      new Feature({
        node_id: 'ctx-comp',
        version: 'v2',
        filename: 'v2-orphan.feature',
        title: 'Orphan',
        content: 'Feature: Orphan\n  Scenario: S\n    Given a step',
        step_count: 3,
      }),
    ];
    const repos = createMockRepos({ nodes, edges: [], versions, features });
    const uc = new GetComponentContext(repos);
    const result = await uc.execute('ctx-comp');

    // The v2 feature should appear in grouped features
    expect(result.features['v2']).toHaveLength(1);
    expect(result.features['v2'][0].step_count).toBe(3);
    // enrichVersions should still work for mvp (with 0 steps)
    expect(result.versions).toHaveLength(1);
    expect(result.versions[0].total_steps).toBe(0);
  });

  it('groupFeatures groups multiple features across versions', async () => {
    const comp = makeNode('ctx-comp');
    const nodes = [comp];
    const versions = [
      new Version({ node_id: 'ctx-comp', version: 'mvp', progress: 50, status: 'in-progress' }),
      new Version({ node_id: 'ctx-comp', version: 'v1', progress: 0, status: 'planned' }),
    ];
    const features = [
      new Feature({
        node_id: 'ctx-comp',
        version: 'mvp',
        filename: 'mvp-a.feature',
        title: 'A',
        content: 'Feature: A\n  Scenario: S\n    Given a step',
        step_count: 2,
      }),
      new Feature({
        node_id: 'ctx-comp',
        version: 'mvp',
        filename: 'mvp-b.feature',
        title: 'B',
        content: 'Feature: B\n  Scenario: S\n    Given a step',
        step_count: 3,
      }),
      new Feature({
        node_id: 'ctx-comp',
        version: 'v1',
        filename: 'v1-c.feature',
        title: 'C',
        content: 'Feature: C\n  Scenario: S\n    Given a step',
        step_count: 4,
      }),
    ];
    const repos = createMockRepos({ nodes, edges: [], versions, features });
    const uc = new GetComponentContext(repos);
    const result = await uc.execute('ctx-comp');

    // groupFeatures: mvp has 2 features, v1 has 1
    expect(result.features['mvp']).toHaveLength(2);
    expect(result.features['v1']).toHaveLength(1);
    // enrichVersions: mvp total_steps = 5, v1 total_steps = 4
    const mvpVer = result.versions.find(v => v.version === 'mvp');
    expect(mvpVer?.total_steps).toBe(5);
    expect(mvpVer?.feature_count).toBe(2);
    const v1Ver = result.versions.find(v => v.version === 'v1');
    expect(v1Ver?.total_steps).toBe(4);
    // buildProgress
    expect(result.progress['mvp']).toBeDefined();
    expect(result.progress['v1']).toBeDefined();
  });

  it('enrichVersions fallback for version with no matching summary', async () => {
    const comp = makeNode('ctx-comp');
    const nodes = [comp];
    // Version exists but no features at all
    const versions = [
      new Version({ node_id: 'ctx-comp', version: 'v2', progress: 0, status: 'planned' }),
    ];
    const repos = createMockRepos({ nodes, edges: [], versions, features: [] });
    const uc = new GetComponentContext(repos);
    const result = await uc.execute('ctx-comp');

    // enrichVersions should use the pre-seeded summary with 0 values
    expect(result.versions).toHaveLength(1);
    expect(result.versions[0].total_steps).toBe(0);
    expect(result.versions[0].feature_count).toBe(0);
    // buildProgress should also have v2
    const v2Progress = result.progress['v2'] as Record<string, unknown>;
    expect(v2Progress.total_steps).toBe(0);
    expect(v2Progress.feature_count).toBe(0);
  });

  it('resolveLayer returns null when layer node does not exist in nodeMap', async () => {
    // Component references a layer that doesn't exist in the loaded nodes
    const comp = new Node({
      id: 'orphan-comp',
      name: 'Orphan',
      type: 'component',
      layer: 'missing-layer',
    });
    const nodes = [comp];
    const repos = createMockRepos({ nodes, edges: [] });
    const uc = new GetComponentContext(repos);
    const result = await uc.execute('orphan-comp');

    expect(result.layer).toBeNull();
  });
});

// ─── GetImplementationOrder — branch coverage ───────────────────────

describe('GetImplementationOrder — branch coverage', () => {
  it('skips non-DEPENDS_ON edges in graph building', async () => {
    const nodes = [makeNode('a'), makeNode('b')];
    // CONTAINS edge should be ignored
    const edges = [makeEdge(1, 'a', 'b', 'CONTAINS')];
    const repos = createMockRepos({ nodes, edges });
    const uc = new GetImplementationOrder(repos);
    const result = await uc.execute();

    // Both should appear in order since CONTAINS is ignored
    expect(result.order).toBeDefined();
    expect(result.order).toHaveLength(2);
    expect(result.cycle).toBeUndefined();
  });

  it('handles diamond dependency graph correctly', async () => {
    // a depends on b and c, both b and c depend on d
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c'), makeNode('d')];
    const edges = [
      makeEdge(1, 'a', 'b'),
      makeEdge(2, 'a', 'c'),
      makeEdge(3, 'b', 'd'),
      makeEdge(4, 'c', 'd'),
    ];
    const repos = createMockRepos({ nodes, edges });
    const uc = new GetImplementationOrder(repos);
    const result = await uc.execute();

    expect(result.order).toBeDefined();
    expect(result.cycle).toBeUndefined();
    const order = result.order as string[];
    expect(order).toHaveLength(4);
    // d must come before b and c, b and c before a
    expect(order.indexOf('d')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('d')).toBeLessThan(order.indexOf('c'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('a'));
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('a'));
  });

  it('returns all components in order when no edges exist', async () => {
    const nodes = [makeNode('x'), makeNode('y'), makeNode('z')];
    const repos = createMockRepos({ nodes, edges: [] });
    const uc = new GetImplementationOrder(repos);
    const result = await uc.execute();

    expect(result.order).toBeDefined();
    expect(result.order).toHaveLength(3);
    expect(result.cycle).toBeUndefined();
  });
});

// ─── GetNextImplementable — branch coverage ─────────────────────────

describe('GetNextImplementable — branch coverage', () => {
  it('filters out versions for different version strings', async () => {
    const nodes = [makeNode('test-layer', 'layer'), makeNode('comp')];
    const versions = [
      new Version({ node_id: 'comp', version: 'mvp', progress: 50, status: 'in-progress' }),
      new Version({ node_id: 'comp', version: 'v1', progress: 100, status: 'complete' }),
    ];
    const features = [
      new Feature({
        node_id: 'comp',
        version: 'mvp',
        filename: 'mvp-a.feature',
        title: 'A',
        content: 'Feature: A\n  Scenario: S\n    Given a step',
        step_count: 3,
      }),
      new Feature({
        node_id: 'comp',
        version: 'v1',
        filename: 'v1-b.feature',
        title: 'B',
        content: 'Feature: B\n  Scenario: S\n    Given a step',
        step_count: 5,
      }),
    ];
    const repos = createMockRepos({ nodes, edges: [], versions, features });
    const uc = new GetNextImplementable(repos);

    // Query for mvp: comp is at 50%, not 100%, so it's implementable
    const mvpResult = await uc.execute('mvp');
    expect(mvpResult.some(c => c.id === 'comp')).toBe(true);
    expect(mvpResult.find(c => c.id === 'comp')?.total_steps).toBe(3);

    // Query for v1: comp is at 100%, so NOT implementable
    const v1Result = await uc.execute('v1');
    expect(v1Result.some(c => c.id === 'comp')).toBe(false);
  });

  it('excludes component when a dependency is not complete', async () => {
    const nodes = [
      makeNode('test-layer', 'layer'),
      makeNode('blocked'),
      makeNode('incomplete-dep'),
    ];
    const edges = [makeEdge(1, 'blocked', 'incomplete-dep')];
    const versions = [
      new Version({
        node_id: 'incomplete-dep',
        version: 'mvp',
        progress: 50,
        status: 'in-progress',
      }),
      new Version({ node_id: 'blocked', version: 'mvp', progress: 0, status: 'planned' }),
    ];
    const repos = createMockRepos({ nodes, edges, versions });
    const uc = new GetNextImplementable(repos);
    const result = await uc.execute('mvp');

    // blocked depends on incomplete-dep (50%), so it's NOT implementable
    expect(result.some(c => c.id === 'blocked')).toBe(false);
    // incomplete-dep has no deps, so it IS implementable (at 50%)
    expect(result.some(c => c.id === 'incomplete-dep')).toBe(true);
  });

  it('handles component with no version record (defaults to 0 progress)', async () => {
    const nodes = [makeNode('test-layer', 'layer'), makeNode('no-ver')];
    const repos = createMockRepos({ nodes, edges: [] });
    const uc = new GetNextImplementable(repos);
    const result = await uc.execute('mvp');

    // no-ver has 0 progress (no version record), no deps => implementable
    expect(result.some(c => c.id === 'no-ver')).toBe(true);
    expect(result.find(c => c.id === 'no-ver')?.progress).toBe(0);
    expect(result.find(c => c.id === 'no-ver')?.total_steps).toBe(0);
  });

  it('skips non-DEPENDS_ON edges when building dependency map', async () => {
    const nodes = [makeNode('test-layer', 'layer'), makeNode('a'), makeNode('b')];
    const edges = [makeEdge(1, 'a', 'b', 'CONTAINS')]; // Not DEPENDS_ON
    const versions = [
      new Version({ node_id: 'a', version: 'mvp', progress: 30, status: 'in-progress' }),
      new Version({ node_id: 'b', version: 'mvp', progress: 30, status: 'in-progress' }),
    ];
    const repos = createMockRepos({ nodes, edges, versions });
    const uc = new GetNextImplementable(repos);
    const result = await uc.execute('mvp');

    // CONTAINS is ignored, so both are implementable (no DEPENDS_ON deps)
    expect(result.some(c => c.id === 'a')).toBe(true);
    expect(result.some(c => c.id === 'b')).toBe(true);
  });
});
