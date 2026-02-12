import type { Feature, IFeatureRepository, INodeRepository } from '../domain/index.js';

import { FeatureNotFoundError, NodeNotFoundError } from './errors.js';

interface Deps {
  featureRepo: IFeatureRepository;
  nodeRepo: INodeRepository;
}

interface ListResult {
  features: Feature[];
  totals: {
    total_features: number;
    total_scenarios: number;
    total_steps: number;
    total_given_steps: number;
    total_when_steps: number;
    total_then_steps: number;
  };
}

function countScenarios(content: string | null): number {
  if (!content) return 0;
  return (content.match(/^\s*Scenario(?:\s+Outline)?:/gm) ?? []).length;
}

function countByKeyword(content: string | null, keywords: string[]): number {
  if (!content) return 0;
  const pattern = new RegExp(`^\\s*(${keywords.join('|')})\\s+`, 'gm');
  return (content.match(pattern) ?? []).length;
}

function computeTotals(features: Feature[]): ListResult['totals'] {
  let scenarios = 0;
  let steps = 0;
  let givenSteps = 0;
  let whenSteps = 0;
  let thenSteps = 0;
  for (const f of features) {
    scenarios += countScenarios(f.content);
    steps += f.step_count;
    givenSteps += countByKeyword(f.content, ['Given', 'And']);
    whenSteps += countByKeyword(f.content, ['When']);
    thenSteps += countByKeyword(f.content, ['Then', 'But']);
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
    return { features, totals: computeTotals(features) };
  }

  async executeSingle(nodeId: string, version: string, filename: string): Promise<Feature> {
    const exists = await this.nodeRepo.exists(nodeId);
    if (!exists) {
      throw new NodeNotFoundError(nodeId);
    }
    const features = await this.featureRepo.findByNodeAndVersion(nodeId, version);
    const feature = features.find(f => f.filename === filename);
    if (!feature) {
      throw new FeatureNotFoundError(nodeId, filename);
    }
    return feature;
  }
}
