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
 * Delegates to a SQL aggregation query for efficiency.
 */
export class GetStepTotals {
  private readonly featureRepo: IFeatureRepository;

  constructor({ featureRepo }: Deps) {
    this.featureRepo = featureRepo;
  }

  async execute(nodeId: string, version: string): Promise<StepTotalsResult> {
    return this.featureRepo.getStepCountSummary(nodeId, version);
  }
}
