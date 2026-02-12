import type { IFeatureRepository, INodeRepository } from '../domain/index.js';

import { FeatureNotFoundError, NodeNotFoundError } from './errors.js';

interface Deps {
  featureRepo: IFeatureRepository;
  nodeRepo: INodeRepository;
}

/**
 * DeleteFeatureVersionScoped use case.
 *
 * Provides version-scoped deletion of feature files:
 * - `executeSingle`: delete one feature by node, version, and filename
 * - `executeVersion`: delete all features for a node and version
 *
 * Both methods validate that the component exists before proceeding.
 */
export class DeleteFeatureVersionScoped {
  private readonly featureRepo: IFeatureRepository;
  private readonly nodeRepo: INodeRepository;

  constructor({ featureRepo, nodeRepo }: Deps) {
    this.featureRepo = featureRepo;
    this.nodeRepo = nodeRepo;
  }

  async executeSingle(nodeId: string, version: string, filename: string): Promise<void> {
    const exists = await this.nodeRepo.exists(nodeId);
    if (!exists) {
      throw new NodeNotFoundError(nodeId);
    }

    const deleted = await this.featureRepo.deleteByNodeAndVersionAndFilename(
      nodeId,
      version,
      filename
    );
    if (!deleted) {
      throw new FeatureNotFoundError(nodeId, filename);
    }
  }

  async executeVersion(nodeId: string, version: string): Promise<number> {
    const exists = await this.nodeRepo.exists(nodeId);
    if (!exists) {
      throw new NodeNotFoundError(nodeId);
    }

    return this.featureRepo.deleteByNodeAndVersion(nodeId, version);
  }
}
