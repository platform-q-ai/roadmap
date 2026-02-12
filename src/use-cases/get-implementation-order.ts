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

    // Only include non-layer nodes
    const components = allNodes.filter(n => n.type !== 'layer');
    const componentIds = new Set(components.map(n => n.id));

    // For the implementation order: if A DEPENDS_ON B, then B must come first.
    // We reverse the edges: dependedOnBy[B] = [A] (B is depended on by A).
    // In-degree counts how many prerequisites (dependencies) each node has.
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
      // source depends on target → target is a prerequisite for source
      // In reverse: target "unblocks" source
      dependedOnBy.get(edge.target_id)!.push(edge.source_id);
      inDegree.set(edge.source_id, (inDegree.get(edge.source_id) ?? 0) + 1);
    }

    // Kahn's algorithm: start with nodes that have no dependencies
    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) {
        queue.push(id);
      }
    }

    const order: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
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
      // Cycle detected — find the nodes involved
      const inOrder = new Set(order);
      const cycleNodes = [...componentIds].filter(id => !inOrder.has(id));
      return { cycle: cycleNodes };
    }

    return { order };
  }
}
