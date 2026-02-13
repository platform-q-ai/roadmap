import type { Node } from '../domain/index.js';
import type { INodeRepository } from '../domain/index.js';

import { NodeNotFoundError } from './errors.js';

interface Deps {
  nodeRepo: INodeRepository;
}

interface LayerResult {
  layer: Node;
  children: Node[];
}

/**
 * Get a layer node and its children (nodes whose layer field matches this id).
 */
export class GetLayer {
  private readonly nodeRepo: INodeRepository;

  constructor({ nodeRepo }: Deps) {
    this.nodeRepo = nodeRepo;
  }

  async execute(layerId: string): Promise<LayerResult> {
    const node = await this.nodeRepo.findById(layerId);
    if (!node || !node.isLayer()) {
      throw new NodeNotFoundError(layerId);
    }
    const children = await this.nodeRepo.findByLayer(layerId);
    return { layer: node, children };
  }
}
