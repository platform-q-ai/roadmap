import type { IFeatureRepository, INodeRepository } from '../domain/index.js';
import { Feature } from '../domain/index.js';

import { NodeNotFoundError } from './errors.js';

export interface UploadFeatureInput {
  nodeId: string;
  filename: string;
  content: string;
}

export interface UploadFeatureResult {
  filename: string;
  version: string;
  title: string;
  node_id: string;
}

interface Deps {
  featureRepo: IFeatureRepository;
  nodeRepo: INodeRepository;
}

/**
 * UploadFeature use case.
 *
 * Parses a Gherkin feature file, derives the version tag and title,
 * and saves it to the feature repository for the given component.
 */
export class UploadFeature {
  private readonly featureRepo: IFeatureRepository;
  private readonly nodeRepo: INodeRepository;

  constructor({ featureRepo, nodeRepo }: Deps) {
    this.featureRepo = featureRepo;
    this.nodeRepo = nodeRepo;
  }

  async execute(input: UploadFeatureInput): Promise<UploadFeatureResult> {
    const node = await this.nodeRepo.findById(input.nodeId);
    if (!node) {
      throw new NodeNotFoundError(input.nodeId);
    }

    const version = Feature.versionFromFilename(input.filename);
    const title = Feature.titleFromContent(input.content, input.filename);

    const feature = new Feature({
      node_id: input.nodeId,
      version,
      filename: input.filename,
      title,
      content: input.content,
    });

    await this.featureRepo.save(feature);

    return {
      filename: input.filename,
      version,
      title,
      node_id: input.nodeId,
    };
  }
}
