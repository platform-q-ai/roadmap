import type { INodeRepository, IVersionRepository, VersionStatus } from '../domain/index.js';
import { ValidationError } from '../domain/index.js';
import { Version } from '../domain/index.js';

import { NodeNotFoundError } from './errors.js';

export interface UpdateVersionInput {
  nodeId: string;
  version: string;
  content?: string;
  progress?: number;
  status?: string;
}

export interface UpdateVersionResult {
  node_id: string;
  version: string;
  content: string | null;
  progress: number;
  status: VersionStatus;
}

interface Deps {
  nodeRepo: INodeRepository;
  versionRepo: IVersionRepository;
}

function validateInput(input: UpdateVersionInput): void {
  if (input.content === undefined || input.content === null) {
    throw new ValidationError('content is required');
  }
  if (input.progress !== undefined && (input.progress < 0 || input.progress > 100)) {
    throw new ValidationError('progress must be between 0 and 100');
  }
  if (
    input.status !== undefined &&
    !(Version.STATUSES as readonly string[]).includes(input.status)
  ) {
    throw new ValidationError(
      `Invalid status: ${input.status}. Must be one of: ${Version.STATUSES.join(', ')}`
    );
  }
}

function buildResult(version: Version): UpdateVersionResult {
  return {
    node_id: version.node_id,
    version: version.version,
    content: version.content,
    progress: version.progress,
    status: version.status,
  };
}

/**
 * UpdateVersion use case.
 *
 * Updates or creates a version entry for a component.
 * Content is required (at least on the first call).
 * Progress and status are optional and preserve existing values when omitted.
 */
export class UpdateVersion {
  private readonly nodeRepo: INodeRepository;
  private readonly versionRepo: IVersionRepository;

  constructor({ nodeRepo, versionRepo }: Deps) {
    this.nodeRepo = nodeRepo;
    this.versionRepo = versionRepo;
  }

  async execute(input: UpdateVersionInput): Promise<UpdateVersionResult> {
    const exists = await this.nodeRepo.exists(input.nodeId);
    if (!exists) {
      throw new NodeNotFoundError(input.nodeId);
    }

    validateInput(input);

    const existing = await this.versionRepo.findByNodeAndVersion(input.nodeId, input.version);

    const version = new Version({
      node_id: input.nodeId,
      version: input.version,
      content: input.content ?? null,
      progress: input.progress ?? existing?.progress ?? 0,
      status: (input.status as VersionStatus | undefined) ?? existing?.status ?? 'planned',
    });

    await this.versionRepo.save(version);

    return buildResult(version);
  }
}
