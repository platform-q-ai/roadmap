import type { IFeatureRepository, INodeRepository } from '../domain/index.js';
import { Feature } from '../domain/index.js';

export interface FeatureFileInput {
  nodeId: string;
  filename: string;
  content: string;
}

interface Deps {
  featureRepo: IFeatureRepository;
  nodeRepo: INodeRepository;
}

/**
 * SeedFeatures use case.
 *
 * Receives pre-scanned feature files from the adapter layer,
 * parses them, and inserts into the feature repository.
 * Clears existing features first (idempotent re-seed).
 */
export class SeedFeatures {
  private readonly featureRepo: IFeatureRepository;
  private readonly nodeRepo: INodeRepository;

  constructor({ featureRepo, nodeRepo }: Deps) {
    this.featureRepo = featureRepo;
    this.nodeRepo = nodeRepo;
  }

  async execute(
    featureFiles: FeatureFileInput[]
  ): Promise<{ seeded: number; skipped: number; features: Feature[] }> {
    await this.featureRepo.deleteAll();

    // Batch-check node existence to avoid N+1 queries
    const uniqueNodeIds = [...new Set(featureFiles.map(f => f.nodeId))];
    const validNodeIds = new Set<string>();
    for (const id of uniqueNodeIds) {
      if (await this.nodeRepo.exists(id)) {
        validNodeIds.add(id);
      }
    }

    const batch: Feature[] = [];
    let skipped = 0;

    for (const { nodeId, filename, content } of featureFiles) {
      if (!validNodeIds.has(nodeId)) {
        skipped++;
        continue;
      }

      batch.push(
        new Feature({
          node_id: nodeId,
          version: Feature.versionFromFilename(filename),
          filename,
          title: Feature.titleFromContent(content, filename),
          content,
          step_count: Feature.countSteps(content),
        })
      );
    }

    if (batch.length > 0) {
      await this.featureRepo.saveMany(batch);
    }

    return { seeded: batch.length, skipped, features: batch };
  }
}
