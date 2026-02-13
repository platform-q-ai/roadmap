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
    const inEdges = await this.deps.edgeRepo.findByTarget(nodeId);
    const depEdges = inEdges.filter(e => e.type === 'DEPENDS_ON');

    const lookups = depEdges.map(async (edge): Promise<DependentInfo | null> => {
      const node = await this.deps.nodeRepo.findById(edge.source_id);
      if (!node) {
        return null;
      }
      return { id: node.id, name: node.name, type: node.type };
    });

    const resolved = await Promise.all(lookups);
    return resolved.filter((info): info is DependentInfo => info !== null);
  }
}
