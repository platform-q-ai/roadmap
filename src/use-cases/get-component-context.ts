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
    const node = await this.deps.nodeRepo.findById(nodeId);
    if (!node) {
      throw new NodeNotFoundError(nodeId);
    }

    const [versions, features, outEdges, inEdges] = await Promise.all([
      this.deps.versionRepo.findByNode(nodeId),
      this.deps.featureRepo.findByNode(nodeId),
      this.deps.edgeRepo.findBySource(nodeId),
      this.deps.edgeRepo.findByTarget(nodeId),
    ]);

    const [dependencies, dependents] = await Promise.all([
      this.resolveEdgeTargets(outEdges),
      this.resolveEdgeSources(inEdges),
    ]);

    const [layerInfo, siblings] = await this.resolveLayerAndSiblings(node);

    return {
      component: this.toComponentInfo(node),
      versions: await this.enrichVersions(nodeId, versions),
      features: this.groupFeatures(features),
      dependencies,
      dependents,
      layer: layerInfo,
      siblings,
      progress: await this.buildProgress(nodeId, versions),
    };
  }

  private async resolveEdgeTargets(edges: Edge[]): Promise<NodeRef[]> {
    const depEdges = edges.filter(e => e.type === 'DEPENDS_ON');
    return Promise.all(
      depEdges.map(async e => {
        const n = await this.deps.nodeRepo.findById(e.target_id);
        return n ? { id: n.id, name: n.name, type: n.type } : { id: e.target_id };
      })
    );
  }

  private async resolveEdgeSources(edges: Edge[]): Promise<NodeRef[]> {
    const depEdges = edges.filter(e => e.type === 'DEPENDS_ON');
    return Promise.all(
      depEdges.map(async e => {
        const n = await this.deps.nodeRepo.findById(e.source_id);
        return n ? { id: n.id, name: n.name, type: n.type } : { id: e.source_id };
      })
    );
  }

  private async resolveLayerAndSiblings(
    node: Node
  ): Promise<[Record<string, unknown> | null, NodeRef[]]> {
    if (!node.layer) {
      return [null, []];
    }
    const layerNode = await this.deps.nodeRepo.findById(node.layer);
    const layerInfo = layerNode
      ? { id: layerNode.id, name: layerNode.name, type: layerNode.type }
      : null;
    const children = await this.deps.nodeRepo.findByLayer(node.layer);
    const siblings = children
      .filter(n => n.id !== node.id)
      .map(n => ({ id: n.id, name: n.name, type: n.type }));
    return [layerInfo, siblings];
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

  private async enrichVersions(
    nodeId: string,
    versions: Version[]
  ): Promise<Array<Record<string, unknown>>> {
    return Promise.all(
      versions.map(async v => {
        const summary = await this.deps.featureRepo.getStepCountSummary(nodeId, v.version);
        return {
          version: v.version,
          progress: v.progress,
          status: v.status,
          total_steps: summary.totalSteps,
          feature_count: summary.featureCount,
        };
      })
    );
  }

  private async buildProgress(
    nodeId: string,
    versions: Version[]
  ): Promise<Record<string, unknown>> {
    const progress: Record<string, unknown> = {};
    for (const v of versions) {
      const summary = await this.deps.featureRepo.getStepCountSummary(nodeId, v.version);
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
