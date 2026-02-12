import type { IEdgeRepository, INodeRepository } from '../domain/index.js';

interface Deps {
  nodeRepo: INodeRepository;
  edgeRepo: IEdgeRepository;
}

interface PathNode {
  id: string;
  name: string;
  type: string;
}

interface PathEdge {
  source_id: string;
  target_id: string;
  type: string;
}

interface PathResult {
  path: PathNode[];
  edges: PathEdge[];
}

/**
 * Find the shortest path between two nodes using BFS.
 * Treats all edges as bidirectional for path finding.
 */
export class GetShortestPath {
  private deps: Deps;

  constructor(deps: Deps) {
    this.deps = deps;
  }

  async execute(fromId: string, toId: string): Promise<PathResult> {
    if (fromId === toId) {
      const node = await this.deps.nodeRepo.findById(fromId);
      if (!node) {
        return { path: [], edges: [] };
      }
      return {
        path: [{ id: node.id, name: node.name, type: node.type }],
        edges: [],
      };
    }

    const allEdges = await this.deps.edgeRepo.findAll();

    // Build bidirectional adjacency list
    const adjacency = new Map<string, Array<{ neighbor: string; edge: PathEdge }>>();
    for (const edge of allEdges) {
      if (!adjacency.has(edge.source_id)) {
        adjacency.set(edge.source_id, []);
      }
      if (!adjacency.has(edge.target_id)) {
        adjacency.set(edge.target_id, []);
      }
      adjacency.get(edge.source_id)!.push({
        neighbor: edge.target_id,
        edge: { source_id: edge.source_id, target_id: edge.target_id, type: edge.type },
      });
      adjacency.get(edge.target_id)!.push({
        neighbor: edge.source_id,
        edge: { source_id: edge.source_id, target_id: edge.target_id, type: edge.type },
      });
    }

    // BFS
    const visited = new Set<string>([fromId]);
    const parent = new Map<string, { from: string; edge: PathEdge }>();
    const queue: string[] = [fromId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === toId) {
        break;
      }
      for (const { neighbor, edge } of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          parent.set(neighbor, { from: current, edge });
          queue.push(neighbor);
        }
      }
    }

    if (!parent.has(toId)) {
      return { path: [], edges: [] };
    }

    // Reconstruct path
    const pathIds: string[] = [];
    const pathEdges: PathEdge[] = [];
    let current = toId;
    while (current !== fromId) {
      pathIds.unshift(current);
      const p = parent.get(current)!;
      pathEdges.unshift(p.edge);
      current = p.from;
    }
    pathIds.unshift(fromId);

    // Resolve node info
    const path: PathNode[] = [];
    for (const id of pathIds) {
      const node = await this.deps.nodeRepo.findById(id);
      if (node) {
        path.push({ id: node.id, name: node.name, type: node.type });
      } else {
        path.push({ id, name: id, type: 'unknown' });
      }
    }

    return { path, edges: pathEdges };
  }
}
