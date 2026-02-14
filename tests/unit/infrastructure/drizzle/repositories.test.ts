import { Edge, Feature, Node, Version } from '@domain/index.js';
import {
  createDrizzleConnection,
  DrizzleEdgeRepository,
  DrizzleFeatureRepository,
  DrizzleNodeRepository,
  DrizzleVersionRepository,
  nodeVersionsTable,
} from '@infrastructure/drizzle/index.js';
import { sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Drizzle Repositories', () => {
  let db: BetterSQLite3Database;
  let nodeRepo: DrizzleNodeRepository;
  let edgeRepo: DrizzleEdgeRepository;
  let versionRepo: DrizzleVersionRepository;
  let featureRepo: DrizzleFeatureRepository;

  beforeEach(() => {
    db = createDrizzleConnection(':memory:');
    nodeRepo = new DrizzleNodeRepository(db);
    edgeRepo = new DrizzleEdgeRepository(db);
    versionRepo = new DrizzleVersionRepository(db);
    featureRepo = new DrizzleFeatureRepository(db);
  });

  afterEach(() => {
    // Drizzle doesn't expose close directly, but the underlying driver handles it
  });

  describe('DrizzleNodeRepository', () => {
    it('saves and retrieves a node by id', async () => {
      await nodeRepo.save(new Node({ id: 'comp-1', name: 'Comp', type: 'component' }));
      const found = await nodeRepo.findById('comp-1');
      expect(found).not.toBeNull();
      expect(found?.name).toBe('Comp');
    });

    it('returns null for missing node', async () => {
      const found = await nodeRepo.findById('missing');
      expect(found).toBeNull();
    });

    it('finds nodes by type', async () => {
      await nodeRepo.save(new Node({ id: 'c1', name: 'C1', type: 'component' }));
      await nodeRepo.save(new Node({ id: 'l1', name: 'L1', type: 'layer' }));
      const components = await nodeRepo.findByType('component');
      expect(components).toHaveLength(1);
      expect(components[0].id).toBe('c1');
    });

    it('finds nodes by layer', async () => {
      await nodeRepo.save(new Node({ id: 'c1', name: 'C1', type: 'component', layer: 'layer-a' }));
      await nodeRepo.save(new Node({ id: 'c2', name: 'C2', type: 'component', layer: 'layer-b' }));
      const found = await nodeRepo.findByLayer('layer-a');
      expect(found).toHaveLength(1);
    });

    it('checks existence', async () => {
      await nodeRepo.save(new Node({ id: 'comp-1', name: 'C', type: 'component' }));
      expect(await nodeRepo.exists('comp-1')).toBe(true);
      expect(await nodeRepo.exists('missing')).toBe(false);
    });

    it('deletes a node', async () => {
      await nodeRepo.save(new Node({ id: 'comp-1', name: 'C', type: 'component' }));
      await nodeRepo.delete('comp-1');
      expect(await nodeRepo.findById('comp-1')).toBeNull();
    });

    it('upserts on save (no duplicate)', async () => {
      await nodeRepo.save(new Node({ id: 'c1', name: 'V1', type: 'component' }));
      await nodeRepo.save(new Node({ id: 'c1', name: 'V2', type: 'component' }));
      const all = await nodeRepo.findAll();
      expect(all).toHaveLength(1);
      expect(all[0].name).toBe('V2');
    });
  });

  describe('DrizzleEdgeRepository', () => {
    beforeEach(async () => {
      await nodeRepo.save(new Node({ id: 'a', name: 'A', type: 'layer' }));
      await nodeRepo.save(new Node({ id: 'b', name: 'B', type: 'component' }));
    });

    it('saves and retrieves edges by source', async () => {
      await edgeRepo.save(new Edge({ source_id: 'a', target_id: 'b', type: 'CONTAINS' }));
      const found = await edgeRepo.findBySource('a');
      expect(found).toHaveLength(1);
    });

    it('retrieves edges by target', async () => {
      await edgeRepo.save(new Edge({ source_id: 'a', target_id: 'b', type: 'CONTAINS' }));
      const found = await edgeRepo.findByTarget('b');
      expect(found).toHaveLength(1);
    });

    it('finds relationships excluding CONTAINS', async () => {
      await edgeRepo.save(new Edge({ source_id: 'a', target_id: 'b', type: 'CONTAINS' }));
      await edgeRepo.save(new Edge({ source_id: 'a', target_id: 'b', type: 'CONTROLS' }));
      const rels = await edgeRepo.findRelationships();
      expect(rels).toHaveLength(1);
      expect(rels[0].type).toBe('CONTROLS');
    });

    it('deletes an edge by id', async () => {
      await edgeRepo.save(new Edge({ source_id: 'a', target_id: 'b', type: 'CONTROLS' }));
      const all = await edgeRepo.findAll();
      expect(all).toHaveLength(1);
      await edgeRepo.delete(all[0].id!);
      expect(await edgeRepo.findAll()).toHaveLength(0);
    });

    it('finds edges by type', async () => {
      await edgeRepo.save(new Edge({ source_id: 'a', target_id: 'b', type: 'CONTAINS' }));
      await edgeRepo.save(new Edge({ source_id: 'a', target_id: 'b', type: 'CONTROLS' }));
      const contains = await edgeRepo.findByType('CONTAINS');
      expect(contains).toHaveLength(1);
      expect(contains[0].type).toBe('CONTAINS');
    });
  });

  describe('DrizzleVersionRepository', () => {
    beforeEach(async () => {
      await nodeRepo.save(new Node({ id: 'comp-1', name: 'Comp', type: 'component' }));
    });

    it('saves and retrieves versions by node', async () => {
      await versionRepo.save(new Version({ node_id: 'comp-1', version: 'mvp', content: 'MVP' }));
      const found = await versionRepo.findByNode('comp-1');
      expect(found).toHaveLength(1);
      expect(found[0].content).toBe('MVP');
    });

    it('finds by node and version', async () => {
      await versionRepo.save(new Version({ node_id: 'comp-1', version: 'mvp', content: 'MVP' }));
      const found = await versionRepo.findByNodeAndVersion('comp-1', 'mvp');
      expect(found).not.toBeNull();
      expect(found?.content).toBe('MVP');
    });

    it('returns null for missing version', async () => {
      const found = await versionRepo.findByNodeAndVersion('comp-1', 'v99');
      expect(found).toBeNull();
    });

    it('deletes versions by node', async () => {
      await versionRepo.save(new Version({ node_id: 'comp-1', version: 'mvp' }));
      await versionRepo.save(new Version({ node_id: 'comp-1', version: 'v1' }));
      await versionRepo.deleteByNode('comp-1');
      expect(await versionRepo.findByNode('comp-1')).toHaveLength(0);
    });

    it('retrieves all versions', async () => {
      await versionRepo.save(new Version({ node_id: 'comp-1', version: 'mvp', content: 'A' }));
      await versionRepo.save(new Version({ node_id: 'comp-1', version: 'v1', content: 'B' }));
      const all = await versionRepo.findAll();
      expect(all).toHaveLength(2);
    });

    it('upserts on save (updates existing)', async () => {
      await versionRepo.save(
        new Version({ node_id: 'comp-1', version: 'mvp', content: 'Old', progress: 10 })
      );
      await versionRepo.save(
        new Version({ node_id: 'comp-1', version: 'mvp', content: 'New', progress: 50 })
      );
      const found = await versionRepo.findByNodeAndVersion('comp-1', 'mvp');
      expect(found?.content).toBe('New');
      expect(found?.progress).toBe(50);
    });
  });

  describe('DrizzleFeatureRepository', () => {
    beforeEach(async () => {
      await nodeRepo.save(new Node({ id: 'comp-1', name: 'Comp', type: 'component' }));
    });

    it('saves and retrieves features by node', async () => {
      await featureRepo.save(
        new Feature({ node_id: 'comp-1', version: 'mvp', filename: 'test.feature', title: 'Test' })
      );
      const found = await featureRepo.findByNode('comp-1');
      expect(found).toHaveLength(1);
    });

    it('finds by node and version', async () => {
      await featureRepo.save(
        new Feature({ node_id: 'comp-1', version: 'mvp', filename: 'a.feature', title: 'A' })
      );
      await featureRepo.save(
        new Feature({ node_id: 'comp-1', version: 'v1', filename: 'b.feature', title: 'B' })
      );
      const found = await featureRepo.findByNodeAndVersion('comp-1', 'mvp');
      expect(found).toHaveLength(1);
    });

    it('deletes all features', async () => {
      await featureRepo.save(
        new Feature({ node_id: 'comp-1', version: 'mvp', filename: 'a.feature', title: 'A' })
      );
      await featureRepo.deleteAll();
      expect(await featureRepo.findAll()).toHaveLength(0);
    });

    it('deletes features by node', async () => {
      await featureRepo.save(
        new Feature({ node_id: 'comp-1', version: 'mvp', filename: 'a.feature', title: 'A' })
      );
      await featureRepo.deleteByNode('comp-1');
      expect(await featureRepo.findByNode('comp-1')).toHaveLength(0);
    });

    it('deletes a feature by node and filename', async () => {
      await featureRepo.save(
        new Feature({ node_id: 'comp-1', version: 'mvp', filename: 'a.feature', title: 'A' })
      );
      await featureRepo.save(
        new Feature({ node_id: 'comp-1', version: 'v1', filename: 'b.feature', title: 'B' })
      );
      const deleted = await featureRepo.deleteByNodeAndFilename('comp-1', 'a.feature');
      expect(deleted).toBe(true);
      expect(await featureRepo.findByNode('comp-1')).toHaveLength(1);
    });

    it('returns false when deleting nonexistent feature by node and filename', async () => {
      const deleted = await featureRepo.deleteByNodeAndFilename('comp-1', 'nope.feature');
      expect(deleted).toBe(false);
    });

    it('searches features by content', async () => {
      await featureRepo.save(
        new Feature({
          node_id: 'comp-1',
          version: 'v1',
          filename: 'auth.feature',
          title: 'Auth',
          content: 'Feature: Auth\n  Scenario: S\n    Given authentication works',
        })
      );
      await nodeRepo.save(new Node({ id: 'comp-2', name: 'C2', type: 'component' }));
      await featureRepo.save(
        new Feature({
          node_id: 'comp-2',
          version: 'mvp',
          filename: 'other.feature',
          title: 'Other',
          content: 'Feature: Other\n  Scenario: S\n    Given something else',
        })
      );
      const results = await featureRepo.search('authentication');
      expect(results).toHaveLength(1);
      expect(results[0].node_id).toBe('comp-1');
    });

    it('searches features filtered by version', async () => {
      await featureRepo.save(
        new Feature({
          node_id: 'comp-1',
          version: 'v1',
          filename: 'a.feature',
          title: 'A',
          content: 'Feature: A\n  Scenario: S\n    Given searchable setup',
        })
      );
      await featureRepo.save(
        new Feature({
          node_id: 'comp-1',
          version: 'mvp',
          filename: 'b.feature',
          title: 'B',
          content: 'Feature: B\n  Scenario: S\n    Given searchable setup',
        })
      );
      const results = await featureRepo.search('searchable', 'v1');
      expect(results).toHaveLength(1);
      expect(results[0].version).toBe('v1');
    });

    it('escapes LIKE wildcards in search query', async () => {
      await featureRepo.save(
        new Feature({
          node_id: 'comp-1',
          version: 'v1',
          filename: 'wild.feature',
          title: 'Wild',
          content: 'Feature: Wild\n  Scenario: S\n    Given 100% coverage',
        })
      );
      const withWildcard = await featureRepo.search('100%');
      expect(withWildcard).toHaveLength(1);
      const noMatch = await featureRepo.search('100_');
      expect(noMatch).toHaveLength(0);
    });

    it('respects limit parameter in search', async () => {
      for (let i = 0; i < 5; i++) {
        await featureRepo.save(
          new Feature({
            node_id: 'comp-1',
            version: 'v1',
            filename: `f${i}.feature`,
            title: `F${i}`,
            content: `Feature: F${i}\n  Scenario: S\n    Given repeated keyword`,
          })
        );
      }
      const limited = await featureRepo.search('repeated', undefined, 3);
      expect(limited).toHaveLength(3);
      const all = await featureRepo.search('repeated');
      expect(all).toHaveLength(5);
    });

    it('retrieves all features across nodes', async () => {
      await nodeRepo.save(new Node({ id: 'comp-2', name: 'C2', type: 'component' }));
      await featureRepo.save(
        new Feature({ node_id: 'comp-1', version: 'mvp', filename: 'a.feature', title: 'A' })
      );
      await featureRepo.save(
        new Feature({ node_id: 'comp-2', version: 'mvp', filename: 'b.feature', title: 'B' })
      );
      const all = await featureRepo.findAll();
      expect(all).toHaveLength(2);
    });
  });

  describe('Progress preservation through upsert', () => {
    beforeEach(async () => {
      await nodeRepo.save(new Node({ id: 'comp-1', name: 'Comp', type: 'component' }));
    });

    it('preserves progress when content is upserted', async () => {
      await versionRepo.save(
        new Version({
          node_id: 'comp-1',
          version: 'mvp',
          content: 'Old',
          progress: 75,
          status: 'in-progress',
        })
      );

      // Simulate seed upsert: update content, preserve progress
      db.insert(nodeVersionsTable)
        .values({
          node_id: 'comp-1',
          version: 'mvp',
          content: 'New',
          progress: 0,
          status: 'planned',
        })
        .onConflictDoUpdate({
          target: [nodeVersionsTable.node_id, nodeVersionsTable.version],
          set: { content: sql`excluded.content`, updated_at: sql`datetime('now')` },
        })
        .run();

      const found = await versionRepo.findByNodeAndVersion('comp-1', 'mvp');
      expect(found?.content).toBe('New');
      expect(found?.progress).toBe(75);
      expect(found?.status).toBe('in-progress');
    });

    it('preserves 100% complete through upsert', async () => {
      await versionRepo.save(
        new Version({
          node_id: 'comp-1',
          version: 'mvp',
          content: 'Old',
          progress: 100,
          status: 'complete',
        })
      );

      db.insert(nodeVersionsTable)
        .values({
          node_id: 'comp-1',
          version: 'mvp',
          content: 'Refreshed',
          progress: 0,
          status: 'planned',
        })
        .onConflictDoUpdate({
          target: [nodeVersionsTable.node_id, nodeVersionsTable.version],
          set: { content: sql`excluded.content`, updated_at: sql`datetime('now')` },
        })
        .run();

      const found = await versionRepo.findByNodeAndVersion('comp-1', 'mvp');
      expect(found?.content).toBe('Refreshed');
      expect(found?.progress).toBe(100);
      expect(found?.status).toBe('complete');
    });
  });
});

