import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';
import Database from 'better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { applySchema } from '../../src/infrastructure/drizzle/connection.js';

interface SchemaWorld {
  sqlite: InstanceType<typeof Database>;
  db: BetterSQLite3Database;
  retrievedPosition: { component_id: string; x: number; y: number } | undefined;
  secondApplyError: Error | null;
  [key: string]: unknown;
}

function ensureWorld(world: SchemaWorld): void {
  if (!world.db) {
    world.sqlite = new Database(':memory:');
    world.sqlite.pragma('journal_mode = WAL');
    world.sqlite.pragma('foreign_keys = ON');
    world.db = drizzle(world.sqlite) as unknown as BetterSQLite3Database;
    applySchema(world.db);
  }
}

// ─── Given ───────────────────────────────────────────────────────────

Given('a fresh database connection with schema applied', function (this: SchemaWorld) {
  ensureWorld(this);
});

Given('a node {string} exists in the database', function (this: SchemaWorld, nodeId: string) {
  ensureWorld(this);
  this.sqlite
    .prepare("INSERT OR IGNORE INTO nodes (id, name, type) VALUES (?, ?, 'app')")
    .run(nodeId, nodeId);
});

Given(
  'a saved position for {string} at x {int} and y {int}',
  function (this: SchemaWorld, componentId: string, x: number, y: number) {
    ensureWorld(this);
    this.sqlite
      .prepare('INSERT INTO component_positions (component_id, x, y) VALUES (?, ?, ?)')
      .run(componentId, x, y);
  }
);

// ─── When ────────────────────────────────────────────────────────────

When(
  'I insert a position for {string} at x {float} and y {float}',
  function (this: SchemaWorld, componentId: string, x: number, y: number) {
    ensureWorld(this);
    this.sqlite
      .prepare('INSERT INTO component_positions (component_id, x, y) VALUES (?, ?, ?)')
      .run(componentId, x, y);
  }
);

When('I delete the node {string}', function (this: SchemaWorld, nodeId: string) {
  ensureWorld(this);
  this.sqlite.prepare('DELETE FROM nodes WHERE id = ?').run(nodeId);
});

When('applySchema is called a second time on the same database', function (this: SchemaWorld) {
  ensureWorld(this);
  this.secondApplyError = null;
  try {
    applySchema(this.db);
  } catch (e) {
    this.secondApplyError = e instanceof Error ? e : new Error(String(e));
  }
});

// ─── Then ────────────────────────────────────────────────────────────

Then('the component_positions table should exist', function (this: SchemaWorld) {
  ensureWorld(this);
  const row = this.sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='component_positions'")
    .get() as { name: string } | undefined;
  assert.ok(row, 'component_positions table does not exist');
  assert.strictEqual(row.name, 'component_positions');
});

Then(
  'the component_positions table should have columns:',
  function (
    this: SchemaWorld,
    dataTable: { hashes: () => Array<{ column: string; type: string }> }
  ) {
    ensureWorld(this);
    const columns = this.sqlite.prepare('PRAGMA table_info(component_positions)').all() as Array<{
      name: string;
      type: string;
    }>;
    const columnMap = new Map(columns.map(c => [c.name, c.type]));

    for (const row of dataTable.hashes()) {
      assert.ok(
        columnMap.has(row.column),
        `Missing column: ${row.column}. Found: ${[...columnMap.keys()].join(', ')}`
      );
      assert.strictEqual(
        columnMap.get(row.column),
        row.type,
        `Column ${row.column} has type ${columnMap.get(row.column)}, expected ${row.type}`
      );
    }
  }
);

Then('I can retrieve the position for {string}', function (this: SchemaWorld, componentId: string) {
  ensureWorld(this);
  this.retrievedPosition = this.sqlite
    .prepare('SELECT component_id, x, y FROM component_positions WHERE component_id = ?')
    .get(componentId) as { component_id: string; x: number; y: number } | undefined;
  assert.ok(this.retrievedPosition, `No position found for ${componentId}`);
});

Then(
  'the retrieved position has x {float} and y {float}',
  function (this: SchemaWorld, x: number, y: number) {
    assert.ok(this.retrievedPosition, 'No retrieved position available');
    assert.strictEqual(
      this.retrievedPosition.x,
      x,
      `Expected x=${x}, got x=${this.retrievedPosition.x}`
    );
    assert.strictEqual(
      this.retrievedPosition.y,
      y,
      `Expected y=${y}, got y=${this.retrievedPosition.y}`
    );
  }
);

Then(
  'the position for {string} should not exist',
  function (this: SchemaWorld, componentId: string) {
    ensureWorld(this);
    const row = this.sqlite
      .prepare('SELECT component_id FROM component_positions WHERE component_id = ?')
      .get(componentId);
    assert.strictEqual(
      row,
      undefined,
      `Position for ${componentId} should have been cascade-deleted`
    );
  }
);

Then('no error is raised', function (this: SchemaWorld) {
  assert.strictEqual(
    this.secondApplyError,
    null,
    `applySchema raised: ${this.secondApplyError?.message}`
  );
});
