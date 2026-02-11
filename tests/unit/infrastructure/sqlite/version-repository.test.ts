import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Node } from '@domain/entities/node.js';
import { Version } from '@domain/entities/version.js';
import { SqliteNodeRepository } from '@infrastructure/sqlite/node-repository.js';
import { SqliteVersionRepository } from '@infrastructure/sqlite/version-repository.js';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('SqliteVersionRepository', () => {
  let db: Database.Database;
  let versionRepo: SqliteVersionRepository;
  let nodeRepo: SqliteNodeRepository;

  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    const schema = readFileSync(join(process.cwd(), 'schema.sql'), 'utf-8');
    db.exec(schema);
    versionRepo = new SqliteVersionRepository(db);
    nodeRepo = new SqliteNodeRepository(db);

    await nodeRepo.save(new Node({ id: 'comp-1', name: 'Comp', type: 'component' }));
  });

  afterEach(() => {
    db.close();
  });

  it('saves and retrieves a version', async () => {
    const ver = new Version({
      node_id: 'comp-1',
      version: 'mvp',
      content: 'MVP specification',
      progress: 25,
      status: 'in-progress',
    });
    await versionRepo.save(ver);

    const all = await versionRepo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].node_id).toBe('comp-1');
    expect(all[0].content).toBe('MVP specification');
    expect(all[0].progress).toBe(25);
  });

  it('finds versions by node', async () => {
    await versionRepo.save(new Version({ node_id: 'comp-1', version: 'overview', content: 'OV' }));
    await versionRepo.save(new Version({ node_id: 'comp-1', version: 'mvp', content: 'MVP' }));

    const versions = await versionRepo.findByNode('comp-1');
    expect(versions).toHaveLength(2);
  });

  it('finds a specific version by node and version tag', async () => {
    await versionRepo.save(new Version({ node_id: 'comp-1', version: 'mvp', content: 'MVP' }));

    const found = await versionRepo.findByNodeAndVersion('comp-1', 'mvp');
    expect(found).not.toBeNull();
    expect(found?.content).toBe('MVP');
  });

  it('returns null for missing node+version combination', async () => {
    const found = await versionRepo.findByNodeAndVersion('comp-1', 'v2');
    expect(found).toBeNull();
  });

  it('updates progress and status', async () => {
    await versionRepo.save(
      new Version({ node_id: 'comp-1', version: 'mvp', progress: 0, status: 'planned' })
    );

    await versionRepo.updateProgress('comp-1', 'mvp', 75, 'in-progress');

    const updated = await versionRepo.findByNodeAndVersion('comp-1', 'mvp');
    expect(updated?.progress).toBe(75);
    expect(updated?.status).toBe('in-progress');
  });

  it('sets updated_at on save', async () => {
    await versionRepo.save(new Version({ node_id: 'comp-1', version: 'mvp' }));

    const found = await versionRepo.findByNodeAndVersion('comp-1', 'mvp');
    expect(found?.updated_at).toBeDefined();
    expect(found?.updated_at).not.toBeNull();
  });

  it('deletes versions by node', async () => {
    await versionRepo.save(new Version({ node_id: 'comp-1', version: 'overview' }));
    await versionRepo.save(new Version({ node_id: 'comp-1', version: 'mvp' }));

    await versionRepo.deleteByNode('comp-1');

    const remaining = await versionRepo.findByNode('comp-1');
    expect(remaining).toHaveLength(0);
  });
});
