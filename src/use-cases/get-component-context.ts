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

interface ComponentContext {
  component: Record<string, unknown>;
  versions: Array<Record<string, unknown>>;
  features: Record<string, Array<Record<string, unknown>>>;
  dependencies: Array<Record<string, unknown>>;
  dependents: Array<Record<string, unknown>>;
  layer: Record<string, unknown> | null;
  siblings: Array<Record<string, unknown>>;
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

    // Dependencies and dependents (DEPENDS_ON edges)
    const depOutEdges = outEdges.filter(e => e.type === 'DEPENDS_ON');
    const depInEdges = inEdges.filter(e => e.type === 'DEPENDS_ON');

    const dependencies = await Promise.all(
      depOutEdges.map(async e => {
        const n = await this.deps.nodeRepo.findById(e.target_id);
        return n ? { id: n.id, name: n.name, type: n.type } : { id: e.target_id };
      })
    );

    const dependents = await Promise.all(
      depInEdges.map(async e => {
        const n = await this.deps.nodeRepo.findById(e.source_id);
        return n ? { id: n.id, name: n.name, type: n.type } : { id: e.source_id };
      })
    );

    // Layer info
    let layerInfo: Record<string, unknown> | null = null;
    if (node.layer) {
      const layerNode = await this.deps.nodeRepo.findById(node.layer);
      if (layerNode) {
        layerInfo = { id: layerNode.id, name: layerNode.name, type: layerNode.type };
      }
    }

    // Siblings (other components in the same layer)
    let siblings: Array<Record<string, unknown>> = [];
    if (node.layer) {
      const layerChildren = await this.deps.nodeRepo.findByLayer(node.layer);
      siblings = layerChildren
        .filter(n => n.id !== nodeId)
        .map(n => ({ id: n.id, name: n.name, type: n.type }));
    }

    // Group features by version
    const featuresByVersion: Record<string, Array<Record<string, unknown>>> = {};
    for (const f of features) {
      if (!featuresByVersion[f.version]) {
        featuresByVersion[f.version] = [];
      }
      featuresByVersion[f.version].push({
        filename: f.filename,
        title: f.title,
        step_count: f.step_count,
      });
    }

    // Per-version step-based progress
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

    // Versions with step counts
    const versionsWithSteps = await Promise.all(
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

    return {
      component: {
        id: node.id,
        name: node.name,
        type: node.type,
        layer: node.layer,
        description: node.description,
        tags: node.tags,
      },
      versions: versionsWithSteps,
      features: featuresByVersion,
      dependencies,
      dependents,
      layer: layerInfo,
      siblings,
      progress,
    };
  }
}
