import { accessSync, constants, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

/**
 * Apply the database schema (CREATE TABLE IF NOT EXISTS) and indexes.
 *
 * Drizzle ORM does not provide a runtime CREATE TABLE API, so raw SQL
 * is necessary here. The definitions mirror schema.sql and schema.ts.
 * For file-backed databases, the build:db script applies schema.sql
 * first; this function ensures in-memory databases (tests) also work.
 */
export function applySchema(db: BetterSQLite3Database): void {
  db.run(sql`CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('layer', 'component', 'store', 'external', 'phase', 'app', 'mcp')),
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
    step_count INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    scopes TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT,
    last_used_at TEXT,
    is_active INTEGER NOT NULL DEFAULT 1
  )`);

  // ─── Migration: add 'mcp' to nodes.type CHECK constraint ─────────
  // SQLite doesn't support ALTER TABLE to modify CHECK constraints.
  // Detect the old constraint and recreate the table if needed.
  const tableInfo = db.all<{ sql: string }>(
    sql`SELECT sql FROM sqlite_master WHERE type='table' AND name='nodes'`
  );
  const createSql = tableInfo[0]?.sql ?? '';
  if (createSql.includes("'app')") && !createSql.includes("'mcp'")) {
    db.run(sql`CREATE TABLE nodes_new (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('layer', 'component', 'store', 'external', 'phase', 'app', 'mcp')),
      layer TEXT,
      color TEXT,
      icon TEXT,
      description TEXT,
      tags TEXT,
      sort_order INTEGER DEFAULT 0,
      current_version TEXT
    )`);
    db.run(
      sql`INSERT INTO nodes_new SELECT id, name, type, layer, color, icon, description, tags, sort_order, current_version FROM nodes`
    );
    db.run(sql`DROP TABLE nodes`);
    db.run(sql`ALTER TABLE nodes_new RENAME TO nodes`);
  }

  db.run(sql`CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(type)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_versions_node ON node_versions(node_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_features_node ON features(node_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_features_version ON features(node_id, version)`);
  db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_name ON api_keys(name)`);
}

/**
 * Ensure the parent directory for the database file exists and is writable.
 * Handles three scenarios:
 *   1. Directory exists and is writable → no-op
 *   2. Directory does not exist → create recursively
 *   3. Directory cannot be created (EACCES) → throw with actionable message
 */
function ensureDbDirectory(dbPath: string): void {
  const dir = dirname(dbPath);

  if (existsSync(dir)) {
    try {
      accessSync(dir, constants.W_OK);
      return;
    } catch {
      throw new Error(
        `Database directory "${dir}" exists but is not writable by the current user. ` +
          `Set DB_PATH to a writable location (e.g. DB_PATH=/data/architecture.db) ` +
          `or fix permissions on "${dir}".`
      );
    }
  }

  try {
    mkdirSync(dir, { recursive: true });
  } catch (err: unknown) {
    const code =
      err instanceof Error && 'code' in err ? (err as NodeJS.ErrnoException).code : 'UNKNOWN';
    throw new Error(
      `Cannot create database directory "${dir}" (${code}). ` +
        `Set DB_PATH to a writable location (e.g. DB_PATH=/data/architecture.db) ` +
        `or ensure the parent directory is writable.`
    );
  }
}

/**
 * Create a Drizzle ORM connection backed by better-sqlite3.
 * Enables WAL mode + foreign keys and applies schema.
 */
export function createDrizzleConnection(dbPath: string): BetterSQLite3Database {
  ensureDbDirectory(dbPath);
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite);
  applySchema(db);

  return db;
}
