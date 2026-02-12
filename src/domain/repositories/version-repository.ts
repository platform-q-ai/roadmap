import type { Version, VersionTag } from '../entities/index.js';

export interface IVersionRepository {
  findAll(): Promise<Version[]>;
  findByNode(nodeId: string): Promise<Version[]>;
  findByNodeAndVersion(nodeId: string, version: VersionTag): Promise<Version | null>;
  save(version: Version): Promise<void>;
  deleteByNode(nodeId: string): Promise<void>;
}
