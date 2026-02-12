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

interface ImplementableComponent {
  id: string;
  name: string;
  total_steps: number;
  progress: number;
}

/**
 * Find components where all DEPENDS_ON targets are at 100% progress
 * for the given version, but the component itself is below 100%.
 */
export class GetNextImplementable {
  private deps: Deps;

  constructor(deps: Deps) {
    this.deps = deps;
  }

  async execute(version: string): Promise<ImplementableComponent[]> {
    const allNodes = await this.deps.nodeRepo.findAll();
    const allEdges = await this.deps.edgeRepo.findAll();

    const components = allNodes.filter(n => n.type !== 'layer');
    const componentIds = new Set(components.map(n => n.id));

    // Build progress map
    const progressMap = new Map<string, number>();
    for (const comp of components) {
      const ver = await this.deps.versionRepo.findByNodeAndVersion(comp.id, version);
      progressMap.set(comp.id, ver?.progress ?? 0);
    }

    // Build dependency map
    const depsMap = new Map<string, string[]>();
    for (const id of componentIds) {
      depsMap.set(id, []);
    }
    for (const edge of allEdges) {
      if (edge.type !== 'DEPENDS_ON') {
        continue;
      }
      if (!componentIds.has(edge.source_id) || !componentIds.has(edge.target_id)) {
        continue;
      }
      depsMap.get(edge.source_id)!.push(edge.target_id);
    }

    const result: ImplementableComponent[] = [];
    for (const comp of components) {
      const selfProgress = progressMap.get(comp.id) ?? 0;
      if (selfProgress >= 100) {
        continue; // Already done
      }

      const depIds = depsMap.get(comp.id) ?? [];
      const allDepsComplete = depIds.every(depId => (progressMap.get(depId) ?? 0) >= 100);

      if (allDepsComplete) {
        const summary = await this.deps.featureRepo.getStepCountSummary(comp.id, version);
        result.push({
          id: comp.id,
          name: comp.name,
          total_steps: summary.totalSteps,
          progress: selfProgress,
        });
      }
    }

    return result;
  }
}
