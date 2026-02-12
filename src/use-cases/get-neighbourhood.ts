import type { Edge, Node } from '../domain/index.js';
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
    const [allEdges, allNodes] = await Promise.all([
      this.deps.edgeRepo.findAll(),
      this.deps.nodeRepo.findAll(),
    ]);
    const nodeMap = new Map(allNodes.map(n => [n.id, n]));
    const adjacency = this.buildAdjacency(allEdges);
    const visited = this.bfsHops(nodeId, hops, adjacency);
    const edges = this.collectEdges(allEdges, visited);
    const nodes = this.resolveNodes(visited, nodeMap);
    return { nodes, edges };
  }

  private buildAdjacency(edges: Edge[]): Map<string, string[]> {
    const adj = new Map<string, string[]>();
    const ensure = (id: string) => {
      if (!adj.has(id)) {
        adj.set(id, []);
      }
    };
    for (const edge of edges) {
      ensure(edge.source_id);
      ensure(edge.target_id);
      adj.get(edge.source_id)?.push(edge.target_id);
      adj.get(edge.target_id)?.push(edge.source_id);
    }
    return adj;
  }

  private bfsHops(nodeId: string, hops: number, adjacency: Map<string, string[]>): Set<string> {
    const visited = new Set<string>([nodeId]);
    let frontier = [nodeId];
    for (let hop = 0; hop < hops; hop++) {
      const nextFrontier: string[] = [];
      for (const current of frontier) {
        for (const neighbor of adjacency.get(current) ?? []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            nextFrontier.push(neighbor);
          }
        }
      }
      frontier = nextFrontier;
    }
    return visited;
  }

  private collectEdges(allEdges: Edge[], visited: Set<string>): NeighbourEdge[] {
    return allEdges
      .filter(e => visited.has(e.source_id) && visited.has(e.target_id))
      .map(e => ({ source_id: e.source_id, target_id: e.target_id, type: e.type }));
  }

  private resolveNodes(visited: Set<string>, nodeMap: Map<string, Node>): NeighbourNode[] {
    const nodes: NeighbourNode[] = [];
    for (const id of visited) {
      const node = nodeMap.get(id);
      if (node) {
        nodes.push({ id: node.id, name: node.name, type: node.type });
      }
    }
    return nodes;
  }
}
