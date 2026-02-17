import type { INodeRepository, IVersionRepository } from '../domain/index.js';
import { Node, Version } from '../domain/index.js';

import { ValidationError } from '../domain/errors.js';
import { NodeNotFoundError } from './errors.js';

export interface UpdateComponentInput {
  name?: string;
  description?: string;
  tags?: string[];
  sort_order?: number;
  current_version?: string;
}

interface Deps {
  nodeRepo: INodeRepository;
  versionRepo: IVersionRepository;
}

const SEMVER_RE = /^\d+\.\d+(\.\d+)?$/;

/**
 * UpdateComponent use case.
 *
 * Partially updates an existing component node (merge-patch semantics).
 * Only the supplied fields are changed; unmentioned fields are preserved.
 * When current_version changes, all phase version records are recalculated.
 */
export class UpdateComponent {
  private readonly nodeRepo: INodeRepository;
  private readonly versionRepo: IVersionRepository;

  constructor({ nodeRepo, versionRepo }: Deps) {
    this.nodeRepo = nodeRepo;
    this.versionRepo = versionRepo;
  }

  async execute(id: string, input: UpdateComponentInput): Promise<Node> {
    const existing = await this.nodeRepo.findById(id);
    if (!existing) {
      throw new NodeNotFoundError(id);
    }

    if (input.current_version !== undefined && !SEMVER_RE.test(input.current_version)) {
      throw new ValidationError(`Invalid version format: ${input.current_version}`);
    }

    const merged = new Node({
      id: existing.id,
      name: input.name ?? existing.name,
      type: existing.type,
      layer: existing.layer,
      color: existing.color,
      icon: existing.icon,
      description: input.description ?? existing.description,
      tags: input.tags ?? existing.tags,
      sort_order: input.sort_order ?? existing.sort_order,
      current_version: input.current_version ?? existing.current_version,
    });

    await this.nodeRepo.save(merged);

    if (input.current_version !== undefined) {
      await this.recalculateVersionProgress(id, input.current_version);
    }

    return merged;
  }

  private async recalculateVersionProgress(nodeId: string, currentVersion: string): Promise<void> {
    const versions = await this.versionRepo.findByNode(nodeId);

    for (const ver of versions) {
      if (!Version.isPhaseTag(ver.version)) {
        continue;
      }
      const progress = Version.deriveProgress(currentVersion, ver.version);
      const status = Version.deriveStatus(progress);
      const updated = new Version({
        id: ver.id,
        node_id: ver.node_id,
        version: ver.version,
        content: ver.content,
        progress,
        status,
        updated_at: ver.updated_at,
      });
      await this.versionRepo.save(updated);
    }
  }
}
