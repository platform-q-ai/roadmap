import type { Edge } from '../domain/index.js';
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

type AdjEntry = { neighbor: string; edge: PathEdge };

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
      return this.sameNodePath(fromId);
    }

    const allEdges = await this.deps.edgeRepo.findAll();
    const adjacency = this.buildAdjacency(allEdges);
    const parentMap = this.bfs(fromId, toId, adjacency);

    if (!parentMap.has(toId)) {
      return { path: [], edges: [] };
    }

    return this.reconstructPath(fromId, toId, parentMap);
  }

  private async sameNodePath(id: string): Promise<PathResult> {
    const node = await this.deps.nodeRepo.findById(id);
    if (!node) {
      return { path: [], edges: [] };
    }
    return { path: [{ id: node.id, name: node.name, type: node.type }], edges: [] };
  }

  private buildAdjacency(edges: Edge[]): Map<string, AdjEntry[]> {
    const adjacency = new Map<string, AdjEntry[]>();
    const ensure = (id: string) => {
      if (!adjacency.has(id)) {
        adjacency.set(id, []);
      }
    };
    for (const edge of edges) {
      ensure(edge.source_id);
      ensure(edge.target_id);
      const pathEdge = { source_id: edge.source_id, target_id: edge.target_id, type: edge.type };
      adjacency.get(edge.source_id)?.push({ neighbor: edge.target_id, edge: pathEdge });
      adjacency.get(edge.target_id)?.push({ neighbor: edge.source_id, edge: pathEdge });
    }
    return adjacency;
  }

  private bfs(
    fromId: string,
    toId: string,
    adjacency: Map<string, AdjEntry[]>
  ): Map<string, { from: string; edge: PathEdge }> {
    const visited = new Set<string>([fromId]);
    const parent = new Map<string, { from: string; edge: PathEdge }>();
    const queue: string[] = [fromId];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || current === toId) {
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
    return parent;
  }

  private async reconstructPath(
    fromId: string,
    toId: string,
    parentMap: Map<string, { from: string; edge: PathEdge }>
  ): Promise<PathResult> {
    const pathIds: string[] = [];
    const pathEdges: PathEdge[] = [];
    let current = toId;
    while (current !== fromId) {
      pathIds.unshift(current);
      const p = parentMap.get(current);
      if (!p) {
        break;
      }
      pathEdges.unshift(p.edge);
      current = p.from;
    }
    pathIds.unshift(fromId);

    const path: PathNode[] = [];
    for (const id of pathIds) {
      const node = await this.deps.nodeRepo.findById(id);
      path.push(
        node ? { id: node.id, name: node.name, type: node.type } : { id, name: id, type: 'unknown' }
      );
    }
    return { path, edges: pathEdges };
  }
}
