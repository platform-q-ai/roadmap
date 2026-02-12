import { and, count, eq, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import type { IFeatureRepository, StepCountSummary } from '../../domain/index.js';
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

  async getStepCountSummary(nodeId: string, version: string): Promise<StepCountSummary> {
    const rows = this.db
      .select({
        totalSteps: sql<number>`COALESCE(SUM(${featuresTable.step_count}), 0)`,
        featureCount: count(),
      })
      .from(featuresTable)
      .where(and(eq(featuresTable.node_id, nodeId), eq(featuresTable.version, version)))
      .all();
    return rows[0] ?? { totalSteps: 0, featureCount: 0 };
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
        step_count: feature.step_count,
      })
      .run();
  }

  async saveMany(features: Feature[]): Promise<void> {
    if (features.length === 0) {
      return;
    }
    this.db
      .insert(featuresTable)
      .values(
        features.map(f => ({
          node_id: f.node_id,
          version: f.version,
          filename: f.filename,
          title: f.title,
          content: f.content,
          step_count: f.step_count,
        }))
      )
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
