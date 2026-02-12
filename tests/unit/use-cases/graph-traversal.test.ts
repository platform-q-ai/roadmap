import type {
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
} from '@domain/index.js';
import { Edge, Feature, Node, Version } from '@domain/index.js';
import {
  GetComponentContext,
  GetComponentsByStatus,
  GetDependencyTree,
  GetDependents,
  GetImplementationOrder,
  GetLayerOverview,
  GetNeighbourhood,
  GetNextImplementable,
  GetShortestPath,
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

// ─── GetDependencyTree ──────────────────────────────────────────────

describe('GetDependencyTree', () => {
  it('returns dependencies as a tree with depth 1', async () => {
    const nodes = [makeNode('root'), makeNode('dep-a'), makeNode('dep-b')];
    const edges = [makeEdge(1, 'root', 'dep-a'), makeEdge(2, 'root', 'dep-b')];
    const repos = createMockRepos({ nodes, edges });
    const uc = new GetDependencyTree(repos);
    const result = await uc.execute('root', 1);

    expect(result).toHaveLength(2);
    const ids = result.map((d: Record<string, unknown>) => d.id);
    expect(ids).toContain('dep-a');
    expect(ids).toContain('dep-b');
  });

  it('returns nested dependencies at depth 2', async () => {
    const nodes = [makeNode('root'), makeNode('mid'), makeNode('leaf')];
    const edges = [makeEdge(1, 'root', 'mid'), makeEdge(2, 'mid', 'leaf')];
    const repos = createMockRepos({ nodes, edges });
    const uc = new GetDependencyTree(repos);
    const result = await uc.execute('root', 2);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('mid');
    expect(result[0].dependencies).toHaveLength(1);
    expect(result[0].dependencies[0].id).toBe('leaf');
  });

  it('stops at max depth', async () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const edges = [makeEdge(1, 'a', 'b'), makeEdge(2, 'b', 'c')];
    const repos = createMockRepos({ nodes, edges });
    const uc = new GetDependencyTree(repos);
    const result = await uc.execute('a', 1);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
    expect(result[0].dependencies).toBeUndefined();
  });

  it('handles no dependencies', async () => {
    const nodes = [makeNode('lone')];
    const repos = createMockRepos({ nodes, edges: [] });
    const uc = new GetDependencyTree(repos);
    const result = await uc.execute('lone', 2);

    expect(result).toHaveLength(0);
  });
});

// ─── GetDependencyTree (edge cases) ─────────────────────────────────

describe('GetDependencyTree — edge cases', () => {
  it('skips already-visited nodes (cycle protection)', async () => {
    const nodes = [makeNode('a'), makeNode('b')];
    // a -> b and b -> a would form a cycle, but we also add a -> b
    const edges = [makeEdge(1, 'a', 'b'), makeEdge(2, 'b', 'a')];
    const repos = createMockRepos({ nodes, edges });
    const uc = new GetDependencyTree(repos);
    const result = await uc.execute('a', 3);

    // Should include b but not recurse infinitely back to a
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });

  it('skips edges pointing to non-existent nodes', async () => {
    const nodes = [makeNode('a')]; // 'ghost' does not exist
    const edges = [makeEdge(1, 'a', 'ghost')];
    const repos = createMockRepos({ nodes, edges });
    const uc = new GetDependencyTree(repos);
    const result = await uc.execute('a', 1);

    expect(result).toHaveLength(0);
  });
});

// ─── GetDependents ──────────────────────────────────────────────────

