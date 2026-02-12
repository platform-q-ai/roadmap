import type { IFeatureRepository, INodeRepository, IVersionRepository } from '../domain/index.js';

interface Deps {
  nodeRepo: INodeRepository;
  versionRepo: IVersionRepository;
  featureRepo: IFeatureRepository;
}

interface ComponentStatus {
  id: string;
  name: string;
  total_steps: number;
  feature_count: number;
}

interface StatusResult {
  complete: ComponentStatus[];
  in_progress: ComponentStatus[];
  planned: ComponentStatus[];
}

/**
 * Classify non-layer components by step coverage for a given version:
 * - complete: has features AND step_count > 0 AND version progress = 100
 * - in_progress: has features AND step_count > 0 AND progress > 0 AND progress < 100
 * - planned: everything else (no features, or 0% progress)
 */
export class GetComponentsByStatus {
  private deps: Deps;

  constructor(deps: Deps) {
    this.deps = deps;
  }

  async execute(version: string): Promise<StatusResult> {
    const allNodes = await this.deps.nodeRepo.findAll();
    const components = allNodes.filter(n => n.type !== 'layer');

    const complete: ComponentStatus[] = [];
    const inProgress: ComponentStatus[] = [];
    const planned: ComponentStatus[] = [];

    for (const comp of components) {
      const summary = await this.deps.featureRepo.getStepCountSummary(comp.id, version);
      const ver = await this.deps.versionRepo.findByNodeAndVersion(comp.id, version);
      const progress = ver?.progress ?? 0;

      const info: ComponentStatus = {
        id: comp.id,
        name: comp.name,
        total_steps: summary.totalSteps,
        feature_count: summary.featureCount,
      };

      if (progress === 100 && summary.totalSteps > 0) {
        complete.push(info);
      } else if (progress > 0 && summary.totalSteps > 0) {
        inProgress.push(info);
      } else {
        planned.push(info);
      }
    }

    return { complete, in_progress: inProgress, planned };
  }
}
