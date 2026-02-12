import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Feature } from '@domain/entities/feature.js';
import { Node } from '@domain/entities/node.js';
import { SqliteFeatureRepository } from '@infrastructure/sqlite/feature-repository.js';
import { SqliteNodeRepository } from '@infrastructure/sqlite/node-repository.js';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('SqliteFeatureRepository — step_count', () => {
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
  });

  afterEach(() => {
    db.close();
  });

  it('persists step_count when saving a feature', async () => {
    const feat = new Feature({
      node_id: 'comp-1',
      version: 'v1',
      filename: 'v1-auth.feature',
      title: 'Auth',
      step_count: 12,
    });
    await featureRepo.save(feat);

    const features = await featureRepo.findByNodeAndVersion('comp-1', 'v1');
    expect(features).toHaveLength(1);
    expect(features[0].step_count).toBe(12);
  });

  it('defaults step_count to 0 when not provided', async () => {
    const feat = new Feature({
      node_id: 'comp-1',
      version: 'v1',
      filename: 'v1-test.feature',
      title: 'Test',
    });
    await featureRepo.save(feat);

    const features = await featureRepo.findByNodeAndVersion('comp-1', 'v1');
    expect(features).toHaveLength(1);
    expect(features[0].step_count).toBe(0);
  });

  it('retrieves step_count correctly across multiple features', async () => {
    await featureRepo.save(
      new Feature({
        node_id: 'comp-1',
        version: 'v1',
        filename: 'v1-a.feature',
        title: 'A',
        step_count: 10,
      })
    );
    await featureRepo.save(
      new Feature({
        node_id: 'comp-1',
        version: 'v1',
        filename: 'v1-b.feature',
        title: 'B',
        step_count: 15,
      })
    );

    const features = await featureRepo.findByNodeAndVersion('comp-1', 'v1');
    expect(features).toHaveLength(2);

    const totalSteps = features.reduce((sum, f) => sum + f.step_count, 0);
    expect(totalSteps).toBe(25);
  });
});