describe('GetDependents', () => {
  it('returns components that depend on the target', async () => {
    const nodes = [makeNode('provider'), makeNode('c1'), makeNode('c2')];
    const edges = [makeEdge(1, 'c1', 'provider'), makeEdge(2, 'c2', 'provider')];
    const repos = createMockRepos({ nodes, edges });
    const uc = new GetDependents(repos);
    const result = await uc.execute('provider');

    expect(result).toHaveLength(2);
    const ids = result.map((d: Record<string, unknown>) => d.id);
    expect(ids).toContain('c1');
    expect(ids).toContain('c2');
  });

  it('returns empty array when no dependents', async () => {
    const nodes = [makeNode('standalone')];
    const repos = createMockRepos({ nodes, edges: [] });
    const uc = new GetDependents(repos);
    const result = await uc.execute('standalone');

    expect(result).toHaveLength(0);
  });

  it('skips dependents whose node no longer exists', async () => {
    const nodes = [makeNode('provider')]; // 'ghost' not in nodes
    const edges = [makeEdge(1, 'ghost', 'provider')];
    const repos = createMockRepos({ nodes, edges });
    const uc = new GetDependents(repos);
    const result = await uc.execute('provider');

    expect(result).toHaveLength(0);
  });
});

// ─── GetComponentContext (edge cases) ───────────────────────────────

describe('GetComponentContext — edge cases', () => {
  it('handles component with no layer', async () => {
    const comp = new Node({ id: 'no-layer', name: 'No Layer', type: 'component' });
    const nodes = [comp];
    const repos = createMockRepos({ nodes, edges: [] });
    const uc = new GetComponentContext(repos);
    const result = await uc.execute('no-layer');

    expect(result.layer).toBeNull();
    expect(result.siblings).toHaveLength(0);
  });

  it('handles edge targets that no longer exist', async () => {
    const comp = makeNode('ctx-comp');
    const nodes = [comp]; // 'ghost' not in nodes
    const edges = [
      makeEdge(1, 'ctx-comp', 'ghost', 'DEPENDS_ON'),
      makeEdge(2, 'phantom', 'ctx-comp', 'DEPENDS_ON'),
    ];
    const repos = createMockRepos({ nodes, edges });
    const uc = new GetComponentContext(repos);
    const result = await uc.execute('ctx-comp');

    // Should include references even when node is not found (fallback to id-only)
    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].id).toBe('ghost');
    expect(result.dependents).toHaveLength(1);
    expect(result.dependents[0].id).toBe('phantom');
  });
});

// ─── GetComponentContext ────────────────────────────────────────────

describe('GetComponentContext', () => {
  it('returns full context with all fields', async () => {
    const layer = makeNode('test-layer', 'layer');
    const comp = makeNode('ctx-comp');
    const sibling = makeNode('ctx-sibling');
    const dep = makeNode('ctx-dep');
    const nodes = [layer, comp, sibling, dep];
    const edges = [
      makeEdge(1, 'test-layer', 'ctx-comp', 'CONTAINS'),
      makeEdge(2, 'test-layer', 'ctx-sibling', 'CONTAINS'),
      makeEdge(3, 'ctx-comp', 'ctx-dep', 'DEPENDS_ON'),
    ];
    const versions = [
      new Version({ node_id: 'ctx-comp', version: 'mvp', progress: 50, status: 'in-progress' }),
    ];
    const features = [
      new Feature({
        node_id: 'ctx-comp',
        version: 'mvp',
        filename: 'mvp-test.feature',
        title: 'Test',
        content: 'Feature: Test\n  Scenario: S\n    Given a step',
        step_count: 1,
      }),
    ];
    const repos = createMockRepos({ nodes, edges, versions, features });
    const uc = new GetComponentContext(repos);
    const result = await uc.execute('ctx-comp');

    expect(result.component).toBeDefined();
    expect(result.component.id).toBe('ctx-comp');
    expect(result.versions).toBeDefined();
    expect(result.features).toBeDefined();
    expect(result.dependencies).toBeDefined();
    expect(result.dependents).toBeDefined();
    expect(result.layer).toBeDefined();
    expect(result.siblings).toBeDefined();
    expect(result.progress).toBeDefined();
  });

  it('throws for non-existent component', async () => {
    const repos = createMockRepos({ nodes: [] });
    const uc = new GetComponentContext(repos);

    await expect(uc.execute('missing')).rejects.toThrow(/not found/i);
  });
});

// ─── GetImplementationOrder ─────────────────────────────────────────

