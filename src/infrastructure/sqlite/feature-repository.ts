import type Database from 'better-sqlite3';

import type { IFeatureRepository } from '../../domain/index.js';
import { Feature } from '../../domain/index.js';

export class SqliteFeatureRepository implements IFeatureRepository {
  constructor(private readonly db: Database.Database) {}

  async findAll(): Promise<Feature[]> {
    const rows = this.db
      .prepare('SELECT * FROM features ORDER BY node_id, version, filename')
      .all();
    return rows.map(r => new Feature(r as ConstructorParameters<typeof Feature>[0]));
  }

  async findByNode(nodeId: string): Promise<Feature[]> {
    const rows = this.db
      .prepare('SELECT * FROM features WHERE node_id = ? ORDER BY version, filename')
      .all(nodeId);
    return rows.map(r => new Feature(r as ConstructorParameters<typeof Feature>[0]));
  }

  async findByNodeAndVersion(nodeId: string, version: string): Promise<Feature[]> {
    const rows = this.db
      .prepare('SELECT * FROM features WHERE node_id = ? AND version = ? ORDER BY filename')
      .all(nodeId, version);
    return rows.map(r => new Feature(r as ConstructorParameters<typeof Feature>[0]));
  }

  async save(feature: Feature): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO features (node_id, version, filename, title, content)
       VALUES (?, ?, ?, ?, ?)`
      )
      .run(feature.node_id, feature.version, feature.filename, feature.title, feature.content);
  }

  async deleteAll(): Promise<void> {
    this.db.prepare('DELETE FROM features').run();
  }

  async deleteByNode(nodeId: string): Promise<void> {
    this.db.prepare('DELETE FROM features WHERE node_id = ?').run(nodeId);
  }

  async deleteByNodeAndFilename(nodeId: string, filename: string): Promise<boolean> {
    const result = this.db
      .prepare('DELETE FROM features WHERE node_id = ? AND filename = ?')
      .run(nodeId, filename);
    return result.changes > 0;
  }
}
