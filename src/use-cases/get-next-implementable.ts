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
    const [allNodes, allEdges, allVersions, allFeatures] = await Promise.all([
      this.deps.nodeRepo.findAll(),
      this.deps.edgeRepo.findAll(),
      this.deps.versionRepo.findAll(),
      this.deps.featureRepo.findAll(),
    ]);

    const components = allNodes.filter(n => n.type !== 'layer');
    const componentIds = new Set(components.map(n => n.id));

    const progressMap = this.buildProgressMap(allVersions, componentIds, version);
    const depsMap = this.buildDependencyMap(componentIds, allEdges);
    const stepMap = this.buildStepMap(allFeatures, version);

    return this.findImplementable(components, progressMap, depsMap, stepMap);
  }

  private buildProgressMap(
    allVersions: Array<{ node_id: string; version: string; progress: number }>,
    componentIds: Set<string>,
    version: string
  ): Map<string, number> {
    const map = new Map<string, number>();
    for (const id of componentIds) {
      map.set(id, 0);
    }
    for (const v of allVersions) {
      if (v.version === version && componentIds.has(v.node_id)) {
        map.set(v.node_id, v.progress);
      }
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

  private buildStepMap(
    allFeatures: Array<{ node_id: string; version: string; step_count: number }>,
    version: string
  ): Map<string, number> {
    const map = new Map<string, number>();
    for (const f of allFeatures) {
      if (f.version === version) {
        map.set(f.node_id, (map.get(f.node_id) ?? 0) + f.step_count);
      }
    }
    return map;
  }

  private findImplementable(
    components: Array<{ id: string; name: string }>,
    progressMap: Map<string, number>,
    depsMap: Map<string, string[]>,
    stepMap: Map<string, number>
  ): ImplementableComponent[] {
    const result: ImplementableComponent[] = [];
    for (const comp of components) {
      const selfProgress = progressMap.get(comp.id) ?? 0;
      if (selfProgress >= 100) {
        continue;
      }
      const depIds = depsMap.get(comp.id) ?? [];
      const allDepsComplete = depIds.every(depId => (progressMap.get(depId) ?? 0) >= 100);
      if (allDepsComplete) {
        result.push({
          id: comp.id,
          name: comp.name,
          total_steps: stepMap.get(comp.id) ?? 0,
          progress: selfProgress,
        });
      }
    }
    return result;
  }
}
