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

    const progressMap = await this.buildProgressMap(components, version);
    const depsMap = this.buildDependencyMap(componentIds, allEdges);

    return this.findImplementable(components, version, progressMap, depsMap);
  }

  private async buildProgressMap(
    components: Array<{ id: string }>,
    version: string
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    for (const comp of components) {
      const ver = await this.deps.versionRepo.findByNodeAndVersion(comp.id, version);
      map.set(comp.id, ver?.progress ?? 0);
    }
    return map;
  }

  private buildDependencyMap(
    componentIds: Set<string>,
    allEdges: Array<{ source_id: string; target_id: string; type: string }>
  ): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const id of componentIds) {
      map.set(id, []);
    }
    for (const edge of allEdges) {
      if (edge.type !== 'DEPENDS_ON') {
        continue;
      }
      if (!componentIds.has(edge.source_id) || !componentIds.has(edge.target_id)) {
        continue;
      }
      map.get(edge.source_id)?.push(edge.target_id);
    }
    return map;
  }

  private async findImplementable(
    components: Array<{ id: string; name: string }>,
    version: string,
    progressMap: Map<string, number>,
    depsMap: Map<string, string[]>
  ): Promise<ImplementableComponent[]> {
    const result: ImplementableComponent[] = [];
    for (const comp of components) {
      const selfProgress = progressMap.get(comp.id) ?? 0;
      if (selfProgress >= 100) {
        continue;
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
