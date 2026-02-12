import type { Version } from '../domain/index.js';
import type { INodeRepository, IVersionRepository } from '../domain/index.js';

interface Deps {
  nodeRepo: INodeRepository;
  versionRepo: IVersionRepository;
}

interface LayerSummary {
  layer_id: string;
  layer_name: string;
  total_components: number;
  completed_mvp: number;
  completed_v1: number;
  overall_progress: number;
}

/**
 * Get a summary overview of each layer for planning:
 * component count, completion counts per version, overall progress.
 */
export class GetLayerOverview {
  private deps: Deps;

  constructor(deps: Deps) {
    this.deps = deps;
  }

  async execute(): Promise<LayerSummary[]> {
    const [allNodes, allVersions] = await Promise.all([
      this.deps.nodeRepo.findAll(),
      this.deps.versionRepo.findAll(),
    ]);

    const layers = allNodes.filter(n => n.type === 'layer');
    const childrenByLayer = new Map<string, string[]>();
    for (const node of allNodes) {
      if (node.type !== 'layer' && node.layer) {
        const list = childrenByLayer.get(node.layer) ?? [];
        list.push(node.id);
        childrenByLayer.set(node.layer, list);
      }
    }

    const versionsByNode = new Map<string, Version[]>();
    for (const v of allVersions) {
      const list = versionsByNode.get(v.node_id) ?? [];
      list.push(v);
      versionsByNode.set(v.node_id, list);
    }

    return layers.map(layer => this.summariseLayer(layer, childrenByLayer, versionsByNode));
  }

  private summariseLayer(
    layer: { id: string; name: string },
    childrenByLayer: Map<string, string[]>,
    versionsByNode: Map<string, Version[]>
  ): LayerSummary {
    const children = childrenByLayer.get(layer.id) ?? [];
    let completedMvp = 0;
    let completedV1 = 0;
    let totalProgress = 0;
    let progressCount = 0;

    for (const childId of children) {
      const versions = versionsByNode.get(childId) ?? [];
      completedMvp += this.countCompleted(versions, 'mvp');
      completedV1 += this.countCompleted(versions, 'v1');

      const avg = this.averageProgress(versions);
      if (avg >= 0) {
        totalProgress += avg;
        progressCount++;
      }
    }

    return {
      layer_id: layer.id,
      layer_name: layer.name,
      total_components: children.length,
      completed_mvp: completedMvp,
      completed_v1: completedV1,
      overall_progress: progressCount > 0 ? Math.round(totalProgress / progressCount) : 0,
    };
  }

  private countCompleted(versions: Version[], tag: string): number {
    return versions.some(v => v.version === tag && v.progress === 100) ? 1 : 0;
  }

  private averageProgress(versions: Version[]): number {
    const progresses = versions.filter(v => v.version !== 'overview').map(v => v.progress);
    if (progresses.length === 0) {
      return -1;
    }
    return progresses.reduce((a, b) => a + b, 0) / progresses.length;
  }
}
