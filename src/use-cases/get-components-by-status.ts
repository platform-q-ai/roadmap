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
    const [allNodes, allVersions, allFeatures] = await Promise.all([
      this.deps.nodeRepo.findAll(),
      this.deps.versionRepo.findAll(),
      this.deps.featureRepo.findAll(),
    ]);
    const components = allNodes.filter(n => n.type !== 'layer');

    const versionMap = new Map<string, number>();
    for (const v of allVersions) {
      if (v.version === version) {
        versionMap.set(v.node_id, v.progress);
      }
    }

    const stepMap = new Map<string, { totalSteps: number; featureCount: number }>();
    for (const f of allFeatures) {
      if (f.version !== version) {
        continue;
      }
      const entry = stepMap.get(f.node_id) ?? { totalSteps: 0, featureCount: 0 };
      entry.totalSteps += f.step_count;
      entry.featureCount += 1;
      stepMap.set(f.node_id, entry);
    }

    return this.classify(components, versionMap, stepMap);
  }

  private classify(
    components: Array<{ id: string; name: string }>,
    versionMap: Map<string, number>,
    stepMap: Map<string, { totalSteps: number; featureCount: number }>
  ): StatusResult {
    const complete: ComponentStatus[] = [];
    const inProgress: ComponentStatus[] = [];
    const planned: ComponentStatus[] = [];

    for (const comp of components) {
      const progress = versionMap.get(comp.id) ?? 0;
      const summary = stepMap.get(comp.id) ?? { totalSteps: 0, featureCount: 0 };

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
