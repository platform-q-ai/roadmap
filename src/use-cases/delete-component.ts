import type {
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
} from '../domain/index.js';

import { NodeNotFoundError } from './errors.js';

interface Deps {
  nodeRepo: INodeRepository;
  edgeRepo: IEdgeRepository;
  versionRepo: IVersionRepository;
  featureRepo: IFeatureRepository;
}

/**
 * DeleteComponent use case.
 *
 * Removes a component node and all its related data:
 * versions, features, and edges (both inbound and outbound).
 */
export class DeleteComponent {
  private readonly nodeRepo: INodeRepository;
  private readonly edgeRepo: IEdgeRepository;
  private readonly versionRepo: IVersionRepository;
  private readonly featureRepo: IFeatureRepository;

  constructor({ nodeRepo, edgeRepo, versionRepo, featureRepo }: Deps) {
    this.nodeRepo = nodeRepo;
    this.edgeRepo = edgeRepo;
    this.versionRepo = versionRepo;
    this.featureRepo = featureRepo;
  }

  async execute(nodeId: string): Promise<void> {
    const node = await this.nodeRepo.findById(nodeId);
    if (!node) {
      throw new NodeNotFoundError(nodeId);
    }

    await this.versionRepo.deleteByNode(nodeId);
    await this.featureRepo.deleteByNode(nodeId);

    const inbound = await this.edgeRepo.findByTarget(nodeId);
    const outbound = await this.edgeRepo.findBySource(nodeId);
    const allEdges = [...inbound, ...outbound];

    for (const edge of allEdges) {
      if (edge.id !== null && edge.id !== undefined) {
        await this.edgeRepo.delete(edge.id);
      }
    }

    await this.nodeRepo.delete(nodeId);
  }
}
