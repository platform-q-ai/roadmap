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
  current_version: string | null;
  display_state: string;
  versions: Record<string, VersionSummary>;
  features: Record<string, FeatureSummary[]>;
}

interface ProgressionEdge {
  source_id: string;
  target_id: string;
  type: string;
  label: string | null;
}

export interface ProgressionTree {
  nodes: EnrichedNode[];
  edges: ProgressionEdge[];
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
  progression_tree: ProgressionTree;
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

  private buildVersionIndex(
    versions: Array<{
      node_id: string;
      version: string;
      content: string | null;
      progress: number;
      status: string;
      updated_at: string | null;
    }>
  ): Record<string, Record<string, VersionSummary>> {
    const index: Record<string, Record<string, VersionSummary>> = {};
    for (const v of versions) {
      if (!index[v.node_id]) {
        index[v.node_id] = {};
      }
      index[v.node_id][v.version] = {
        content: v.content,
        progress: v.progress,
        status: v.status,
        updated_at: v.updated_at,
      };
    }
    return index;
  }

  private buildFeatureIndex(
    features: Array<{
      node_id: string;
      version: string;
      filename: string;
      title: string;
      content: string | null;
    }>
  ): Record<string, FeatureSummary[]> {
    const index: Record<string, FeatureSummary[]> = {};
    for (const f of features) {
      const key = `${f.node_id}:${f.version}`;
      if (!index[key]) {
        index[key] = [];
      }
      index[key].push({ filename: f.filename, title: f.title, content: f.content });
    }
    return index;
  }

  async execute(): Promise<ArchitectureData> {
    const [nodes, edges, versions, features] = await Promise.all([
      this.nodeRepo.findAll(),
      this.edgeRepo.findAll(),
      this.versionRepo.findAll(),
      this.featureRepo.findAll(),
    ]);

    const versionsByNode = this.buildVersionIndex(versions);
    const featuresByNodeVersion = this.buildFeatureIndex(features);

    const enrichedNodes: EnrichedNode[] = nodes.map(n => {
      const nodeFeatures: Record<string, FeatureSummary[]> = {};
      const nodeVersionKeys = Object.keys(versionsByNode[n.id] || {});
      const allVersionKeys = new Set([...nodeVersionKeys, 'mvp', 'v1', 'v2']);

      for (const fKey of Object.keys(featuresByNodeVersion)) {
        if (fKey.startsWith(`${n.id}:`)) {
          allVersionKeys.add(fKey.split(':')[1]);
        }
      }

      for (const v of allVersionKeys) {
        const key = `${n.id}:${v}`;
        if (featuresByNodeVersion[key]) {
          nodeFeatures[v] = featuresByNodeVersion[key];
        }
      }

      return {
        ...n.toJSON(),
        display_state: n.displayState(),
        versions: versionsByNode[n.id] || {},
        features: nodeFeatures,
      };
    });

    const layers = nodes.filter(n => n.isLayer());
    const layerGroups = layers.map(layer => ({
      ...layer.toJSON(),
      display_state: layer.displayState(),
      children: enrichedNodes.filter(n => n.layer === layer.id && n.type !== 'layer'),
      versions: versionsByNode[layer.id] || {},
      features: {} as Record<string, FeatureSummary[]>,
    }));

    const relationships = edges.filter(e => !e.isContainment()).map(e => e.toJSON());

    const appNodeIds = new Set(nodes.filter(n => n.isApp()).map(n => n.id));
    const progressionNodes = enrichedNodes.filter(n => appNodeIds.has(n.id));
    const progressionEdges: ProgressionEdge[] = edges
      .filter(
        e => e.type === 'DEPENDS_ON' && appNodeIds.has(e.source_id) && appNodeIds.has(e.target_id)
      )
      .map(e => ({
        source_id: e.source_id,
        target_id: e.target_id,
        type: e.type,
        label: e.label,
      }));

    return {
      generated_at: new Date().toISOString(),
      layers: layerGroups,
      nodes: enrichedNodes,
      edges: relationships,
      progression_tree: {
        nodes: progressionNodes,
        edges: progressionEdges,
      },
      stats: {
        total_nodes: nodes.length,
        total_edges: edges.length,
        total_versions: versions.length,
        total_features: features.length,
      },
    };
  }
}
