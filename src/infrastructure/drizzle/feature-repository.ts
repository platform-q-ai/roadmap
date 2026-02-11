import { and, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import type { IFeatureRepository } from '../../domain/index.js';
import { Feature } from '../../domain/index.js';

import { featuresTable } from './schema.js';

export class DrizzleFeatureRepository implements IFeatureRepository {
  constructor(private readonly db: BetterSQLite3Database) {}

  async findAll(): Promise<Feature[]> {
    const rows = this.db
      .select()
      .from(featuresTable)
      .orderBy(featuresTable.node_id, featuresTable.version, featuresTable.filename)
      .all();
    return rows.map(r => new Feature(r as ConstructorParameters<typeof Feature>[0]));
  }

  async findByNode(nodeId: string): Promise<Feature[]> {
    const rows = this.db
      .select()
      .from(featuresTable)
      .where(eq(featuresTable.node_id, nodeId))
      .orderBy(featuresTable.version, featuresTable.filename)
      .all();
    return rows.map(r => new Feature(r as ConstructorParameters<typeof Feature>[0]));
  }

  async findByNodeAndVersion(nodeId: string, version: string): Promise<Feature[]> {
    const rows = this.db
      .select()
      .from(featuresTable)
      .where(and(eq(featuresTable.node_id, nodeId), eq(featuresTable.version, version)))
      .orderBy(featuresTable.filename)
      .all();
    return rows.map(r => new Feature(r as ConstructorParameters<typeof Feature>[0]));
  }

  async save(feature: Feature): Promise<void> {
    this.db
      .insert(featuresTable)
      .values({
        node_id: feature.node_id,
        version: feature.version,
        filename: feature.filename,
        title: feature.title,
        content: feature.content,
      })
      .run();
  }

  async deleteAll(): Promise<void> {
    this.db.delete(featuresTable).run();
  }

  async deleteByNode(nodeId: string): Promise<void> {
    this.db.delete(featuresTable).where(eq(featuresTable.node_id, nodeId)).run();
  }

  async deleteByNodeAndFilename(nodeId: string, filename: string): Promise<boolean> {
    const result = this.db
      .delete(featuresTable)
      .where(and(eq(featuresTable.node_id, nodeId), eq(featuresTable.filename, filename)))
      .run();
    return result.changes > 0;
  }
}