describe('GetImplementationOrder', () => {
  it('returns valid topological order for DAG', async () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const edges = [makeEdge(1, 'a', 'b'), makeEdge(2, 'b', 'c')];
    const repos = createMockRepos({ nodes, edges });
    const uc = new GetImplementationOrder(repos);
    const result = await uc.execute();

    expect(result.order).toBeDefined();
    expect(result.cycle).toBeUndefined();
    // c should come before b, b before a
    const order = result.order as string[];
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('a'));
  });

  it('detects cycles', async () => {
    const nodes = [makeNode('x'), makeNode('y'), makeNode('z')];
    const edges = [makeEdge(1, 'x', 'y'), makeEdge(2, 'y', 'z'), makeEdge(3, 'z', 'x')];
    const repos = createMockRepos({ nodes, edges });
    const uc = new GetImplementationOrder(repos);
    const result = await uc.execute();

    expect(result.cycle).toBeDefined();
    expect(result.cycle!.length).toBeGreaterThanOrEqual(2);
    expect(result.order).toBeUndefined();
  });

  it('excludes layer nodes from order', async () => {
    const nodes = [makeNode('test-layer', 'layer'), makeNode('comp-1')];
    const repos = createMockRepos({ nodes, edges: [] });
    const uc = new GetImplementationOrder(repos);
    const result = await uc.execute();

    const order = result.order as string[];
    expect(order).not.toContain('test-layer');
    expect(order).toContain('comp-1');
  });

  it('ignores DEPENDS_ON edges referencing non-component nodes', async () => {
    const nodes = [makeNode('test-layer', 'layer'), makeNode('a')];
    // Edge from 'a' to 'test-layer' — layer is not in component set
    const edges = [makeEdge(1, 'a', 'test-layer')];
    const repos = createMockRepos({ nodes, edges });
    const uc = new GetImplementationOrder(repos);
    const result = await uc.execute();

    expect(result.order).toBeDefined();
    expect(result.order).toContain('a');
  });
});

// ─── GetComponentsByStatus ──────────────────────────────────────────

describe('GetComponentsByStatus', () => {
  it('classifies components by step coverage', async () => {
    const nodes = [
      makeNode('test-layer', 'layer'),
      makeNode('done'),
      makeNode('partial'),
      makeNode('empty'),
    ];
    const features = [
      new Feature({
        node_id: 'done',
        version: 'mvp',
        filename: 'mvp-done.feature',
        title: 'Done',
        content: 'Feature: Done\n  Scenario: S\n    Given a',
        step_count: 5,
      }),
      new Feature({
        node_id: 'partial',
        version: 'mvp',
        filename: 'mvp-partial.feature',
        title: 'Partial',
        content: 'Feature: Partial\n  Scenario: S\n    Given a',
        step_count: 3,
      }),
    ];
    const versions = [
      new Version({ node_id: 'done', version: 'mvp', progress: 100, status: 'complete' }),
      new Version({ node_id: 'partial', version: 'mvp', progress: 50, status: 'in-progress' }),
      new Version({ node_id: 'empty', version: 'mvp', progress: 0, status: 'planned' }),
    ];
    const repos = createMockRepos({ nodes, features, versions });
    const uc = new GetComponentsByStatus(repos);
    const result = await uc.execute('mvp');

    expect(result.complete).toBeDefined();
    expect(result.in_progress).toBeDefined();
    expect(result.planned).toBeDefined();
  });
});

// ─── GetComponentsByStatus (edge cases) ─────────────────────────────

describe('GetComponentsByStatus — edge cases', () => {
  it('treats component with no version record as planned', async () => {
    const nodes = [makeNode('test-layer', 'layer'), makeNode('no-ver')];
    // No versions at all for no-ver => ver?.progress ?? 0 => 0
    const repos = createMockRepos({ nodes, edges: [] });
    const uc = new GetComponentsByStatus(repos);
    const result = await uc.execute('mvp');

    expect(result.planned.some(c => c.id === 'no-ver')).toBe(true);
  });
});

// ─── GetNextImplementable ───────────────────────────────────────────

