import Database from 'better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';

import { applySchema } from '../../../../src/infrastructure/drizzle/connection.js';

describe('applySchema — component_positions table', () => {
  let sqlite: InstanceType<typeof Database>;
  let db: BetterSQLite3Database;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite) as unknown as BetterSQLite3Database;
    applySchema(db);
  });

  it('should create the component_positions table', () => {
    const row = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='component_positions'")
      .get() as { name: string } | undefined;
    expect(row).toBeDefined();
    expect(row?.name).toBe('component_positions');
  });

  it('should have component_id as TEXT PRIMARY KEY', () => {
    const columns = sqlite.prepare('PRAGMA table_info(component_positions)').all() as Array<{
      name: string;
      type: string;
      pk: number;
    }>;
    const pkCol = columns.find(c => c.name === 'component_id');
    expect(pkCol).toBeDefined();
    expect(pkCol?.type).toBe('TEXT');
    expect(pkCol?.pk).toBe(1);
  });

  it('should have x and y as REAL NOT NULL', () => {
    const columns = sqlite.prepare('PRAGMA table_info(component_positions)').all() as Array<{
      name: string;
      type: string;
      notnull: number;
    }>;
    const xCol = columns.find(c => c.name === 'x');
    const yCol = columns.find(c => c.name === 'y');
    expect(xCol?.type).toBe('REAL');
    expect(xCol?.notnull).toBe(1);
    expect(yCol?.type).toBe('REAL');
    expect(yCol?.notnull).toBe(1);
  });

  it('should have updated_at column', () => {
    const columns = sqlite.prepare('PRAGMA table_info(component_positions)').all() as Array<{
      name: string;
      type: string;
    }>;
    const col = columns.find(c => c.name === 'updated_at');
    expect(col).toBeDefined();
    expect(col?.type).toBe('TEXT');
  });

  it('should cascade delete positions when parent node is deleted', () => {
    sqlite.prepare("INSERT INTO nodes (id, name, type) VALUES ('n1', 'N1', 'app')").run();
    sqlite
      .prepare("INSERT INTO component_positions (component_id, x, y) VALUES ('n1', 10, 20)")
      .run();

    // Delete parent node
    sqlite.prepare("DELETE FROM nodes WHERE id = 'n1'").run();

    const row = sqlite
      .prepare("SELECT component_id FROM component_positions WHERE component_id = 'n1'")
      .get();
    expect(row).toBeUndefined();
  });

  it('should be idempotent (calling applySchema twice does not error)', () => {
    expect(() => applySchema(db)).not.toThrow();

    // Table still exists and works
    const row = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='component_positions'")
      .get() as { name: string } | undefined;
    expect(row?.name).toBe('component_positions');
  });

  it('should support UPSERT on component_positions', () => {
    sqlite.prepare("INSERT INTO nodes (id, name, type) VALUES ('n2', 'N2', 'app')").run();
    sqlite
      .prepare("INSERT INTO component_positions (component_id, x, y) VALUES ('n2', 10, 20)")
      .run();

    // UPSERT
    sqlite
      .prepare(
        `
      INSERT INTO component_positions (component_id, x, y, updated_at)
      VALUES ('n2', 30, 40, datetime('now'))
      ON CONFLICT(component_id) DO UPDATE SET
        x = excluded.x,
        y = excluded.y,
        updated_at = excluded.updated_at
    `
      )
      .run();

    const row = sqlite
      .prepare("SELECT x, y FROM component_positions WHERE component_id = 'n2'")
      .get() as { x: number; y: number };
    expect(row.x).toBe(30);
    expect(row.y).toBe(40);
  });
});
