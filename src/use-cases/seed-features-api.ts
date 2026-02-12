import type { IFeatureRepository, INodeRepository } from '../domain/index.js';
import { Feature } from '../domain/index.js';

import type { FeatureFileInput } from './index.js';
import { SeedFeatures } from './index.js';

type ScanFn = () => Promise<FeatureFileInput[]>;

interface StepTotalsEntry {
  total_steps: number;
  total_scenarios: number;
}

export interface SeedFeaturesApiResult {
  seeded: number;
  skipped: number;
  step_totals: Record<string, StepTotalsEntry>;
}

interface Deps {
  featureRepo: IFeatureRepository;
  nodeRepo: INodeRepository;
  scanFeatureFiles: ScanFn;
}

/**
 * SeedFeaturesApi use case.
 *
 * Wraps the existing SeedFeatures use case with:
 * 1. Filesystem scanning via an injected scan function
 * 2. Post-seed step-total aggregation from the just-seeded batch
 *
 * The scan function and repos are injected so this use case
 * remains infrastructure-free.
 */
export class SeedFeaturesApi {
  private readonly seedFeatures: SeedFeatures;
  private readonly scanFeatureFiles: ScanFn;

  constructor({ featureRepo, nodeRepo, scanFeatureFiles }: Deps) {
    this.seedFeatures = new SeedFeatures({ featureRepo, nodeRepo });
    this.scanFeatureFiles = scanFeatureFiles;
  }

  async execute(): Promise<SeedFeaturesApiResult> {
    const files = await this.scanFeatureFiles();
    const { seeded, skipped, features } = await this.seedFeatures.execute(files);

    const stepTotals = SeedFeaturesApi.computeStepTotals(features);

    return { seeded, skipped, step_totals: stepTotals };
  }

  static computeStepTotals(features: Feature[]): Record<string, StepTotalsEntry> {
    const byVersion = new Map<string, { steps: number; scenarios: number }>();

    for (const f of features) {
      const entry = byVersion.get(f.version) ?? { steps: 0, scenarios: 0 };
      entry.steps += f.step_count;
      entry.scenarios += Feature.countScenarios(f.content ?? '');
      byVersion.set(f.version, entry);
    }

    const result: Record<string, StepTotalsEntry> = {};
    for (const [version, data] of byVersion) {
      result[version] = {
        total_steps: data.steps,
        total_scenarios: data.scenarios,
      };
    }
    return result;
  }
}
