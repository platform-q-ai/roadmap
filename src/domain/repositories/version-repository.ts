import type { Version, VersionStatus, VersionTag } from '../entities/version.js';

export interface IVersionRepository {
  findAll(): Promise<Version[]>;
  findByNode(nodeId: string): Promise<Version[]>;
  findByNodeAndVersion(nodeId: string, version: VersionTag): Promise<Version | null>;
  save(version: Version): Promise<void>;
  updateProgress(
    nodeId: string,
    version: VersionTag,
    progress: number,
    status: VersionStatus
  ): Promise<void>;
  deleteByNode(nodeId: string): Promise<void>;
}
