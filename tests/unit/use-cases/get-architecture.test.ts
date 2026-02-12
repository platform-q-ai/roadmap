import { Edge } from '@domain/entities/edge.js';
import { Feature } from '@domain/entities/feature.js';
import { Node } from '@domain/entities/node.js';
import { Version } from '@domain/entities/version.js';
import type { IEdgeRepository } from '@domain/repositories/edge-repository.js';
import type { IFeatureRepository } from '@domain/repositories/feature-repository.js';
import type { INodeRepository } from '@domain/repositories/node-repository.js';
import type { IVersionRepository } from '@domain/repositories/version-repository.js';
import { GetArchitecture } from '@use-cases/get-architecture.js';
import { describe, expect, it, vi } from 'vitest';

function createMockRepos(
  overrides: {
    nodes?: Node[];
    edges?: Edge[];
    versions?: Version[];
    features?: Feature[];
  } = {}
) {
  const nodes = overrides.nodes ?? [];
  const edges = overrides.edges ?? [];
  const versions = overrides.versions ?? [];
  const features = overrides.features ?? [];

  const nodeRepo: INodeRepository = {
    findAll: vi.fn().mockResolvedValue(nodes),
    findById: vi.fn(),
    findByType: vi.fn(),
    findByLayer: vi.fn(),
    exists: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
  const edgeRepo: IEdgeRepository = {
    findAll: vi.fn().mockResolvedValue(edges),
    findById: vi.fn(),
    findBySource: vi.fn(),
    findByTarget: vi.fn(),
    findByType: vi.fn(),
    findRelationships: vi.fn(),
    existsBySrcTgtType: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
  const versionRepo: IVersionRepository = {
    findAll: vi.fn().mockResolvedValue(versions),
    findByNode: vi.fn(),
    findByNodeAndVersion: vi.fn(),
    save: vi.fn(),
    deleteByNode: vi.fn(),
  };
  const featureRepo: IFeatureRepository = {
    findAll: vi.fn().mockResolvedValue(features),
    findByNode: vi.fn(),
    findByNodeAndVersion: vi.fn(),
    getStepCountSummary: vi.fn().mockResolvedValue({ totalSteps: 0, featureCount: 0 }),
    save: vi.fn(),
    saveMany: vi.fn(),
    deleteAll: vi.fn(),
    deleteByNode: vi.fn(),
    deleteByNodeAndFilename: vi.fn(),
  };

  return { nodeRepo, edgeRepo, versionRepo, featureRepo };
}

describe('GetArchitecture', () => {
  it('returns all nodes in the result', async () => {
    const nodes = [
      new Node({ id: 'layer-1', name: 'Layer', type: 'layer' }),
      new Node({ id: 'comp-1', name: 'Comp', type: 'component', layer: 'layer-1' }),
    ];
    const repos = createMockRepos({ nodes });
    const uc = new GetArchitecture(repos);
    const result = await uc.execute();

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes.map(n => n.id)).toContain('layer-1');
    expect(result.nodes.map(n => n.id)).toContain('comp-1');
  });

  it('groups components under their parent layer', async () => {
    const nodes = [
      new Node({ id: 'L', name: 'Layer', type: 'layer' }),
      new Node({ id: 'C1', name: 'Comp1', type: 'component', layer: 'L' }),
      new Node({ id: 'C2', name: 'Comp2', type: 'component', layer: 'L' }),
    ];
    const repos = createMockRepos({ nodes });
    const result = await new GetArchitecture(repos).execute();

    expect(result.layers).toHaveLength(1);
    expect(result.layers[0].id).toBe('L');
    expect(result.layers[0].children).toHaveLength(2);
    expect(result.layers[0].children.map(c => c.id)).toEqual(['C1', 'C2']);
  });

  it('enriches nodes with their version content', async () => {
    const nodes = [new Node({ id: 'comp', name: 'C', type: 'component' })];
    const versions = [
      new Version({ node_id: 'comp', version: 'overview', content: 'Overview' }),
      new Version({
        node_id: 'comp',
        version: 'mvp',
        content: 'MVP spec',
        progress: 30,
        status: 'in-progress',
      }),
    ];
    const repos = createMockRepos({ nodes, versions });
    const result = await new GetArchitecture(repos).execute();

    const enriched = result.nodes.find(n => n.id === 'comp');
    expect(enriched?.versions['overview']).toBeDefined();
    expect(enriched?.versions['overview'].content).toBe('Overview');
    expect(enriched?.versions['mvp'].progress).toBe(30);
    expect(enriched?.versions['mvp'].status).toBe('in-progress');
  });

  it('enriches nodes with their feature specs', async () => {
    const nodes = [new Node({ id: 'w', name: 'Worker', type: 'component' })];
    const features = [
      new Feature({
        node_id: 'w',
        version: 'mvp',
        filename: 'mvp-exec.feature',
        title: 'Execution',
      }),
    ];
    const repos = createMockRepos({ nodes, features });
    const result = await new GetArchitecture(repos).execute();

    const enriched = result.nodes.find(n => n.id === 'w');
    expect(enriched?.features['mvp']).toHaveLength(1);
    expect(enriched?.features['mvp'][0].title).toBe('Execution');
  });

  it('excludes CONTAINS edges from relationship output', async () => {
    const nodes = [
      new Node({ id: 'L', name: 'L', type: 'layer' }),
      new Node({ id: 'C', name: 'C', type: 'component' }),
      new Node({ id: 'D', name: 'D', type: 'component' }),
    ];
    const edges = [
      new Edge({ id: 1, source_id: 'L', target_id: 'C', type: 'CONTAINS' }),
      new Edge({ id: 2, source_id: 'C', target_id: 'D', type: 'DEPENDS_ON' }),
    ];
    const repos = createMockRepos({ nodes, edges });
    const result = await new GetArchitecture(repos).execute();

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].type).toBe('DEPENDS_ON');
  });

  it('reports accurate statistics', async () => {
    const nodes = [
      new Node({ id: 'n1', name: 'N1', type: 'layer' }),
      new Node({ id: 'n2', name: 'N2', type: 'component' }),
    ];
    const edges = [new Edge({ source_id: 'n1', target_id: 'n2', type: 'CONTAINS' })];
    const versions = [new Version({ node_id: 'n2', version: 'mvp' })];
    const features = [
      new Feature({ node_id: 'n2', version: 'mvp', filename: 'mvp-t.feature', title: 'T' }),
    ];
    const repos = createMockRepos({ nodes, edges, versions, features });
    const result = await new GetArchitecture(repos).execute();

    expect(result.stats).toEqual({
      total_nodes: 2,
      total_edges: 1,
      total_versions: 1,
      total_features: 1,
    });
  });

  it('includes a generated_at ISO timestamp', async () => {
    const repos = createMockRepos();
    const result = await new GetArchitecture(repos).execute();

    expect(result.generated_at).toBeDefined();
    expect(new Date(result.generated_at).toISOString()).toBe(result.generated_at);
  });

  it('groups multiple features under the same node+version key', async () => {
    const nodes = [new Node({ id: 'w', name: 'Worker', type: 'component' })];
    const features = [
      new Feature({
        node_id: 'w',
        version: 'mvp',
        filename: 'mvp-a.feature',
        title: 'Feature A',
      }),
      new Feature({
        node_id: 'w',
        version: 'mvp',
        filename: 'mvp-b.feature',
        title: 'Feature B',
      }),
    ];
    const repos = createMockRepos({ nodes, features });
    const result = await new GetArchitecture(repos).execute();

    const enriched = result.nodes.find(n => n.id === 'w');
    expect(enriched?.features['mvp']).toHaveLength(2);
    expect(enriched?.features['mvp'].map(f => f.title)).toEqual(['Feature A', 'Feature B']);
  });

  it('handles empty database gracefully', async () => {
    const repos = createMockRepos();
    const result = await new GetArchitecture(repos).execute();

    expect(result.nodes).toEqual([]);
    expect(result.layers).toEqual([]);
    expect(result.edges).toEqual([]);
    expect(result.stats.total_nodes).toBe(0);
  });
});
