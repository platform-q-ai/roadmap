import type { IFeatureRepository, INodeRepository } from '../domain/index.js';
import { Feature } from '../domain/index.js';

import { FeatureNotFoundError, NodeNotFoundError } from './errors.js';

interface Deps {
  featureRepo: IFeatureRepository;
  nodeRepo: INodeRepository;
}

interface EnrichedFeature {
  scenario_count: number;
  [key: string]: unknown;
}

interface ListResult {
  features: EnrichedFeature[];
  totals: {
    total_features: number;
    total_scenarios: number;
    total_steps: number;
    total_given_steps: number;
    total_when_steps: number;
    total_then_steps: number;
  };
}

// Pre-compiled regex (avoids recompilation per call)
const STEP_LINE_RE = /^\s*(Given|When|Then|And|But)\s+/gm;

/**
 * Stateful step keyword counter.
 * `And`/`But` inherit the previous primary keyword (Given/When/Then).
 */
function countStepsByKeyword(content: string | null): {
  given: number;
  when: number;
  then: number;
} {
  const result = { given: 0, when: 0, then: 0 };
  if (!content) {
    return result;
  }
  let lastPrimary: 'given' | 'when' | 'then' = 'given';
  let match: RegExpExecArray | null = null;
  STEP_LINE_RE.lastIndex = 0;
  while ((match = STEP_LINE_RE.exec(content)) !== null) {
    const keyword = match[1];
    if (keyword === 'Given') {
      lastPrimary = 'given';
    } else if (keyword === 'When') {
      lastPrimary = 'when';
    } else if (keyword === 'Then') {
      lastPrimary = 'then';
    }
    // And/But inherit lastPrimary
    result[lastPrimary]++;
  }
  return result;
}

function enrichFeature(f: Feature): EnrichedFeature {
  return { ...f.toJSON(), scenario_count: Feature.countScenarios(f.content ?? '') };
}

function computeTotals(features: Feature[]): ListResult['totals'] {
  let scenarios = 0;
  let steps = 0;
  let givenSteps = 0;
  let whenSteps = 0;
  let thenSteps = 0;
  for (const f of features) {
    scenarios += Feature.countScenarios(f.content ?? '');
    steps += f.step_count;
    const counts = countStepsByKeyword(f.content);
    givenSteps += counts.given;
    whenSteps += counts.when;
    thenSteps += counts.then;
  }
  return {
    total_features: features.length,
    total_scenarios: scenarios,
    total_steps: steps,
    total_given_steps: givenSteps,
    total_when_steps: whenSteps,
    total_then_steps: thenSteps,
  };
}

/**
 * GetFeatureVersionScoped use case.
 *
 * Provides version-scoped retrieval of feature files:
 * - `executeList`: list features for a component+version with totals
 * - `executeSingle`: get one feature by component, version, and filename
 */
export class GetFeatureVersionScoped {
  private readonly featureRepo: IFeatureRepository;
  private readonly nodeRepo: INodeRepository;

  constructor({ featureRepo, nodeRepo }: Deps) {
    this.featureRepo = featureRepo;
    this.nodeRepo = nodeRepo;
  }

  async executeList(nodeId: string, version: string): Promise<ListResult> {
    const exists = await this.nodeRepo.exists(nodeId);
    if (!exists) {
      throw new NodeNotFoundError(nodeId);
    }
    const features = await this.featureRepo.findByNodeAndVersion(nodeId, version);
    return {
      features: features.map(enrichFeature),
      totals: computeTotals(features),
    };
  }

  async executeSingle(
    nodeId: string,
    version: string,
    filename: string
  ): Promise<{ feature: Feature; enriched: EnrichedFeature }> {
    const exists = await this.nodeRepo.exists(nodeId);
    if (!exists) {
      throw new NodeNotFoundError(nodeId);
    }
    const feature = await this.featureRepo.findByNodeVersionAndFilename(nodeId, version, filename);
    if (!feature) {
      throw new FeatureNotFoundError(nodeId, filename);
    }
    return { feature, enriched: enrichFeature(feature) };
  }
}
