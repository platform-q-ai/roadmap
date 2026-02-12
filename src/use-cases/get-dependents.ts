import type { IEdgeRepository, INodeRepository } from '../domain/index.js';

interface Deps {
  nodeRepo: INodeRepository;
  edgeRepo: IEdgeRepository;
}

interface DependentInfo {
  id: string;
  name: string;
  type: string;
}

/**
 * Find all components that depend on the given component
 * (inbound DEPENDS_ON edges).
 */
export class GetDependents {
  private deps: Deps;

  constructor(deps: Deps) {
    this.deps = deps;
  }

  async execute(nodeId: string): Promise<DependentInfo[]> {
    const [inEdges, allNodes] = await Promise.all([
      this.deps.edgeRepo.findByTarget(nodeId),
      this.deps.nodeRepo.findAll(),
    ]);
    const nodeMap = new Map(allNodes.map(n => [n.id, n]));
    const depEdges = inEdges.filter(e => e.type === 'DEPENDS_ON');

    const result: DependentInfo[] = [];
    for (const edge of depEdges) {
      const node = nodeMap.get(edge.source_id);
      if (node) {
        result.push({ id: node.id, name: node.name, type: node.type });
      }
    }
    return result;
  }
}