describe('GetNextImplementable', () => {
  it('returns components where all deps are complete', async () => {
    const nodes = [makeNode('test-layer', 'layer'), makeNode('done-dep'), makeNode('ready')];
    const edges = [makeEdge(1, 'ready', 'done-dep')];
    const features = [
      new Feature({
        node_id: 'done-dep',
        version: 'mvp',
        filename: 'mvp-a.feature',
        title: 'A',
        content: 'Feature: A\n  Scenario: S\n    Given a',
        step_count: 5,
      }),
    ];
    const versions = [
      new Version({ node_id: 'done-dep', version: 'mvp', progress: 100, status: 'complete' }),
      new Version({ node_id: 'ready', version: 'mvp', progress: 30, status: 'in-progress' }),
    ];
    const repos = createMockRepos({ nodes, edges, features, versions });
    const uc = new GetNextImplementable(repos);
    const result = await uc.execute('mvp');

    expect(Array.isArray(result)).toBe(true);
  });

  it('ignores DEPENDS_ON edges referencing non-component nodes', async () => {
    const nodes = [makeNode('test-layer', 'layer'), makeNode('comp'), makeNode('dep')];
    const edges = [
      makeEdge(1, 'comp', 'dep'),
      makeEdge(2, 'comp', 'test-layer'), // target is a layer, not a component
    ];
    const versions = [
      new Version({ node_id: 'dep', version: 'mvp', progress: 100, status: 'complete' }),
      new Version({ node_id: 'comp', version: 'mvp', progress: 30, status: 'in-progress' }),
    ];
    const repos = createMockRepos({ nodes, edges, versions });
    const uc = new GetNextImplementable(repos);
    const result = await uc.execute('mvp');

    // comp's only valid dep (dep) is complete, so comp should be implementable
    expect(result.some(c => c.id === 'comp')).toBe(true);
  });
});

// ─── GetShortestPath ────────────────────────────────────────────────

