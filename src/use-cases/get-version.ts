import type { IFeatureRepository, INodeRepository, IVersionRepository } from '../domain/index.js';
import { Version } from '../domain/index.js';

import { NodeNotFoundError, VersionNotFoundError } from './errors.js';
import type { VersionWithSteps } from './list-versions.js';

interface Deps {
  nodeRepo: INodeRepository;
  versionRepo: IVersionRepository;
  featureRepo: IFeatureRepository;
}

/**
 * GetVersion use case.
 *
 * Returns a single version for a component, enriching phase versions
 * (mvp, v1, v2) with step-based progress fields.
 */
export class GetVersion {
  private readonly nodeRepo: INodeRepository;
  private readonly versionRepo: IVersionRepository;
  private readonly featureRepo: IFeatureRepository;

  constructor({ nodeRepo, versionRepo, featureRepo }: Deps) {
    this.nodeRepo = nodeRepo;
    this.versionRepo = versionRepo;
    this.featureRepo = featureRepo;
  }

  async execute(nodeId: string, versionTag: string): Promise<VersionWithSteps> {
    const exists = await this.nodeRepo.exists(nodeId);
    if (!exists) {
      throw new NodeNotFoundError(nodeId);
    }

    const version = await this.versionRepo.findByNodeAndVersion(nodeId, versionTag);
    if (!version) {
      throw new VersionNotFoundError(nodeId, versionTag);
    }

    const result: VersionWithSteps = {
      node_id: version.node_id,
      version: version.version,
      content: version.content,
      progress: version.progress,
      status: version.status,
      updated_at: version.updated_at,
    };

    if (Version.isPhaseTag(versionTag)) {
      const summary = await this.featureRepo.getStepCountSummary(nodeId, versionTag);
      const passing = summary.passingSteps ?? summary.totalSteps;
      result.total_steps = summary.totalSteps;
      result.passing_steps = passing;
      result.step_progress =
        summary.totalSteps > 0 ? Math.round((passing / summary.totalSteps) * 100) : 0;
    }

    return result;
  }
}
