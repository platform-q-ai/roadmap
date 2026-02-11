import type {
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
} from '../domain/index.js';

interface VersionSummary {
  content: string | null;
  progress: number;
  status: string;
  updated_at: string | null;
}

interface FeatureSummary {
  filename: string;
  title: string;
  content: string | null;
}

export interface EnrichedNode {
  id: string;
  name: string;
  type: string;
  layer: string | null;
  color: string | null;
  icon: string | null;
  description: string | null;
  tags: string[];
  sort_order: number;
  versions: Record<string, VersionSummary>;
  features: Record<string, FeatureSummary[]>;
}

export interface ArchitectureData {
  generated_at: string;
  layers: Array<EnrichedNode & { children: EnrichedNode[] }>;
  nodes: EnrichedNode[];
  edges: Array<{
    id: number | null;
    source_id: string;
    target_id: string;
    type: string;
    label: string | null;
    metadata: string | null;
  }>;
  stats: {
    total_nodes: number;
    total_edges: number;
    total_versions: number;
    total_features: number;
  };
}

interface Deps {
  nodeRepo: INodeRepository;
  edgeRepo: IEdgeRepository;
  versionRepo: IVersionRepository;
  featureRepo: IFeatureRepository;
}

/**
 * GetArchitecture use case.
 *
 * Assembles the full architecture graph: layers with their children,
 * enriched with versions and features.
 */
export class GetArchitecture {
  private readonly nodeRepo: INodeRepository;
  private readonly edgeRepo: IEdgeRepository;
  private readonly versionRepo: IVersionRepository;
  private readonly featureRepo: IFeatureRepository;

  constructor({ nodeRepo, edgeRepo, versionRepo, featureRepo }: Deps) {
    this.nodeRepo = nodeRepo;
    this.edgeRepo = edgeRepo;
    this.versionRepo = versionRepo;
    this.featureRepo = featureRepo;
  }

  async execute(): Promise<ArchitectureData> {
    const [nodes, edges, versions, features] = await Promise.all([
      this.nodeRepo.findAll(),
      this.edgeRepo.findAll(),
      this.versionRepo.findAll(),
      this.featureRepo.findAll(),
    ]);

    const versionsByNode: Record<string, Record<string, VersionSummary>> = {};
    for (const v of versions) {
      if (!versionsByNode[v.node_id]) {
        versionsByNode[v.node_id] = {};
      }
      versionsByNode[v.node_id][v.version] = {
        content: v.content,
        progress: v.progress,
        status: v.status,
        updated_at: v.updated_at,
      };
    }

    const featuresByNodeVersion: Record<string, FeatureSummary[]> = {};
    for (const f of features) {
      const key = `${f.node_id}:${f.version}`;
      if (!featuresByNodeVersion[key]) {
        featuresByNodeVersion[key] = [];
      }
      featuresByNodeVersion[key].push({
        filename: f.filename,
        title: f.title,
        content: f.content,
      });
    }

    const enrichedNodes: EnrichedNode[] = nodes.map(n => {
      const nodeFeatures: Record<string, FeatureSummary[]> = {};
      for (const v of ['mvp', 'v1', 'v2']) {
        const key = `${n.id}:${v}`;
        if (featuresByNodeVersion[key]) {
          nodeFeatures[v] = featuresByNodeVersion[key];
        }
      }

      return {
        ...n.toJSON(),
        versions: versionsByNode[n.id] || {},
        features: nodeFeatures,
      };
    });

    const layers = nodes.filter(n => n.isLayer());
    const layerGroups = layers.map(layer => ({
      ...layer.toJSON(),
      children: enrichedNodes.filter(n => n.layer === layer.id && n.type !== 'layer'),
      versions: versionsByNode[layer.id] || {},
      features: {} as Record<string, FeatureSummary[]>,
    }));

    const relationships = edges.filter(e => !e.isContainment()).map(e => e.toJSON());

    return {
      generated_at: new Date().toISOString(),
      layers: layerGroups,
      nodes: enrichedNodes,
      edges: relationships,
      stats: {
        total_nodes: nodes.length,
        total_edges: edges.length,
        total_versions: versions.length,
        total_features: features.length,
      },
    };
  }
}
