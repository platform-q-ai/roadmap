import { describe, expect, it } from 'vitest';

import { Edge } from '../../../src/domain/entities/edge.js';
import { Feature } from '../../../src/domain/entities/feature.js';
import { Node } from '../../../src/domain/entities/node.js';
import { Version } from '../../../src/domain/entities/version.js';
import type { IEdgeRepository } from '../../../src/domain/repositories/edge-repository.js';
import type { IFeatureRepository } from '../../../src/domain/repositories/feature-repository.js';
import type { INodeRepository } from '../../../src/domain/repositories/node-repository.js';
import type { IVersionRepository } from '../../../src/domain/repositories/version-repository.js';
import { GetArchitecture } from '../../../src/use-cases/get-architecture.js';

function buildRepos(
  nodes: Node[],
  edges: Edge[] = [],
  versions: Version[] = [],
  features: Feature[] = []
) {
  const nodeRepo: INodeRepository = {
    findAll: async () => nodes,
    findById: async (id: string) => nodes.find(n => n.id === id) ?? null,
    findByType: async (type: string) => nodes.filter(n => n.type === type),
    findByLayer: async (layerId: string) => nodes.filter(n => n.layer === layerId),
    exists: async (id: string) => nodes.some(n => n.id === id),
    save: async () => {},
    delete: async () => {},
  };
  const edgeRepo: IEdgeRepository = {
    findAll: async () => edges,
    findBySource: async (sid: string) => edges.filter(e => e.source_id === sid),
    findByTarget: async (tid: string) => edges.filter(e => e.target_id === tid),
    findByType: async (type: string) => edges.filter(e => e.type === type),
    findRelationships: async () => edges.filter(e => !e.isContainment()),
    save: async () => {},
    delete: async () => {},
  };
  const versionRepo: IVersionRepository = {
    findAll: async () => versions,
    findByNode: async (nid: string) => versions.filter(v => v.node_id === nid),
    findByNodeAndVersion: async (nid: string, ver: string) =>
      versions.find(v => v.node_id === nid && v.version === ver) ?? null,
    save: async () => {},
    updateProgress: async () => {},
    deleteByNode: async () => {},
  };
  const featureRepo: IFeatureRepository = {
    findAll: async () => features,
    findByNode: async (nid: string) => features.filter(f => f.node_id === nid),
    findByNodeAndVersion: async (nid: string, ver: string) =>
      features.filter(f => f.node_id === nid && f.version === ver),
    save: async () => {},
    deleteAll: async () => {},
    deleteByNode: async () => {},
  };
  return { nodeRepo, edgeRepo, versionRepo, featureRepo };
}

describe('GetArchitecture — progression tree', () => {
  it('should include progression_tree in result', async () => {
    const nodes = [new Node({ id: 'app1', name: 'App 1', type: 'app', current_version: '0.1.0' })];
    const repos = buildRepos(nodes);
    const useCase = new GetArchitecture(repos);
    const result = await useCase.execute();

    expect(result.progression_tree).toBeDefined();
  });

  it('should include only app-type nodes in progression_tree', async () => {
    const nodes = [
      new Node({ id: 'app1', name: 'App 1', type: 'app' }),
      new Node({ id: 'comp1', name: 'Comp 1', type: 'component' }),
      new Node({ id: 'layer1', name: 'Layer 1', type: 'layer' }),
    ];
    const repos = buildRepos(nodes);
    const useCase = new GetArchitecture(repos);
    const result = await useCase.execute();

    expect(result.progression_tree.nodes).toHaveLength(1);
    expect(result.progression_tree.nodes[0].id).toBe('app1');
  });

  it('should include only DEPENDS_ON edges between apps in progression_tree', async () => {
    const nodes = [
      new Node({ id: 'app1', name: 'App 1', type: 'app' }),
      new Node({ id: 'app2', name: 'App 2', type: 'app' }),
      new Node({ id: 'comp1', name: 'Comp 1', type: 'component' }),
    ];
    const edges = [
      new Edge({ source_id: 'app1', target_id: 'app2', type: 'DEPENDS_ON' }),
      new Edge({ source_id: 'app1', target_id: 'comp1', type: 'CONTROLS' }),
    ];
    const repos = buildRepos(nodes, edges);
    const useCase = new GetArchitecture(repos);
    const result = await useCase.execute();

    expect(result.progression_tree.edges).toHaveLength(1);
    expect(result.progression_tree.edges[0].source_id).toBe('app1');
    expect(result.progression_tree.edges[0].target_id).toBe('app2');
  });

  it('should include display_state and current_version on progression nodes', async () => {
    const nodes = [
      new Node({ id: 'app1', name: 'App 1', type: 'app', current_version: '0.3.0' }),
      new Node({ id: 'app2', name: 'App 2', type: 'app' }),
    ];
    const repos = buildRepos(nodes);
    const useCase = new GetArchitecture(repos);
    const result = await useCase.execute();

    const node1 = result.progression_tree.nodes.find((n: { id: string }) => n.id === 'app1');
    const node2 = result.progression_tree.nodes.find((n: { id: string }) => n.id === 'app2');

    expect(node1.display_state).toBe('MVP');
    expect(node1.current_version).toBe('0.3.0');
    expect(node2.display_state).toBe('Concept');
    expect(node2.current_version).toBeNull();
  });
});

describe('GetArchitecture — enriched nodes include version state', () => {
  it('should include current_version on enriched nodes', async () => {
    const nodes = [new Node({ id: 'app1', name: 'App 1', type: 'app', current_version: '1.2.0' })];
    const repos = buildRepos(nodes);
    const useCase = new GetArchitecture(repos);
    const result = await useCase.execute();

    const node = result.nodes.find(n => n.id === 'app1');
    expect(node).toBeDefined();
    expect(node!.current_version).toBe('1.2.0');
  });

  it('should include display_state on enriched nodes', async () => {
    const nodes = [new Node({ id: 'app1', name: 'App 1', type: 'app', current_version: '1.2.0' })];
    const repos = buildRepos(nodes);
    const useCase = new GetArchitecture(repos);
    const result = await useCase.execute();

    const node = result.nodes.find(n => n.id === 'app1');
    expect(node).toBeDefined();
    expect(node!.display_state).toBe('v1');
  });

  it('should handle feature version strings beyond v2', async () => {
    const nodes = [new Node({ id: 'app1', name: 'App 1', type: 'app' })];
    const features = [
      new Feature({
        node_id: 'app1',
        version: 'v3',
        filename: 'v3-thing.feature',
        title: 'V3 Thing',
      }),
    ];
    const repos = buildRepos(nodes, [], [], features);
    const useCase = new GetArchitecture(repos);
    const result = await useCase.execute();

    const node = result.nodes.find(n => n.id === 'app1');
    expect(node).toBeDefined();
    expect(node!.features['v3']).toBeDefined();
    expect(node!.features['v3']).toHaveLength(1);
  });
});
