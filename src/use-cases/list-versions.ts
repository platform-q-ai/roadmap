import type { IFeatureRepository, INodeRepository, IVersionRepository } from '../domain/index.js';
import { Version } from '../domain/index.js';

import { NodeNotFoundError } from './errors.js';

export interface VersionWithSteps {
  node_id: string;
  version: string;
  content: string | null;
  progress: number;
  status: string;
  updated_at: string | null;
  total_steps?: number;
  passing_steps?: number;
  step_progress?: number;
}

interface Deps {
  nodeRepo: INodeRepository;
  versionRepo: IVersionRepository;
  featureRepo: IFeatureRepository;
}

/**
 * ListVersions use case.
 *
 * Returns all versions for a component, enriching phase versions
 * (mvp, v1, v2) with step-based progress fields.
 */
export class ListVersions {
  private readonly nodeRepo: INodeRepository;
  private readonly versionRepo: IVersionRepository;
  private readonly featureRepo: IFeatureRepository;

  constructor({ nodeRepo, versionRepo, featureRepo }: Deps) {
    this.nodeRepo = nodeRepo;
    this.versionRepo = versionRepo;
    this.featureRepo = featureRepo;
  }

  async execute(nodeId: string): Promise<VersionWithSteps[]> {
    const exists = await this.nodeRepo.exists(nodeId);
    if (!exists) {
      throw new NodeNotFoundError(nodeId);
    }

    const versions = await this.versionRepo.findByNode(nodeId);
    const results: VersionWithSteps[] = [];

    for (const v of versions) {
      const base: VersionWithSteps = {
        node_id: v.node_id,
        version: v.version,
        content: v.content,
        progress: v.progress,
        status: v.status,
        updated_at: v.updated_at,
      };

      if (Version.isPhaseTag(v.version)) {
        const summary = await this.featureRepo.getStepCountSummary(nodeId, v.version);
        const passing = summary.passingSteps ?? summary.totalSteps;
        base.total_steps = summary.totalSteps;
        base.passing_steps = passing;
        base.step_progress =
          summary.totalSteps > 0 ? Math.round((passing / summary.totalSteps) * 100) : 0;
      }

      results.push(base);
    }

    return results;
  }
}
