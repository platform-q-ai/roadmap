import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Feature } from '@domain/entities/feature.js';
import { Node } from '@domain/entities/node.js';
import { SqliteFeatureRepository } from '@infrastructure/sqlite/feature-repository.js';
import { SqliteNodeRepository } from '@infrastructure/sqlite/node-repository.js';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('SqliteFeatureRepository', () => {
  let db: Database.Database;
  let featureRepo: SqliteFeatureRepository;
  let nodeRepo: SqliteNodeRepository;

  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    const schema = readFileSync(join(process.cwd(), 'schema.sql'), 'utf-8');
    db.exec(schema);
    featureRepo = new SqliteFeatureRepository(db);
    nodeRepo = new SqliteNodeRepository(db);

    await nodeRepo.save(new Node({ id: 'comp-1', name: 'Comp', type: 'component' }));
    await nodeRepo.save(new Node({ id: 'comp-2', name: 'Comp2', type: 'component' }));
  });

  afterEach(() => {
    db.close();
  });

  it('saves and retrieves a feature', async () => {
    const feat = new Feature({
      node_id: 'comp-1',
      version: 'mvp',
      filename: 'mvp-test.feature',
      title: 'Test Feature',
      content: 'Feature: Test Feature',
    });
    await featureRepo.save(feat);

    const all = await featureRepo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].node_id).toBe('comp-1');
    expect(all[0].filename).toBe('mvp-test.feature');
    expect(all[0].title).toBe('Test Feature');
  });

  it('finds features by node', async () => {
    await featureRepo.save(
      new Feature({ node_id: 'comp-1', version: 'mvp', filename: 'a.feature', title: 'A' })
    );
    await featureRepo.save(
      new Feature({ node_id: 'comp-1', version: 'v1', filename: 'b.feature', title: 'B' })
    );
    await featureRepo.save(
      new Feature({ node_id: 'comp-2', version: 'mvp', filename: 'c.feature', title: 'C' })
    );

    const comp1Features = await featureRepo.findByNode('comp-1');
    expect(comp1Features).toHaveLength(2);
  });

  it('finds features by node and version', async () => {
    await featureRepo.save(
      new Feature({ node_id: 'comp-1', version: 'mvp', filename: 'a.feature', title: 'A' })
    );
    await featureRepo.save(
      new Feature({ node_id: 'comp-1', version: 'v1', filename: 'b.feature', title: 'B' })
    );

    const mvpFeatures = await featureRepo.findByNodeAndVersion('comp-1', 'mvp');
    expect(mvpFeatures).toHaveLength(1);
    expect(mvpFeatures[0].filename).toBe('a.feature');
  });

  it('deletes all features', async () => {
    await featureRepo.save(
      new Feature({ node_id: 'comp-1', version: 'mvp', filename: 'a.feature', title: 'A' })
    );
    await featureRepo.save(
      new Feature({ node_id: 'comp-2', version: 'mvp', filename: 'b.feature', title: 'B' })
    );

    await featureRepo.deleteAll();

    const all = await featureRepo.findAll();
    expect(all).toHaveLength(0);
  });

  it('deletes a single feature by node and filename', async () => {
    await featureRepo.save(
      new Feature({ node_id: 'comp-1', version: 'mvp', filename: 'a.feature', title: 'A' })
    );
    await featureRepo.save(
      new Feature({ node_id: 'comp-1', version: 'v1', filename: 'b.feature', title: 'B' })
    );

    const deleted = await featureRepo.deleteByNodeAndFilename('comp-1', 'a.feature');
    expect(deleted).toBe(true);

    const remaining = await featureRepo.findByNode('comp-1');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].filename).toBe('b.feature');
  });

  it('returns false when deleting nonexistent feature by node and filename', async () => {
    const deleted = await featureRepo.deleteByNodeAndFilename('comp-1', 'ghost.feature');
    expect(deleted).toBe(false);
  });

  it('deletes features by node', async () => {
    await featureRepo.save(
      new Feature({ node_id: 'comp-1', version: 'mvp', filename: 'a.feature', title: 'A' })
    );
    await featureRepo.save(
      new Feature({ node_id: 'comp-2', version: 'mvp', filename: 'b.feature', title: 'B' })
    );

    await featureRepo.deleteByNode('comp-1');

    const comp1 = await featureRepo.findByNode('comp-1');
    const comp2 = await featureRepo.findByNode('comp-2');
    expect(comp1).toHaveLength(0);
    expect(comp2).toHaveLength(1);
  });
});
