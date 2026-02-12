import type { IFeatureRepository, INodeRepository } from '../domain/index.js';
import { Feature } from '../domain/index.js';

import { NodeNotFoundError, ValidationError } from './errors.js';

const MAX_BATCH_SIZE = 50;

export interface BatchFeatureEntry {
  filename: string;
  content: string;
}

export interface BatchUploadInput {
  nodeId: string;
  version: string;
  features: BatchFeatureEntry[];
}

export interface CrossComponentFeatureEntry {
  node_id: string;
  version: string;
  filename: string;
  content: string;
}

export interface CrossComponentBatchInput {
  features: CrossComponentFeatureEntry[];
}

export interface BatchFeatureError {
  filename: string;
  error: string;
}

export interface BatchUploadResult {
  uploaded: number;
  version?: string;
  total_steps: number;
  errors: BatchFeatureError[];
}

interface Deps {
  featureRepo: IFeatureRepository;
  nodeRepo: INodeRepository;
}

/**
 * BatchUploadFeatures use case.
 *
 * Uploads multiple feature files to one component/version (single-component)
 * or across multiple components (cross-component). Validates each entry
 * individually and returns partial results on validation failures.
 */
export class BatchUploadFeatures {
  private readonly featureRepo: IFeatureRepository;
  private readonly nodeRepo: INodeRepository;

  constructor({ featureRepo, nodeRepo }: Deps) {
    this.featureRepo = featureRepo;
    this.nodeRepo = nodeRepo;
  }

  /** Single-component batch: all features go to one node_id + version. */
  async execute(input: BatchUploadInput): Promise<BatchUploadResult> {
    if (input.features.length === 0) {
      throw new ValidationError('features array must not be empty');
    }
    if (input.features.length > MAX_BATCH_SIZE) {
      throw new ValidationError(`Batch size exceeds maximum 50 features`);
    }

    const node = await this.nodeRepo.findById(input.nodeId);
    if (!node) {
      throw new NodeNotFoundError(input.nodeId);
    }

    let uploaded = 0;
    let totalSteps = 0;
    const errors: BatchFeatureError[] = [];

    for (const entry of input.features) {
      const entryError = this.validateEntry(entry);
      if (entryError) {
        errors.push({ filename: entry.filename || '(unknown)', error: entryError });
        continue;
      }

      const title = Feature.titleFromContent(entry.content, entry.filename);
      const stepCount = Feature.countSteps(entry.content);

      const feature = new Feature({
        node_id: input.nodeId,
        version: input.version,
        filename: entry.filename,
        title,
        content: entry.content,
        step_count: stepCount,
      });

      await this.featureRepo.save(feature);
      uploaded++;
      totalSteps += stepCount;
    }

    return {
      uploaded,
      version: input.version,
      total_steps: totalSteps,
      errors,
    };
  }

  /** Cross-component batch: each entry specifies its own node_id + version. */
  async executeCrossComponent(input: CrossComponentBatchInput): Promise<BatchUploadResult> {
    this.validateCrossComponentEntries(input.features);

    if (input.features.length > MAX_BATCH_SIZE) {
      throw new ValidationError(`Batch size exceeds maximum 50 features`);
    }

    let uploaded = 0;
    let totalSteps = 0;
    const errors: BatchFeatureError[] = [];

    for (const entry of input.features) {
      const nodeExists = await this.nodeRepo.exists(entry.node_id);
      if (!nodeExists) {
        errors.push({
          filename: entry.filename,
          error: `Component not found: ${entry.node_id}`,
        });
        continue;
      }

      const entryError = this.validateEntry(entry);
      if (entryError) {
        errors.push({ filename: entry.filename || '(unknown)', error: entryError });
        continue;
      }

      const title = Feature.titleFromContent(entry.content, entry.filename);
      const stepCount = Feature.countSteps(entry.content);

      const feature = new Feature({
        node_id: entry.node_id,
        version: entry.version,
        filename: entry.filename,
        title,
        content: entry.content,
        step_count: stepCount,
      });

      await this.featureRepo.save(feature);
      uploaded++;
      totalSteps += stepCount;
    }

    return { uploaded, total_steps: totalSteps, errors };
  }

  private validateEntry(entry: { filename: string; content: string }): string | null {
    if (!entry.filename) {
      return 'filename is required';
    }
    if (!entry.content) {
      return 'content is required';
    }
    if (!Feature.hasValidGherkin(entry.content)) {
      return 'Invalid Gherkin: missing Feature: line';
    }
    return null;
  }

  private validateCrossComponentEntries(entries: CrossComponentFeatureEntry[]): void {
    for (const entry of entries) {
      if (!entry.node_id) {
        throw new ValidationError('Every entry must have node_id: node_id is required');
      }
      if (!entry.version) {
        throw new ValidationError('Every entry must have version: version is required');
      }
    }
  }
}
