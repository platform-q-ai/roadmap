import type { IEdgeRepository, INodeRepository } from '../domain/index.js';

interface Deps {
  nodeRepo: INodeRepository;
  edgeRepo: IEdgeRepository;
}

interface NeighbourNode {
  id: string;
  name: string;
  type: string;
}

interface NeighbourEdge {
  source_id: string;
  target_id: string;
  type: string;
}

interface NeighbourhoodResult {
  nodes: NeighbourNode[];
  edges: NeighbourEdge[];
}

/**
 * Get the N-hop neighbourhood subgraph around a component.
 * Returns all nodes within N hops and the edges between them.
 */
export class GetNeighbourhood {
  private deps: Deps;

  constructor(deps: Deps) {
    this.deps = deps;
  }

  async execute(nodeId: string, hops: number = 1): Promise<NeighbourhoodResult> {
    const allEdges = await this.deps.edgeRepo.findAll();

    // Build bidirectional adjacency
    const adjacency = new Map<string, Array<{ neighbor: string }>>();
    for (const edge of allEdges) {
      if (!adjacency.has(edge.source_id)) {
        adjacency.set(edge.source_id, []);
      }
      if (!adjacency.has(edge.target_id)) {
        adjacency.set(edge.target_id, []);
      }
      adjacency.get(edge.source_id)!.push({ neighbor: edge.target_id });
      adjacency.get(edge.target_id)!.push({ neighbor: edge.source_id });
    }

    // BFS to find all nodes within N hops
    const visited = new Set<string>([nodeId]);
    let frontier = [nodeId];

    for (let hop = 0; hop < hops; hop++) {
      const nextFrontier: string[] = [];
      for (const current of frontier) {
        for (const { neighbor } of adjacency.get(current) ?? []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            nextFrontier.push(neighbor);
          }
        }
      }
      frontier = nextFrontier;
    }

    // Collect edges between visited nodes
    const nodeEdges: NeighbourEdge[] = [];
    for (const edge of allEdges) {
      if (visited.has(edge.source_id) && visited.has(edge.target_id)) {
        nodeEdges.push({
          source_id: edge.source_id,
          target_id: edge.target_id,
          type: edge.type,
        });
      }
    }

    // Resolve node info
    const nodes: NeighbourNode[] = [];
    for (const id of visited) {
      const node = await this.deps.nodeRepo.findById(id);
      if (node) {
        nodes.push({ id: node.id, name: node.name, type: node.type });
      }
    }

    return { nodes, edges: nodeEdges };
  }
}
