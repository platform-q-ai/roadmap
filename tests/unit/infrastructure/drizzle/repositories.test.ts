import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';

import { Node } from '@domain/entities/node.js';
import { Edge } from '@domain/entities/edge.js';
import { Version } from '@domain/entities/version.js';
import { Feature } from '@domain/entities/feature.js';

import { createDrizzleConnection } from '@infrastructure/drizzle/connection.js';
import { nodeVersionsTable } from '@infrastructure/drizzle/schema.js';
import { DrizzleNodeRepository } from '@infrastructure/drizzle/node-repository.js';
import { DrizzleEdgeRepository } from '@infrastructure/drizzle/edge-repository.js';
import { DrizzleVersionRepository } from '@infrastructure/drizzle/version-repository.js';
import { DrizzleFeatureRepository } from '@infrastructure/drizzle/feature-repository.js';

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

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

    it('updates progress and status', async () => {
      await versionRepo.save(
        new Version({ node_id: 'comp-1', version: 'mvp', progress: 0, status: 'planned' })
      );
      await versionRepo.updateProgress('comp-1', 'mvp', 75, 'in-progress');
      const found = await versionRepo.findByNodeAndVersion('comp-1', 'mvp');
      expect(found?.progress).toBe(75);
      expect(found?.status).toBe('in-progress');
    });

    it('deletes versions by node', async () => {
      await versionRepo.save(new Version({ node_id: 'comp-1', version: 'mvp' }));
      await versionRepo.save(new Version({ node_id: 'comp-1', version: 'v1' }));
      await versionRepo.deleteByNode('comp-1');
      expect(await versionRepo.findByNode('comp-1')).toHaveLength(0);
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
          progress: 0,
          status: 'planned',
        })
      );
      await versionRepo.updateProgress('comp-1', 'mvp', 75, 'in-progress');

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