describe('Schema migration — mcp node type', () => {
  it('migrates old nodes table to include mcp in CHECK constraint', async () => {
    // 1. Create a DB with the OLD schema (no 'mcp')
    const Database = (await import('better-sqlite3')).default;
    const sqlite = new Database(':memory:');
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    sqlite.exec(`CREATE TABLE nodes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('layer', 'component', 'store', 'external', 'phase', 'app')),
      layer TEXT, color TEXT, icon TEXT, description TEXT, tags TEXT,
      sort_order INTEGER DEFAULT 0, current_version TEXT
    )`);
    // Insert test data
    sqlite.exec(`INSERT INTO nodes (id, name, type) VALUES ('old-app', 'Old App', 'app')`);

    // 2. Apply schema (should detect old constraint and migrate)
    const { drizzle } = await import('drizzle-orm/better-sqlite3');
    const { applySchema } = await import('../../../../src/infrastructure/drizzle/connection.js');
    const db = drizzle(sqlite);
    applySchema(db);

    // 3. Verify migration: can insert 'mcp' type
    sqlite.exec(`INSERT INTO nodes (id, name, type) VALUES ('mcp-test', 'MCP', 'mcp')`);
    const row = sqlite.prepare(`SELECT type FROM nodes WHERE id = 'mcp-test'`).get() as {
      type: string;
    };
    expect(row.type).toBe('mcp');

    // 4. Verify old data preserved
    const oldRow = sqlite.prepare(`SELECT type FROM nodes WHERE id = 'old-app'`).get() as {
      type: string;
    };
    expect(oldRow.type).toBe('app');
  });

  it('skips migration when mcp constraint already exists', () => {
    // Fresh DB via createDrizzleConnection already has mcp
    const freshDb = createDrizzleConnection(':memory:');
    // Should be able to insert mcp directly
    freshDb.run(sql`INSERT INTO nodes (id, name, type) VALUES ('mcp-fresh', 'MCP Fresh', 'mcp')`);
    const rows = freshDb.all<{ type: string }>(sql`SELECT type FROM nodes WHERE id = 'mcp-fresh'`);
    expect(rows[0]?.type).toBe('mcp');
  });
});
