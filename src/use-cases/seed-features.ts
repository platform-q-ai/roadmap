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

  async execute(featureFiles: FeatureFileInput[]): Promise<{ seeded: number; skipped: number }> {
    await this.featureRepo.deleteAll();

    let seeded = 0;
    let skipped = 0;

    for (const { nodeId, filename, content } of featureFiles) {
      const exists = await this.nodeRepo.exists(nodeId);
      if (!exists) {
        skipped++;
        continue;
      }

      const version = Feature.versionFromFilename(filename);
      const title = Feature.titleFromContent(content, filename);

      const feature = new Feature({
        node_id: nodeId,
        version,
        filename,
        title,
        content,
        step_count: Feature.countSteps(content),
      });

      await this.featureRepo.save(feature);
      seeded++;
    }

    return { seeded, skipped };
  }
}
