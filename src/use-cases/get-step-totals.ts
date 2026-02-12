import type { IFeatureRepository } from '../domain/index.js';

export interface StepTotalsResult {
  totalSteps: number;
  featureCount: number;
}

interface Deps {
  featureRepo: IFeatureRepository;
}

/**
 * GetStepTotals use case.
 *
 * Aggregates step counts across all features for a given component and version.
 * Returns the total number of steps and the number of features.
 */
export class GetStepTotals {
  private readonly featureRepo: IFeatureRepository;

  constructor({ featureRepo }: Deps) {
    this.featureRepo = featureRepo;
  }

  async execute(nodeId: string, version: string): Promise<StepTotalsResult> {
    const features = await this.featureRepo.findByNodeAndVersion(nodeId, version);

    const totalSteps = features.reduce((sum, f) => sum + f.step_count, 0);

    return {
      totalSteps,
      featureCount: features.length,
    };
  }
}
