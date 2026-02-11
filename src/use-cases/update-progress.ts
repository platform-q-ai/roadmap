import type {
  INodeRepository,
  IVersionRepository,
  VersionStatus,
  VersionTag,
} from '../domain/index.js';

interface Deps {
  versionRepo: IVersionRepository;
  nodeRepo: INodeRepository;
}

/**
 * UpdateProgress use case.
 *
 * Updates the progress percentage and status for a specific
 * node version. Used by CLI, API, and future MCP server.
 */
export class UpdateProgress {
  private readonly versionRepo: IVersionRepository;
  private readonly nodeRepo: INodeRepository;

  constructor({ versionRepo, nodeRepo }: Deps) {
    this.versionRepo = versionRepo;
    this.nodeRepo = nodeRepo;
  }

  async execute(
    nodeId: string,
    version: VersionTag,
    progress: number,
    status: VersionStatus
  ): Promise<void> {
    const node = await this.nodeRepo.findById(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    if (progress < 0 || progress > 100) {
      throw new Error(`Progress must be 0-100, got: ${progress}`);
    }

    const validStatuses: VersionStatus[] = ['planned', 'in-progress', 'complete'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Status must be one of ${validStatuses.join(', ')}, got: ${status}`);
    }

    await this.versionRepo.updateProgress(nodeId, version, progress, status);
  }
}
