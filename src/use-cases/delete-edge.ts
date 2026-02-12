import type { IEdgeRepository } from '../domain/index.js';

import { EdgeNotFoundError } from './errors.js';

interface Deps {
  edgeRepo: IEdgeRepository;
}

/**
 * DeleteEdge use case.
 *
 * Verifies edge existence before deletion;
 * throws EdgeNotFoundError if the edge does not exist.
 */
export class DeleteEdge {
  private readonly edgeRepo: IEdgeRepository;

  constructor({ edgeRepo }: Deps) {
    this.edgeRepo = edgeRepo;
  }

  async execute(id: number): Promise<void> {
    const edge = await this.edgeRepo.findById(id);
    if (!edge) {
      throw new EdgeNotFoundError(id);
    }
    await this.edgeRepo.delete(id);
  }
}
