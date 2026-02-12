import type { IFeatureRepository, INodeRepository } from '../domain/index.js';
import { Feature } from '../domain/index.js';

import { NodeNotFoundError, ValidationError } from './errors.js';

const VERSION_RE = /^(mvp|v\d+)$/;

export interface UploadFeatureInput {
  nodeId: string;
  filename: string;
  content: string;
  version?: string;
}

export interface UploadFeatureResult {
  filename: string;
  version: string;
  title: string;
  node_id: string;
  step_count: number;
  scenario_count: number;
  given_count: number;
  when_count: number;
  then_count: number;
}

interface Deps {
  featureRepo: IFeatureRepository;
  nodeRepo: INodeRepository;
}

/**
 * UploadFeature use case.
 *
 * Parses a Gherkin feature file, derives or validates the version tag,
 * extracts the title, and upserts it to the feature repository.
 *
 * V1 additions:
 * - Explicit version parameter (overrides filename-derived version)
 * - Version format validation (mvp | v1 | v2 | ...)
 * - Upsert semantics (delete-then-save)
 * - Step count breakdown in result
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

    const version = input.version ?? Feature.versionFromFilename(input.filename);

    if (!VERSION_RE.test(version)) {
      throw new ValidationError(`Invalid version: ${version}`);
    }

    const title = Feature.titleFromContent(input.content, input.filename);
    const stepCount = Feature.countSteps(input.content);
    const scenarioCount = Feature.countScenarios(input.content);
    const keywordCounts = Feature.countByKeyword(input.content);

    // Upsert: remove any existing feature with same node+version+filename
    await this.featureRepo.deleteByNodeAndVersionAndFilename(input.nodeId, version, input.filename);

    const feature = new Feature({
      node_id: input.nodeId,
      version,
      filename: input.filename,
      title,
      content: input.content,
      step_count: stepCount,
    });

    await this.featureRepo.save(feature);

    return {
      filename: input.filename,
      version,
      title,
      node_id: input.nodeId,
      step_count: stepCount,
      scenario_count: scenarioCount,
      given_count: keywordCounts.given,
      when_count: keywordCounts.when,
      then_count: keywordCounts.then,
    };
  }
}
