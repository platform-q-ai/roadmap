import type Database from 'better-sqlite3';

import type { INodeRepository } from '../../domain/index.js';
import { Node } from '../../domain/index.js';

export class SqliteNodeRepository implements INodeRepository {
  constructor(private readonly db: Database.Database) {}

  async findAll(): Promise<Node[]> {
    const rows = this.db.prepare('SELECT * FROM nodes ORDER BY sort_order').all();
    return rows.map(r => new Node(r as ConstructorParameters<typeof Node>[0]));
  }

  async findById(id: string): Promise<Node | null> {
    const row = this.db.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
    return row ? new Node(row as ConstructorParameters<typeof Node>[0]) : null;
  }

  async findByType(type: string): Promise<Node[]> {
    const rows = this.db
      .prepare('SELECT * FROM nodes WHERE type = ? ORDER BY sort_order')
      .all(type);
    return rows.map(r => new Node(r as ConstructorParameters<typeof Node>[0]));
  }

  async findByLayer(layerId: string): Promise<Node[]> {
    const rows = this.db
      .prepare('SELECT * FROM nodes WHERE layer = ? ORDER BY sort_order')
      .all(layerId);
    return rows.map(r => new Node(r as ConstructorParameters<typeof Node>[0]));
  }

  async exists(id: string): Promise<boolean> {
    const row = this.db.prepare('SELECT 1 FROM nodes WHERE id = ?').get(id);
    return !!row;
  }

  async save(node: Node): Promise<void> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO nodes (id, name, type, layer, color, icon, description, tags, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        node.id,
        node.name,
        node.type,
        node.layer,
        node.color,
        node.icon,
        node.description,
        node.tagsJson(),
        node.sort_order
      );
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM nodes WHERE id = ?').run(id);
  }
}
