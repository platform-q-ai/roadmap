import type Database from 'better-sqlite3';

import type { IEdgeRepository } from '../../domain/index.js';
import { Edge } from '../../domain/index.js';

export class SqliteEdgeRepository implements IEdgeRepository {
  constructor(private readonly db: Database.Database) {}

  async findAll(): Promise<Edge[]> {
    const rows = this.db.prepare('SELECT * FROM edges ORDER BY id').all();
    return rows.map(r => new Edge(r as ConstructorParameters<typeof Edge>[0]));
  }

  async findById(id: number): Promise<Edge | null> {
    const row = this.db.prepare('SELECT * FROM edges WHERE id = ?').get(id);
    if (!row) {
      return null;
    }
    return new Edge(row as ConstructorParameters<typeof Edge>[0]);
  }

  async findBySource(sourceId: string): Promise<Edge[]> {
    const rows = this.db
      .prepare('SELECT * FROM edges WHERE source_id = ? ORDER BY id')
      .all(sourceId);
    return rows.map(r => new Edge(r as ConstructorParameters<typeof Edge>[0]));
  }

  async findByTarget(targetId: string): Promise<Edge[]> {
    const rows = this.db
      .prepare('SELECT * FROM edges WHERE target_id = ? ORDER BY id')
      .all(targetId);
    return rows.map(r => new Edge(r as ConstructorParameters<typeof Edge>[0]));
  }

  async findByType(type: string): Promise<Edge[]> {
    const rows = this.db.prepare('SELECT * FROM edges WHERE type = ? ORDER BY id').all(type);
    return rows.map(r => new Edge(r as ConstructorParameters<typeof Edge>[0]));
  }

  async findRelationships(): Promise<Edge[]> {
    const rows = this.db.prepare("SELECT * FROM edges WHERE type != 'CONTAINS' ORDER BY id").all();
    return rows.map(r => new Edge(r as ConstructorParameters<typeof Edge>[0]));
  }

  async existsBySrcTgtType(sourceId: string, targetId: string, type: string): Promise<boolean> {
    const row = this.db
      .prepare('SELECT 1 FROM edges WHERE source_id = ? AND target_id = ? AND type = ?')
      .get(sourceId, targetId, type);
    return row !== undefined;
  }

  async save(edge: Edge): Promise<Edge> {
    const result = this.db
      .prepare(
        `INSERT OR REPLACE INTO edges (source_id, target_id, type, label, metadata)
       VALUES (?, ?, ?, ?, ?)`
      )
      .run(edge.source_id, edge.target_id, edge.type, edge.label, edge.metadata);
    return new Edge({
      id: Number(result.lastInsertRowid),
      source_id: edge.source_id,
      target_id: edge.target_id,
      type: edge.type,
      label: edge.label,
      metadata: edge.metadata,
    });
  }

  async delete(id: number): Promise<void> {
    this.db.prepare('DELETE FROM edges WHERE id = ?').run(id);
  }
}
