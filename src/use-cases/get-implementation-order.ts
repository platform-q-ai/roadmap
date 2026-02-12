import type { Edge } from '../domain/index.js';
import type { IEdgeRepository, INodeRepository } from '../domain/index.js';

interface Deps {
  nodeRepo: INodeRepository;
  edgeRepo: IEdgeRepository;
}

interface OrderResult {
  order?: string[];
  cycle?: string[];
}

/**
 * Compute topological sort of non-layer components based on DEPENDS_ON edges.
 * Returns the sorted order or the cycle if one exists.
 */
export class GetImplementationOrder {
  private deps: Deps;

  constructor(deps: Deps) {
    this.deps = deps;
  }

  async execute(): Promise<OrderResult> {
    const allNodes = await this.deps.nodeRepo.findAll();
    const allEdges = await this.deps.edgeRepo.findAll();
    const components = allNodes.filter(n => n.type !== 'layer');
    const componentIds = new Set(components.map(n => n.id));

    const { dependedOnBy, inDegree } = this.buildGraph(componentIds, allEdges);
    return this.kahnSort(componentIds, dependedOnBy, inDegree);
  }

  private buildGraph(
    componentIds: Set<string>,
    allEdges: Edge[]
  ): { dependedOnBy: Map<string, string[]>; inDegree: Map<string, number> } {
    const dependedOnBy = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    for (const id of componentIds) {
      dependedOnBy.set(id, []);
      inDegree.set(id, 0);
    }
    for (const edge of allEdges) {
      if (edge.type !== 'DEPENDS_ON') {
        continue;
      }
      if (!componentIds.has(edge.source_id) || !componentIds.has(edge.target_id)) {
        continue;
      }
      dependedOnBy.get(edge.target_id)?.push(edge.source_id);
      inDegree.set(edge.source_id, (inDegree.get(edge.source_id) ?? 0) + 1);
    }
    return { dependedOnBy, inDegree };
  }

  private kahnSort(
    componentIds: Set<string>,
    dependedOnBy: Map<string, string[]>,
    inDegree: Map<string, number>
  ): OrderResult {
    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) {
        queue.push(id);
      }
    }

    const order: string[] = [];
    let head = 0;
    while (head < queue.length) {
      const current = queue[head++];
      order.push(current);
      for (const dependent of dependedOnBy.get(current) ?? []) {
        const newDeg = (inDegree.get(dependent) ?? 1) - 1;
        inDegree.set(dependent, newDeg);
        if (newDeg === 0) {
          queue.push(dependent);
        }
      }
    }

    if (order.length < componentIds.size) {
      const inOrder = new Set(order);
      return { cycle: [...componentIds].filter(id => !inOrder.has(id)) };
    }
    return { order };
  }
}
