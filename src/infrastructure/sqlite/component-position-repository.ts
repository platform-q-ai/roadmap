import type { Database } from 'better-sqlite3';

import {
  type ComponentPosition,
  createComponentPosition,
} from '../../domain/entities/component-position.js';
import type { ComponentPositionRepository } from '../../domain/repositories/component-position-repository.js';

export class SqliteComponentPositionRepository implements ComponentPositionRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
    this.initializeTable();
  }

  private initializeTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS component_positions (
        component_id TEXT PRIMARY KEY,
        x REAL NOT NULL,
        y REAL NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  findByComponentId(componentId: string): ComponentPosition | null {
    const row = this.db
      .prepare('SELECT component_id, x, y FROM component_positions WHERE component_id = ?')
      .get(componentId) as { component_id: string; x: number; y: number } | undefined;

    if (!row) {
      return null;
    }

    return createComponentPosition({
      componentId: row.component_id,
      x: row.x,
      y: row.y,
    });
  }

  findAll(): ComponentPosition[] {
    const rows = this.db
      .prepare('SELECT component_id, x, y FROM component_positions')
      .all() as Array<{ component_id: string; x: number; y: number }>;

    return rows.map(row =>
      createComponentPosition({
        componentId: row.component_id,
        x: row.x,
        y: row.y,
      })
    );
  }

  save(position: ComponentPosition): ComponentPosition {
    this.db
      .prepare(
        `
        INSERT INTO component_positions (component_id, x, y, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(component_id) DO UPDATE SET
          x = excluded.x,
          y = excluded.y,
          updated_at = excluded.updated_at
      `
      )
      .run(position.componentId, position.x, position.y);

    return position;
  }

  delete(componentId: string): void {
    this.db.prepare('DELETE FROM component_positions WHERE component_id = ?').run(componentId);
  }
}
