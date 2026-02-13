import type { Node } from '../domain/index.js';
import type { INodeRepository } from '../domain/index.js';

interface Deps {
  nodeRepo: INodeRepository;
}

/**
 * List all layer nodes in the architecture graph.
 */
export class ListLayers {
  private readonly nodeRepo: INodeRepository;

  constructor({ nodeRepo }: Deps) {
    this.nodeRepo = nodeRepo;
  }

  async execute(): Promise<Node[]> {
    return this.nodeRepo.findByType('layer');
  }
}
