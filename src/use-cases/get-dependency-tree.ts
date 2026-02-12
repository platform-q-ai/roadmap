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

/**
 * Recursively traverse DEPENDS_ON edges from a component,
 * building a tree up to the specified depth.
 */
export class GetDependencyTree {
  private deps: Deps;

  constructor(deps: Deps) {
    this.deps = deps;
  }

  async execute(nodeId: string, maxDepth: number = 1): Promise<TreeNode[]> {
    const visited = new Set<string>();
    return this.traverse(nodeId, 1, maxDepth, visited);
  }

  private async traverse(
    nodeId: string,
    currentDepth: number,
    maxDepth: number,
    visited: Set<string>
  ): Promise<TreeNode[]> {
    visited.add(nodeId);
    const outEdges = await this.deps.edgeRepo.findBySource(nodeId);
    const depEdges = outEdges.filter(e => e.type === 'DEPENDS_ON');

    const result: TreeNode[] = [];
    for (const edge of depEdges) {
      if (visited.has(edge.target_id)) {
        continue;
      }
      const node = await this.deps.nodeRepo.findById(edge.target_id);
      if (!node) {
        continue;
      }
      const treeNode: TreeNode = { id: node.id, name: node.name, type: node.type };
      if (currentDepth < maxDepth) {
        treeNode.dependencies = await this.traverse(
          edge.target_id,
          currentDepth + 1,
          maxDepth,
          visited
        );
      }
      result.push(treeNode);
    }
    return result;
  }
}