describe('GetShortestPath', () => {
  it('finds shortest path between connected nodes', async () => {
    const nodes = [makeNode('s'), makeNode('m'), makeNode('e')];
    const edges = [makeEdge(1, 's', 'm'), makeEdge(2, 'm', 'e')];
    const repos = createMockRepos({ nodes, edges });
    const uc = new GetShortestPath(repos);
    const result = await uc.execute('s', 'e');

    expect(result.path.length).toBe(3);
    expect(result.path[0].id).toBe('s');
    expect(result.path[2].id).toBe('e');
    expect(result.edges.length).toBe(2);
  });

  it('returns empty path for unconnected nodes', async () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const repos = createMockRepos({ nodes, edges: [] });
    const uc = new GetShortestPath(repos);
    const result = await uc.execute('a', 'b');

    expect(result.path).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it('handles same source and target', async () => {
    const nodes = [makeNode('x')];
    const repos = createMockRepos({ nodes, edges: [] });
    const uc = new GetShortestPath(repos);
    const result = await uc.execute('x', 'x');

    expect(result.path).toHaveLength(1);
    expect(result.path[0].id).toBe('x');
  });

  it('returns empty path when same-node does not exist', async () => {
    const repos = createMockRepos({ nodes: [] });
    const uc = new GetShortestPath(repos);
    const result = await uc.execute('ghost', 'ghost');

    expect(result.path).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it('falls back to unknown type for nodes missing during reconstruct', async () => {
    // a -> b -> c, but only a exists in nodeRepo
    const nodes = [makeNode('a')];
    const edges = [makeEdge(1, 'a', 'b'), makeEdge(2, 'b', 'c')];
    const repos = createMockRepos({ nodes, edges });
    const uc = new GetShortestPath(repos);
    const result = await uc.execute('a', 'c');

    // b and c won't be found, should use fallback { id, name: id, type: 'unknown' }
    expect(result.path.length).toBe(3);
    const bNode = result.path[1];
    expect(bNode.type).toBe('unknown');
  });
});

// ─── GetNeighbourhood ───────────────────────────────────────────────

describe('GetNeighbourhood', () => {
  it('returns nodes and edges within N hops', async () => {
    const nodes = [makeNode('c'), makeNode('n1'), makeNode('n2')];
    const edges = [makeEdge(1, 'c', 'n1'), makeEdge(2, 'n1', 'n2')];
    const repos = createMockRepos({ nodes, edges });
    const uc = new GetNeighbourhood(repos);
    const result = await uc.execute('c', 2);

    expect(result.nodes.length).toBeGreaterThanOrEqual(2);
    expect(result.edges.length).toBeGreaterThanOrEqual(1);
  });

  it('limits to 1 hop', async () => {
    const nodes = [makeNode('c'), makeNode('n1'), makeNode('n2')];
    const edges = [makeEdge(1, 'c', 'n1'), makeEdge(2, 'n1', 'n2')];
    const repos = createMockRepos({ nodes, edges });
    const uc = new GetNeighbourhood(repos);
    const result = await uc.execute('c', 1);

    const ids = result.nodes.map((n: Record<string, unknown>) => n.id);
    expect(ids).toContain('n1');
    expect(ids).not.toContain('n2');
  });

  it('skips nodes that no longer exist during resolution', async () => {
    const nodes = [makeNode('c')]; // 'ghost' not in nodes
    const edges = [makeEdge(1, 'c', 'ghost')];
    const repos = createMockRepos({ nodes, edges });
    const uc = new GetNeighbourhood(repos);
    const result = await uc.execute('c', 1);

    // 'ghost' visited via BFS but won't resolve to a node
    const ids = result.nodes.map((n: Record<string, unknown>) => n.id);
    expect(ids).toContain('c');
    expect(ids).not.toContain('ghost');
  });
});

// ─── GetLayerOverview ───────────────────────────────────────────────

describe('GetLayerOverview', () => {
  it('returns layer summaries with counts and progress', async () => {
    const layer = makeNode('test-layer', 'layer');
    const comp = makeNode('comp-1');
    const nodes = [layer, comp];
    const edges = [makeEdge(1, 'test-layer', 'comp-1', 'CONTAINS')];
    const features = [
      new Feature({
        node_id: 'comp-1',
        version: 'mvp',
        filename: 'mvp-a.feature',
        title: 'A',
        content: 'Feature: A\n  Scenario: S\n    Given a',
        step_count: 3,
      }),
    ];
    const versions = [
      new Version({ node_id: 'comp-1', version: 'mvp', progress: 100, status: 'complete' }),
    ];
    const repos = createMockRepos({ nodes, edges, versions, features });
    const uc = new GetLayerOverview(repos);
    const result = await uc.execute();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const summary = result[0];
    expect(summary.layer_id).toBeDefined();
    expect(typeof summary.total_components).toBe('number');
    expect(typeof summary.completed_mvp).toBe('number');
    expect(typeof summary.completed_v1).toBe('number');
    expect(typeof summary.overall_progress).toBe('number');
  });

  it('returns empty array when no layers exist', async () => {
    const repos = createMockRepos({ nodes: [], edges: [] });
    const uc = new GetLayerOverview(repos);
    const result = await uc.execute();

    expect(result).toHaveLength(0);
  });

  it('counts completed v1 versions', async () => {
    const layer = makeNode('test-layer', 'layer');
    const comp = makeNode('comp-v1');
    const nodes = [layer, comp];
    const versions = [
      new Version({ node_id: 'comp-v1', version: 'v1', progress: 100, status: 'complete' }),
    ];
    const repos = createMockRepos({ nodes, edges: [], versions });
    const uc = new GetLayerOverview(repos);
    const result = await uc.execute();

    const summary = result[0];
    expect(summary.completed_v1).toBe(1);
  });

  it('handles component with no versions (zero progress)', async () => {
    const layer = makeNode('test-layer', 'layer');
    const comp = makeNode('no-versions');
    const repos = createMockRepos({ nodes: [layer, comp], edges: [] });
    const uc = new GetLayerOverview(repos);
    const result = await uc.execute();

    expect(result[0].overall_progress).toBe(0);
  });
});
