import type {
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
} from '../domain/index.js';

interface Deps {
  nodeRepo: INodeRepository;
  edgeRepo: IEdgeRepository;
  versionRepo: IVersionRepository;
  featureRepo: IFeatureRepository;
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
    const allNodes = await this.deps.nodeRepo.findAll();
    const layers = allNodes.filter(n => n.type === 'layer');

    const results: LayerSummary[] = [];
    for (const layer of layers) {
      const children = await this.deps.nodeRepo.findByLayer(layer.id);
      const total = children.length;

      let completedMvp = 0;
      let completedV1 = 0;
      let totalProgress = 0;
      let progressCount = 0;

      for (const child of children) {
        const versions = await this.deps.versionRepo.findByNode(child.id);

        for (const ver of versions) {
          if (ver.version === 'mvp' && ver.progress === 100) {
            completedMvp++;
          }
          if (ver.version === 'v1' && ver.progress === 100) {
            completedV1++;
          }
        }

        // Overall progress: average of all version progresses
        const versionProgresses = versions
          .filter(v => v.version !== 'overview')
          .map(v => v.progress);
        if (versionProgresses.length > 0) {
          totalProgress += versionProgresses.reduce((a, b) => a + b, 0) / versionProgresses.length;
          progressCount++;
        }
      }

      results.push({
        layer_id: layer.id,
        layer_name: layer.name,
        total_components: total,
        completed_mvp: completedMvp,
        completed_v1: completedV1,
        overall_progress: progressCount > 0 ? Math.round(totalProgress / progressCount) : 0,
      });
    }

    return results;
  }
}
