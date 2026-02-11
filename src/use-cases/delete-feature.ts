import type { IFeatureRepository, INodeRepository } from '../domain/index.js';

interface Deps {
  featureRepo: IFeatureRepository;
  nodeRepo: INodeRepository;
}

class NodeNotFoundError extends Error {
  constructor(id: string) {
    super(`Component not found: ${id}`);
    this.name = 'NodeNotFoundError';
  }
}

class FeatureNotFoundError extends Error {
  constructor(nodeId: string, filename: string) {
    super(`Feature not found: ${filename} for component ${nodeId}`);
    this.name = 'FeatureNotFoundError';
  }
}

/**
 * DeleteFeature use case.
 *
 * Deletes a single feature file from a component.
 * Validates that the component exists and the feature exists before deleting.
 */
export class DeleteFeature {
  private readonly featureRepo: IFeatureRepository;
  private readonly nodeRepo: INodeRepository;

  constructor({ featureRepo, nodeRepo }: Deps) {
    this.featureRepo = featureRepo;
    this.nodeRepo = nodeRepo;
  }

  async execute(nodeId: string, filename: string): Promise<void> {
    const exists = await this.nodeRepo.exists(nodeId);
    if (!exists) {
      throw new NodeNotFoundError(nodeId);
    }

    const deleted = await this.featureRepo.deleteByNodeAndFilename(nodeId, filename);
    if (!deleted) {
      throw new FeatureNotFoundError(nodeId, filename);
    }
  }
}
