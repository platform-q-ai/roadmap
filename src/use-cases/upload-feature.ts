import type { IFeatureRepository, INodeRepository } from '../domain/index.js';
import { ValidationError } from '../domain/index.js';
import { Feature } from '../domain/index.js';

import { NodeNotFoundError } from './errors.js';

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
    this.validateFilename(input.filename);
    const validated = this.validateContent(input.content);

    const node = await this.nodeRepo.findById(input.nodeId);
    if (!node) {
      throw new NodeNotFoundError(input.nodeId);
    }

    const version = input.version ?? Feature.versionFromFilename(input.filename);

    if (!VERSION_RE.test(version)) {
      throw new ValidationError(`Invalid version: ${version.slice(0, 64)}`);
    }

    const title = Feature.titleFromContent(input.content, input.filename);
    const { scenarioCount, keywordCounts } = validated;
    const stepCount = keywordCounts.given + keywordCounts.when + keywordCounts.then;

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

  private validateFilename(filename: string): void {
    if (!Feature.isValidFeatureExtension(filename)) {
      throw new ValidationError('Invalid filename: must end with .feature');
    }
    if (!Feature.isKebabCaseFilename(filename)) {
      throw new ValidationError(
        `Invalid filename: must be kebab-case (got "${filename.slice(0, 64)}")`
      );
    }
  }

  private validateContent(content: string): {
    scenarioCount: number;
    keywordCounts: { given: number; when: number; then: number };
  } {
    if (!content.trim()) {
      throw new ValidationError('Content must not be empty');
    }
    if (!Feature.hasValidGherkin(content)) {
      throw new ValidationError('Invalid Gherkin: missing Feature: line');
    }
    const scenarioCount = Feature.countScenarios(content);
    if (scenarioCount === 0) {
      throw new ValidationError('Invalid Gherkin: no scenario found');
    }
    const keywordCounts = Feature.countByKeyword(content);
    const stepCount = keywordCounts.given + keywordCounts.when + keywordCounts.then;
    if (stepCount === 0) {
      throw new ValidationError('Invalid Gherkin: no steps found in any scenario');
    }
    const syntaxError = Feature.findFirstSyntaxError(content);
    if (syntaxError) {
      throw new ValidationError(
        `Invalid Gherkin at line ${syntaxError.line}: ${syntaxError.text.slice(0, 120)}`
      );
    }
    return { scenarioCount, keywordCounts };
  }
}
