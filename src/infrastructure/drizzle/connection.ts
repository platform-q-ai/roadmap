import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { edgesTable, featuresTable, nodesTable, nodeVersionsTable } from './schema.js';

/**
 * Create a Drizzle ORM connection backed by better-sqlite3.
 * Applies schema (CREATE TABLE IF NOT EXISTS) and enables WAL + foreign keys.
 */
export function createDrizzleConnection(dbPath: string): BetterSQLite3Database {
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite);

  // Apply schema — idempotent via IF NOT EXISTS
  db.run(sql`CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('layer', 'component', 'store', 'external', 'phase', 'app')),
    layer TEXT,
    color TEXT,
    icon TEXT,
    description TEXT,
    tags TEXT,
    sort_order INTEGER DEFAULT 0,
    current_version TEXT
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN (
      'CONTAINS', 'CONTROLS', 'DEPENDS_ON', 'READS_FROM', 'WRITES_TO',
      'DISPATCHES_TO', 'ESCALATES_TO', 'PROXIES', 'SANITISES', 'GATES', 'SEQUENCE'
    )),
    label TEXT,
    metadata TEXT,
    UNIQUE(source_id, target_id, type)
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS node_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    content TEXT,
    progress INTEGER DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
    status TEXT DEFAULT 'planned' CHECK(status IN ('planned', 'in-progress', 'complete')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(node_id, version)
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS features (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    filename TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  // Indexes
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(type)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_versions_node ON node_versions(node_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_features_node ON features(node_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_features_version ON features(node_id, version)`);

  return db;
}

// Re-export table references for convenient use
export { edgesTable, featuresTable, nodesTable, nodeVersionsTable };
