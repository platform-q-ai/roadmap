import type { Node } from '../domain/index.js';
import type { IEdgeRepository, INodeRepository } from '../domain/index.js';

interface Deps {
  nodeRepo: INodeRepository;
  edgeRepo: IEdgeRepository;
}

interface TreeNode {
  id: string;
  name: string;
  type: string;
  dependencies?: TreeNode[];
}

interface TraversalContext {
  nodeMap: Map<string, Node>;
  depsBySource: Map<string, string[]>;
  visited: Set<string>;
  maxDepth: number;
}

/**
 * Recursively traverse DEPENDS_ON edges from a component,
 * building a tree up to the specified depth.
 * Pre-loads all nodes and edges to avoid N+1 queries.
 */
export class GetDependencyTree {
  private deps: Deps;

  constructor(deps: Deps) {
    this.deps = deps;
  }

  async execute(nodeId: string, maxDepth: number = 1): Promise<TreeNode[]> {
    const [allNodes, allEdges] = await Promise.all([
      this.deps.nodeRepo.findAll(),
      this.deps.edgeRepo.findAll(),
    ]);

    const nodeMap = new Map(allNodes.map(n => [n.id, n]));
    const depsBySource = new Map<string, string[]>();
    for (const edge of allEdges) {
      if (edge.type !== 'DEPENDS_ON') {
        continue;
      }
      const list = depsBySource.get(edge.source_id) ?? [];
      list.push(edge.target_id);
      depsBySource.set(edge.source_id, list);
    }

    const ctx: TraversalContext = { nodeMap, depsBySource, visited: new Set(), maxDepth };
    return this.traverse(nodeId, 1, ctx);
  }

  private traverse(nodeId: string, currentDepth: number, ctx: TraversalContext): TreeNode[] {
    ctx.visited.add(nodeId);
    const targetIds = ctx.depsBySource.get(nodeId) ?? [];

    const result: TreeNode[] = [];
    for (const targetId of targetIds) {
      if (ctx.visited.has(targetId)) {
        continue;
      }
      const node = ctx.nodeMap.get(targetId);
      if (!node) {
        continue;
      }
      const treeNode: TreeNode = { id: node.id, name: node.name, type: node.type };
      if (currentDepth < ctx.maxDepth) {
        treeNode.dependencies = this.traverse(targetId, currentDepth + 1, ctx);
      }
      result.push(treeNode);
    }
    return result;
  }
}
