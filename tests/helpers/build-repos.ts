/**
 * Shared in-memory repository builder for step definitions and tests.
 *
 * Builds mock repositories backed by arrays, suitable for Cucumber worlds
 * that hold nodes[], edges[], versions[], features[].
 */
import type {
  Edge,
  Feature,
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
  Node,
  Version,
} from '../../src/domain/index.js';

export interface InMemoryWorld {
  nodes: Node[];
  edges: Edge[];
  versions: Version[];
  features: Feature[];
  [key: string]: unknown;
}

interface RepoOverrides {
  featureSave?: (feature: Feature) => Promise<void>;
  featureDeleteAll?: () => Promise<void>;
}

export function buildRepos(world: InMemoryWorld, overrides?: RepoOverrides) {
  const nodeRepo: INodeRepository = {
    findAll: async () => world.nodes,
    findById: async (id: string) => world.nodes.find(n => n.id === id) ?? null,
    findByType: async (type: string) => world.nodes.filter(n => n.type === type),
    findByLayer: async (layerId: string) => world.nodes.filter(n => n.layer === layerId),
    exists: async (id: string) => world.nodes.some(n => n.id === id),
    save: async () => {},
    delete: async () => {},
  };
  const edgeRepo: IEdgeRepository = {
    findAll: async () => world.edges,
    findBySource: async (sid: string) => world.edges.filter(e => e.source_id === sid),
    findByTarget: async (tid: string) => world.edges.filter(e => e.target_id === tid),
    findByType: async (type: string) => world.edges.filter(e => e.type === type),
    findRelationships: async () => world.edges.filter(e => !e.isContainment()),
    save: async () => {},
    delete: async () => {},
  };
  const versionRepo: IVersionRepository = {
    findAll: async () => world.versions,
    findByNode: async (nid: string) => world.versions.filter(v => v.node_id === nid),
    findByNodeAndVersion: async (nid: string, ver: string) =>
      world.versions.find(v => v.node_id === nid && v.version === ver) ?? null,
    save: async () => {},
    deleteByNode: async () => {},
  };
  const featureRepo: IFeatureRepository = {
    findAll: async () => world.features,
    findByNode: async (nid: string) => world.features.filter(f => f.node_id === nid),
    findByNodeAndVersion: async (nid: string, ver: string) =>
      world.features.filter(f => f.node_id === nid && f.version === ver),
    save: overrides?.featureSave ?? (async () => {}),
    deleteAll: overrides?.featureDeleteAll ?? (async () => {}),
    deleteByNode: async () => {},
    deleteByNodeAndFilename: async () => false,
  };
  return { nodeRepo, edgeRepo, versionRepo, featureRepo };
}
