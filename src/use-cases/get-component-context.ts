import type { Edge, Feature, Node, Version } from '../domain/index.js';
import type {
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
} from '../domain/index.js';

import { NodeNotFoundError } from './errors.js';

interface Deps {
  nodeRepo: INodeRepository;
  edgeRepo: IEdgeRepository;
  versionRepo: IVersionRepository;
  featureRepo: IFeatureRepository;
}

interface NodeRef {
  id: string;
  name?: string;
  type?: string;
}

interface ComponentContext {
  component: Record<string, unknown>;
  versions: Array<Record<string, unknown>>;
  features: Record<string, Array<Record<string, unknown>>>;
  dependencies: NodeRef[];
  dependents: NodeRef[];
  layer: Record<string, unknown> | null;
  siblings: NodeRef[];
  progress: Record<string, unknown>;
}

/**
 * Get full component context for coding:
 * component details, versions with step counts, features grouped by version,
 * dependencies, dependents, layer, siblings, and progress.
 */
export class GetComponentContext {
  private deps: Deps;

  constructor(deps: Deps) {
    this.deps = deps;
  }

  async execute(nodeId: string): Promise<ComponentContext> {
    const [allNodes, versions, features, outEdges, inEdges] = await Promise.all([
      this.deps.nodeRepo.findAll(),
      this.deps.versionRepo.findByNode(nodeId),
      this.deps.featureRepo.findByNode(nodeId),
      this.deps.edgeRepo.findBySource(nodeId),
      this.deps.edgeRepo.findByTarget(nodeId),
    ]);

    const nodeMap = new Map(allNodes.map(n => [n.id, n]));
    const node = nodeMap.get(nodeId);
    if (!node) {
      throw new NodeNotFoundError(nodeId);
    }

    const stepSummaries = this.buildStepSummaries(features, versions);

    return {
      component: this.toComponentInfo(node),
      versions: this.enrichVersions(versions, stepSummaries),
      features: this.groupFeatures(features),
      dependencies: this.resolveEdgeTargets(outEdges, nodeMap),
      dependents: this.resolveEdgeSources(inEdges, nodeMap),
      layer: this.resolveLayer(node, nodeMap),
      siblings: this.resolveSiblings(node, allNodes),
      progress: this.buildProgress(versions, stepSummaries),
    };
  }

  private buildStepSummaries(
    features: Feature[],
    versions: Version[]
  ): Map<string, { totalSteps: number; featureCount: number }> {
    const map = new Map<string, { totalSteps: number; featureCount: number }>();
    for (const v of versions) {
      map.set(v.version, { totalSteps: 0, featureCount: 0 });
    }
    for (const f of features) {
      const entry = map.get(f.version) ?? { totalSteps: 0, featureCount: 0 };
      entry.totalSteps += f.step_count;
      entry.featureCount += 1;
      map.set(f.version, entry);
    }
    return map;
  }

  private resolveEdgeTargets(edges: Edge[], nodeMap: Map<string, Node>): NodeRef[] {
    return edges
      .filter(e => e.type === 'DEPENDS_ON')
      .map(e => {
        const n = nodeMap.get(e.target_id);
        return n ? { id: n.id, name: n.name, type: n.type } : { id: e.target_id };
      });
  }

  private resolveEdgeSources(edges: Edge[], nodeMap: Map<string, Node>): NodeRef[] {
    return edges
      .filter(e => e.type === 'DEPENDS_ON')
      .map(e => {
        const n = nodeMap.get(e.source_id);
        return n ? { id: n.id, name: n.name, type: n.type } : { id: e.source_id };
      });
  }

  private resolveLayer(node: Node, nodeMap: Map<string, Node>): Record<string, unknown> | null {
    if (!node.layer) {
      return null;
    }
    const layerNode = nodeMap.get(node.layer);
    return layerNode ? { id: layerNode.id, name: layerNode.name, type: layerNode.type } : null;
  }

  private resolveSiblings(node: Node, allNodes: Node[]): NodeRef[] {
    if (!node.layer) {
      return [];
    }
    return allNodes
      .filter(n => n.layer === node.layer && n.id !== node.id)
      .map(n => ({ id: n.id, name: n.name, type: n.type }));
  }

  private toComponentInfo(node: Node): Record<string, unknown> {
    return {
      id: node.id,
      name: node.name,
      type: node.type,
      layer: node.layer,
      description: node.description,
      tags: node.tags,
    };
  }

  private groupFeatures(features: Feature[]): Record<string, Array<Record<string, unknown>>> {
    const grouped: Record<string, Array<Record<string, unknown>>> = {};
    for (const f of features) {
      if (!grouped[f.version]) {
        grouped[f.version] = [];
      }
      grouped[f.version].push({ filename: f.filename, title: f.title, step_count: f.step_count });
    }
    return grouped;
  }

  private enrichVersions(
    versions: Version[],
    summaries: Map<string, { totalSteps: number; featureCount: number }>
  ): Array<Record<string, unknown>> {
    return versions.map(v => {
      const summary = summaries.get(v.version) ?? { totalSteps: 0, featureCount: 0 };
      return {
        version: v.version,
        progress: v.progress,
        status: v.status,
        total_steps: summary.totalSteps,
        feature_count: summary.featureCount,
      };
    });
  }

  private buildProgress(
    versions: Version[],
    summaries: Map<string, { totalSteps: number; featureCount: number }>
  ): Record<string, unknown> {
    const progress: Record<string, unknown> = {};
    for (const v of versions) {
      const summary = summaries.get(v.version) ?? { totalSteps: 0, featureCount: 0 };
      progress[v.version] = {
        total_steps: summary.totalSteps,
        feature_count: summary.featureCount,
        status: v.status,
        progress: v.progress,
      };
    }
    return progress;
  }
}
