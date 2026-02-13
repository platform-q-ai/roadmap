import type { INodeRepository, IVersionRepository } from '../domain/index.js';

import { NodeNotFoundError } from './errors.js';

interface Deps {
  nodeRepo: INodeRepository;
  versionRepo: IVersionRepository;
}

/**
 * DeleteAllVersions use case.
 *
 * Deletes all version records for a given component.
 */
export class DeleteAllVersions {
  private readonly nodeRepo: INodeRepository;
  private readonly versionRepo: IVersionRepository;

  constructor({ nodeRepo, versionRepo }: Deps) {
    this.nodeRepo = nodeRepo;
    this.versionRepo = versionRepo;
  }

  async execute(nodeId: string): Promise<void> {
    const exists = await this.nodeRepo.exists(nodeId);
    if (!exists) {
      throw new NodeNotFoundError(nodeId);
    }

    await this.versionRepo.deleteByNode(nodeId);
  }
}
