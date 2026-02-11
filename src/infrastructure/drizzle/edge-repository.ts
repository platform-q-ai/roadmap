import { eq, ne, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import type { IEdgeRepository } from '../../domain/index.js';
import { Edge } from '../../domain/index.js';

import { edgesTable } from './schema.js';

export class DrizzleEdgeRepository implements IEdgeRepository {
  constructor(private readonly db: BetterSQLite3Database) {}

  async findAll(): Promise<Edge[]> {
    const rows = this.db.select().from(edgesTable).orderBy(edgesTable.id).all();
    return rows.map(r => new Edge(r as ConstructorParameters<typeof Edge>[0]));
  }

  async findBySource(sourceId: string): Promise<Edge[]> {
    const rows = this.db
      .select()
      .from(edgesTable)
      .where(eq(edgesTable.source_id, sourceId))
      .orderBy(edgesTable.id)
      .all();
    return rows.map(r => new Edge(r as ConstructorParameters<typeof Edge>[0]));
  }

  async findByTarget(targetId: string): Promise<Edge[]> {
    const rows = this.db
      .select()
      .from(edgesTable)
      .where(eq(edgesTable.target_id, targetId))
      .orderBy(edgesTable.id)
      .all();
    return rows.map(r => new Edge(r as ConstructorParameters<typeof Edge>[0]));
  }

  async findByType(type: string): Promise<Edge[]> {
    const rows = this.db
      .select()
      .from(edgesTable)
      .where(eq(edgesTable.type, type))
      .orderBy(edgesTable.id)
      .all();
    return rows.map(r => new Edge(r as ConstructorParameters<typeof Edge>[0]));
  }

  async findRelationships(): Promise<Edge[]> {
    const rows = this.db
      .select()
      .from(edgesTable)
      .where(ne(edgesTable.type, 'CONTAINS'))
      .orderBy(edgesTable.id)
      .all();
    return rows.map(r => new Edge(r as ConstructorParameters<typeof Edge>[0]));
  }

  async save(edge: Edge): Promise<void> {
    this.db
      .insert(edgesTable)
      .values({
        source_id: edge.source_id,
        target_id: edge.target_id,
        type: edge.type,
        label: edge.label,
        metadata: edge.metadata,
      })
      .onConflictDoUpdate({
        target: [edgesTable.source_id, edgesTable.target_id, edgesTable.type],
        set: {
          label: sql`excluded.label`,
          metadata: sql`excluded.metadata`,
        },
      })
      .run();
  }

  async delete(id: number): Promise<void> {
    this.db.delete(edgesTable).where(eq(edgesTable.id, id)).run();
  }
}
