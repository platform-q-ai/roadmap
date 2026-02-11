import type Database from 'better-sqlite3';

import type { VersionStatus, VersionTag } from '../../domain/entities/version.js';
import { Version } from '../../domain/entities/version.js';
import type { IVersionRepository } from '../../domain/repositories/version-repository.js';

export class SqliteVersionRepository implements IVersionRepository {
  constructor(private readonly db: Database.Database) {}

  async findAll(): Promise<Version[]> {
    const rows = this.db.prepare('SELECT * FROM node_versions ORDER BY node_id, version').all();
    return rows.map(r => new Version(r as ConstructorParameters<typeof Version>[0]));
  }

  async findByNode(nodeId: string): Promise<Version[]> {
    const rows = this.db
      .prepare('SELECT * FROM node_versions WHERE node_id = ? ORDER BY version')
      .all(nodeId);
    return rows.map(r => new Version(r as ConstructorParameters<typeof Version>[0]));
  }

  async findByNodeAndVersion(nodeId: string, version: VersionTag): Promise<Version | null> {
    const row = this.db
      .prepare('SELECT * FROM node_versions WHERE node_id = ? AND version = ?')
      .get(nodeId, version);
    return row ? new Version(row as ConstructorParameters<typeof Version>[0]) : null;
  }

  async save(version: Version): Promise<void> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO node_versions (node_id, version, content, progress, status, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(version.node_id, version.version, version.content, version.progress, version.status);
  }

  async updateProgress(
    nodeId: string,
    version: VersionTag,
    progress: number,
    status: VersionStatus
  ): Promise<void> {
    this.db
      .prepare(
        `UPDATE node_versions SET progress = ?, status = ?, updated_at = datetime('now')
       WHERE node_id = ? AND version = ?`
      )
      .run(progress, status, nodeId, version);
  }

  async deleteByNode(nodeId: string): Promise<void> {
    this.db.prepare('DELETE FROM node_versions WHERE node_id = ?').run(nodeId);
  }
}
