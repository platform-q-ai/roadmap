import type Database from 'better-sqlite3';

import type { IFeatureRepository, StepCountSummary } from '../../domain/index.js';
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

  async findByNodeVersionAndFilename(
    nodeId: string,
    version: string,
    filename: string
  ): Promise<Feature | null> {
    const row = this.db
      .prepare('SELECT * FROM features WHERE node_id = ? AND version = ? AND filename = ? LIMIT 1')
      .get(nodeId, version, filename);
    return row ? new Feature(row as ConstructorParameters<typeof Feature>[0]) : null;
  }

  async getStepCountSummary(nodeId: string, version: string): Promise<StepCountSummary> {
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(step_count), 0) AS totalSteps,
                COUNT(*) AS featureCount
         FROM features
         WHERE node_id = ? AND version = ?`
      )
      .get(nodeId, version) as StepCountSummary;
    return row;
  }

  async save(feature: Feature): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO features (node_id, version, filename, title, content, step_count)
       VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        feature.node_id,
        feature.version,
        feature.filename,
        feature.title,
        feature.content,
        feature.step_count
      );
  }

  async saveMany(features: Feature[]): Promise<void> {
    const insert = this.db.prepare(
      `INSERT INTO features (node_id, version, filename, title, content, step_count)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const runAll = this.db.transaction((items: Feature[]) => {
      for (const f of items) {
        insert.run(f.node_id, f.version, f.filename, f.title, f.content, f.step_count);
      }
    });
    runAll(features);
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

  async deleteByNodeAndVersionAndFilename(
    nodeId: string,
    version: string,
    filename: string
  ): Promise<boolean> {
    const result = this.db
      .prepare('DELETE FROM features WHERE node_id = ? AND version = ? AND filename = ?')
      .run(nodeId, version, filename);
    return result.changes > 0;
  }

  async deleteByNodeAndVersion(nodeId: string, version: string): Promise<number> {
    const result = this.db
      .prepare('DELETE FROM features WHERE node_id = ? AND version = ?')
      .run(nodeId, version);
    return result.changes;
  }

  async search(query: string, version?: string): Promise<Feature[]> {
    const pattern = `%${query.toLowerCase()}%`;
    if (version) {
      const rows = this.db
        .prepare(
          `SELECT * FROM features
           WHERE LOWER(content) LIKE ? AND version = ?
           ORDER BY node_id, filename`
        )
        .all(pattern, version);
      return rows.map(r => new Feature(r as ConstructorParameters<typeof Feature>[0]));
    }
    const rows = this.db
      .prepare(
        `SELECT * FROM features
         WHERE LOWER(content) LIKE ?
         ORDER BY node_id, filename`
      )
      .all(pattern);
    return rows.map(r => new Feature(r as ConstructorParameters<typeof Feature>[0]));
  }
}
